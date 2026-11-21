/* Minimal i18n for MicoPay Rentas.
   Spanish strings are the keys (café convention); English is the default
   language and the fallback for any key without a translation.
   Language precedence: ?lang= (URL) > localStorage > English.
   ?lang= always wins, even when localStorage is unavailable (denied storage). */

export type Lang = 'es' | 'en';

const KEY = 'rentas.lang';

/** English text for each Spanish key. Every literal t() key in the app must have an entry here. */
export const EN: Record<string, string> = {
  'Algo salió mal. Inténtalo de nuevo.': 'Something went wrong. Please try again.',
  'En garantía': 'In escrow',
  'En disputa': 'In dispute',
  'Pagado': 'Paid',
  'Resuelto': 'Resolved',
  'Cancelado': 'Cancelled',
  'Paid into escrow': 'Paid into escrow',
  'Cancelled by the guest': 'Cancelled by the guest',
  'Cancelled by the host': 'Cancelled by the host',
  'Released to the host': 'Released to the host',
  'Guest reported a problem': 'Guest reported a problem',
  'Host claimed damage': 'Host claimed damage',
  'Arbiter split the escrow': 'Arbiter split the escrow',
  'Paid out by default after the deadline': 'Paid out by default after the deadline',
  'Booked': 'Booked',
  'Check-in': 'Check-in',
  'Claims close': 'Claims close',
  'done': 'done',
  'reached': 'reached',
  'in {time}': 'in {time}',
  '{n} nights': '{n} nights',
  '{n} guests': '{n} guests',
  'Guest {name}': 'Guest {name}',
  'Host {name}': 'Host {name}',
  'Escrow on Stellar': 'Escrow on Stellar',
  'Demo clock: the on-chain dates run at {secs} s per calendar day.': 'Demo clock: the on-chain dates run at {secs} s per calendar day.',
  'Stay (to the host)': 'Stay (to the host)',
  'MicoPay fee': 'MicoPay fee',
  'Damage deposit': 'Damage deposit',
  'Locked': 'Locked',
  '1 USD = {rate} MXN at booking': '1 USD = {rate} MXN at booking',
  'Read from the contract just now': 'Read from the contract just now',
  'status {status} · amount {amount} · fee {fee} · deposit {deposit} USDC': 'status {status} · amount {amount} · fee {fee} · deposit {deposit} USDC',
  'booking id {id} = SHA-256 of the booking terms': 'booking id {id} = SHA-256 of the booking terms',
  'History': 'History',
  'Closed': 'Closed',
  'This booking is settled. Every movement is in the history with its Stellar transaction.': 'This booking is settled. Every movement is in the history with its Stellar transaction.',
  'Cancel': 'Cancel',
  'Cancelling now returns {amount}: {pct}% of the stay and fee, plus the full deposit.': 'Cancelling now returns {amount}: {pct}% of the stay and fee, plus the full deposit.',
  'Cancelling…': 'Cancelling…',
  'Cancel booking': 'Cancel booking',
  'Your stay': 'Your stay',
  'Everything fine? Release the payment and get your deposit back now. If you do nothing, the contract pays the host when claims close.': 'Everything fine? Release the payment and get your deposit back now. If you do nothing, the contract pays the host when claims close.',
  'Releasing…': 'Releasing…',
  'Release payment to host': 'Release payment to host',
  'Opening…': 'Opening…',
  'Report a problem': 'Report a problem',
  'Host actions': 'Host actions',
  'Something damaged? Claim it before claims close: the arbiter decides how the deposit is split.': 'Something damaged? Claim it before claims close: the arbiter decides how the deposit is split.',
  'Claiming…': 'Claiming…',
  'Claim damage': 'Claim damage',
  'You are paid {amount} after check-in.': 'You are paid {amount} after check-in.',
  'Cancel and refund the guest in full': 'Cancel and refund the guest in full',
  'Resolve dispute': 'Resolve dispute',
  'Split the {amount} in escrow. The platform can keep at most its fee.': 'Split the {amount} in escrow. The platform can keep at most its fee.',
  'To {party} (MXN)': 'To {party} (MXN)',
  'guest': 'guest',
  'host': 'host',
  'platform': 'platform',
  'Fill: no damage': 'Fill: no damage',
  'Sum {sum} of {total}': 'Sum {sum} of {total}',
  'Paying out…': 'Paying out…',
  'Resolve and pay out': 'Resolve and pay out',
  'Arbiter': 'Arbiter',
  'Release to host': 'Release to host',
  'Claims closed': 'Claims closed',
  'Nobody acted, so anyone can finish it: the host gets the stay, the guest the deposit.': 'Nobody acted, so anyone can finish it: the host gets the stay, the guest the deposit.',
  'Settle by default': 'Settle by default',
  'In dispute ': 'In dispute ',
  'MicoPay is reviewing it. If the arbiter doesn\'t decide within 7 days, the contract pays out by default.': 'MicoPay is reviewing it. If the arbiter doesn\'t decide within 7 days, the contract pays out by default.',
  'In dispute': 'In dispute',
};

/** Read localStorage without throwing (private mode / denied storage). */
function readStored(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

function writeStored(v: Lang): void {
  try {
    localStorage.setItem(KEY, v);
  } catch {
    /* storage denied: the choice lasts for this page only */
  }
}

/** Resolve the initial language. ?lang= wins regardless of storage state. */
export function initialLang(search: string = typeof location !== 'undefined' ? location.search : ''): Lang {
  const q = new URLSearchParams(search).get('lang');
  if (q === 'es' || q === 'en') return q;
  return readStored() === 'es' ? 'es' : 'en';
}

let current: Lang = initialLang();
const listeners = new Set<() => void>();

export const getLang = (): Lang => current;

export function setLang(l: Lang): void {
  current = l;
  writeStored(l);
  listeners.forEach((fn) => fn());
}

export function onLangChange(fn: () => void): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Translate a Spanish key. Returns the English entry when lang is 'en' and
   one exists, otherwise the key itself. Interpolates {name} placeholders. */
export function t(key: string, vars?: Record<string, string | number>): string {
  let s = current === 'en' ? (EN[key] ?? key) : key;
  if (vars) {
    s = s.replace(/\{(\w+)\}/g, (m, name: string) => (name in vars ? String(vars[name]) : m));
  }
  return s;
}

/** Local message for unknown API errors (never shows the raw server text). */
export const genericError = (): string =>
  t('Algo salió mal. Inténtalo de nuevo.');
