import Big from 'big.js';
import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api, type BookingDetail } from '../api';
import { Cover, ErrorBox, Panel, Row, StatusBadge, usePersona } from '../comun';
import { day, duration, mxn, short, usdc, when } from '../format';
import { Button, Icon, Label } from '../ui';

const EVENT: Record<string, string> = {
  locked: 'Paid into escrow', cancel: 'Cancelled by the guest', host_cancel: 'Cancelled by the host', release: 'Released to the host',
  dispute: 'Guest reported a problem', claim_damage: 'Host claimed damage', resolve: 'Arbiter split the escrow', settle_default: 'Paid out by default after the deadline',
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

  const load = () => api.booking(Number(id)).then((d) => { setB(d); setSkew(d.ledgerTime - Date.now() / 1000); }).catch((e: Error) => setErr(e.message));
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
            <div className="text-gris">{day(b.check_in)} → {day(b.check_out)} · {b.nights} night{b.nights > 1 ? 's' : ''} · {b.guests} guests</div>
            <div className="text-[14px] text-gris">Guest {b.guest_name} · Host {b.host_name}</div>
          </div>
        </div>

        <Panel title={<span className="flex items-center justify-between">Escrow on Stellar <StatusBadge s={b.status} /></span>}>
          <ol className="grid grid-cols-3 gap-2 text-[13px]">
            {[
              { t: 'Booked', at: null, done: true },
              { t: 'Check-in', at: checkIn, done: ledger >= checkIn },
              { t: 'Claims close', at: deadline, done: ledger >= deadline },
            ].map((s) => (
              <li key={s.t} className={`rounded-sm border-2 border-tinta px-2.5 py-2 ${s.done ? 'bg-tinta text-papel' : 'bg-fondo'}`}>
                <div className="font-bold">{s.t}</div>
                <div className={`num ${s.done ? 'text-gris-3' : 'text-gris'}`}>{s.at === null ? 'done' : s.done ? 'reached' : `in ${duration(s.at - ledger)}`}</div>
              </li>
            ))}
          </ol>
          {daySecs < 86_400 && <p className="mt-2 text-[12px] text-gris">Demo clock: the on-chain dates run at {daySecs} s per calendar day.</p>}

          <div className="mt-4 text-[15px]">
            <Row k="Stay (to the host)" v={<>{mxn(b.subtotal_mxn)} <span className="text-gris">· {usdc(b.amount_token)}</span></>} />
            <Row k="MicoPay fee" v={<>{mxn(b.fee_mxn)} <span className="text-gris">· {usdc(b.fee_token)}</span></>} />
            <Row k="Damage deposit" v={<>{mxn(b.deposit_mxn)} <span className="text-gris">· {usdc(b.deposit_token)}</span></>} />
            <Row strong k="Locked" v={mxn(b.total_mxn)} />
            <div className="text-right text-[12px] text-gris num">1 USD = {Number(b.fx_rate).toFixed(4)} MXN at booking</div>
          </div>
          {b.chain && (
            <div className="mt-3 rounded-sm border-2 border-tinta bg-fondo px-3 py-2 text-[13px]">
              <div className="flex items-center gap-1.5 font-bold"><Icon name="verified" size={18} /> Read from the contract just now</div>
              <div className="num">status {b.chain.status} · amount {b.chain.amount} · fee {b.chain.fee} · deposit {b.chain.deposit} USDC</div>
              <div className="num text-gris">booking id {short(b.escrow_id, 8)} = SHA-256 of the booking terms</div>
            </div>
          )}
        </Panel>

        <Panel title="History">
          <ul className="space-y-2 text-[14px]">
            {b.events.map((e) => (
              <li key={e.id} className="flex items-baseline justify-between gap-3">
                <span><b>{EVENT[e.kind] ?? e.kind}</b> <span className="text-gris">· {when(e.created_at)}</span></span>
                {e.explorer && <a className="flex items-center gap-1 whitespace-nowrap font-bold text-verde underline" href={e.explorer} target="_blank" rel="noreferrer">{short(e.tx_hash!, 4)} <Icon name="open_in_new" size={16} /></a>}
              </li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="min-w-0 space-y-4 lg:sticky lg:top-4 lg:self-start">
        <ErrorBox msg={err} />
        {!open && b.status !== 'disputed' && <Panel title="Closed"><p>This booking is settled. Every movement is in the history with its Stellar transaction.</p></Panel>}

        {who === 'guest' && mine && open && phase === 'before' && (
          <Panel title="Cancel">
            <p className="text-[15px]">Cancelling now returns <b className="num">{mxn(refundMxn.toFixed(2))}</b>: {refundPct}% of the stay and fee, plus the full deposit.</p>
            <Button variant="ghost" block className="mt-3" disabled={!!busy} onClick={() => run('cancel')}>{busy === 'cancel' ? 'Cancelling…' : 'Cancel booking'}</Button>
          </Panel>
        )}
        {who === 'guest' && mine && open && phase !== 'before' && (
          <Panel title="Your stay">
            <p className="text-[15px]">Everything fine? Release the payment and get your deposit back now. If you do nothing, the contract pays the host when claims close.</p>
            <Button block className="mt-3" disabled={!!busy} onClick={() => run('release', { by: 'guest' })}>{busy === 'release' ? 'Releasing…' : 'Release payment to host'}</Button>
            {phase === 'stay' && <Button variant="ghost" block className="mt-3" disabled={!!busy} onClick={() => run('dispute')}>{busy === 'dispute' ? 'Opening…' : 'Report a problem'}</Button>}
          </Panel>
        )}
        {who === 'host' && mine && open && (
          <Panel title="Host actions">
            {phase === 'stay' && <>
              <p className="text-[15px]">Something damaged? Claim it before claims close: the arbiter decides how the deposit is split.</p>
              <Button variant="ghost" block className="mt-3" disabled={!!busy} onClick={() => run('claim-damage')}>{busy === 'claim-damage' ? 'Claiming…' : 'Claim damage'}</Button>
            </>}
            {phase === 'before' && <p className="text-[15px]">You are paid {mxn(b.subtotal_mxn)} after check-in.</p>}
            <Button variant="peligro" block className="mt-3" disabled={!!busy} onClick={() => run('host-cancel')}>{busy === 'host-cancel' ? 'Cancelling…' : 'Cancel and refund the guest in full'}</Button>
          </Panel>
        )}
        {who === 'arbiter' && b.status === 'disputed' && (
          <Panel title="Resolve dispute">
            <p className="text-[14px] text-gris">Split the {mxn(b.total_mxn)} in escrow. The platform can keep at most its fee.</p>
            {(['guest', 'host', 'platform'] as const).map((k) => (
              <label key={k} className="mt-2 block text-[13px] font-bold capitalize text-gris">To {k} (MXN)
                <input inputMode="decimal" value={split?.[k] ?? ''} placeholder="0.00"
                  onChange={(e) => setSplit({ guest: split?.guest ?? '', host: split?.host ?? '', platform: split?.platform ?? '', [k]: e.target.value })}
                  className="mt-1 min-h-12 w-full rounded-sm border-2 border-tinta bg-fondo px-3 text-[16px] text-tinta" />
              </label>
            ))}
            <Button variant="ghost" className="mt-2" onClick={() => setSplit({ guest: b.deposit_mxn, host: b.subtotal_mxn, platform: b.fee_mxn })}>Fill: no damage</Button>
            {splitSum && <div className={`mt-2 num text-[14px] ${splitSum.eq(total) ? 'text-verde' : 'text-rojo'}`}>Sum {mxn(splitSum.toFixed(2))} of {mxn(b.total_mxn)}</div>}
            <Button block className="mt-3" disabled={!!busy || !splitSum?.eq(total) || new Big(split?.platform || 0).gt(b.fee_mxn)} onClick={() => run('resolve', { split })}>
              {busy === 'resolve' ? 'Paying out…' : 'Resolve and pay out'}
            </Button>
          </Panel>
        )}
        {who === 'arbiter' && open && phase !== 'before' && (
          <Panel title="Arbiter">
            <Button variant="ghost" block disabled={!!busy} onClick={() => run('release', { by: 'arbiter' })}>{busy === 'release' ? 'Releasing…' : 'Release to host'}</Button>
          </Panel>
        )}
        {open && phase === 'after' && (
          <Panel title="Claims closed">
            <p className="text-[15px]">Nobody acted, so anyone can finish it: the host gets the stay, the guest the deposit.</p>
            <Button block className="mt-3" disabled={!!busy} onClick={() => run('settle-default')}>{busy === 'settle-default' ? 'Paying out…' : 'Settle by default'}</Button>
          </Panel>
        )}
        {b.status === 'disputed' && who !== 'arbiter' && <Panel title="In dispute"><p>MicoPay is reviewing it. If the arbiter doesn't decide within 7 days, the contract pays out by default.</p></Panel>}
      </div>
    </div>
  );
}
