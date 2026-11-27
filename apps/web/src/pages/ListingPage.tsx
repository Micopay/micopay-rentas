import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { api, type Quote } from '../api';
import { Cover, ErrorBox, Panel, Row, usePersona } from '../comun';
import { day, isoDay, mxn, usdc } from '../format';
import { Badge, Button, Label } from '../ui';
import Calendar, { crossesBooked } from '../ui/Calendar';
import { useData } from '../useData';

export default function ListingPage() {
  const { slug = '' } = useParams();
  const { data: l, error, reload } = useData(() => api.listing(slug), [slug]);
  const { persona, config } = usePersona();
  const nav = useNavigate();
  const [checkIn, setCheckIn] = useState(isoDay(3));
  const [checkOut, setCheckOut] = useState(isoDay(5));

  const isRangeValid = (start: string, end: string) => !start || !end || !crossesBooked(l?.booked ?? [], start, end);
  const [guests, setGuests] = useState(2);
  const [q, setQ] = useState<Quote | null>(null);
  const [qErr, setQErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const quoteReqRef = useRef(0);
  const [quoteDates, setQuoteDates] = useState<{ checkIn: string; checkOut: string } | null>(null);

  useEffect(() => {
    if (!l) return;
    setQErr(null);
    if (!checkIn || !checkOut) { setQ(null); setQuoteDates(null); return; }
    setQ(null);
    setQuoteDates(null);
    const reqId = ++quoteReqRef.current;
    api.quote(l.id, checkIn, checkOut).then((quote) => {
      if (reqId === quoteReqRef.current) {
        setQ(quote);
        setQuoteDates({ checkIn, checkOut });
      }
    }).catch((e: Error) => {
      if (reqId === quoteReqRef.current) { setQ(null); setQErr(e.message); }
    });
  }, [l, checkIn, checkOut]);

  if (error) return <ErrorBox msg={error} />;
  if (!l) return null;
  const policy = config?.policies[l.policy];
  const isGuest = persona?.kind === 'guest';

  async function book() {
    if (!l || persona?.kind !== 'guest') return;
    setBusy(true); setErr(null);
    try {
      const r = await api.book({ listingId: l.id, guestId: persona.user.id, checkIn, checkOut, guests });
      nav(`/bookings/${r.id}`);
    } catch (e) {
      const errMsg = (e as Error).message;
      if (errMsg === 'Those dates are already booked') {
        setErr('Those dates are no longer available. Please choose different dates.');
        setQ(null);
        setQuoteDates(null);
      } else {
        setErr(errMsg);
      }
      reload();
    } finally {
      setBusy(false);
    }
  }

  const rate = q?.fx.rate ? Number(q.fx.rate) : null;
  return (
    <div className="grid gap-8 lg:grid-cols-[1.4fr_1fr]">
      <div className="min-w-0 space-y-6">
        <Cover n={l.cover} title={l.title} className="aspect-[16/9] shadow-solida" />
        <div>
          <Label>{l.area}</Label>
          <p className="mt-3 text-[17px] leading-relaxed">{l.description}</p>
          <div className="mt-3 flex flex-wrap gap-2">
            {l.amenities.map((a) => <Badge key={a}>{a}</Badge>)}
            <Badge tono="tinta">{l.bedrooms} bedroom{l.bedrooms > 1 ? 's' : ''} · up to {l.max_guests}</Badge>
          </div>
        </div>
        <Panel title={`Cancellation policy · ${policy?.label ?? l.policy}`}>
          <ul className="space-y-1 text-[15px]">
            {policy?.tiers.map((t) => <li key={t.days}>Cancel at least <b>{t.days} day{t.days > 1 ? 's' : ''}</b> before check-in: <b>{t.refundPct}%</b> of the stay and fee back.</li>)}
            <li>Later than that: the stay is not refunded. The damage deposit always comes back if you cancel.</li>
            <li>If the host cancels, you get everything back.</li>
          </ul>
          <p className="mt-3 text-[13px] text-gris">These rules are written into the escrow contract when you book: nobody can change them afterwards.</p>
        </Panel>
        <Panel title="Your host">
          <div className="font-bold">{l.host_name}</div>
          <div className="text-[14px] text-gris">{l.host_bio}</div>
        </Panel>
      </div>

      <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <Panel title={<span className="num">{mxn(l.nightly_mxn)} / night</span>}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-[13px] font-bold text-gris">Check-in
              <input type="date" value={checkIn} min={isoDay(1)} onChange={(e) => {
                const newCheckIn = e.target.value;
                // If check-out is set, validate the new range
                if (checkOut && !isRangeValid(newCheckIn, checkOut)) {
                  setCheckOut(''); // Clear check-out if range becomes invalid
                }
                setCheckIn(newCheckIn);
              }} className="mt-1 min-h-12 w-full rounded-sm border-2 border-tinta bg-fondo px-2 text-[16px] text-tinta" />
            </label>
            <label className="text-[13px] font-bold text-gris">Check-out
              <input type="date" value={checkOut} min={checkIn} onChange={(e) => {
                const newCheckOut = e.target.value;
                // Validate the range before accepting
                if (newCheckOut && !isRangeValid(checkIn, newCheckOut)) {
                  return; // Reject invalid range
                }
                setCheckOut(newCheckOut);
              }} className="mt-1 min-h-12 w-full rounded-sm border-2 border-tinta bg-fondo px-2 text-[16px] text-tinta" />
            </label>
            <label className="sm:col-span-2 text-[13px] font-bold text-gris">Guests
              <input type="number" min={1} max={l.max_guests} value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="mt-1 min-h-12 w-full rounded-sm border-2 border-tinta bg-fondo px-2 text-[16px] text-tinta" />
            </label>
          </div>

          {q && (
            <div className="mt-4 text-[15px]">
              <Row k={`${mxn(q.nightly)} × ${q.nights} night${q.nights > 1 ? 's' : ''}`} v={mxn(q.stay)} />
              <Row k="Cleaning" v={mxn(q.cleaning)} />
              <Row k={`MicoPay fee (${Number(q.feeRate) * 100}%)`} v={mxn(q.fee)} />
              <Row k="Damage deposit (refundable)" v={mxn(q.deposit)} />
              <Row strong k="Into escrow" v={mxn(q.total)} />
              {rate && <div className="mt-1 text-right text-[13px] text-gris num">≈ {usdc(Number(q.total) / rate)} at 1 USD = {rate.toFixed(2)} MXN</div>}
              <div className="mt-3 rounded-sm border-2 border-tinta bg-verde-suave px-3 py-2 text-[13px]">
                The host receives <b className="num">{mxn(q.subtotal)}</b> after check-in. The deposit comes back after check-out unless there is a damage claim.
              </div>
            </div>
          )}
          {q && !q.available && <div className="mt-3"><ErrorBox msg="Those dates are already booked" /></div>}
          <div className="mt-3"><ErrorBox msg={qErr ?? err} /></div>

          <div className="mt-4">
            <Calendar
              booked={l.booked ?? []}
              checkIn={checkIn}
              checkOut={checkOut}
              onCheckInChange={setCheckIn}
              onCheckOutChange={setCheckOut}
              minDate={isoDay(1)}
            />
          </div>


          <div className="mt-4">
            {isGuest ? (
              <Button block disabled={!q || !q.available || busy || quoteDates?.checkIn !== checkIn || quoteDates?.checkOut !== checkOut} onClick={book}>
                {busy ? 'Locking in escrow on Stellar…' : 'Book and pay into escrow'}
              </Button>
            ) : (
              <div className="text-[14px] text-gris">Switch to the guest (top right) to book.</div>
            )}
            {isGuest && <p className="mt-2 text-[12px] text-gris">Demo: the guest's testnet key signs. In production you approve it in your MicoPay app.</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
