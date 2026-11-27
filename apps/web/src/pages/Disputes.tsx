import { api } from '../api';
import { ErrorBox, MissingPersona, usePersona } from '../comun';
import { t } from '../i18n';
import { useData } from '../useData';
import { BookingList } from './Trips';

export default function Disputes() {
  const { persona } = usePersona();
  const open = useData(() => api.bookings({ status: 'disputed' }));
  const all = useData(() => api.bookings({}));
  if (persona?.kind !== 'arbiter') return <MissingPersona type="arbiter" />;
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[32px] font-extrabold">{t('Disputas')}</h1>
        <p className="text-gris">{t('El árbitro puede repartir una reserva en disputa entre huésped y anfitrión. No puede enviar fondos a nadie más y, si no decide en 7 días, el contrato paga solo.')}</p>
      </div>
      <ErrorBox msg={open.error ?? all.error} onRetry={open.error ? open.reload : all.reload} />
      <BookingList items={open.data} loading={open.loading} who="arbiter" empty={t('No hay disputas abiertas.')} />
      <h2 className="font-display text-[22px] font-extrabold">{t('Todas las reservas')}</h2>
      <BookingList items={all.data} loading={all.loading} who="arbiter" empty={t('Aún no hay reservas.')} />
    </div>
  );
}
