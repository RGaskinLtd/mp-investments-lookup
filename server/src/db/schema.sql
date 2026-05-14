CREATE TABLE IF NOT EXISTS mps (
  id            SERIAL PRIMARY KEY,
  parliament_id INTEGER UNIQUE NOT NULL,
  name          TEXT NOT NULL,
  party         TEXT NOT NULL,
  constituency  TEXT,
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
