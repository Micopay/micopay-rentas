import Big from 'big.js';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type BookingDetail } from '../api';
import { Cover, ErrorBox, Panel, Row, StatusBadge, usePersona } from '../comun';
import { day, duration, mxn, short, usdc, when } from '../format';
import { genericError, t } from '../i18n';
import { Button, Icon, Label } from '../ui';

// Event labels are keyed by stable identifiers and resolved at render time.
const EVENT: Record<string, () => string> = {
  locked: () => t('Paid into escrow'),
  cancel: () => t('Cancelled by the guest'),
  host_cancel: () => t('Cancelled by the host'),
  release: () => t('Released to the host'),
  dispute: () => t('Guest reported a problem'),
  claim_damage: () => t('Host claimed damage'),
  resolve: () => t('Arbiter split the escrow'),
  settle_default: () => t('Paid out by default after the deadline'),
};

export default function BookingPage({ onChange }: { onChange: () => void }) {
  const { id = '' } = useParams();
  const { persona, config } = usePersona();
  const [b, setB] = useState<BookingDetail | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [skew, setSkew] = useState(0); // ledger clock − local clock
  const [now, setNow] = useState(Date.now() / 1000);
  const [split, setSplit] = useState<{ guest: string; host: string; platform: string } | null>(null);

  const load = () => api.booking(Number(id)).then((d) => { setB(d); setSkew(d.ledgerTime - Date.now() / 1000); }).catch(() => setErr(genericError()));
  useEffect(() => { load(); const t = setInterval(load, 10_000); return () => clearInterval(t); }, [id]);
  useEffect(() => { const t = setInterval(() => setNow(Date.now() / 1000), 1000); return () => clearInterval(t); }, []);

  if (!b) return <ErrorBox msg={err} />;
  const ledger = now + skew;
  const checkIn = Number(b.chain_check_in), deadline = Number(b.chain_deadline);
  const phase = ledger < checkIn ? 'before' : ledger < deadline ? 'stay' : 'after';
  const open = b.status === 'locked';
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
    } catch {
      setErr(genericError());
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
            <div className="text-gris">{day(b.check_in)} → {day(b.check_out)} · {t('{n} nights', { n: b.nights })} · {t('{n} guests', { n: b.guests })}</div>
            <div className="text-[14px] text-gris">{t('Guest {name}', { name: b.guest_name })} · {t('Host {name}', { name: b.host_name })}</div>
          </div>
        </div>

        <Panel title={<span className="flex items-center justify-between">{t('Escrow on Stellar')} <StatusBadge s={b.status} /></span>}>
          <ol className="grid grid-cols-3 gap-2 text-[13px]">
            {[
              { t: t('Booked'), at: null, done: true },
              { t: t('Check-in'), at: checkIn, done: ledger >= checkIn },
              { t: t('Claims close'), at: deadline, done: ledger >= deadline },
            ].map((s) => (
              <li key={s.t} className={`rounded-sm border-2 border-tinta px-2.5 py-2 ${s.done ? 'bg-tinta text-papel' : 'bg-fondo'}`}>
                <div className="font-bold">{s.t}</div>
                <div className={`num ${s.done ? 'text-gris-3' : 'text-gris'}`}>{s.at === null ? t('done') : s.done ? t('reached') : t('in {time}', { time: duration(s.at - ledger) })}</div>
              </li>
            ))}
          </ol>
          {daySecs < 86_400 && <p className="mt-2 text-[12px] text-gris">{t('Demo clock: the on-chain dates run at {secs} s per calendar day.', { secs: daySecs })}</p>}

          <div className="mt-4 text-[15px]">
            <Row k={t('Stay (to the host)')} v={<>{mxn(b.subtotal_mxn)} <span className="text-gris">· {usdc(b.amount_token)}</span></>} />
            <Row k={t('MicoPay fee')} v={<>{mxn(b.fee_mxn)} <span className="text-gris">· {usdc(b.fee_token)}</span></>} />
            <Row k={t('Damage deposit')} v={<>{mxn(b.deposit_mxn)} <span className="text-gris">· {usdc(b.deposit_token)}</span></>} />
            <Row strong k={t('Locked')} v={mxn(b.total_mxn)} />
            <div className="text-right text-[12px] text-gris num">{t('1 USD = {rate} MXN at booking', { rate: Number(b.fx_rate).toFixed(4) })}</div>
          </div>
          {b.chain && (
            <div className="mt-3 rounded-sm border-2 border-tinta bg-fondo px-3 py-2 text-[13px]">
              <div className="flex items-center gap-1.5 font-bold"><Icon name="verified" size={18} /> {t('Read from the contract just now')}</div>
              <div className="num">{t('status {status} · amount {amount} · fee {fee} · deposit {deposit} USDC', { status: b.chain.status, amount: b.chain.amount, fee: b.chain.fee, deposit: b.chain.deposit })}</div>
              <div className="num text-gris">{t('booking id {id} = SHA-256 of the booking terms', { id: short(b.escrow_id, 8) })}</div>
            </div>
          )}
        </Panel>

        <Panel title={t('History')}>
          <ul className="space-y-2 text-[14px]">
            {b.events.map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-3">
                <span><b>{EVENT[e.kind]?.() ?? e.kind}</b> <span className="text-gris">· {when(e.created_at)}</span></span>
                {e.explorer && <a className="flex min-h-12 items-center gap-1 whitespace-nowrap font-bold text-verde underline focus-visible:outline-2 focus-visible:outline-offset-2" href={e.explorer} target="_blank" rel="noreferrer">{short(e.tx_hash!, 4)} <Icon name="open_in_new" size={16} /></a>}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
        <ErrorBox msg={err} />
        {!open && b.status !== 'disputed' && <Panel title={t('Closed')}><p>{t('This booking is settled. Every movement is in the history with its Stellar transaction.')}</p></Panel>}

        {who === 'guest' && mine && open && phase === 'before' && (
          <Panel title={t('Cancel')}>
            <p className="text-[15px]">{t('Cancelling now returns {amount}: {pct}% of the stay and fee, plus the full deposit.', { amount: mxn(refundMxn.toFixed(2)), pct: refundPct })}</p>
            <Button variant="ghost" block className="mt-3" disabled={!!busy} onClick={() => run('cancel')}>{busy === 'cancel' ? t('Cancelling…') : t('Cancel booking')}</Button>
          </Panel>
        )}
        {who === 'guest' && mine && open && phase !== 'before' && (
          <Panel title={t('Your stay')}>
            <p className="text-[15px]">{t('Everything fine? Release the payment and get your deposit back now. If you do nothing, the contract pays the host when claims close.')}</p>
            <Button block className="mt-3" disabled={!!busy} onClick={() => run('release', { by: 'guest' })}>{busy === 'release' ? t('Releasing…') : t('Release payment to host')}</Button>
            {phase === 'stay' && <Button variant="ghost" block className="mt-3" disabled={!!busy} onClick={() => run('dispute')}>{busy === 'dispute' ? t('Opening…') : t('Report a problem')}</Button>}
          </Panel>
        )}
        {who === 'host' && mine && open && (
          <Panel title={t('Host actions')}>
            {phase === 'stay' && <>
              <p className="text-[15px]">{t('Something damaged? Claim it before claims close: the arbiter decides how the deposit is split.')}</p>
              <Button variant="ghost" block className="mt-3" disabled={!!busy} onClick={() => run('claim-damage')}>{busy === 'claim-damage' ? t('Claiming…') : t('Claim damage')}</Button>
            </>}
            {phase === 'before' && <p className="text-[15px]">{t('You are paid {amount} after check-in.', { amount: mxn(b.subtotal_mxn) })}</p>}
            <Button variant="peligro" block className="mt-3" disabled={!!busy} onClick={() => run('host-cancel')}>{busy === 'host-cancel' ? t('Cancelling…') : t('Cancel and refund the guest in full')}</Button>
          </Panel>
        )}
        {who === 'arbiter' && b.status === 'disputed' && (
          <Panel title={t('Resolve dispute')}>
            <p className="text-[14px] text-gris">{t('Split the {amount} in escrow. The platform can keep at most its fee.', { amount: mxn(b.total_mxn) })}</p>
            {(['guest', 'host', 'platform'] as const).map((k) => (
              <label key={k} className="mt-2 block text-[13px] font-bold text-gris">{t('To {party} (MXN)', { party: t(k) })}
                <input inputMode="decimal" value={split?.[k] ?? ''} placeholder="0.00"
                  onChange={(e) => setSplit({ guest: split?.guest ?? '', host: split?.host ?? '', platform: split?.platform ?? '', [k]: e.target.value })}
                  className="mt-1 min-h-12 w-full rounded-sm border-2 border-tinta bg-fondo px-3 text-[16px] text-tinta focus-visible:outline-2 focus-visible:outline-offset-2" />
              </label>
            ))}
            <Button variant="ghost" className="mt-2" onClick={() => setSplit({ guest: b.deposit_mxn, host: b.subtotal_mxn, platform: b.fee_mxn })}>{t('Fill: no damage')}</Button>
            {splitSum && <div className={`mt-2 num text-[14px] ${splitSum.eq(total) ? 'text-verde' : 'text-rojo'}`}>{t('Sum {sum} of {total}', { sum: mxn(splitSum.toFixed(2)), total: mxn(b.total_mxn) })}</div>}
            <Button block className="mt-3" disabled={!!busy || !splitSum?.eq(total) || new Big(split?.platform || 0).gt(b.fee_mxn)} onClick={() => run('resolve', { split })}>
              {busy === 'resolve' ? t('Paying out…') : t('Resolve and pay out')}
            </Button>
          </Panel>
        )}
        {who === 'arbiter' && open && phase !== 'before' && (
          <Panel title={t('Arbiter')}>
            <Button variant="ghost" block disabled={!!busy} onClick={() => run('release', { by: 'arbiter' })}>{busy === 'release' ? t('Releasing…') : t('Release to host')}</Button>
          </Panel>
        )}
        {open && phase === 'after' && (
          <Panel title={t('Claims closed')}>
            <p className="text-[15px]">{t('Nobody acted, so anyone can finish it: the host gets the stay, the guest the deposit.')}</p>
            <Button block className="mt-3" disabled={!!busy} onClick={() => run('settle-default')}>{busy === 'settle-default' ? t('Paying out…') : t('Settle by default')}</Button>
          </Panel>
        )}
        {b.status === 'disputed' && who !== 'arbiter' && <Panel title={t('In dispute')}><p>{t('MicoPay is reviewing it. If the arbiter doesn\'t decide within 7 days, the contract pays out by default.')}</p></Panel>}
      </div>
    </div>
  );
}
