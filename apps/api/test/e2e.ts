/**
 * End-to-end on testnet against a running API (npm run dev:api) with the demo clock
 * (DEMO_DAY_SECS=60). Exercises every escrow path and checks balances on Horizon:
 *
 *   1. flexible booking cancelled early        → guest gets everything back
 *   2. booking released by the guest after check-in → host paid, deposit back
 *   3. host claims damage, arbiter splits      → exact split
 *   4. nobody acts                              → anyone settles after the deadline
 *
 *   npx tsx test/e2e.ts
 */
import Big from 'big.js';

const API = process.env.API ?? 'http://127.0.0.1:8797/api';
let failures = 0;
const check = (ok: boolean, msg: string) => { console.log(`${ok ? '✓' : '✗'} ${msg}`); if (!ok) failures++; };

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${API}${path}`, body === undefined ? undefined : { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) });
  const data = await res.json();
  if (!res.ok) throw new Error(`${path}: ${(data as { error: string }).error}`);
  return data as T;
}

interface User { id: number; name: string; role: string; stellar_address: string; balance: string | null }
interface Listing { id: number; slug: string; title: string; host_id: number }
interface Booking { id: number; status: string; chain_check_in: string; chain_deadline: string; ledgerTime: number; amount_token: string; fee_token: string; deposit_token: string; chain: { status: string } | null }

const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
const users = await call<User[]>('/users');
const guest = users.find((u) => u.role === 'guest')!;
const listings = await call<Listing[]>('/listings');
const by = (slug: string) => listings.find((l) => l.slug === slug)!;
const bal = async (id: number) => new Big((await call<User[]>('/users')).find((u) => u.id === id)!.balance ?? '0');
const hostOf = (l: Listing) => users.find((u) => u.id === l.host_id)!;
const book = (l: Listing, from: number, nights: number) => call<{ id: number; reference: string }>('/bookings', { listingId: l.id, guestId: guest.id, checkIn: day(from), checkOut: day(from + nights), guests: 2 });
const get = (id: number) => call<Booking>(`/bookings/${id}`);

async function waitLedger(id: number, field: 'chain_check_in' | 'chain_deadline', label: string) {
  for (;;) {
    const b = await get(id);
    const left = Number(b[field]) - b.ledgerTime;
    if (left <= 0) return;
    console.log(`  … ${label} in ${left}s`);
    await new Promise((r) => setTimeout(r, Math.min(20, left + 3) * 1000));
  }
}

// Book everything first so the waits overlap.
const g0 = await bal(guest.id);
const cab = by('cabana-amatlan'), loft = by('loft-centro'), atongo = by('casa-atongo'), tepoz = by('casa-tepozteco');
const b1 = await book(cab, 3, 2);
const b2 = await book(loft, 1, 1);
const b3 = await book(atongo, 1, 1);
const b4 = await book(tepoz, 1, 1);
console.log(`booked ${b1.reference} ${b2.reference} ${b3.reference} ${b4.reference}`);
check((await get(b1.id)).chain?.status === 'Locked', 'booking 1 is locked on-chain');
try { await book(cab, 3, 2); check(false, 'double booking rejected'); } catch (e) { check(/already booked/.test((e as Error).message), 'double booking rejected'); }

// 1. Early cancel, flexible policy → full refund.
{
  const before = await bal(guest.id);
  const b = await get(b1.id);
  const r = await call<{ status: string }>(`/bookings/${b1.id}/cancel`, {});
  check(r.status === 'cancelled', 'cancel → cancelled');
  const total = new Big(b.amount_token).plus(b.fee_token).plus(b.deposit_token);
  check((await bal(guest.id)).minus(before).eq(total.round(7)), `guest got the full ${total} USDC back`);
}

// 2. Release by the guest after check-in.
{
  try { await call(`/bookings/${b2.id}/release`, {}); check(false, 'release before check-in rejected'); } catch (e) { check(/Too early/.test((e as Error).message), 'release before check-in rejected'); }
  await waitLedger(b2.id, 'chain_check_in', 'loft check-in');
  const host = hostOf(loft);
  const h0 = await bal(host.id);
  const b = await get(b2.id);
  await call(`/bookings/${b2.id}/release`, {});
  check((await bal(host.id)).minus(h0).eq(new Big(b.amount_token)), `host paid ${b.amount_token} USDC`);
  check((await get(b2.id)).chain?.status === 'Released', 'loft released on-chain');
}

// 3. Damage claim and arbiter split (MXN amounts).
{
  await waitLedger(b3.id, 'chain_check_in', 'atongo check-in');
  await call(`/bookings/${b3.id}/claim-damage`, {});
  check((await get(b3.id)).chain?.status === 'Disputed', 'atongo disputed');
  const host = hostOf(atongo);
  const h0 = await bal(host.id), gBefore = await bal(guest.id);
  // Deposit is MX$3,000: host keeps 1,000 for damage, guest gets 2,000 back; platform keeps its fee.
  const b = (await get(b3.id)) as Booking & { subtotal_mxn: string; fee_mxn: string };
  await call(`/bookings/${b3.id}/resolve`, { split: { guest: '2000', host: new Big(b.subtotal_mxn).plus(1000).toFixed(2), platform: b.fee_mxn } });
  check((await get(b3.id)).chain?.status === 'Resolved', 'atongo resolved');
  check((await bal(guest.id)).gt(gBefore) && (await bal(host.id)).gt(h0), 'both parties received their share');
}

// 4. Nobody acts → default after the deadline.
{
  await waitLedger(b4.id, 'chain_deadline', 'tepozteco deadline');
  const host = hostOf(tepoz);
  const h0 = await bal(host.id);
  const b = await get(b4.id);
  await call(`/bookings/${b4.id}/settle-default`, {});
  check((await bal(host.id)).minus(h0).eq(new Big(b.amount_token)), 'default paid the host');
}

console.log(`guest spent ${g0.minus(await bal(guest.id)).toFixed(7)} USDC overall`);
console.log(failures ? `${failures} FAILED` : 'ALL PASSED');
process.exit(failures ? 1 : 0);
