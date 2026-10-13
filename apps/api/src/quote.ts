import Big from 'big.js';
import { CLAIM_DAYS, DAY_SECS, FEE_RATE } from './config.js';

export type Policy = 'flexible' | 'moderate' | 'strict';

/** Cancellation policies in calendar days before check-in (Airbnb-style). */
export const POLICIES: Record<Policy, { label: string; tiers: Array<{ days: number; refundPct: number }> }> = {
  flexible: { label: 'Flexible', tiers: [{ days: 1, refundPct: 100 }] },
  moderate: { label: 'Moderate', tiers: [{ days: 5, refundPct: 100 }, { days: 1, refundPct: 50 }] },
  strict: { label: 'Strict', tiers: [{ days: 14, refundPct: 100 }, { days: 7, refundPct: 50 }] },
};

export interface Quote {
  nights: number;
  nightly: string;
  stay: string;
  cleaning: string;
  subtotal: string; // what the host receives
  fee: string; // platform, paid by the guest
  deposit: string; // returned after the stay unless there is a damage claim
  total: string; // locked in escrow
  feeRate: string;
}

const DAY_MS = 86_400_000;

export function nightsBetween(checkIn: string, checkOut: string): number {
  return Math.round((Date.parse(`${checkOut}T00:00:00Z`) - Date.parse(`${checkIn}T00:00:00Z`)) / DAY_MS);
}

export function quote(l: { nightly_mxn: string; cleaning_mxn: string; deposit_mxn: string }, nights: number): Quote {
  const stay = new Big(l.nightly_mxn).times(nights);
  const subtotal = stay.plus(l.cleaning_mxn);
  const fee = subtotal.times(FEE_RATE).round(2, Big.roundHalfUp);
  const deposit = new Big(l.deposit_mxn);
  return {
    nights,
    nightly: new Big(l.nightly_mxn).toFixed(2),
    stay: stay.toFixed(2),
    cleaning: new Big(l.cleaning_mxn).toFixed(2),
    subtotal: subtotal.toFixed(2),
    fee: fee.toFixed(2),
    deposit: deposit.toFixed(2),
    total: subtotal.plus(fee).plus(deposit).toFixed(2),
    feeRate: FEE_RATE,
  };
}

/** Check-in 15:00 and check-out 11:00, Mexico City (UTC-6, no DST since 2022). */
export function calendarTimes(checkIn: string, checkOut: string): { checkInMs: number; checkOutMs: number } {
  return {
    checkInMs: Date.parse(`${checkIn}T15:00:00-06:00`),
    checkOutMs: Date.parse(`${checkOut}T11:00:00-06:00`),
  };
}

/**
 * Calendar → on-chain seconds through the demo clock (DAY_SECS per day). In real
 * time (86 400) this is just the timestamp; in the demo a day lasts a minute.
 */
export function chainTimes(checkIn: string, checkOut: string, nowMs = Date.now()) {
  const { checkInMs, checkOutMs } = calendarTimes(checkIn, checkOut);
  const scale = (ms: number) => Math.floor(nowMs / 1000 + ((ms - nowMs) / DAY_MS) * DAY_SECS);
  const checkInSec = scale(checkInMs);
  const deadlineSec = scale(checkOutMs) + CLAIM_DAYS * DAY_SECS;
  return { checkInSec, deadlineSec };
}

export function chainTiers(policy: Policy): Array<{ min_secs_before: number; refund_bps: number }> {
  return POLICIES[policy].tiers.map((t) => ({ min_secs_before: t.days * DAY_SECS, refund_bps: t.refundPct * 100 }));
}
