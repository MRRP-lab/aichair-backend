-- runs once, on the first start of an empty pgdata volume, before seed.sql
-- (both are mounted into /docker-entrypoint-initdb.d by docker-compose.yml)

CREATE EXTENSION IF NOT EXISTS postgis;

-- one row per access barrier report
CREATE TABLE reports (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    osm_id        bigint,                                   -- nullable; OpenStreetMap node id, if known
    lat           double precision NOT NULL,                -- WGS84 latitude
    lon           double precision NOT NULL,                -- WGS84 longitude
    report_type   text NOT NULL,                            -- Obstacle, Confuser, Point of Interest, Seasonal or Other
    description   text,                                     -- nullable; free-text note from the reporter
    geom          geometry(Point, 4326) NOT NULL
                  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lon, lat), 4326)) STORED,  -- derived from lat/lon
    created_at    timestamptz NOT NULL DEFAULT now(),       -- when the barrier was reported
    tags          jsonb NOT NULL DEFAULT '{}',              -- extra attributes, e.g. subtype, ground_material
    image_path    text                                      -- nullable; path to a photo (no uploads yet)
);

-- speeds up spatial queries, e.g. reports within the map's view
CREATE INDEX reports_geom_idx ON reports USING GIST (geom);

-- survey points have a global_id from the survey app, and each one should only be in here once.
-- rows without a global_id (e.g. added through the API) are not affected
CREATE UNIQUE INDEX reports_global_id_idx ON reports ((tags->>'global_id'));
