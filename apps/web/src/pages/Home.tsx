import { Link } from 'react-router-dom';
import { api } from '../api';
import { Cover, ErrorBox, usePersona } from '../comun';
import { mxn } from '../format';
import { Label } from '../ui';
import { useData } from '../useData';

export default function Home() {
  const { data, error } = useData(api.listings);
  const { config } = usePersona();
  const fee = config ? `${Number(config.feeRate) * 100}%` : '3%';
  return (
    <div className="space-y-8">
      <section className="grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-end">
        <div>
          <Label>Tepoztlán, Morelos</Label>
          <h1 className="mt-3 font-display text-[40px] font-extrabold leading-[1.02] md:text-[56px]" style={{ fontVariationSettings: '"wdth" 112' }}>
            Book directly with the host. Pay into an escrow, not a middleman.
          </h1>
        </div>
        <div className="rounded-sm border-2 border-tinta bg-tinta p-5 text-papel shadow-solida">
          <div className="text-[11px] font-bold uppercase tracking-[.12em] text-gris-3">How it works</div>
          <ol className="mt-2 space-y-1.5 text-[15px]">
            <li><b className="text-naranja-claro">1.</b> You pay from your MicoPay app into a Stellar escrow.</li>
            <li><b className="text-naranja-claro">2.</b> The host is paid after check-in, not before.</li>
            <li><b className="text-naranja-claro">3.</b> Cancel by the policy, dispute damage, or let the contract pay out on its own.</li>
            <li><b className="text-naranja-claro">4.</b> One platform fee: <b className="text-verde-brillo">{fee}</b>, shown before you book.</li>
          </ol>
        </div>
      </section>

      <ErrorBox msg={error} />
      <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
        {data?.map((l) => (
          <Link key={l.id} to={`/stay/${l.slug}`} className="group block rounded-sm border-2 border-tinta bg-papel shadow-solida active:translate-x-[3px] active:translate-y-[3px] active:shadow-solida-xs">
            <Cover n={l.cover} className="aspect-[4/3] border-0 border-b-2" />
            <div className="p-3.5">
              <div className="font-display text-[18px] font-extrabold leading-tight">{l.title}</div>
              <div className="text-[13px] text-gris">{l.area}</div>
              <div className="mt-2 text-[14px]">{l.summary}</div>
              <div className="mt-3 flex items-baseline justify-between">
                <span className="num font-bold">{mxn(l.nightly_mxn)} <span className="font-normal text-gris">/ night</span></span>
                <span className="text-[12px] text-gris">{l.max_guests} guests</span>
              </div>
            </div>
          </Link>
        ))}
      </section>
    </div>
  );
}
