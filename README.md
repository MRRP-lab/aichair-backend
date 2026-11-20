# aichair-backend

backend for collecting access barrier reports around Western Washington University, with a demo frontend for viewing and adding them

## stack

- FastAPI (REST API)
- PostgreSQL + PostGIS (database)
- nginx (serves frontend and forwards API requests)
- React + Leaflet (frontend)
- Docker Compose

## quick start

you'll need Docker with Compose, and ports 80 and 8001 free

```bash
git clone https://github.com/ketchkai/aichair-backend.git
cd aichair-backend
cp .env.example .env
# set POSTGRES_PASSWORD in .env, letters and numbers only (openssl rand -hex 24)
docker compose up --build -d
curl http://localhost/health    # {"status":"ok"}
```

then open `http://localhost` in a browser. on first start the database is created from `db/schema.sql`
and loaded with 127 survey reports from `db/seed.sql`. these only run on an empty database, so after
changing either one, reset with `docker compose down -v` and start again.

**on a VM:** it only needs Docker and Git. follow quick start, then run `sudo systemctl enable docker` so stack comes back after a reboot. to update, `git pull` and
`docker compose up --build -d`, which keeps the data. NO HTTPS or login yet, so don't open port
80 to the internet.

**working on the frontend:** with the stack running, `cd frontend && npm install && npm run dev` serves
the app with hot reload at `http://localhost:5173`, talking to the API on port 8001. needs Node 22.

## endpoints

all endpoints return JSON, with timestamps in UTC. Requests with a body must send
`Content-Type: application/json`. coordinates outside the WWU bbox (`48.7240, -122.4935, 48.7430,
-122.4740`) are rejected with `422`. interactive docs at `http://localhost/docs`.

a report's `report_type` is one of `Obstacle`, `Confuser`, `Point of Interest`, `Seasonal` or `Other`.
anything more specific goes in `tags`, which can hold any JSON object. `global_id` is reserved for
survey data.

| tag | values |
|---|---|
| `subtype` | e.g. `Pothole`, `Roots`, `Trail Intersection`, `Sign`, `Seating` |
| `wheelchair_accessible` | `Yes` or `No` |
| `why_not` | `Bumps`, `Obstacle in Path`, `Slope` or `Other` |
| `ground_material` | `paved (asphalt)`, `gravel`, `natural ground (dirt)` or `other` |
| `other_material` | free text, when `ground_material` is `other` |
| `trail_width_m` | number, in meters |
| `temporary` | `Yes` or `No` |

### GET /health

liveness check, which also checks the database. no request body.

**Response 200**
```json
{ "status": "ok" }
```

**Errors**
- `503` — the database is unavailable

**Example**
```bash
curl http://localhost/health
```

### GET /reports

list reports, optionally filtered. no request body.

| query parameter | what it does |
|---|---|
| `south`, `west`, `north`, `east` | only reports inside this box, trimmed to the WWU bbox |
| `report_type` | only reports of this type |

**Response 200**
```json
[
  {
    "id": 1,
    "osm_id": null,
    "lat": 48.7359628,
    "lon": -122.4815607,
    "report_type": "Obstacle",
    "description": "004",
    "created_at": "2024-03-08T21:04:00Z",
    "tags": {
      "associated_segment_number": 1.0,
      "global_id": "870d974e-7623-4b4c-9e07-70bb3346c881",
      "ground_material": "paved (asphalt)",
      "subtype": "Bushes",
      "wheelchair_accessible": "Yes"
    },
    "image_path": null
  }
]
```

**Errors**
- `422` — invalid parameters, or the box is entirely outside the WWU bbox

**Example**
```bash
curl "http://localhost/reports?report_type=Obstacle"
```

### GET /reports/{id}

get one report. no request body.

**Response 200** — one report, in the same shape as above

**Errors**
- `404` — no report with that id
- `422` — the id isn't a positive whole number

**Example**
```bash
curl http://localhost/reports/1
```

### POST /reports

add a report. `lat`, `lon` and `report_type` are required.

**Request body**
```json
{
  "lat": 48.7330,
  "lon": -122.4830,
  "report_type": "Obstacle",
  "description": "large root across the left half of the path",
  "tags": { "subtype": "Roots", "wheelchair_accessible": "No", "why_not": "Obstacle in Path" }
}
```

**Response 201** — the new report, in the same shape as `GET /reports`

**Errors**
- `422` — validation failure (coordinates outside the bbox, unknown type, missing fields, description
  over 500 characters, `global_id` in tags)

**Example**
```bash
curl -X POST http://localhost/reports \
  -H "Content-Type: application/json" \
  -d '{"lat":48.733,"lon":-122.483,"report_type":"Obstacle","description":"large root across the left half of the path","tags":{"subtype":"Roots"}}'
```
