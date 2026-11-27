import { t } from './i18n';

export interface Config {
  contractId: string; contractExplorer: string; asset: { code: string; issuer: string };
  daySecs: number; feeRate: string; stayHoldDays: number; fx: { rate: string; source: string } | null; arbiter: string; platform: string;
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
export type Status = 'locked' | 'stay_paid' | 'disputed' | 'released' | 'cancelled' | 'resolved';
export interface Booking {
  id: number; reference: string; listing_id: number; title: string; slug: string; area: string; cover: number;
  check_in: string; check_out: string; nights: number; guests: number;
  nightly_mxn: string; cleaning_mxn: string; subtotal_mxn: string; fee_mxn: string; deposit_mxn: string; total_mxn: string;
  fx_rate: string; amount_token: string; fee_token: string; deposit_token: string; policy: Policy;
  tiers: Array<{ min_secs_before: number; refund_bps: number }>; escrow_id: string; chain_check_in: string; chain_stay_paid_at: string; chain_deadline: string;
  chain_stay_paid: boolean;
  status: Status; created_at: string; guest_id: number; guest_name: string; guest_address: string; host_id: number; host_name: string; host_address: string;
}
export interface ChainBooking { amount: string; fee: string; deposit: string; check_in: number; stay_paid_at: number; deadline: number; status: string; payer: string; beneficiary: string }
export interface BookingEvent { id: number; kind: string; actor: string; tx_hash: string | null; explorer: string | null; details: Record<string, unknown>; created_at: string }
export interface BookingDetail extends Booking { chain: ChainBooking | null; ledgerTime: number; events: BookingEvent[] }
export interface TxResult { txHash: string; explorer: string; status: Status | null }

/** API messages the UI knows how to say in both languages. Anything else gets a generic local message. */
const KNOWN: Record<string, string> = {
  'Those dates are already booked': 'Esas fechas ya están reservadas',
  'Booking not found': 'Reserva no encontrada',
  'Listing not found': 'Alojamiento no encontrado',
};

/** `message` is safe to show; `raw` is what the API said, for logic only. */
export class ApiError extends Error {
  constructor(readonly raw: string, readonly status: number) {
    super(t(KNOWN[raw] ?? 'Algo salió mal. Inténtalo de nuevo.'));
  }
}

async function call<T>(path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api${path}`, body === undefined ? undefined : {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    });
  } catch {
    throw new ApiError('network', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError((data as { error?: string }).error ?? `Error ${res.status}`, res.status);
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
