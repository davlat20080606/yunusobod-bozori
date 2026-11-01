"""Nightly copy of the whole database to Cloudflare R2, encrypted.

The server image has no pg_dump, so the server itself writes every table to one JSON file (the same code works
on SQLite and Postgres), gzips it and encrypts it with BACKUP_KEY. The R2 bucket is readable by link (product
photos are served from it), so an unencrypted copy with customers' phones must never land there.

Without BACKUP_KEY nothing is copied and /api/health says so. The key must also be kept somewhere outside
Render (a password manager): a copy cannot be opened without it.

Kept: the last 14 days, plus every Monday for 8 weeks. Restore: backend/scripts/restore_backup.py.
"""
import base64
import gzip
import hashlib
import json
import logging
from datetime import date, datetime, timedelta
from typing import Optional

from fastapi.concurrency import run_in_threadpool
from sqlalchemy import DateTime, Date, LargeBinary, insert, inspect, text

from app.config import settings, R2_ENABLED
from app.database import Base

logger = logging.getLogger(__name__)

PREFIX = "backups/"
KEEP_DAYS = 14
KEEP_WEEKS = 8
FORMAT = 1


def fernet(key: Optional[str] = None):
    from cryptography.fernet import Fernet
    secret = (key if key is not None else settings.BACKUP_KEY).strip()
    if not secret:
        raise RuntimeError("BACKUP_KEY is not set")
    # Any long random text works as the key: it is stretched to the 32 bytes Fernet needs
    return Fernet(base64.urlsafe_b64encode(hashlib.sha256(f"bozor-backup:{secret}".encode()).digest()))


def _tables():
    return [t for t in Base.metadata.sorted_tables]


def dump_tables(conn) -> dict:
    """Every row of every table, JSON-safe (dates as text, binary as base64)."""
    have = set(inspect(conn).get_table_names())
    version = conn.execute(text("SELECT version_num FROM alembic_version")).scalar() if "alembic_version" in have else None
    tables = {}
    for table in _tables():
        if table.name not in have:
            continue
        rows = []
        for row in conn.execute(table.select()).mappings():
            item = {}
            for key, value in row.items():
                if isinstance(value, (datetime, date)):
                    value = value.isoformat()
                elif isinstance(value, (bytes, bytearray, memoryview)):
                    value = base64.b64encode(bytes(value)).decode()
                item[key] = value
            rows.append(item)
        tables[table.name] = rows
    return {"format": FORMAT, "schema": version, "made_at": datetime.utcnow().isoformat(), "tables": tables}


def load_tables(conn, data: dict) -> dict:
    """Put a copy into a database at the same schema. Existing rows are replaced. Returns rows per table."""
    counts = {}
    tables = _tables()
    for table in reversed(tables):
        conn.execute(table.delete())
    for table in tables:
        rows = data["tables"].get(table.name, [])
        columns = {c.name: c for c in table.columns}
        fixed = []
        for row in rows:
            item = {}
            for key, value in row.items():
                column = columns.get(key)
                if column is None:
                    continue  # a column the copy has but this schema dropped
                if value is not None and isinstance(column.type, DateTime):
                    value = datetime.fromisoformat(value)
                elif value is not None and isinstance(column.type, Date):
                    value = date.fromisoformat(value)
                elif value is not None and isinstance(column.type, LargeBinary):
                    value = base64.b64decode(value)
                item[key] = value
            fixed.append(item)
        if fixed:
            conn.execute(insert(table), fixed)
        counts[table.name] = len(fixed)
        # Postgres hands out ids from a sequence that does not know about the inserted ones
        if conn.dialect.name == "postgresql" and fixed and "id" in columns:
            conn.execute(text(f"SELECT setval(pg_get_serial_sequence('{table.name}', 'id'), "
                              f"(SELECT MAX(id) FROM {table.name}))"))
    return counts


def pack(data: dict, key: Optional[str] = None) -> bytes:
    return fernet(key).encrypt(gzip.compress(json.dumps(data, ensure_ascii=False).encode()))


def unpack(blob: bytes, key: Optional[str] = None) -> dict:
    return json.loads(gzip.decompress(fernet(key).decrypt(blob)))


def object_name(day: date) -> str:
    return f"{PREFIX}{day.isoformat()}.json.gz.enc"


def to_keep(days: list, today: date) -> set:
    """The last KEEP_DAYS days, and Mondays for KEEP_WEEKS weeks."""
    keep = set()
    for d in days:
        age = (today - d).days
        if age < KEEP_DAYS or (d.weekday() == 0 and age < KEEP_WEEKS * 7):
            keep.add(d)
    return keep


def _r2_list() -> list:
    from app.services.storage import r2_client
    names, token = [], None
    while True:
        kwargs = {"Bucket": settings.R2_BUCKET, "Prefix": PREFIX}
        if token:
            kwargs["ContinuationToken"] = token
        page = r2_client().list_objects_v2(**kwargs)
        names += [o["Key"] for o in page.get("Contents", [])]
        if not page.get("IsTruncated"):
            return names
        token = page.get("NextContinuationToken")


def _r2_cleanup(today: date) -> int:
    from app.services.storage import r2_client
    dated = {}
    for name in _r2_list():
        try:
            dated[date.fromisoformat(name[len(PREFIX):len(PREFIX) + 10])] = name
        except ValueError:
            continue
    keep = to_keep(list(dated), today)
    old = [name for d, name in dated.items() if d not in keep]
    for name in old:
        r2_client().delete_object(Bucket=settings.R2_BUCKET, Key=name)
    return len(old)


def status() -> str:
    if not settings.BACKUP_KEY.strip():
        return "off (missing: BACKUP_KEY)"
    if not R2_ENABLED:
        return "off (R2 is not set up)"
    return "on"


async def make_backup(engine, today: Optional[date] = None) -> dict:
    """Copy, encrypt, upload, then drop copies that are too old."""
    from app.services.storage import r2_client
    today = today or (datetime.utcnow() + timedelta(hours=5)).date()
    async with engine.connect() as conn:
        data = await conn.run_sync(dump_tables)
    blob = pack(data)
    name = object_name(today)
    await run_in_threadpool(r2_client().put_object, Bucket=settings.R2_BUCKET, Key=name, Body=blob,
                            ContentType="application/octet-stream", CacheControl="no-store")
    removed = await run_in_threadpool(_r2_cleanup, today)
    rows = sum(len(r) for r in data["tables"].values())
    logger.info(f"Backup {name}: {rows} rows, {len(blob)} bytes, {removed} old copies removed")
    return {"name": name, "rows": rows, "bytes": len(blob), "removed": removed}
