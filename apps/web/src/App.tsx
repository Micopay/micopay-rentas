import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { api, type Config, type User } from './api';
import { ErrorBox, PersonaCtx, type Persona } from './comun';
import { usdc } from './format';
import { lang, setLang, t } from './i18n';
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
  const [users, setUsers] = useState<User[]>([]);
  const [config, setConfig] = useState<Config | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [configError, setConfigError] = useState<string | null>(null);
  const [who, setWho] = useState<string>(read() ?? 'guest');

  const reloadUsers = () => {
    setUsersError(null);
    api.users().then(setUsers).catch((e: Error) => setUsersError(e.message));
  };
  const reloadConfig = () => {
    setConfigError(null);
    api.config().then(setConfig).catch((e: Error) => setConfigError(e.message));
  };
  useEffect(() => {
    reloadConfig();
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
    `px-3 py-2 text-[14px] font-bold ${isActive ? 'bg-tinta text-papel' : 'text-tinta'}`;

  return (
    <PersonaCtx.Provider value={{ persona, config }}>
      <div className="min-h-screen overflow-x-hidden bg-fondo text-tinta">
        <header className="border-b-2 border-tinta bg-papel">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-3 px-4 py-3">
            <Link to="/" className="font-display text-[22px] font-extrabold leading-none" style={{ fontVariationSettings: '"wdth" 112' }}>
              MICO<span className="text-naranja">PAY</span> <span className="text-[14px] font-bold tracking-[.12em]">RENTAS</span>
            </Link>
            <nav className="flex flex-wrap gap-1">
              <NavLink to="/" end className={nav}>{t('Estancias')}</NavLink>
              {persona?.kind === 'guest' && <NavLink to="/trips" className={nav}>{t('Mis viajes')}</NavLink>}
              {persona?.kind === 'host' && <NavLink to="/hosting" className={nav}>{t('Anfitrión')}</NavLink>}
              {persona?.kind === 'arbiter' && <NavLink to="/disputes" className={nav}>{t('Disputas')}</NavLink>}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              {usersError ? (
                <button onClick={reloadUsers} className="min-h-12 px-2 text-[13px] font-bold text-rojo underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">{t('No se pudieron cargar los usuarios · Reintentar')}</button>
              ) : persona && persona.kind !== 'arbiter' ? (
                <span className="num text-[13px] text-gris">{persona.user.balance ? usdc(persona.user.balance) : '—'}</span>
              ) : null}
              <label className="flex min-w-0 items-center gap-2 text-[13px] font-bold">
                <span className="hidden sm:inline">{t('Actuando como')}</span>
                <select value={who} onChange={(e) => pick(e.target.value)} className="min-h-10 max-w-[200px] rounded-sm border-2 border-tinta bg-fondo px-2 text-[14px]">
                  {users.filter((u) => u.role === 'guest').map((u) => <option key={u.id} value="guest">{u.name} · {t('huésped')}</option>)}
                  {users.filter((u) => u.role === 'host').map((u) => <option key={u.id} value={`host:${u.id}`}>{u.name} · {t('anfitrión')}</option>)}
                  <option value="arbiter">MicoPay · {t('árbitro')}</option>
                </select>
              </label>
              <div className="flex" role="group" aria-label={t('Idioma')}>
                {(['es', 'en'] as const).map((l) => (
                  <button key={l} type="button" onClick={() => setLang(l)} aria-pressed={lang === l}
                    className={`min-h-12 min-w-12 border-2 border-tinta px-2 text-[13px] font-bold uppercase focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-tinta ${lang === l ? 'bg-tinta text-papel' : 'bg-papel text-tinta'}`}>{l}</button>
                ))}
              </div>
            </div>
          </div>
          {configError && <div className="border-t-2 border-tinta bg-rojo-suave px-4 py-1.5 text-center text-[12px] font-bold text-rojo">{t('No se pudo cargar la configuración.')} <button onClick={reloadConfig} className="min-h-12 min-w-12 px-2 underline focus-visible:outline focus-visible:outline-2 focus-visible:outline-rojo">{t('Reintentar')}</button></div>}
          {config && config.daySecs < 86_400 && (
            <div className="border-t-2 border-tinta bg-aviso px-4 py-1.5 text-center text-[12px] font-bold text-aviso-texto">
              {t('Demo en testnet · reloj de demo: 1 día calendario = {secs} s en la cadena, así que el check-in y los pagos ocurren en minutos', { secs: config.daySecs })}
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
          {t('Los pagos los retiene el contrato escrow-v2 en Stellar testnet')}{config && <> · <a className="underline" href={config.contractExplorer} target="_blank" rel="noreferrer">{config.contractId.slice(0, 8)}…</a></>}.
          {' '}{t('Los alojamientos son casas de demostración ficticias.')}
        </footer>
      </div>
    </PersonaCtx.Provider>
  );
}
