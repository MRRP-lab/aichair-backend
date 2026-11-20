""" Kai Ketcham, WWU CS, 2026 """

from contextlib import asynccontextmanager
from datetime import datetime
import json
import os
from typing import Any, Literal

import asyncpg
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Path, Query, Request
from pydantic import BaseModel, Field, field_validator

load_dotenv()


# Western Washington University and the Sehome Hill Arboretum (south, west, north, east)
# keep in sync with BBOX in frontend/src/constants.js
BBOX = (48.7240, -122.4935, 48.7430, -122.4740)

ReportType = Literal["Obstacle", "Confuser", "Point of Interest", "Seasonal", "Other"]

# every column, in the order the API returns them
COLUMNS = "id, osm_id, lat, lon, report_type, description, created_at, tags, image_path"


def validate_in_bbox(lat: float, lon: float) -> None:
    south, west, north, east = BBOX
    if not (south <= lat <= north and west <= lon <= east):
        raise ValueError(f"Coordinates ({lat}, {lon}) outside WWU bbox")


class ReportCreate(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    report_type: ReportType
    description: str | None = Field(default=None, max_length=500)
    tags: dict[str, Any] = Field(default_factory=dict)

    @field_validator("lon")
    @classmethod
    def validate_bbox(cls, lon: float, info):
        lat = info.data.get("lat")
        if lat is not None:
            validate_in_bbox(lat, lon)
        return lon

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, tags: dict[str, Any]):
        # survey points are matched on global_id, which has to be unique
        if "global_id" in tags:
            raise ValueError("global_id is reserved for survey data")
        return tags


class ReportRead(BaseModel):
    id: int
    osm_id: int | None
    lat: float
    lon: float
    report_type: str
    description: str | None
    created_at: datetime
    tags: dict[str, Any]
    image_path: str | None


async def init_connection(conn: asyncpg.Connection) -> None:
    # makes jsonb columns (tags) read and write as python dicts instead of strings
    await conn.set_type_codec("jsonb", encoder=json.dumps, decoder=json.loads, schema="pg_catalog")


@asynccontextmanager
async def lifespan(app: FastAPI):
    app.state.pool = await asyncpg.create_pool(
        os.getenv("DATABASE_URL"),
        min_size=1,
        max_size=5,
        init=init_connection,
    )
    yield
    await app.state.pool.close()


app = FastAPI(title="aichair access barrier reports", lifespan=lifespan)


async def get_db(request: Request) -> asyncpg.Connection:
    async with request.app.state.pool.acquire() as conn:
        yield conn


@app.get("/health")
async def health(request: Request):
    try:
        await request.app.state.pool.fetchval("SELECT 1", timeout=2)
    except (OSError, TimeoutError, asyncpg.PostgresError, asyncpg.InterfaceError):
        raise HTTPException(status_code=503, detail="Database unavailable")
    return {"status": "ok"}


@app.get("/reports", response_model=list[ReportRead])
async def list_reports(
    south: float = Query(default=BBOX[0], ge=-90, le=90),
    west: float = Query(default=BBOX[1], ge=-180, le=180),
    north: float = Query(default=BBOX[2], ge=-90, le=90),
    east: float = Query(default=BBOX[3], ge=-180, le=180),
    report_type: ReportType | None = None,
    conn: asyncpg.Connection = Depends(get_db),
):
    # clamp to the WWU bbox so a map view that reaches past it still works
    south, west = max(south, BBOX[0]), max(west, BBOX[1])
    north, east = min(north, BBOX[2]), min(east, BBOX[3])
    if south >= north or west >= east:
        raise HTTPException(status_code=422, detail="Bounding box is empty or outside WWU bbox")

    rows = await conn.fetch(
        f"""
        SELECT {COLUMNS}
        FROM reports
        WHERE ST_Intersects(geom, ST_MakeEnvelope($1, $2, $3, $4, 4326))
          AND ($5::text IS NULL OR report_type = $5)
        ORDER BY id
        """,
        west,
        south,
        east,
        north,
        report_type,
    )
    return [dict(row) for row in rows]


@app.get("/reports/{report_id}", response_model=ReportRead)
async def get_report(
    # le= keeps the id inside postgres' bigint range
    report_id: int = Path(ge=1, le=2**63 - 1),
    conn: asyncpg.Connection = Depends(get_db),
):
    row = await conn.fetchrow(f"SELECT {COLUMNS} FROM reports WHERE id = $1", report_id)
    if row is None:
        raise HTTPException(status_code=404, detail="Report not found")
    return dict(row)


@app.post("/reports", response_model=ReportRead, status_code=201)
async def create_report(
    report: ReportCreate,
    conn: asyncpg.Connection = Depends(get_db),
):
    try:
        row = await conn.fetchrow(
            f"""
            INSERT INTO reports (lat, lon, report_type, description, tags)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING {COLUMNS}
            """,
            report.lat,
            report.lon,
            report.report_type,
            report.description,
            report.tags,
        )
    except asyncpg.DataError:
        # valid JSON that postgres can't store, like a null character in a string
        raise HTTPException(status_code=422, detail="Text contains characters that can't be stored")
    return dict(row)
