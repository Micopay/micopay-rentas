import { api } from '../api';
import { ErrorBox, MissingPersona, usePersona } from '../comun';
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
        <h1 className="font-display text-[32px] font-extrabold">Disputes</h1>
        <p className="text-gris">The arbiter can split a disputed booking between guest and host. It can't send funds anywhere else, and if it doesn't decide within 7 days the contract pays out on its own.</p>
      </div>
      <ErrorBox msg={open.error ?? all.error} onRetry={open.error ? open.reload : all.reload} />
      <BookingList items={open.data} loading={open.loading} who="arbiter" empty="No open disputes." />
      <h2 className="font-display text-[22px] font-extrabold">All bookings</h2>
      <BookingList items={all.data} loading={all.loading} who="arbiter" empty="No bookings yet." />
    </div>
  );
}
