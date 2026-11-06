""" Kai Ketcham, WWU CS, 2026 """

from contextlib import asynccontextmanager
from datetime import datetime
import json
import os
from typing import Any, Literal

import asyncpg
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, HTTPException, Query, Request
from pydantic import BaseModel, Field, field_validator

load_dotenv()


BBOX = (48.68, -122.55, 48.82, -122.35)

ObstacleType = Literal["Obstacle", "Confuser", "Point of Interest", "Seasonal", "Other"]


def validate_bellingham(lat: float, lon: float) -> None:
    south, west, north, east = BBOX
    if not (south <= lat <= north and west <= lon <= east):
        raise ValueError(f"Coordinates ({lat}, {lon}) outside Bellingham bbox")


class ObstacleCreate(BaseModel):
    lat: float = Field(ge=-90, le=90)
    lon: float = Field(ge=-180, le=180)
    obstacle_type: ObstacleType
    description: str | None = Field(default=None, max_length=500)
    tags: dict[str, Any] = Field(default_factory=dict)

    @field_validator("lon")
    @classmethod
    def validate_bbox(cls, lon: float, info):
        lat = info.data.get("lat")
        if lat is not None:
            validate_bellingham(lat, lon)
        return lon

    @field_validator("tags")
    @classmethod
    def validate_tags(cls, tags: dict[str, Any]):
        # imported points are matched on global_id, which has to be unique
        if "global_id" in tags:
            raise ValueError("global_id is reserved for imported data")
        return tags


class ObstacleRead(BaseModel):
    id: int
    osm_id: int | None
    lat: float
    lon: float
    obstacle_type: str
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


app = FastAPI(lifespan=lifespan)


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


@app.get("/obstacles", response_model=list[ObstacleRead])
async def list_obstacles(
    south: float = Query(default=BBOX[0], ge=-90, le=90),
    west: float = Query(default=BBOX[1], ge=-180, le=180),
    north: float = Query(default=BBOX[2], ge=-90, le=90),
    east: float = Query(default=BBOX[3], ge=-180, le=180),
    obstacle_type: ObstacleType | None = None,
    conn: asyncpg.Connection = Depends(get_db),
):
    # clamp to Bellingham so a map view that reaches past it still works
    south, west = max(south, BBOX[0]), max(west, BBOX[1])
    north, east = min(north, BBOX[2]), min(east, BBOX[3])
    if south >= north or west >= east:
        raise HTTPException(status_code=422, detail="Bounding box is empty or outside Bellingham bbox")

    rows = await conn.fetch(
        """
        SELECT id, osm_id, lat, lon, obstacle_type, description, created_at, tags, image_path
        FROM obstacles
        WHERE ST_Intersects(geom, ST_MakeEnvelope($1, $2, $3, $4, 4326))
          AND ($5::text IS NULL OR obstacle_type = $5)
        ORDER BY id
        """,
        west,
        south,
        east,
        north,
        obstacle_type,
    )
    return [dict(row) for row in rows]


@app.post("/obstacles", response_model=ObstacleRead, status_code=201)
async def create_obstacle(
    obstacle: ObstacleCreate,
    conn: asyncpg.Connection = Depends(get_db),
):
    try:
        row = await conn.fetchrow(
            """
            INSERT INTO obstacles (lat, lon, obstacle_type, description, tags)
            VALUES ($1, $2, $3, $4, $5)
            RETURNING id, osm_id, lat, lon, obstacle_type, description, created_at, tags, image_path
            """,
            obstacle.lat,
            obstacle.lon,
            obstacle.obstacle_type,
            obstacle.description,
            obstacle.tags,
        )
    except asyncpg.DataError:
        # valid JSON that postgres can't store, like a null character in a string
        raise HTTPException(status_code=422, detail="Text contains characters that can't be stored")
    return dict(row)
