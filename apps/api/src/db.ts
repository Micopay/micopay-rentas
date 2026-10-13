import { PGlite } from '@electric-sql/pglite';
import { mkdirSync } from 'node:fs';

/** Local development on PGlite (Postgres in WASM). Plain Postgres SQL, so it moves to AWS as is. */
export type Db = PGlite;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id              SERIAL PRIMARY KEY,
  name            TEXT NOT NULL,
  role            TEXT NOT NULL CHECK (role IN ('host', 'guest')),
  stellar_address VARCHAR(56) NOT NULL UNIQUE,
  bio             TEXT
);

CREATE TABLE IF NOT EXISTS listings (
  id            SERIAL PRIMARY KEY,
  host_id       INT NOT NULL REFERENCES users(id),
  slug          TEXT NOT NULL UNIQUE,
  title         TEXT NOT NULL,
  area          TEXT NOT NULL,
  summary       TEXT NOT NULL,
  description   TEXT NOT NULL,
  nightly_mxn   NUMERIC(12,2) NOT NULL,
  cleaning_mxn  NUMERIC(12,2) NOT NULL,
  deposit_mxn   NUMERIC(12,2) NOT NULL,
  max_guests    INT NOT NULL,
  bedrooms      INT NOT NULL,
  policy        TEXT NOT NULL CHECK (policy IN ('flexible', 'moderate', 'strict')),
  amenities     JSONB NOT NULL DEFAULT '[]',
  cover         INT NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS bookings (
  id              SERIAL PRIMARY KEY,
  reference       VARCHAR(20) NOT NULL UNIQUE,
  listing_id      INT NOT NULL REFERENCES listings(id),
  guest_id        INT NOT NULL REFERENCES users(id),
  check_in        DATE NOT NULL,
  check_out       DATE NOT NULL,
  nights          INT NOT NULL,
  guests          INT NOT NULL,
  nightly_mxn     NUMERIC(12,2) NOT NULL,
  cleaning_mxn    NUMERIC(12,2) NOT NULL,
  subtotal_mxn    NUMERIC(12,2) NOT NULL,
  fee_mxn         NUMERIC(12,2) NOT NULL,
  deposit_mxn     NUMERIC(12,2) NOT NULL,
  total_mxn       NUMERIC(12,2) NOT NULL,
  fx_rate         NUMERIC(14,6) NOT NULL,
  amount_token    NUMERIC(20,7) NOT NULL,
  fee_token       NUMERIC(20,7) NOT NULL,
  deposit_token   NUMERIC(20,7) NOT NULL,
  policy          TEXT NOT NULL,
  tiers           JSONB NOT NULL,
  escrow_id       CHAR(64) NOT NULL UNIQUE,
  chain_check_in  BIGINT NOT NULL,
  chain_deadline  BIGINT NOT NULL,
  status          TEXT NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS booking_events (
  id          SERIAL PRIMARY KEY,
  booking_id  INT NOT NULL REFERENCES bookings(id),
  kind        TEXT NOT NULL,
  actor       TEXT NOT NULL,
  tx_hash     CHAR(64),
  details     JSONB NOT NULL DEFAULT '{}',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export async function openDb(dir: string): Promise<Db> {
  mkdirSync(dir, { recursive: true });
  const db = new PGlite(dir);
  await db.exec(SCHEMA);
  return db;
}
