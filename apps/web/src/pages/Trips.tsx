import { Link } from 'react-router-dom';
import { api, type Booking } from '../api';
import { Cover, ErrorBox, StatusBadge, usePersona } from '../comun';
import { day, mxn } from '../format';
import { useData } from '../useData';

export function BookingList({ items, empty, who }: { items: Booking[] | null; empty: string; who: 'guest' | 'host' | 'arbiter' }) {
  if (!items) return null;
  if (items.length === 0) return <div className="text-gris">{empty}</div>;
  return (
    <div className="space-y-3">
      {items.map((b) => (
        <Link key={b.id} to={`/bookings/${b.id}`} className="grid grid-cols-[88px_1fr] gap-4 rounded-sm border-2 border-tinta bg-papel p-3 shadow-solida sm:grid-cols-[110px_1fr_auto] sm:items-center">
          <Cover n={b.cover} className="aspect-[4/3]" />
          <div>
            <div className="font-display text-[17px] font-extrabold leading-tight">{b.title}</div>
            <div className="text-[14px] text-gris">{day(b.check_in)} → {day(b.check_out)} · {b.nights} night{b.nights > 1 ? 's' : ''}</div>
            <div className="text-[13px] text-gris">{b.reference} · {who === 'guest' ? `host ${b.host_name}` : `guest ${b.guest_name}`}</div>
          </div>
          <div className="col-span-2 flex items-center justify-between gap-3 sm:col-span-1 sm:flex-col sm:items-end">
            <StatusBadge s={b.status} />
            <span className="num font-bold">{mxn(who === 'host' ? b.subtotal_mxn : b.total_mxn)}</span>
          </div>
        </Link>
      ))}
    </div>
  );
}

export default function Trips() {
  const { persona } = usePersona();
  const guestId = persona?.kind === 'guest' ? persona.user.id : undefined;
  const { data, error } = useData(() => (guestId ? api.bookings({ guestId }) : Promise.resolve(null)), [guestId]);
  return (
    <div className="space-y-4">
      <h1 className="font-display text-[32px] font-extrabold">My trips</h1>
      <ErrorBox msg={error} />
      <BookingList items={data} who="guest" empty="No trips yet." />
    </div>
  );
}
