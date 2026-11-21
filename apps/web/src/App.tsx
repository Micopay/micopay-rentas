import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { api, type Config, type User } from './api';
import { PersonaCtx, type Persona } from './comun';
import { usdc } from './format';
import { useI18n, t } from './i18n';
import Home from './pages/Home';
import ListingPage from './pages/ListingPage';
import Trips from './pages/Trips';
import BookingPage from './pages/BookingPage';
import Hosting from './pages/Hosting';
import Disputes from './pages/Disputes';

const KEY = 'rentas.persona';
const read = () => { try { return localStorage.getItem(KEY); } catch { return null; } };
const write = (v: string) => { try { localStorage.setItem(KEY, v); } catch { /* private mode */ } };

export default function App() {
  const { lang, setLang } = useI18n();
  const [users, setUsers] = useState<User[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [who, setWho] = useState<string>(read() ?? 'guest');

  const reloadUsers = () => api.users().then(setUsers).catch(() => {});
  useEffect(() => {
    api.config().then(setConfig).catch(() => {});
    reloadUsers();
    const t = setInterval(reloadUsers, 15_000);
    return () => clearInterval(t);
  }, []);

  const persona: Persona | null = useMemo(() => {
    if (who === 'arbiter') return { kind: 'arbiter' };
    const u = who === 'guest' ? users.find((x) => x.role === 'guest') : users.find((x) => `host:${x.id}` === who);
    return u ? { kind: u.role, user: u } : null;
  }, [who, users]);

  const pick = (v: string) => { setWho(v); write(v); };
  const nav = ({ isActive }: { isActive: boolean }) =>
    `inline-flex min-h-12 min-w-12 items-center px-3 py-2 text-[14px] font-bold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 ${isActive ? 'bg-tinta text-papel' : 'text-tinta'}`;

  return (
    <PersonaCtx.Provider value={{ persona, config }}>
      <div className="min-h-screen overflow-x-hidden bg-fondo text-tinta" lang={lang}>
        <header className="border-b-2 border-tinta bg-papel">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
            <Link to="/" className="font-display text-[22px] font-extrabold leading-none" style={{ fontVariationSettings: '"wdth" 112' }}>
              MICO<span className="text-naranja">PAY</span> <span className="text-[14px] font-bold tracking-[.12em]">RENTAS</span>
            </Link>
            <nav className="flex flex-wrap gap-1">
              <NavLink to="/" end className={nav}>{t('Alojamientos')}</NavLink>
              {persona?.kind === 'guest' && <NavLink to="/trips" className={nav}>{t('Mis viajes')}</NavLink>}
              {persona?.kind === 'host' && <NavLink to="/hosting" className={nav}>{t('Anfitrión')}</NavLink>}
              {persona?.kind === 'arbiter' && <NavLink to="/disputes" className={nav}>{t('Disputas')}</NavLink>}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              {persona && persona.kind !== 'arbiter' && (
                <span className="num text-[13px] text-gris">{persona.user.balance ? usdc(persona.user.balance) : '—'}</span>
              )}
              <div role="group" aria-label={t('Idioma')} className="flex border-2 border-tinta">
                {(['es', 'en'] as const).map((l) => (
                  <button
                    key={l}
                    type="button"
                    aria-pressed={lang === l}
                    onClick={() => setLang(l)}
                    className={`min-h-12 min-w-12 px-3 text-[14px] font-bold focus-visible:outline focus-visible:outline-3 focus-visible:outline-offset-2 ${lang === l ? 'bg-tinta text-papel' : 'text-tinta'}`}
                  >
                    {l.toUpperCase()}
                  </button>
                ))}
              </div>
              <label className="flex min-w-0 items-center gap-2 text-[13px] font-bold">
                <span className="hidden sm:inline">{t('Actuando como')}</span>
                <select value={who} onChange={(e) => pick(e.target.value)} className="min-h-12 max-w-[200px] rounded-sm border-2 border-tinta bg-fondo px-2 text-[14px]">
                  {users.filter((u) => u.role === 'guest').map((u) => <option key={u.id} value="guest">{t('{name} · huésped', { name: u.name })}</option>)}
                  {users.filter((u) => u.role === 'host').map((u) => <option key={u.id} value={`host:${u.id}`}>{t('{name} · anfitrión', { name: u.name })}</option>)}
                  <option value="arbiter">{t('MicoPay · árbitro')}</option>
                </select>
              </label>
            </div>
          </div>
          {config && config.daySecs < 86_400 && (
            <div className="border-t-2 border-tinta bg-aviso px-4 py-1.5 text-center text-[12px] font-bold text-aviso-texto">
              {t('Demo en testnet · reloj de demo: 1 día calendario = {secs} s on-chain, así que el check-in y los pagos ocurren en minutos', { secs: config.daySecs })}
            </div>
          )}
        </header>
        <main className="mx-auto max-w-6xl px-4 py-6">
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/stay/:slug" element={<ListingPage />} />
            <Route path="/trips" element={<Trips />} />
            <Route path="/bookings/:id" element={<BookingPage onChange={reloadUsers} />} />
            <Route path="/hosting" element={<Hosting />} />
            <Route path="/disputes" element={<Disputes />} />
          </Routes>
        </main>
        <footer className="mx-auto max-w-6xl px-4 pb-8 text-[12px] text-gris">
          {t('Los pagos los retiene el contrato escrow-v2 en la testnet de Stellar')}{config && <> · <a className="underline" href={config.contractExplorer} target="_blank" rel="noreferrer">{config.contractId.slice(0, 8)}…</a></>}.
          {' '}{t('Los alojamientos son casas ficticias de demostración.')}
        </footer>
      </div>
    </PersonaCtx.Provider>
  );
}
