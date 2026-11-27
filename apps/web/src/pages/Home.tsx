import { Link } from 'react-router-dom';
import { api } from '../api';
import { Cover, EmptyState, ErrorBox, Loading, usePersona } from '../comun';
import { mxn } from '../format';
import { t } from '../i18n';
import { Label } from '../ui';
import { useData } from '../useData';

export default function Home() {
  const { data, loading, error, reload } = useData(api.listings);
  const { config } = usePersona();
  const fee = config ? `${Number(config.feeRate) * 100}%` : '3%';
  return (
    <div className="space-y-8">
      <section className="grid gap-6 md:grid-cols-[1.2fr_1fr] md:items-end">
        <div>
          <Label>Tepoztlán, Morelos</Label>
          <h1 className="mt-3 font-display text-[40px] font-extrabold leading-[1.02] md:text-[56px]" style={{ fontVariationSettings: '"wdth" 112' }}>
            {t('Reserva directo con el anfitrión. Paga a una garantía, no a un intermediario.')}
          </h1>
        </div>
        <div className="rounded-sm border-2 border-tinta bg-tinta p-5 text-papel shadow-solida">
          <div className="text-[11px] font-bold uppercase tracking-[.12em] text-gris-3">{t('Cómo funciona')}</div>
          <ol className="mt-2 space-y-1.5 text-[15px]">
            <li><b className="text-naranja-claro">1.</b> {t('Pagas desde tu app de MicoPay a una garantía en Stellar.')}</li>
            <li><b className="text-naranja-claro">2.</b> {t('Al anfitrión se le paga después del check-in, no antes.')}</li>
            <li><b className="text-naranja-claro">3.</b> {t('Cancela según la política, reclama daños o deja que el contrato pague solo.')}</li>
            <li><b className="text-naranja-claro">4.</b> {t('Una sola comisión de la plataforma:')} <b className="text-verde-brillo">{fee}</b>{t(', que ves antes de reservar.')}</li>
          </ol>
        </div>
      </section>

      <ErrorBox msg={error} onRetry={reload} />
      {loading ? (
        <Loading />
      ) : !data ? null : data.length > 0 ? (
        <section className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {data.map((l) => (
            <Link key={l.id} to={`/stay/${l.slug}`} className="group block rounded-sm border-2 border-tinta bg-papel shadow-solida active:translate-x-[3px] active:translate-y-[3px] active:shadow-solida-xs">
              <Cover n={l.cover} className="aspect-[4/3] border-0 border-b-2" />
              <div className="p-3.5">
                <div className="font-display text-[18px] font-extrabold leading-tight">{l.title}</div>
                <div className="text-[13px] text-gris">{l.area}</div>
                <div className="mt-2 text-[14px]">{l.summary}</div>
                <div className="mt-3 flex items-baseline justify-between">
                  <span className="num font-bold">{mxn(l.nightly_mxn)} <span className="font-normal text-gris">{t('/ noche')}</span></span>
                  <span className="text-[12px] text-gris">{t('{n} huéspedes', { n: l.max_guests })}</span>
                </div>
              </div>
            </Link>
          ))}
        </section>
      ) : (
        <EmptyState message={t('No hay alojamientos disponibles.')} />
      )}
    </div>
  );
}
