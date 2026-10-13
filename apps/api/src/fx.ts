import Big from 'big.js';

/**
 * MXN per 1 USDC. Prices, settlements and ISO messages stay in MXN (what the
 * producer agreed); the ledger moves USDC converted at this rate. It is the same
 * rate the MicoPay app uses to show USDC balances in pesos, so the buyer's web
 * and the producer's phone show the same figures.
 */
const RATE_URL = `${process.env.MICOPAY_API ?? 'https://api.micopay.app'}/rate/usdc-mxn`;
const TTL_MS = 60_000;
let cached: { rate: string; source: string; at: number } | null = null;

export async function usdcMxnRate(): Promise<{ rate: string; source: string }> {
  if (cached && Date.now() - cached.at < TTL_MS) return cached;
  try {
    const res = await fetch(RATE_URL, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`rate ${res.status}`);
    const body = (await res.json()) as { rate: number; source: string };
    if (!(body.rate > 0)) throw new Error('rate inválido');
    cached = { rate: new Big(body.rate).toFixed(6), source: `micopay:${body.source}`, at: Date.now() };
    return cached;
  } catch (err) {
    if (cached) return cached; // stale but real beats invented
    const fallback = process.env.FX_MXN_PER_USD;
    if (fallback) return { rate: new Big(fallback).toFixed(6), source: 'env:FX_MXN_PER_USD' };
    throw new Error(`no hay tipo de cambio USDC/MXN disponible (${(err as Error).message})`);
  }
}

/** MXN → token units, 5 decimals: the most an ISO 20022 amount carries, and Stellar accepts it. */
export function toToken(mxn: string, rate: string): string {
  return new Big(mxn).div(rate).round(5, Big.roundHalfUp).toFixed(5);
}

export function toMxn(token: string, rate: string): string {
  return new Big(token).times(rate).round(2, Big.roundHalfUp).toFixed(2);
}
