import { useEffect, useMemo, useState } from 'react';
import { Link, NavLink, Route, Routes } from 'react-router-dom';
import { api, type Config, type User } from './api';
import { PersonaCtx, type Persona } from './comun';
import { usdc } from './format';
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
              <NavLink to="/" end className={nav}>Stays</NavLink>
              {persona?.kind === 'guest' && <NavLink to="/trips" className={nav}>My trips</NavLink>}
              {persona?.kind === 'host' && <NavLink to="/hosting" className={nav}>Hosting</NavLink>}
              {persona?.kind === 'arbiter' && <NavLink to="/disputes" className={nav}>Disputes</NavLink>}
            </nav>
            <div className="ml-auto flex items-center gap-3">
              {persona && persona.kind !== 'arbiter' && (
                <span className="num text-[13px] text-gris">{persona.user.balance ? usdc(persona.user.balance) : '—'}</span>
              )}
              <label className="flex min-w-0 items-center gap-2 text-[13px] font-bold">
                <span className="hidden sm:inline">Acting as</span>
                <select value={who} onChange={(e) => pick(e.target.value)} className="min-h-10 max-w-[200px] rounded-sm border-2 border-tinta bg-fondo px-2 text-[14px]">
                  {users.filter((u) => u.role === 'guest').map((u) => <option key={u.id} value="guest">{u.name} · guest</option>)}
                  {users.filter((u) => u.role === 'host').map((u) => <option key={u.id} value={`host:${u.id}`}>{u.name} · host</option>)}
                  <option value="arbiter">MicoPay · arbiter</option>
                </select>
              </label>
            </div>
          </div>
          {config && config.daySecs < 86_400 && (
            <div className="border-t-2 border-tinta bg-aviso px-4 py-1.5 text-center text-[12px] font-bold text-aviso-texto">
              Testnet demo · demo clock: 1 calendar day = {config.daySecs} s on-chain, so check-in and payouts happen within minutes
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
          Payments are held by the escrow-v2 contract on Stellar testnet{config && <> · <a className="underline" href={config.contractExplorer} target="_blank" rel="noreferrer">{config.contractId.slice(0, 8)}…</a></>}.
          Listings are fictional demo homes.
        </footer>
      </div>
    </PersonaCtx.Provider>
  );
}
