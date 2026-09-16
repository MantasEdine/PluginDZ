-- Prospects : boutiques repérées, de quoi les joindre, et où l'on en est.
--
-- Deux clés d'unicité, pour deux façons de retomber sur la même boutique :
--   - (source, source_id) : le collecteur repasse et retrouve la même fiche Google ;
--   - phone_e164          : deux fiches différentes qui partagent un numéro sont,
--                           en pratique, la même personne — on ne l'écrit pas deux fois.
CREATE TABLE IF NOT EXISTS leads (
  id              BIGSERIAL PRIMARY KEY,
  source          TEXT        NOT NULL,
  source_id       TEXT        NOT NULL,
  name            TEXT        NOT NULL,
  phone_e164      TEXT,
  phone_national  TEXT,
  is_mobile       BOOLEAN     NOT NULL DEFAULT FALSE,
  address         TEXT,
  wilaya          TEXT,
  lat             DOUBLE PRECISION,
  lng             DOUBLE PRECISION,
  maps_url        TEXT,
  website         TEXT,
  rating          NUMERIC(2,1),
  rating_count    INTEGER,
  status          TEXT        NOT NULL DEFAULT 'nouveau',
  note            TEXT        NOT NULL DEFAULT '',
  first_seen_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  contacted_at    TIMESTAMPTZ,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT leads_source_unique UNIQUE (source, source_id),
  CONSTRAINT leads_status_check CHECK (
    status IN ('nouveau', 'contacte', 'interesse', 'client', 'pas_interesse', 'ne_pas_contacter')
  )
);

-- Unicité du numéro seulement quand il est connu : plusieurs fiches sans
-- numéro doivent pouvoir coexister.
CREATE UNIQUE INDEX IF NOT EXISTS leads_phone_e164_unique
  ON leads (phone_e164) WHERE phone_e164 IS NOT NULL;

-- Les filtres du back-office : par wilaya, par état, et « les plus récents ».
CREATE INDEX IF NOT EXISTS leads_wilaya_idx     ON leads (wilaya);
CREATE INDEX IF NOT EXISTS leads_status_idx     ON leads (status);
CREATE INDEX IF NOT EXISTS leads_first_seen_idx ON leads (first_seen_at DESC);
