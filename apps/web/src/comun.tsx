import { createContext, useContext, type ReactNode } from 'react';
import type { Config, Status, User } from './api';
import { Badge } from './ui';

/** Who the demo is acting as. In production this is the MicoPay login (Stellar address). */
export type Persona = { kind: 'guest' | 'host'; user: User } | { kind: 'arbiter' };
export const PersonaCtx = createContext<{ persona: Persona | null; config: Config | null }>({ persona: null, config: null });
export const usePersona = () => useContext(PersonaCtx);

/* Listing cover: flat blocks in the MicoPay palette (no photos yet). */
const COVERS = [
  { bg: 'bg-verde', sun: 'bg-naranja-claro', hill: 'bg-tinta', text: 'text-papel' },
  { bg: 'bg-naranja-suave', sun: 'bg-naranja', hill: 'bg-verde', text: 'text-tinta' },
  { bg: 'bg-tinta', sun: 'bg-verde-brillo', hill: 'bg-naranja-claro', text: 'text-papel' },
  { bg: 'bg-verde-suave', sun: 'bg-naranja-claro', hill: 'bg-tinta-3', text: 'text-tinta' },
];

export function Cover({ n, title, className = '' }: { n: number; title?: string; className?: string }) {
  const c = COVERS[n % COVERS.length]!;
  return (
    <div className={`relative overflow-hidden border-2 border-tinta ${c.bg} ${className}`}>
      <div className={`absolute right-[14%] top-[16%] h-[28%] aspect-square rounded-full ${c.sun}`} />
      <div className={`absolute bottom-0 left-[-10%] h-[55%] w-[70%] ${c.hill}`} style={{ clipPath: 'polygon(0 100%, 45% 8%, 58% 30%, 72% 0, 100% 100%)' }} />
      <div className={`absolute bottom-0 right-[-5%] h-[38%] w-[55%] ${c.hill} opacity-80`} style={{ clipPath: 'polygon(0 100%, 50% 0, 100% 100%)' }} />
      {title && <div className={`absolute left-4 top-3 font-display text-[22px] font-extrabold leading-tight ${c.text}`} style={{ fontVariationSettings: '"wdth" 112' }}>{title}</div>}
    </div>
  );
}

const STATUS: Record<Status, { label: string; tono: 'tinta' | 'naranja' | 'verde' | 'papel' | 'aviso' }> = {
  locked: { label: 'In escrow', tono: 'tinta' },
  disputed: { label: 'Disputed', tono: 'aviso' },
  released: { label: 'Paid out', tono: 'verde' },
  resolved: { label: 'Resolved', tono: 'verde' },
  cancelled: { label: 'Cancelled', tono: 'papel' },
};
export const StatusBadge = ({ s }: { s: Status }) => <Badge tono={STATUS[s].tono}>{STATUS[s].label}</Badge>;

export function Panel({ title, children, className = '' }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-sm border-2 border-tinta bg-papel shadow-solida ${className}`}>
      {title && <div className="border-b-2 border-tinta px-4 py-2.5 text-[12px] font-bold uppercase tracking-[.12em]">{title}</div>}
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Row({ k, v, strong = false }: { k: ReactNode; v: ReactNode; strong?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-1.5 ${strong ? 'border-t-2 border-tinta pt-2.5 font-bold' : ''}`}>
      <span className={strong ? '' : 'text-gris'}>{k}</span>
      <span className="num text-right">{v}</span>
    </div>
  );
}

export const ErrorBox = ({ msg }: { msg: string | null }) =>
  msg ? <div className="rounded-sm border-2 border-rojo bg-rojo-suave px-3 py-2 text-[14px] font-semibold text-rojo">{msg}</div> : null;
