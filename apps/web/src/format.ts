const MXN = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'MXN', currencyDisplay: 'narrowSymbol', minimumFractionDigits: 2 });

/** Prices are in pesos: shown as MX$ so nobody reads them as dollars. */
export const mxn = (v: string | number | null | undefined) => `MX${MXN.format(Number(v ?? 0))}`;
export const usdc = (v: string | number | null | undefined) =>
  `${new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Number(v ?? 0))} USDC`;
export const short = (s: string, n = 5) => (s.length > n * 2 ? `${s.slice(0, n)}…${s.slice(-n)}` : s);
export const day = (v: string) => new Date(`${v}T12:00:00Z`).toLocaleDateString('en-US', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'UTC' });
export const when = (v: string) => new Date(v).toLocaleString('en-US', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });

/** YYYY-MM-DD in Mexico City (UTC-6), `offset` days from today. */
export const isoDay = (offset = 0) => new Date(Date.now() - 6 * 3600_000 + offset * 86_400_000).toISOString().slice(0, 10);

export function duration(secs: number): string {
  const s = Math.max(0, Math.round(secs));
  if (s < 60) return `${s}s`;
  if (s < 3600) return `${Math.floor(s / 60)}m ${s % 60}s`;
  if (s < 86_400) return `${Math.floor(s / 3600)}h ${Math.floor((s % 3600) / 60)}m`;
  return `${Math.floor(s / 86_400)}d ${Math.floor((s % 86_400) / 3600)}h`;
}
