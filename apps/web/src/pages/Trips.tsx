import { Link } from 'react-router-dom';
import { api, type Booking } from '../api';
import { Cover, EmptyState, ErrorBox, Loading, MissingPersona, StatusBadge, usePersona } from '../comun';
import { day, mxn } from '../format';
import { t } from '../i18n';
import { useData } from '../useData';

export function BookingList({ items, loading, empty, who }: { items: Booking[] | null; loading?: boolean; empty: string; who: 'guest' | 'host' | 'arbiter' }) {
  if (loading) return <Loading />;
  if (!items) return null;
  if (items.length === 0) return <EmptyState message={empty} />;
  return (
    <div className="space-y-3">
      {items.map((b) => (
        <Link key={b.id} to={`/bookings/${b.id}`} className="grid grid-cols-[88px_1fr] gap-4 rounded-sm border-2 border-tinta bg-papel p-3 shadow-solida sm:grid-cols-[110px_1fr_auto] sm:items-center">
          <Cover n={b.cover} className="aspect-[4/3]" />
          <div>
            <div className="font-display text-[17px] font-extrabold leading-tight">{b.title}</div>
            <div className="text-[14px] text-gris">{day(b.check_in)} → {day(b.check_out)} · {b.nights === 1 ? t('1 noche') : t('{n} noches', { n: b.nights })}</div>
            <div className="text-[13px] text-gris">{b.reference} · {who === 'guest' ? t('anfitrión {name}', { name: b.host_name }) : t('huésped {name}', { name: b.guest_name })}</div>
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
  const { data, loading, error, reload } = useData(() => (guestId ? api.bookings({ guestId }) : Promise.resolve(null)), [guestId]);
  if (!guestId) return <MissingPersona type="guest" />;
  return (
    <div className="space-y-4">
      <h1 className="font-display text-[32px] font-extrabold">{t('Mis viajes')}</h1>
      <ErrorBox msg={error} onRetry={reload} />
      <BookingList items={data} loading={loading} who="guest" empty={t('Aún no tienes viajes.')} />
    </div>
  );
}
