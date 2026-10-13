import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

export const DATA_DIR = fileURLToPath(new URL('../../../data/', import.meta.url));
export const KEYS_FILE = `${DATA_DIR}testnet-keys.json`;
export const PG_DIR = `${DATA_DIR}pg`;

export const RPC_URL = process.env.SOROBAN_RPC_URL ?? 'https://soroban-testnet.stellar.org';
export const HORIZON_URL = process.env.HORIZON_URL ?? 'https://horizon-testnet.stellar.org';

/**
 * Demo clock: how many on-chain seconds one calendar day lasts. With 60, a stay
 * three days ahead checks in on-chain three minutes after booking, so the whole
 * escrow lifecycle fits in a demo. Set DEMO_DAY_SECS=86400 for real time.
 */
export const DAY_SECS = Number(process.env.DEMO_DAY_SECS ?? 60);

/** Platform fee charged to the guest on top of the stay (Airbnb charges hosts ~15.5 %). */
export const FEE_RATE = process.env.FEE_RATE ?? '0.03';

/** Days after check-out in which guest or host can open a dispute. */
export const CLAIM_DAYS = 2;

/** Testnet-only keys written by the seed. Never real funds. */
export interface TestnetKeys {
  contractId: string;
  token: string; // SAC of the settlement asset
  asset: { code: string; issuer: string };
  arbiter: string; // secret: platform admin, arbiter of disputes
  platform: string; // secret: fee wallet; also settles defaults
  /** Demo signers for hosts and guests, keyed by address. The real path signs in the MicoPay app. */
  users: Record<string, string>;
}

export function loadKeys(): TestnetKeys {
  if (!existsSync(KEYS_FILE)) throw new Error('No testnet keys. Run first: npm run seed -w apps/api');
  return JSON.parse(readFileSync(KEYS_FILE, 'utf8')) as TestnetKeys;
}

export function saveKeys(keys: TestnetKeys): void {
  mkdirSync(DATA_DIR, { recursive: true });
  writeFileSync(KEYS_FILE, JSON.stringify(keys, null, 2));
}
