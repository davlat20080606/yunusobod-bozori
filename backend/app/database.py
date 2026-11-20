from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import declarative_base
from app.config import settings, IS_POSTGRES, DB_SSL

engine = create_async_engine(
    settings.DATABASE_URL,
    echo=False,
    future=True,
    # Cloud Postgres needs SSL and drops idle connections
    connect_args={"ssl": DB_SSL} if IS_POSTGRES else {},
    pool_pre_ping=IS_POSTGRES
)

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with async_session_factory() as session:
        try:
            yield session
        finally:
            await session.close()
