import Big from 'big.js';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type BookingDetail } from '../api';
import { Cover, ErrorBox, Loading, Panel, Rich, Row, StatusBadge, usePersona } from '../comun';
import { day, duration, mxn, short, usdc, when } from '../format';
import { t } from '../i18n';
import { Button, Icon, Label } from '../ui';

const EVENT: Record<string, string> = {
  locked: 'Pagado a la garantía', pay_stay: 'Estancia pagada al anfitrión', cancel: 'Cancelada por el huésped', host_cancel: 'Cancelada por el anfitrión', release: 'Liberado al anfitrión',
  dispute: 'El huésped reportó un problema', claim_damage: 'El anfitrión reclamó daños', resolve: 'El árbitro repartió la garantía', settle_default: 'Pagado por defecto después del plazo',
};

const SPLIT_LABEL = { guest: 'Para el huésped (MXN)', host: 'Para el anfitrión (MXN)', platform: 'Para la plataforma (MXN)' } as const;

export default function BookingPage({ onChange }: { onChange: () => void }) {
  const { id = '' } = useParams();
  const { persona, config } = usePersona();
  const [b, setB] = useState<BookingDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [initialLoad, setInitialLoad] = useState(true);
  const [skew, setSkew] = useState(0); // ledger clock − local clock
  const [now, setNow] = useState(Date.now() / 1000);
  const [split, setSplit] = useState<{ guest: string; host: string; platform: string } | null>(null);

  const load = () => api.booking(Number(id)).then((d) => { setB(d); setSkew(d.ledgerTime - Date.now() / 1000); setInitialLoad(false); }).catch((e: Error) => { setErr(e.message); setInitialLoad(false); });
  useEffect(() => { load(); const t = setInterval(load, 10_000); return () => clearInterval(t); }, [id]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now() / 1000), 1000); return () => clearInterval(t); }, []);

  if (initialLoad && !b) return <Loading />;
  if (!b) return <ErrorBox msg={err ?? t('Reserva no encontrada')} onRetry={load} />;
  const ledger = now + skew;
  const checkIn = Number(b.chain_check_in), deadline = Number(b.chain_deadline);
  const phase = ledger < checkIn ? 'before' : ledger < deadline ? 'stay' : 'after';
  const open = b.status === 'locked' || b.status === 'stay_paid';
  const stayPaid = b.chain_stay_paid || b.status === 'stay_paid' || b.status === 'released';
  const cancelled = b.status === 'cancelled';
  const claimsClosed = ledger >= deadline || cancelled || b.status === 'released' || b.status === 'resolved';
  const stayPaidAt = Number(b.chain_stay_paid_at);
  const who = persona?.kind;
  const mine = (who === 'guest' && persona?.kind === 'guest' && persona.user.id === b.guest_id) || (who === 'host' && persona?.kind === 'host' && persona.user.id === b.host_id);

  // What the guest would get back if they cancelled now (same rule as the contract).
  const tier = b.tiers.find((t) => checkIn - ledger >= t.min_secs_before);
  const refundPct = (tier?.refund_bps ?? 0) / 100;
  const refundMxn = new Big(b.subtotal_mxn).plus(b.fee_mxn).times(refundPct).div(100).plus(b.deposit_mxn);

  async function run(action: string, body: object = {}) {
    setBusy(action); setErr(null);
    try {
      await api.act(b!.id, action, body);
      await load();
      onChange();
    } catch (e) {
      setErr((e as Error).message);
    } finally {
      setBusy(null);
    }
  }

  const splitSum = split ? new Big(split.guest || 0).plus(split.host || 0).plus(split.platform || 0) : null;
  const total = new Big(b.total_mxn);
  const daySecs = config?.daySecs ?? 86_400;

  return (
    <div className="grid gap-8 lg:grid-cols-[1.3fr_1fr]">
      <div className="min-w-0 space-y-6">
        <div className="flex items-start gap-4">
          <Cover n={b.cover} className="aspect-[4/3] w-20 shrink-0 sm:w-32" />
          <div>
            <Label>{b.reference}</Label>
            <h1 className="mt-2 font-display text-[28px] font-extrabold leading-tight"><Link to={`/stay/${b.slug}`}>{b.title}</Link></h1>
            <div className="text-gris">{day(b.check_in)} → {day(b.check_out)} · {b.nights === 1 ? t('1 noche') : t('{n} noches', { n: b.nights })}</div>
            <div className="text-[14px] text-gris">{t('{n} huéspedes · Huésped {guest} · Anfitrión {host}', { n: b.guests, guest: b.guest_name, host: b.host_name })}</div>
          </div>
        </div>

        <Panel title={<span className="flex items-center justify-between">{t('Garantía en Stellar')} <StatusBadge s={b.status} /></span>}>
          <ol className="grid gap-2 text-[13px] sm:grid-cols-3">
            {[
              { k: 'checkin', t: cancelled ? 'Reserva cancelada' : 'Llegada', at: checkIn, done: ledger >= checkIn || cancelled },
              { k: 'stay', t: 'Pago de la estancia', at: stayPaidAt, done: stayPaid },
              { k: 'claims', t: 'Cierre de reclamos', at: deadline, done: claimsClosed },
            ].map((s) => (
              <li key={s.k} className={`rounded-sm border-2 border-tinta px-2.5 py-2 ${s.done ? 'bg-tinta text-papel' : 'bg-fondo'}`}>
                <div className="font-bold">{t(s.t)}</div>
                <div className={`num ${s.done ? 'text-gris-3' : 'text-gris'}`}>{s.done
                  ? s.k === 'stay' ? when(new Date(s.at * 1000).toISOString()) : t('hecho')
                  : t('en {time}', { time: duration(s.at - ledger) })}</div>
              </li>
            ))}
          </ol>
          {daySecs < 86_400 && <p className="mt-2 text-[12px] text-gris">{t('Reloj de demo: las fechas en la cadena corren a {secs} s por día calendario.', { secs: daySecs })}</p>}

          <div className="mt-4 text-[15px]">
            <Row k={t('Estancia (para el anfitrión)')} v={<>{mxn(b.subtotal_mxn)} <span className="text-gris">· {usdc(b.amount_token)}</span></>} />
            <Row k={t('Comisión de MicoPay')} v={<>{mxn(b.fee_mxn)} <span className="text-gris">· {usdc(b.fee_token)}</span></>} />
            <Row k={t('Depósito por daños')} v={<>{mxn(b.deposit_mxn)} <span className="text-gris">· {usdc(b.deposit_token)}</span></>} />
            <Row strong k={t(stayPaid ? 'Total al reservar' : 'Bloqueado')} v={mxn(b.total_mxn)} />
            <div className="text-right text-[12px] text-gris num">{t('1 USD = {rate} MXN al reservar', { rate: Number(b.fx_rate).toFixed(4) })}</div>
          </div>
          {b.chain && (
            <div className="mt-3 rounded-sm border-2 border-tinta bg-fondo px-3 py-2 text-[13px]">
              <div className="flex items-center gap-1.5 font-bold"><Icon name="verified" size={18} /> {t('Leído del contrato hace un momento')}</div>
              <div className="num">{t('estado {status} · monto {amount} · comisión {fee} · depósito {deposit} USDC', { status: b.chain.status, amount: b.chain.amount, fee: b.chain.fee, deposit: b.chain.deposit })}</div>
              <div className="num text-gris">{t('id de reserva {id} = SHA-256 de los términos de la reserva', { id: short(b.escrow_id, 8) })}</div>
            </div>
          )}
        </Panel>

        <Panel title={t('Historial')}>
          <ul className="space-y-2 text-[14px]">
            {b.events.map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-3">
                <span><b>{EVENT[e.kind] ? t(EVENT[e.kind]!) : e.kind}</b> <span className="text-gris">· {when(e.created_at)}</span></span>
                {e.explorer && <a className="flex items-center gap-1 whitespace-nowrap font-bold text-verde underline" href={e.explorer} target="_blank" rel="noreferrer">{short(e.tx_hash!, 4)} <Icon name="open_in_new" size={16} /></a>}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
        <ErrorBox msg={err} onRetry={load} />
        {b.status === 'cancelled' && <Panel title={t('Cancelada')}><p>{t('La reserva se canceló y se procesó el reembolso del huésped. Cada movimiento está en el historial con su transacción de Stellar.')}</p></Panel>}
        {b.status === 'released' && <Panel title={t('Pagado')}><p>{t('El anfitrión recibió el pago de la estancia y se devolvió el depósito del huésped.')}</p></Panel>}
        {b.status === 'resolved' && <Panel title={t('Resuelto')}><p>{t('La decisión del árbitro ya se pagó. Cada movimiento está en el historial con su transacción de Stellar.')}</p></Panel>}

        {who === 'guest' && mine && open && phase === 'before' && (
          <Panel title={t('Cancelar')}>
            <p className="text-[15px]"><Rich text={t('Si cancelas ahora te devolvemos <b>{amount}</b>: {pct}% de la estancia y la comisión, más todo el depósito.', { amount: mxn(refundMxn.toFixed(2)), pct: refundPct })} /></p>
            <Button variant="ghost" block className="mt-3" disabled={!!busy} onClick={() => run('cancel')}>{busy === 'cancel' ? t('Cancelando…') : t('Cancelar reserva')}</Button>
          </Panel>
        )}
        {who === 'guest' && mine && open && phase !== 'before' && (
          <Panel title={t('Tu estancia')}>
            <p className="text-[15px]">{stayPaid
              ? t('El depósito sigue retenido y vuelve cuando cierran los reclamos o cuando lo liberas.')
              : ledger < stayPaidAt
                ? t('¿Algo mal con el lugar? Repórtalo antes del {date}; después, al anfitrión se le paga la estancia.', { date: when(new Date(stayPaidAt * 1000).toISOString()) })
                : t('Terminó la retención de la estancia. Ya se le puede pagar al anfitrión; el depósito por daños sigue en la garantía durante el periodo de reclamos.')}</p>
            {phase !== 'after' && <Button block className="mt-3" disabled={!!busy} onClick={() => run('release', { by: 'guest' })}>{busy === 'release' ? t('Liberando…') : stayPaid ? t('Liberar el depósito') : t('Liberar el pago al anfitrión')}</Button>}
            {phase === 'stay' && <Button variant="ghost" block className="mt-3" disabled={!!busy} onClick={() => run('dispute')}>{busy === 'dispute' ? t('Abriendo…') : t('Reportar un problema')}</Button>}
          </Panel>
        )}
        {who === 'host' && mine && open && (
          <Panel title={t('Acciones del anfitrión')}>
            {phase === 'stay' && <>
              <p className="text-[15px]">{t('¿Algo dañado? Reclámalo antes del cierre de reclamos: el árbitro decide cómo se reparte el depósito.')}</p>
              <Button variant="ghost" block className="mt-3" disabled={!!busy} onClick={() => run('claim-damage')}>{busy === 'claim-damage' ? t('Reclamando…') : t('Reclamar daños')}</Button>
            </>}
            {phase === 'before' && <p className="text-[15px]">{t('Recibes {amount} cuando termina la retención de la estancia.', { amount: mxn(b.subtotal_mxn) })}</p>}
            {phase === 'before' && <Button variant="peligro" block className="mt-3" disabled={!!busy} onClick={() => run('host-cancel')}>{busy === 'host-cancel' ? t('Cancelando…') : t('Cancelar y reembolsar todo al huésped')}</Button>}
          </Panel>
        )}
        {open && b.status === 'locked' && ledger >= stayPaidAt && (
          <Panel title={t('Pagar la estancia')}>
            <p className="text-[15px]">{t('Terminó la retención de la estancia. Ya se le puede pagar al anfitrión; el depósito por daños sigue en la garantía durante el periodo de reclamos.')}</p>
            <Button block className="mt-3" disabled={!!busy} onClick={() => run('pay-stay')}>{busy === 'pay-stay' ? t('Pagando al anfitrión…') : t('Pagar al anfitrión')}</Button>
          </Panel>
        )}
        {who === 'arbiter' && b.status === 'disputed' && (
          <Panel title={t('Resolver disputa')}>
            <p className="text-[14px] text-gris">{stayPaid
              ? t('Reparte solo el depósito de {amount}. La parte de la plataforma es MX$0.00.', { amount: mxn(b.deposit_mxn) })
              : t('Reparte los {amount} en garantía. La plataforma puede quedarse como máximo con su comisión.', { amount: mxn(b.total_mxn) })}</p>
            {(['guest', 'host', 'platform'] as const).map((k) => (
              <label key={k} className="mt-2 block text-[13px] font-bold text-gris">{t(SPLIT_LABEL[k])}
                <input inputMode="decimal" value={stayPaid && k === 'platform' ? '0.00' : split?.[k] ?? ''} readOnly={stayPaid && k === 'platform'} placeholder="0.00"
                  onChange={(e) => setSplit({ guest: split?.guest ?? '', host: split?.host ?? '', platform: split?.platform ?? '', [k]: e.target.value })}
                  className="mt-1 min-h-12 w-full rounded-sm border-2 border-tinta bg-fondo px-3 text-[16px] text-tinta" />
              </label>
            ))}
            <Button variant="ghost" className="mt-2" onClick={() => setSplit(stayPaid
              ? { guest: b.deposit_mxn, host: '0.00', platform: '0.00' }
              : { guest: b.deposit_mxn, host: b.subtotal_mxn, platform: b.fee_mxn })}>{t('Llenar: sin daños')}</Button>
            {splitSum && <div className={`mt-2 num text-[14px] ${splitSum.eq(stayPaid ? b.deposit_mxn : total) ? 'text-verde' : 'text-rojo'}`}>{t('Suma {sum} de {total}', { sum: mxn(splitSum.toFixed(2)), total: mxn(stayPaid ? b.deposit_mxn : b.total_mxn) })}</div>}
            <Button block className="mt-3" disabled={!!busy || !splitSum?.eq(stayPaid ? b.deposit_mxn : total) || (stayPaid ? new Big(split?.platform || 0).gt(0) : new Big(split?.platform || 0).gt(b.fee_mxn))} onClick={() => run('resolve', { split })}>
              {busy === 'resolve' ? t('Pagando…') : t('Resolver y pagar')}
            </Button>
          </Panel>
        )}
        {who === 'arbiter' && open && phase !== 'before' && phase !== 'after' && (
          <Panel title={t('Árbitro')}>
            <Button variant="ghost" block disabled={!!busy} onClick={() => run('release', { by: 'arbiter' })}>{busy === 'release' ? t('Liberando…') : stayPaid ? t('Liberar el depósito') : t('Liberar al anfitrión')}</Button>
          </Panel>
        )}
        {(open || b.status === 'disputed') && phase === 'after' && (
          <Panel title={t('Reclamos cerrados')}>
            <p className="text-[15px]">{stayPaid
              ? t('Cerraron los reclamos. Cualquiera puede liquidar la reserva; la estancia ya se pagó, así que el huésped recupera el depósito.')
              : t('Cerraron los reclamos. Cualquiera puede liquidar la reserva; el anfitrión recibe la estancia y el huésped el depósito.')}</p>
            <Button block className="mt-3" disabled={!!busy} onClick={() => run('settle-default')}>{busy === 'settle-default' ? t('Pagando…') : t('Liquidar por defecto')}</Button>
          </Panel>
        )}
        {b.status === 'disputed' && who !== 'arbiter' && <Panel title={t('En disputa')}><p>{stayPaid ? t('El anfitrión ya recibió el pago de la estancia. El depósito por daños sigue en la garantía mientras MicoPay revisa el reclamo.') : t('El pago sigue en la garantía mientras MicoPay revisa el reclamo.')} {t('Si el árbitro no decide en 7 días, el contrato paga por defecto.')}</p></Panel>}
      </div>
    </div>
  );
}
