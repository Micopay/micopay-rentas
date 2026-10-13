import Big from 'big.js';
import { createHash, randomBytes } from 'node:crypto';
import { Keypair } from '@stellar/stellar-sdk';
import { loadKeys } from './config.js';
import type { Db } from './db.js';
import { EscrowError, explorerTx, getBooking, invoke, sv, toStroops, type ChainBooking } from './escrow.js';
import { usdcMxnRate, toToken } from './fx.js';
import { chainTiers, chainTimes, nightsBetween, quote, type Policy } from './quote.js';

export class BookingError extends Error {}

const ACTIVE = `('locked', 'disputed', 'released', 'resolved')`;

export async function isAvailable(db: Db, listingId: number, checkIn: string, checkOut: string): Promise<boolean> {
  const r = await db.query(
    `SELECT 1 FROM bookings WHERE listing_id = $1 AND status IN ${ACTIVE} AND check_in < $3 AND check_out > $2 LIMIT 1`,
    [listingId, checkIn, checkOut],
  );
  return r.rows.length === 0;
}

async function nextReference(db: Db): Promise<string> {
  const year = new Date().getFullYear();
  const r = await db.query<{ n: number }>(`SELECT COUNT(*)::int + 1 AS n FROM bookings`);
  return `TPZ-${year}-${String(r.rows[0]!.n).padStart(5, '0')}`;
}

async function event(db: Db, bookingId: number, kind: string, actor: string, txHash: string | null, details: object = {}) {
  await db.query(`INSERT INTO booking_events (booking_id, kind, actor, tx_hash, details) VALUES ($1, $2, $3, $4, $5)`,
    [bookingId, kind, actor, txHash, JSON.stringify(details)]);
}

function signerFor(address: string): Keypair {
  const secret = loadKeys().users[address];
  if (!secret) throw new BookingError('No demo key for this account; in production it signs in the MicoPay app');
  return Keypair.fromSecret(secret);
}

/**
 * Quote → escrow. The escrow id is SHA-256 of the booking terms plus a random salt, so the
 * on-chain record points at exactly what was agreed and can't be guessed in advance.
 */
export async function createBooking(db: Db, input: { listingId: number; guestId: number; checkIn: string; checkOut: string; guests: number }) {
  const l = (await db.query<{ id: number; slug: string; nightly_mxn: string; cleaning_mxn: string; deposit_mxn: string; max_guests: number; policy: Policy; host_address: string }>(
    `SELECT l.*, u.stellar_address AS host_address FROM listings l JOIN users u ON u.id = l.host_id WHERE l.id = $1`, [input.listingId],
  )).rows[0];
  if (!l) throw new BookingError('Listing not found');
  const guest = (await db.query<{ id: number; stellar_address: string }>(`SELECT id, stellar_address FROM users WHERE id = $1 AND role = 'guest'`, [input.guestId])).rows[0];
  if (!guest) throw new BookingError('Guest not found');
  const nights = nightsBetween(input.checkIn, input.checkOut);
  if (!(nights >= 1 && nights <= 30)) throw new BookingError('A stay is 1 to 30 nights');
  if (input.guests < 1 || input.guests > l.max_guests) throw new BookingError(`This place takes up to ${l.max_guests} guests`);
  const times = chainTimes(input.checkIn, input.checkOut);
  if (times.checkInSec <= Date.now() / 1000 + 30) throw new BookingError('Check-in must be in the future');
  if (!(await isAvailable(db, l.id, input.checkIn, input.checkOut))) throw new BookingError('Those dates are already booked');

  const q = quote(l, nights);
  const fx = await usdcMxnRate();
  const token = { amount: toToken(q.subtotal, fx.rate), fee: toToken(q.fee, fx.rate), deposit: toToken(q.deposit, fx.rate) };
  const tiers = chainTiers(l.policy);
  const reference = await nextReference(db);
  const terms = JSON.stringify({ reference, listing: l.slug, guest: guest.stellar_address, host: l.host_address, ...input, quote: q, token, fx: fx.rate, salt: randomBytes(16).toString('hex') });
  const escrowId = createHash('sha256').update(terms).digest('hex');

  const keys = loadKeys();
  const res = await invoke(keys.contractId, signerFor(guest.stellar_address), 'lock', [
    sv.bytes32(escrowId), sv.address(guest.stellar_address), sv.address(l.host_address),
    sv.i128(toStroops(token.amount)), sv.i128(toStroops(token.fee)), sv.i128(toStroops(token.deposit)),
    sv.u64(times.checkInSec), sv.u64(times.deadlineSec), sv.tiers(tiers),
  ]);

  const row = (await db.query<{ id: number }>(
    `INSERT INTO bookings (reference, listing_id, guest_id, check_in, check_out, nights, guests, nightly_mxn, cleaning_mxn, subtotal_mxn, fee_mxn,
       deposit_mxn, total_mxn, fx_rate, amount_token, fee_token, deposit_token, policy, tiers, escrow_id, chain_check_in, chain_deadline, status)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21,$22,'locked') RETURNING id`,
    [reference, l.id, guest.id, input.checkIn, input.checkOut, nights, input.guests, q.nightly, q.cleaning, q.subtotal, q.fee, q.deposit, q.total,
      fx.rate, token.amount, token.fee, token.deposit, l.policy, JSON.stringify(tiers), escrowId, times.checkInSec, times.deadlineSec],
  )).rows[0]!;
  await event(db, row.id, 'locked', 'guest', res.hash, { totalToken: new Big(token.amount).plus(token.fee).plus(token.deposit).toFixed(5) });
  return { id: row.id, reference, txHash: res.hash, explorer: explorerTx(res.hash) };
}

