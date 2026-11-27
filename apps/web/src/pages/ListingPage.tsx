import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { ApiError, api, type Policy, type Quote } from '../api';
import { Cover, ErrorBox, Panel, Rich, Row, usePersona } from '../comun';
import { day, isoDay, mxn, usdc } from '../format';
import { Badge, Button, Label } from '../ui';
import { t } from '../i18n';
import Calendar, { crossesBooked } from '../ui/Calendar';

const POLICY: Record<Policy, string> = { flexible: 'Flexible', moderate: 'Moderada', strict: 'Estricta' };
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
      if (e instanceof ApiError && e.raw === 'Those dates are already booked') {
        setErr(t('Esas fechas ya no están disponibles. Elige otras fechas.'));
        setQ(null);
        setQuoteDates(null);
      } else {
        setErr((e as Error).message);
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
            <Badge tono="tinta">{l.bedrooms === 1 ? t('1 recámara · hasta {max}', { max: l.max_guests }) : t('{n} recámaras · hasta {max}', { n: l.bedrooms, max: l.max_guests })}</Badge>
          </div>
        </div>
        <Panel title={t('Política de cancelación · {policy}', { policy: t(POLICY[l.policy]) })}>
          <ul className="space-y-1 text-[15px]">
            {policy?.tiers.map((tier) => <li key={tier.days}><Rich text={tier.days === 1
              ? t('Cancela al menos <b>1 día</b> antes del check-in: te devolvemos <b>{pct}%</b> de la estancia y la comisión.', { pct: tier.refundPct })
              : t('Cancela al menos <b>{days} días</b> antes del check-in: te devolvemos <b>{pct}%</b> de la estancia y la comisión.', { days: tier.days, pct: tier.refundPct })} /></li>)}
            <li>{t('Después de eso, la estancia no se reembolsa. El depósito por daños siempre vuelve si cancelas.')}</li>
            <li>{t('Si cancela el anfitrión, te devolvemos todo.')}</li>
          </ul>
          <p className="mt-3 text-[13px] text-gris">{t('Estas reglas quedan escritas en el contrato de garantía al reservar: nadie puede cambiarlas después.')}</p>
        </Panel>
        <Panel title={t('Tu anfitrión')}>
          <div className="font-bold">{l.host_name}</div>
          <div className="text-[14px] text-gris">{l.host_bio}</div>
        </Panel>
      </div>

      <div className="min-w-0 lg:sticky lg:top-4 lg:self-start">
        <Panel title={<span className="num">{mxn(l.nightly_mxn)} {t('/ noche')}</span>}>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <label className="text-[13px] font-bold text-gris">{t('Llegada')}
              <input type="date" value={checkIn} min={isoDay(1)} onChange={(e) => {
                const newCheckIn = e.target.value;
                // If check-out is set, validate the new range
                if (checkOut && !isRangeValid(newCheckIn, checkOut)) {
                  setCheckOut(''); // Clear check-out if range becomes invalid
                }
                setCheckIn(newCheckIn);
              }} className="mt-1 min-h-12 w-full rounded-sm border-2 border-tinta bg-fondo px-2 text-[16px] text-tinta" />
            </label>
            <label className="text-[13px] font-bold text-gris">{t('Salida')}
              <input type="date" value={checkOut} min={checkIn} onChange={(e) => {
                const newCheckOut = e.target.value;
                // Validate the range before accepting
                if (newCheckOut && !isRangeValid(checkIn, newCheckOut)) {
                  return; // Reject invalid range
                }
                setCheckOut(newCheckOut);
              }} className="mt-1 min-h-12 w-full rounded-sm border-2 border-tinta bg-fondo px-2 text-[16px] text-tinta" />
            </label>
            <label className="sm:col-span-2 text-[13px] font-bold text-gris">{t('Huéspedes')}
              <input type="number" min={1} max={l.max_guests} value={guests} onChange={(e) => setGuests(Number(e.target.value))} className="mt-1 min-h-12 w-full rounded-sm border-2 border-tinta bg-fondo px-2 text-[16px] text-tinta" />
            </label>
          </div>

          {q && (
            <div className="mt-4 text-[15px]">
              <Row k={q.nights === 1 ? t('{price} × 1 noche', { price: mxn(q.nightly) }) : t('{price} × {n} noches', { price: mxn(q.nightly), n: q.nights })} v={mxn(q.stay)} />
              <Row k={t('Limpieza')} v={mxn(q.cleaning)} />
              <Row k={t('Comisión de MicoPay ({pct}%)', { pct: Number(q.feeRate) * 100 })} v={mxn(q.fee)} />
              <Row k={t('Depósito por daños (reembolsable)')} v={mxn(q.deposit)} />
              <Row strong k={t('A la garantía')} v={mxn(q.total)} />
              {rate && <div className="mt-1 text-right text-[13px] text-gris num">{t('≈ {amount} a 1 USD = {rate} MXN', { amount: usdc(Number(q.total) / rate), rate: rate.toFixed(2) })}</div>}
              <div className="mt-3 rounded-sm border-2 border-tinta bg-verde-suave px-3 py-2 text-[13px]">
                <Rich text={t('El anfitrión recibe <b>{amount}</b> después del check-in. El depósito vuelve después de la salida, salvo que haya un reclamo por daños.', { amount: mxn(q.subtotal) })} />
              </div>
            </div>
          )}
          {q && !q.available && <div className="mt-3"><ErrorBox msg={t('Esas fechas ya están reservadas')} /></div>}
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
                {busy ? t('Bloqueando en la garantía de Stellar…') : t('Reservar y pagar a la garantía')}
              </Button>
            ) : (
              <div className="text-[14px] text-gris">{t('Cámbiate al huésped (arriba a la derecha) para reservar.')}</div>
            )}
            {isGuest && <p className="mt-2 text-[12px] text-gris">{t('Demo: firma la llave de testnet del huésped. En producción lo apruebas en tu app de MicoPay.')}</p>}
          </div>
        </Panel>
      </div>
    </div>
  );
}
