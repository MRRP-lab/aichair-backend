# aichair-backend

backend for an accessibility-focused routing app in Bellingham, WA. it stores trail obstacles in
PostGIS and serves them over a REST API.

```
request -> nginx (port 80) -> api (FastAPI, port 8001) -> db (PostgreSQL + PostGIS)
```

## quick start

you'll need Docker with the Compose plugin, and ports 80 and 8001 free.

```bash
git clone https://github.com/ketchkai/aichair-backend.git
cd aichair-backend
cp .env.example .env    # then set POSTGRES_PASSWORD
docker compose up --build -d
curl http://localhost/health    # {"status":"ok"}
```

the database starts empty, with the table defined in `db/schema.sql`. add obstacles with
[`POST /obstacles`](#post-obstacles).

## configuration

set these in `.env`, which is gitignored:

| variable | what it is |
|---|---|
| `POSTGRES_USER`, `POSTGRES_DB` | database user and name |
| `POSTGRES_PASSWORD` | letters and numbers only, `openssl rand -hex 24` makes a good one |
| `SERVER_NAME` | domain nginx answers to, a placeholder for now |

## common commands

```bash
docker compose logs -f api      # follow the API's logs
docker compose up --build -d    # start, or rebuild after changing code
docker compose down             # stop everything, keeps the data
docker compose down -v          # stop everything and DELETE the database
docker compose exec db sh -c 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB"'    # database shell
```

`db/schema.sql` only runs on an empty database. to apply a schema change, run `docker compose down -v`
and start the stack again.

## running on a VM

the VM only needs Docker and Git.

1. run the [quick start](#quick-start) steps, using a password that's only for the VM
2. make sure Docker starts at boot, so the stack comes back after a reboot:
   ```bash
   sudo systemctl enable docker
   ```

to update it later, run `git pull` and then `docker compose up --build -d`. your data is kept.

**before opening it up to the internet:** there's no HTTPS or login yet, so anyone who can reach port
80 can read obstacles and add new ones.

## troubleshooting

| problem | fix |
|---|---|
| `port is already allocated` | something else is using port 80 or 8001. stop it, or change the left number under `ports` in `docker-compose.yml` |
| `password authentication failed` in the API logs | `.env` doesn't match the password the database was created with. put the old one back, or reset with `docker compose down -v` |
| nginx keeps restarting | check that `SERVER_NAME` is set in `.env`, then run `docker compose up -d nginx` |
| `/health` returns `502` | nginx can't reach the API, check `docker compose logs api` |
| `/health` returns `503` | the API can't reach the database, check `docker compose logs db` |

## routing (disabled)

`POST /route` was removed because the database only holds obstacle points, and routing needs a
network of paths. the code is in git history (commit `e9a8f0e`), and `unweaver_stub/` is kept but
isn't built or started.

## endpoints

all endpoints return JSON, with timestamps in UTC. interactive docs are at `http://localhost/docs`.

the obstacle types are `Obstacle`, `Confuser`, `Point of Interest`, `Seasonal` and `Other`. anything
more specific goes in `tags`, which can hold any JSON object, except `global_id` is reserved for
imported data.

### GET /health

returns `200` with `{"status":"ok"}`, or `503` if the database is unavailable.

### GET /obstacles

lists obstacles, optionally filtered. returns `422` for invalid parameters, or if the box is entirely
outside Bellingham.

| query parameter | what it does |
|---|---|
| `south`, `west`, `north`, `east` | bounding box, trimmed to Bellingham (`48.68, -122.55, 48.82, -122.35`) |
| `obstacle_type` | only return this type |

```bash
curl "http://localhost/obstacles?obstacle_type=Obstacle"
```

```json
[
  {
    "id": 1,
    "osm_id": null,
    "lat": 48.75,
    "lon": -122.48,
    "obstacle_type": "Obstacle",
    "description": "pothole on the left side",
    "created_at": "2026-05-23T19:42:00.123456Z",
    "tags": { "subtype": "Pothole" },
    "image_path": null
  }
]
```

### POST /obstacles

adds an obstacle and returns `201` with the new row, in the same shape as above. `lat`, `lon` and
`obstacle_type` are required. returns `422` for invalid input, including coordinates outside
Bellingham.

```bash
curl -X POST http://localhost/obstacles \
  -H "Content-Type: application/json" \
  -d '{"lat":48.75,"lon":-122.48,"obstacle_type":"Obstacle","description":"pothole on the left side","tags":{"subtype":"Pothole"}}'
```
