"""Runs migrations on the connection the server hands over, or on DATABASE_URL from the command line."""
import asyncio
from alembic import context
from sqlalchemy.ext.asyncio import create_async_engine

from app.config import settings, IS_POSTGRES
from app.database import Base
import app.models.schemas  # noqa: F401  (registers every table on Base.metadata)

target_metadata = Base.metadata


def run(connection):
    context.configure(
        connection=connection,
        target_metadata=target_metadata,
        # SQLite cannot ALTER most things in place; batch mode rebuilds the table instead
        render_as_batch=connection.dialect.name == "sqlite",
        compare_type=True,
    )
    with context.begin_transaction():
        context.run_migrations()


async def run_from_url():
    engine = create_async_engine(settings.DATABASE_URL, connect_args={"ssl": True} if IS_POSTGRES else {})
    async with engine.connect() as conn:
        await conn.run_sync(run)
    await engine.dispose()


connection = context.config.attributes.get("connection")
if connection is not None:
    run(connection)
else:
    asyncio.run(run_from_url())
