import { useCallback, useMemo, useRef, useState } from 'react';
import { day } from '../format';
import { locale, t } from '../i18n';

interface BookedRange {
  check_in: string;
  check_out: string;
}

interface CalendarProps {
  booked: BookedRange[];
  checkIn: string;
  checkOut: string;
  onCheckInChange: (date: string) => void;
  onCheckOutChange: (date: string) => void;
  minDate?: string;
}

type DateState = 'free' | 'booked' | 'selected' | 'in-range';

/* Dates are plain YYYY-MM-DD strings. All arithmetic is done in UTC so the
   user's time zone can never shift a day. */
const toIso = (y: number, m: number, d: number) => new Date(Date.UTC(y, m, d)).toISOString().slice(0, 10);
const addDays = (iso: string, n: number) => {
  const [y, m, d] = iso.split('-').map(Number) as [number, number, number];
  return toIso(y, m - 1, d + n);
};

/** True when [start, end) contains a booked night. A range may end on the day another booking starts. */
export function crossesBooked(booked: BookedRange[], start: string, end: string): boolean {
  return booked.some((b) => start < b.check_out.slice(0, 10) && end > b.check_in.slice(0, 10));
}

const weekDays = ['Do', 'Lu', 'Ma', 'Mi', 'Ju', 'Vi', 'Sá'];
const monthLabel = (y: number, m: number) => new Date(Date.UTC(y, m, 1)).toLocaleDateString(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' });

export default function Calendar({ booked, checkIn, checkOut, onCheckInChange, onCheckOutChange, minDate }: CalendarProps) {
  const [view, setView] = useState(() => {
    const [y, m] = (checkIn || minDate || toIso(2026, 0, 1)).split('-').map(Number) as [number, number];
    return { y, m: m - 1 };
  });
  const gridRef = useRef<HTMLDivElement>(null);

  // Booked nights: every day from check_in up to (not including) check_out.
  const bookedNights = useMemo(() => {
    const set = new Set<string>();
    for (const b of booked) {
      for (let d = b.check_in.slice(0, 10); d < b.check_out.slice(0, 10); d = addDays(d, 1)) set.add(d);
    }
    return set;
  }, [booked]);

  const monthDays = useMemo(() => {
    const offset = new Date(Date.UTC(view.y, view.m, 1)).getUTCDay();
    const last = new Date(Date.UTC(view.y, view.m + 1, 0)).getUTCDate();
    const days: Array<string | null> = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= last; d++) days.push(toIso(view.y, view.m, d));
    return days;
  }, [view]);

  const picking = Boolean(checkIn && !checkOut);
  // While picking a check-out, a booked day is still a valid end if no booked night lies in between.
  const canEndOn = useCallback((iso: string) => picking && iso > checkIn && !crossesBooked(booked, checkIn, iso), [picking, checkIn, booked]);

  const stateOf = (iso: string): DateState => {
    if (iso === checkIn || iso === checkOut) return 'selected';
    if (bookedNights.has(iso)) return 'booked';
    if (checkIn && checkOut && iso > checkIn && iso < checkOut) return 'in-range';
    return 'free';
  };
  const isDisabled = (iso: string) => Boolean(minDate && iso < minDate) || (bookedNights.has(iso) && !canEndOn(iso));

  const pick = (iso: string) => {
    if (isDisabled(iso)) return;
    if (!checkIn || checkOut || iso < checkIn) {
      onCheckInChange(iso);
      onCheckOutChange('');
    } else if (iso === checkIn) {
      onCheckInChange('');
      onCheckOutChange('');
    } else if (!crossesBooked(booked, checkIn, iso)) {
      onCheckOutChange(iso);
    }
  };

  const moveMonth = (delta: number) => setView((v) => {
    const d = new Date(Date.UTC(v.y, v.m + delta, 1));
    return { y: d.getUTCFullYear(), m: d.getUTCMonth() };
  });

  const onKey = (e: React.KeyboardEvent, iso: string) => {
    const step: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 };
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(iso); return; }
    const n = step[e.key];
    if (n === undefined) return;
    e.preventDefault();
    const target = addDays(iso, n);
    const el = gridRef.current?.querySelector<HTMLElement>(`[data-date="${target}"]`);
    if (el) el.focus();
  };

  const cell = (iso: string | null, i: number) => {
    if (!iso) return <div key={`empty-${i}`} className="h-12" aria-hidden="true" />;
    const state = stateOf(iso);
    const disabled = isDisabled(iso);
    const label = `${day(iso)}, ${t(state === 'booked' ? (disabled ? 'reservado' : 'reservado desde este día; puede ser tu salida') : state === 'selected' ? 'seleccionado' : state === 'in-range' ? 'dentro del rango elegido' : 'sin reserva registrada')}`;
    const style: Record<DateState, string> = {
      free: 'bg-papel text-tinta border-line hover:border-tinta',
      booked: 'bg-papel text-gris-2 border-line line-through decoration-2 decoration-tinta',
      selected: 'bg-naranja text-papel border-tinta shadow-solida-sm',
      'in-range': 'bg-naranja-suave text-tinta border-naranja-borde',
    };
    return (
      <button
        key={iso}
        data-date={iso}
        type="button"
        disabled={disabled}
        className={`flex h-12 w-full min-w-0 items-center justify-center rounded-lg border-2 text-[15px] font-bold focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta ${style[state]} ${disabled ? 'cursor-not-allowed opacity-40' : ''}`}
        onClick={() => pick(iso)}
        onKeyDown={(e) => onKey(e, iso)}
        aria-label={label}
        aria-pressed={state === 'selected'}
      >
        {Number(iso.slice(8))}
      </button>
    );
  };

  const navBtn = 'min-h-12 min-w-12 rounded-lg border-2 border-tinta bg-papel px-3 font-bold text-[15px] text-tinta focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta active:translate-x-[1px] active:translate-y-[1px]';

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <button type="button" onClick={() => moveMonth(-1)} className={navBtn} aria-label={t('Mes anterior')}>←</button>
        <span className="text-[15px] font-bold text-tinta" aria-live="polite">{monthLabel(view.y, view.m)}</span>
        <button type="button" onClick={() => moveMonth(1)} className={navBtn} aria-label={t('Mes siguiente')}>→</button>
      </div>

      <div ref={gridRef} className="grid grid-cols-7 gap-0.5" aria-label={t('Calendario')}>
        {weekDays.map((wd) => <div key={wd} className="py-1 text-center text-[12px] font-bold text-gris" aria-hidden="true">{t(wd)}</div>)}
        {monthDays.map(cell)}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-gris">
        <span className="flex items-center gap-1"><span className="h-4 w-4 rounded border-2 border-line bg-papel" />{t('Sin reserva registrada')}</span>
        <span className="flex items-center gap-1"><span className="h-4 w-4 rounded border-2 border-line bg-papel line-through decoration-tinta" />{t('Reservado')}</span>
        <span className="flex items-center gap-1"><span className="h-4 w-4 rounded border-2 border-tinta bg-naranja" />{t('Seleccionado')}</span>
      </div>
    </div>
  );
}