type Action = 'cancel' | 'host_cancel' | 'release' | 'dispute' | 'claim_damage' | 'resolve' | 'settle_default';

const ACTOR: Record<Action, 'guest' | 'host' | 'arbiter' | 'anyone'> = {
  cancel: 'guest', host_cancel: 'host', release: 'guest', dispute: 'guest', claim_damage: 'host', resolve: 'arbiter', settle_default: 'anyone',
};

const STATUS: Record<ChainBooking['status'], string> = {
  Locked: 'locked', Disputed: 'disputed', Released: 'released', Cancelled: 'cancelled', Resolved: 'resolved',
};

/** Runs one escrow step. `by` lets the arbiter release instead of the guest. */
export async function act(db: Db, id: number, action: Action, opts: { by?: 'guest' | 'arbiter'; split?: { guest: string; host: string; platform: string } } = {}) {
  const b = (await db.query<{ id: number; escrow_id: string; guest_address: string; host_address: string; fx_rate: string }>(
    `SELECT b.id, b.escrow_id, b.fx_rate, g.stellar_address AS guest_address, h.stellar_address AS host_address
       FROM bookings b JOIN users g ON g.id = b.guest_id JOIN listings l ON l.id = b.listing_id JOIN users h ON h.id = l.host_id WHERE b.id = $1`, [id],
  )).rows[0];
  if (!b) throw new BookingError('Booking not found');
  const keys = loadKeys();
  const arbiter = Keypair.fromSecret(keys.arbiter);
  const actor = action === 'release' && opts.by === 'arbiter' ? 'arbiter' : ACTOR[action];
  const signer = actor === 'guest' ? signerFor(b.guest_address) : actor === 'host' ? signerFor(b.host_address)
    : actor === 'arbiter' ? arbiter : Keypair.fromSecret(keys.platform);

  const args = [sv.bytes32(b.escrow_id)];
  let details: object = {};
  if (action === 'release') args.push(sv.address(signer.publicKey()));
  if (action === 'resolve') {
    if (!opts.split) throw new BookingError('Resolve needs the split');
    const s = { guest: toToken(opts.split.guest, b.fx_rate), host: toToken(opts.split.host, b.fx_rate), platform: toToken(opts.split.platform, b.fx_rate) };
    // MXN amounts convert with rounding; the contract needs the exact locked total, so the
    // host's share absorbs the last stroop.
    const chain = await getBooking(keys.contractId, arbiter.publicKey(), b.escrow_id);
    if (!chain) throw new BookingError('Booking not in escrow');
    const total = toStroops(chain.amount) + toStroops(chain.fee) + toStroops(chain.deposit);
    const g = toStroops(s.guest), p = toStroops(s.platform);
    const h = total - g - p;
    if (h < 0n) throw new BookingError('The split is larger than the escrow');
    args.push(sv.i128(g), sv.i128(h), sv.i128(p));
    details = { split: opts.split };
  }
  const res = await invoke(keys.contractId, signer, action, args);
  const chain = await getBooking(keys.contractId, arbiter.publicKey(), b.escrow_id);
  if (chain) await db.query(`UPDATE bookings SET status = $1 WHERE id = $2`, [STATUS[chain.status], id]);
  await event(db, id, action, actor, res.hash, { ...details, returned: res.value === null ? undefined : String(res.value) });
  return { txHash: res.hash, explorer: explorerTx(res.hash), status: chain ? STATUS[chain.status] : null };
}

export { EscrowError };
