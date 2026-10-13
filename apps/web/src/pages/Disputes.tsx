import { api } from '../api';
import { ErrorBox } from '../comun';
import { useData } from '../useData';
import { BookingList } from './Trips';

export default function Disputes() {
  const open = useData(() => api.bookings({ status: 'disputed' }));
  const all = useData(() => api.bookings({}));
  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[32px] font-extrabold">Disputes</h1>
        <p className="text-gris">The arbiter can split a disputed booking between guest and host. It can't send funds anywhere else, and if it doesn't decide within 7 days the contract pays out on its own.</p>
      </div>
      <ErrorBox msg={open.error ?? all.error} />
      <BookingList items={open.data} who="arbiter" empty="No open disputes." />
      <h2 className="font-display text-[22px] font-extrabold">All bookings</h2>
      <BookingList items={all.data} who="arbiter" empty="No bookings yet." />
    </div>
  );
}
