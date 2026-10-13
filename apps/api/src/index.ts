import Fastify from 'fastify';
import cors from '@fastify/cors';
import { Horizon, Keypair } from '@stellar/stellar-sdk';
import { act, BookingError, createBooking, EscrowError, isAvailable } from './bookings.js';
import { DAY_SECS, FEE_RATE, HORIZON_URL, loadKeys, PG_DIR } from './config.js';
import { openDb } from './db.js';
import { explorerContract, explorerTx, getBooking, ledgerTime } from './escrow.js';
import { usdcMxnRate } from './fx.js';
import { nightsBetween, POLICIES, quote } from './quote.js';

const db = await openDb(PG_DIR);
const app = Fastify({ logger: false });
await app.register(cors);
const horizon = new Horizon.Server(HORIZON_URL);

app.setErrorHandler((err, _req, reply) => {
  const known = err instanceof BookingError || err instanceof EscrowError;
  if (!known) console.error(err);
  reply.status(known ? 400 : 500).send({ error: err.message });
});

async function usdcBalance(address: string): Promise<string | null> {
  try {
    const keys = loadKeys();
    const acc = await horizon.loadAccount(address);
    const line = acc.balances.find((b) => 'asset_code' in b && b.asset_code === keys.asset.code && 'asset_issuer' in b && b.asset_issuer === keys.asset.issuer);
    return line ? line.balance : null;
  } catch {
    return null;
  }
}

app.get('/api/config', async () => {
  const keys = loadKeys();
  const fx = await usdcMxnRate().catch(() => null);
  return {
    contractId: keys.contractId, contractExplorer: explorerContract(keys.contractId), asset: keys.asset,
    daySecs: DAY_SECS, feeRate: FEE_RATE, fx, policies: POLICIES,
    arbiter: Keypair.fromSecret(keys.arbiter).publicKey(), platform: Keypair.fromSecret(keys.platform).publicKey(),
  };
});

app.get('/api/users', async () => {
  const users = (await db.query<{ id: number; name: string; role: string; stellar_address: string }>(`SELECT id, name, role, stellar_address, bio FROM users ORDER BY id`)).rows;
  return Promise.all(users.map(async (u) => ({ ...u, balance: await usdcBalance(u.stellar_address) })));
});

app.get('/api/listings', async () =>
  (await db.query(`SELECT l.*, u.name AS host_name FROM listings l JOIN users u ON u.id = l.host_id ORDER BY l.id`)).rows);

app.get<{ Params: { slug: string } }>('/api/listings/:slug', async (req, reply) => {
  const l = (await db.query(`SELECT l.*, u.name AS host_name, u.bio AS host_bio, u.stellar_address AS host_address FROM listings l JOIN users u ON u.id = l.host_id WHERE l.slug = $1`, [req.params.slug])).rows[0];
  if (!l) return reply.status(404).send({ error: 'Listing not found' });
  const booked = (await db.query(`SELECT check_in::text, check_out::text FROM bookings WHERE listing_id = $1 AND status IN ('locked','disputed','released','resolved') ORDER BY check_in`, [(l as { id: number }).id])).rows;
  return { ...l, booked };
});

app.get<{ Querystring: { listingId: string; checkIn: string; checkOut: string } }>('/api/quote', async (req) => {
  const l = (await db.query<{ id: number; nightly_mxn: string; cleaning_mxn: string; deposit_mxn: string }>(`SELECT * FROM listings WHERE id = $1`, [Number(req.query.listingId)])).rows[0];
  if (!l) throw new BookingError('Listing not found');
  const nights = nightsBetween(req.query.checkIn, req.query.checkOut);
  if (!(nights >= 1 && nights <= 30)) throw new BookingError('A stay is 1 to 30 nights');
  const fx = await usdcMxnRate();
  return { ...quote(l, nights), available: await isAvailable(db, l.id, req.query.checkIn, req.query.checkOut), fx };
});

app.post<{ Body: { listingId: number; guestId: number; checkIn: string; checkOut: string; guests: number } }>('/api/bookings', async (req) => createBooking(db, req.body));

const BOOKING_SQL = `
  SELECT b.*, b.check_in::text AS check_in, b.check_out::text AS check_out, l.title, l.slug, l.area, l.cover,
         g.name AS guest_name, g.stellar_address AS guest_address, h.name AS host_name, h.stellar_address AS host_address, h.id AS host_id
    FROM bookings b JOIN listings l ON l.id = b.listing_id JOIN users g ON g.id = b.guest_id JOIN users h ON h.id = l.host_id`;

app.get<{ Querystring: { guestId?: string; hostId?: string; status?: string } }>('/api/bookings', async (req) => {
  const where: string[] = [], args: unknown[] = [];
  if (req.query.guestId) { args.push(Number(req.query.guestId)); where.push(`b.guest_id = $${args.length}`); }
  if (req.query.hostId) { args.push(Number(req.query.hostId)); where.push(`h.id = $${args.length}`); }
  if (req.query.status) { args.push(req.query.status); where.push(`b.status = $${args.length}`); }
  return (await db.query(`${BOOKING_SQL} ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY b.id DESC`, args)).rows;
});

app.get<{ Params: { id: string } }>('/api/bookings/:id', async (req, reply) => {
  const b = (await db.query<{ id: number; escrow_id: string }>(`${BOOKING_SQL} WHERE b.id = $1`, [Number(req.params.id)])).rows[0];
  if (!b) return reply.status(404).send({ error: 'Booking not found' });
  const keys = loadKeys();
  const [chain, now, events] = await Promise.all([
    getBooking(keys.contractId, Keypair.fromSecret(keys.platform).publicKey(), b.escrow_id).catch(() => null),
    ledgerTime().catch(() => Math.floor(Date.now() / 1000)),
    db.query<{ tx_hash: string | null }>(`SELECT * FROM booking_events WHERE booking_id = $1 ORDER BY id`, [b.id]),
  ]);
  return { ...b, chain, ledgerTime: now, events: events.rows.map((e) => ({ ...e, explorer: e.tx_hash ? explorerTx(e.tx_hash) : null })) };
});

for (const action of ['cancel', 'host_cancel', 'release', 'dispute', 'claim_damage', 'resolve', 'settle_default'] as const) {
  app.post<{ Params: { id: string }; Body: { by?: 'guest' | 'arbiter'; split?: { guest: string; host: string; platform: string } } }>(
    `/api/bookings/:id/${action.replace('_', '-')}`, async (req) => act(db, Number(req.params.id), action, req.body ?? {}));
}

const PORT = Number(process.env.PORT ?? 8797);
await app.listen({ port: PORT, host: '127.0.0.1' });
console.log(`MicoPay Rentas API on http://127.0.0.1:${PORT} · demo day = ${DAY_SECS}s`);
for (const sig of ['SIGINT', 'SIGTERM'] as const) process.on(sig, async () => { await app.close(); await db.close(); process.exit(0); });
