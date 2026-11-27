import Big from 'big.js';
import { api } from '../api';
import { EmptyState, ErrorBox, Loading, MissingPersona, usePersona } from '../comun';
import { mxn, usdc } from '../format';
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
      <h1 className="font-display text-[32px] font-extrabold">Hosting · {host.name}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <MoneyBlock etiqueta="Balance in MicoPay" cifra={host.balance ? usdc(host.balance) : '—'} pie="Withdraw to SPEI or cash in the MicoPay app" />
        <MoneyBlock tipo="cobro" etiqueta="Waiting in escrow" cifra={loading ? '—' : mxn(inEscrow.toFixed(2))} pie="Stays not paid out yet; paid after the hold that follows check-in" />
        <MoneyBlock etiqueta="Paid out (stays)" cifra={loading ? '—' : mxn(paid.toFixed(2))} pie="Full price: the fee is paid by the guest" />
      </div>
      <ErrorBox msg={error} onRetry={reload} />
      <BookingList items={data} loading={loading} who="host" empty="No bookings yet." />
    </div>
  );
}
