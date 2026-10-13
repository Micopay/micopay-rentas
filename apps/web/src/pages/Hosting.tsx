import Big from 'big.js';
import { api } from '../api';
import { ErrorBox, usePersona } from '../comun';
import { mxn, usdc } from '../format';
import { MoneyBlock } from '../ui';
import { useData } from '../useData';
import { BookingList } from './Trips';

export default function Hosting() {
  const { persona } = usePersona();
  const host = persona?.kind === 'host' ? persona.user : null;
  const { data, error } = useData(() => (host ? api.bookings({ hostId: host.id }) : Promise.resolve(null)), [host?.id]);
  const inEscrow = (data ?? []).filter((b) => b.status === 'locked' || b.status === 'disputed').reduce((a, b) => a.plus(b.subtotal_mxn), new Big(0));
  const paid = (data ?? []).filter((b) => b.status === 'released').reduce((a, b) => a.plus(b.subtotal_mxn), new Big(0));
  if (!host) return <div className="text-gris">Switch to a host (top right).</div>;
  return (
    <div className="space-y-6">
      <h1 className="font-display text-[32px] font-extrabold">Hosting · {host.name}</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <MoneyBlock etiqueta="Balance in MicoPay" cifra={host.balance ? usdc(host.balance) : '—'} pie="Withdraw to SPEI or cash in the MicoPay app" />
        <MoneyBlock tipo="cobro" etiqueta="Waiting in escrow" cifra={mxn(inEscrow.toFixed(2))} pie="Paid out after each check-in" />
        <MoneyBlock etiqueta="Paid out (stays)" cifra={mxn(paid.toFixed(2))} pie="Full price: the fee is paid by the guest" />
      </div>
      <ErrorBox msg={error} />
      <BookingList items={data} who="host" empty="No bookings yet." />
    </div>
  );
}
