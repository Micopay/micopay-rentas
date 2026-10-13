export interface Config {
  contractId: string; contractExplorer: string; asset: { code: string; issuer: string };
  daySecs: number; feeRate: string; fx: { rate: string; source: string } | null; arbiter: string; platform: string;
  policies: Record<Policy, { label: string; tiers: Array<{ days: number; refundPct: number }> }>;
}
export type Policy = 'flexible' | 'moderate' | 'strict';
export interface User { id: number; name: string; role: 'host' | 'guest'; stellar_address: string; bio: string | null; balance: string | null }
export interface Listing {
  id: number; host_id: number; slug: string; title: string; area: string; summary: string; description: string;
  nightly_mxn: string; cleaning_mxn: string; deposit_mxn: string; max_guests: number; bedrooms: number; policy: Policy;
  amenities: string[]; cover: number; host_name: string; host_bio?: string; host_address?: string;
  booked?: Array<{ check_in: string; check_out: string }>;
}
export interface Quote {
  nights: number; nightly: string; stay: string; cleaning: string; subtotal: string; fee: string; deposit: string; total: string; feeRate: string;
  available: boolean; fx: { rate: string };
}
export type Status = 'locked' | 'disputed' | 'released' | 'cancelled' | 'resolved';
export interface Booking {
  id: number; reference: string; listing_id: number; title: string; slug: string; area: string; cover: number;
  check_in: string; check_out: string; nights: number; guests: number;
  nightly_mxn: string; cleaning_mxn: string; subtotal_mxn: string; fee_mxn: string; deposit_mxn: string; total_mxn: string;
  fx_rate: string; amount_token: string; fee_token: string; deposit_token: string; policy: Policy;
  tiers: Array<{ min_secs_before: number; refund_bps: number }>; escrow_id: string; chain_check_in: string; chain_deadline: string;
  status: Status; created_at: string; guest_id: number; guest_name: string; guest_address: string; host_id: number; host_name: string; host_address: string;
}
export interface ChainBooking { amount: string; fee: string; deposit: string; check_in: number; deadline: number; status: string; payer: string; beneficiary: string }
export interface BookingEvent { id: number; kind: string; actor: string; tx_hash: string | null; explorer: string | null; details: Record<string, unknown>; created_at: string }
export interface BookingDetail extends Booking { chain: ChainBooking | null; ledgerTime: number; events: BookingEvent[] }
export interface TxResult { txHash: string; explorer: string; status: Status | null }

async function call<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, body === undefined ? undefined : {
    method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error((data as { error?: string }).error ?? `Error ${res.status}`);
  return data as T;
}

const qs = (o: Record<string, string | number | undefined>) => {
  const p = Object.entries(o).filter(([, v]) => v !== undefined && v !== '');
  return p.length ? `?${p.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}` : '';
};

export const api = {
  config: () => call<Config>('/config'),
  users: () => call<User[]>('/users'),
  listings: () => call<Listing[]>('/listings'),
  listing: (slug: string) => call<Listing>(`/listings/${slug}`),
  quote: (listingId: number, checkIn: string, checkOut: string) => call<Quote>(`/quote${qs({ listingId, checkIn, checkOut })}`),
  book: (b: { listingId: number; guestId: number; checkIn: string; checkOut: string; guests: number }) =>
    call<{ id: number; reference: string; txHash: string; explorer: string }>('/bookings', b),
  bookings: (f: { guestId?: number; hostId?: number; status?: string }) => call<Booking[]>(`/bookings${qs(f)}`),
  booking: (id: number) => call<BookingDetail>(`/bookings/${id}`),
  act: (id: number, action: string, body: object = {}) => call<TxResult>(`/bookings/${id}/${action}`, body),
};
