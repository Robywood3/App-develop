-- Casa App schema (docs/architettura.md, section 6).
CREATE EXTENSION IF NOT EXISTS timescaledb;

-- Single house log: raw values of every entity with `log: true`.
CREATE TABLE misure (
    ts           timestamptz      NOT NULL,
    entita       text             NOT NULL,   -- logical name from config/entities.yaml
    valore_num   double precision,
    valore_testo text,
    attributi    jsonb
);
SELECT create_hypertable('misure', 'ts', chunk_time_interval => INTERVAL '1 day');
CREATE INDEX misure_entita_ts ON misure (entita, ts DESC);

ALTER TABLE misure SET (timescaledb.compress, timescaledb.compress_segmentby = 'entita', timescaledb.compress_orderby = 'ts DESC');
SELECT add_compression_policy('misure', INTERVAL '7 days');
SELECT add_retention_policy('misure', INTERVAL '365 days');

-- Continuous aggregates: mean, min, max per entity. Kept forever.
CREATE MATERIALIZED VIEW misure_5min WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT time_bucket(INTERVAL '5 minutes', ts) AS bucket, entita,
       avg(valore_num) AS media, min(valore_num) AS minimo, max(valore_num) AS massimo
FROM misure WHERE valore_num IS NOT NULL
GROUP BY bucket, entita WITH NO DATA;
SELECT add_continuous_aggregate_policy('misure_5min', start_offset => INTERVAL '3 days', end_offset => INTERVAL '5 minutes', schedule_interval => INTERVAL '5 minutes');

CREATE MATERIALIZED VIEW misure_1h WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT time_bucket(INTERVAL '1 hour', ts) AS bucket, entita,
       avg(valore_num) AS media, min(valore_num) AS minimo, max(valore_num) AS massimo
FROM misure WHERE valore_num IS NOT NULL
GROUP BY bucket, entita WITH NO DATA;
SELECT add_continuous_aggregate_policy('misure_1h', start_offset => INTERVAL '7 days', end_offset => INTERVAL '1 hour', schedule_interval => INTERVAL '30 minutes');

CREATE MATERIALIZED VIEW misure_1g WITH (timescaledb.continuous, timescaledb.materialized_only = false) AS
SELECT time_bucket(INTERVAL '1 day', ts) AS bucket, entita,
       avg(valore_num) AS media, min(valore_num) AS minimo, max(valore_num) AS massimo
FROM misure WHERE valore_num IS NOT NULL
GROUP BY bucket, entita WITH NO DATA;
SELECT add_continuous_aggregate_policy('misure_1g', start_offset => INTERVAL '30 days', end_offset => INTERVAL '1 day', schedule_interval => INTERVAL '6 hours');

-- Users and sessions.
CREATE TABLE utenti (
    id          serial PRIMARY KEY,
    nome        text UNIQUE NOT NULL,
    hash        text NOT NULL,
    ruolo       text NOT NULL CHECK (ruolo IN ('admin', 'utente', 'tv', 'lettura')),
    dispositivi jsonb NOT NULL DEFAULT '[]',
    creato      timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE sessioni (
    token_hash  text PRIMARY KEY,
    utente_id   integer NOT NULL REFERENCES utenti(id) ON DELETE CASCADE,
    dispositivo text NOT NULL,
    scade       timestamptz NOT NULL,
    creata      timestamptz NOT NULL DEFAULT now(),
    ultimo_uso  timestamptz NOT NULL DEFAULT now()
);

-- Command log (RF-07): every command, also the rejected ones.
CREATE TABLE comandi (
    id       bigserial PRIMARY KEY,
    ts       timestamptz NOT NULL DEFAULT now(),
    utente   text NOT NULL,
    servizio text,
    target   text NOT NULL,
    valore   jsonb,
    esito    text NOT NULL
);
CREATE INDEX comandi_ts ON comandi (ts DESC);

-- Camera events from Frigate (MQTT frigate/events). Kept 30 days, like the clips.
CREATE TABLE eventi_video (
    ts          timestamptz NOT NULL,
    fine        timestamptz,
    telecamera  text NOT NULL,
    oggetto     text NOT NULL,
    id_frigate  text NOT NULL,
    clip        boolean NOT NULL DEFAULT false,
    punteggio   double precision,
    UNIQUE (id_frigate, ts)
);
SELECT create_hypertable('eventi_video', 'ts', chunk_time_interval => INTERVAL '7 days');
CREATE INDEX eventi_video_cam ON eventi_video (telecamera, ts DESC);
SELECT add_retention_policy('eventi_video', INTERVAL '30 days');
