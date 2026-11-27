import Big from 'big.js';
import { api } from '../api';
import { EmptyState, ErrorBox, Loading, MissingPersona, usePersona } from '../comun';
import { mxn, usdc } from '../format';
import { t } from '../i18n';
import { MoneyBlock } from '../ui';
import { useData } from '../useData';
import { BookingList } from './Trips';

export default function Hosting() {
  const { persona } = usePersona();
  const host = persona?.kind === 'host' ? persona.user : null;
  const { data, loading, error, reload } = useData(() => (host ? api.bookings({ hostId: host.id }) : Promise.resolve(null)), [host?.id]);
  // Host money only: the stay until it is paid out. The deposit belongs to the guest unless a claim awards it.
  const stayPaid = (b: { status: string; chain_stay_paid: boolean }) => b.chain_stay_paid || b.status === 'stay_paid';
  const inEscrow = (data ?? []).filter((b) => (b.status === 'locked' || b.status === 'disputed') && !stayPaid(b))
    .reduce((a, b) => a.plus(b.subtotal_mxn), new Big(0));
  const paid = (data ?? []).filter((b) => stayPaid(b) || b.status === 'released')
    .reduce((a, b) => a.plus(b.subtotal_mxn), new Big(0));
  if (!host) return <MissingPersona type="host" />;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-[32px] font-extrabold">{t('Anfitrión · {name}', { name: host.name })}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <MoneyBlock etiqueta={t('Saldo en MicoPay')} cifra={host.balance ? usdc(host.balance) : '—'} pie={t('Retira por SPEI o en efectivo en la app de MicoPay')} />
        <MoneyBlock tipo="cobro" etiqueta={t('Esperando en la garantía')} cifra={loading ? '—' : mxn(inEscrow.toFixed(2))} pie={t('Estancias aún sin pagar; se pagan al terminar la retención tras el check-in')} />
        <MoneyBlock etiqueta={t('Pagado (estancias)')} cifra={loading ? '—' : mxn(paid.toFixed(2))} pie={t('Precio completo: la comisión la paga el huésped')} />
      </div>
      <ErrorBox msg={error} onRetry={reload} />
      <BookingList items={data} loading={loading} who="host" empty={t('Aún no hay reservas.')} />
    </div>
  );
}
