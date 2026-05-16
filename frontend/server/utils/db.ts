import pg from 'pg';

const { Pool } = pg;

const SCHEMA = `
CREATE TABLE IF NOT EXISTS mps (
  id              SERIAL PRIMARY KEY,
  parliament_id   INTEGER UNIQUE NOT NULL,
  name            TEXT NOT NULL,
  party           TEXT NOT NULL,
  constituency    TEXT,
  thumbnail_url   TEXT,
  name_full_title TEXT,
  cached_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS interests (
  id           SERIAL PRIMARY KEY,
  mp_id        INTEGER NOT NULL REFERENCES mps(parliament_id) ON DELETE CASCADE,
  category     TEXT,
  raw_text     TEXT NOT NULL,
  company_name TEXT,
  amount_gbp   NUMERIC,
  cached_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS companies (
  id             SERIAL PRIMARY KEY,
  company_number TEXT UNIQUE NOT NULL,
  name           TEXT NOT NULL,
  status         TEXT,
  sic_codes      TEXT[],
  cached_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mps_party       ON mps(party);
CREATE INDEX IF NOT EXISTS idx_interests_mp_id ON interests(mp_id);
CREATE INDEX IF NOT EXISTS idx_companies_name  ON companies(LOWER(name));
`;

let _pool: pg.Pool | null = null;
let _schemaReady = false;

export async function getPool(): Promise<pg.Pool> {
  if (!_pool) {
    const connectionString = process.env.DATABASE_URL;
    const needsSsl =
      connectionString?.includes('neon.tech') ||
      connectionString?.includes('sslmode=require');

    _pool = new Pool({
      connectionString,
      ssl: needsSsl ? { rejectUnauthorized: false } : undefined,
      // Serverless-friendly: one connection per function instance
      max: 1,
      idleTimeoutMillis: 0,
    });
  }

  if (!_schemaReady) {
    await _pool.query(SCHEMA);
    _schemaReady = true;
  }

  return _pool;
}
