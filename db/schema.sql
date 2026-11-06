-- runs once, on the first start of an empty pgdata volume
-- (mounted into /docker-entrypoint-initdb.d by docker-compose.yml)

CREATE EXTENSION IF NOT EXISTS postgis;

CREATE TABLE obstacles (
    id            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    osm_id        bigint,                                   -- nullable; OpenStreetMap node id, if known
    lat           double precision NOT NULL,                -- WGS84 latitude
    lon           double precision NOT NULL,                -- WGS84 longitude
    obstacle_type text NOT NULL,                            -- category, e.g. Obstacle, Confuser, Seasonal
    description   text,                                     -- nullable; free-text note from the reporter
    geom          geometry(Point, 4326) NOT NULL
                  GENERATED ALWAYS AS (ST_SetSRID(ST_MakePoint(lon, lat), 4326)) STORED,  -- derived from lat/lon
    created_at    timestamptz NOT NULL DEFAULT now(),       -- when the obstacle was reported, not imported
    tags          jsonb NOT NULL DEFAULT '{}',              -- extra source attributes, e.g. subtype, global_id
    image_path    text                                      -- nullable; path to the image file
);

-- speeds up spatial queries, e.g. obstacles within area/near this point
CREATE INDEX obstacles_geom_idx ON obstacles USING GIST (geom);

-- one row per imported point, so importing again does not create duplicates.
-- rows without a global_id (e.g. added through the API) are not affected.
CREATE UNIQUE INDEX obstacles_global_id_idx ON obstacles ((tags->>'global_id'));
