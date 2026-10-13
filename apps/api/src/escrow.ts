import Big from 'big.js';
import {
  Address, Contract, Keypair, Networks, rpc, scValToNative, TransactionBuilder, nativeToScVal, xdr,
} from '@stellar/stellar-sdk';
import { RPC_URL } from './config.js';

/**
 * Client for contracts/escrow-v2 on Soroban. Every call simulates first (that is where
 * contract errors show up, before anything is signed), then signs and waits for the ledger.
 */
export const server = new rpc.Server(RPC_URL);
export const NETWORK_PASSPHRASE = Networks.TESTNET;
export const explorerTx = (hash: string) => `https://stellar.expert/explorer/testnet/tx/${hash}`;
export const explorerContract = (id: string) => `https://stellar.expert/explorer/testnet/contract/${id}`;

/** Contract errors (contracts/escrow-v2/src/errors.rs) in words a person can act on. */
const ERRORS: Record<number, string> = {
  1: 'The escrow contract is not initialized',
  2: 'The escrow contract is already initialized',
  3: 'This booking is not in the escrow',
  4: 'This booking was already paid into the escrow',
  5: 'Invalid amount',
  6: 'Guest and host must be different accounts',
  7: 'Invalid dates: check-in must be in the future and before check-out',
  8: 'Invalid cancellation policy',
  9: 'This booking is already closed',
  10: 'Only a disputed booking can be resolved',
  11: 'Too early for this step',
  12: 'Too late for this step',
  13: 'This account cannot do that',
  14: 'The split must add up to everything in escrow, and the fee cannot grow',
};

export class EscrowError extends Error {
  constructor(public readonly code: number | null, message: string) {
    super(message);
  }
}

function contractError(text: string): EscrowError {
  const m = /Error\(Contract, #(\d+)\)/.exec(text);
  const code = m ? Number(m[1]) : null;
  return new EscrowError(code, code !== null ? ERRORS[code] ?? `Contract error #${code}` : text.slice(0, 300));
}

/** Token units with 7 decimals (Stellar asset contracts) ↔ i128 stroops. */
export const toStroops = (amount: string) => BigInt(new Big(amount).times(1e7).round(0, Big.roundDown).toFixed(0));
export const fromStroops = (v: bigint | number | string) => new Big(v.toString()).div(1e7).toFixed(7);

export const sv = {
  address: (a: string) => new Address(a).toScVal(),
  i128: (v: bigint) => nativeToScVal(v, { type: 'i128' }),
  u64: (v: number | bigint) => nativeToScVal(BigInt(v), { type: 'u64' }),
  bytes32: (hex: string) => xdr.ScVal.scvBytes(Buffer.from(hex, 'hex')),
  tiers: (tiers: Array<{ min_secs_before: number; refund_bps: number }>) =>
    xdr.ScVal.scvVec(tiers.map((t) => xdr.ScVal.scvMap([
      // Struct fields go in a map sorted by name.
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('min_secs_before'), val: nativeToScVal(BigInt(t.min_secs_before), { type: 'u64' }) }),
      new xdr.ScMapEntry({ key: xdr.ScVal.scvSymbol('refund_bps'), val: nativeToScVal(t.refund_bps, { type: 'u32' }) }),
    ]))),
};

export interface InvokeResult {
  hash: string;
  value: unknown;
}

export async function invoke(contractId: string, signer: Keypair, method: string, args: xdr.ScVal[]): Promise<InvokeResult> {
  const account = await server.getAccount(signer.publicKey());
  const tx = new TransactionBuilder(account, { fee: '1000000', networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(120)
    .build();

  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw contractError(sim.error);
  const prepared = rpc.assembleTransaction(tx, sim).build();
  prepared.sign(signer);

  const sent = await server.sendTransaction(prepared);
  if (sent.status === 'ERROR') throw new EscrowError(null, `Network rejected the transaction (${sent.errorResult?.result().switch().name ?? 'error'})`);
  for (let i = 0; i < 40; i++) {
    await new Promise((r) => setTimeout(r, 1500));
    const got = await server.getTransaction(sent.hash);
    if (got.status === rpc.Api.GetTransactionStatus.SUCCESS) {
      return { hash: sent.hash, value: got.returnValue ? scValToNative(got.returnValue) : null };
    }
    if (got.status === rpc.Api.GetTransactionStatus.FAILED) throw new EscrowError(null, `Transaction failed on the ledger (${sent.hash})`);
  }
  throw new EscrowError(null, `No confirmation for ${sent.hash} yet; check the explorer`);
}

/** Read-only call: simulate and return the value. */
export async function read(contractId: string, source: string, method: string, args: xdr.ScVal[]): Promise<unknown> {
  const account = await server.getAccount(source);
  const tx = new TransactionBuilder(account, { fee: '100', networkPassphrase: NETWORK_PASSPHRASE })
    .addOperation(new Contract(contractId).call(method, ...args))
    .setTimeout(30)
    .build();
  const sim = await server.simulateTransaction(tx);
  if (rpc.Api.isSimulationError(sim)) throw contractError(sim.error);
  return sim.result ? scValToNative(sim.result.retval) : null;
}

export interface ChainBooking {
  payer: string;
  beneficiary: string;
  amount: string;
  fee: string;
  deposit: string;
  check_in: number;
  deadline: number;
  status: 'Locked' | 'Disputed' | 'Released' | 'Cancelled' | 'Resolved';
}

export async function getBooking(contractId: string, source: string, escrowId: string): Promise<ChainBooking | null> {
  try {
    const b = (await read(contractId, source, 'get_booking', [sv.bytes32(escrowId)])) as Record<string, unknown>;
    return {
      payer: b.payer as string,
      beneficiary: b.beneficiary as string,
      amount: fromStroops(b.amount as bigint),
      fee: fromStroops(b.fee as bigint),
      deposit: fromStroops(b.deposit as bigint),
      check_in: Number(b.check_in),
      deadline: Number(b.deadline),
      status: (b.status as string[])[0] as ChainBooking['status'],
    };
  } catch (e) {
    if (e instanceof EscrowError && e.code === 3) return null;
    throw e;
  }
}

/** Latest ledger close time: the contract's clock, which runs a few seconds behind ours. */
export async function ledgerTime(): Promise<number> {
  const res = await fetch(RPC_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'getLatestLedger' }),
  });
  const body = (await res.json()) as { result?: { closeTime?: string } };
  return body.result?.closeTime ? Number(body.result.closeTime) : Math.floor(Date.now() / 1000);
}
