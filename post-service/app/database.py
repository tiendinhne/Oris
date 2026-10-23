from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase

from app.config import settings

engine = create_async_engine(settings.database_url, pool_pre_ping=True)
SessionLocal = async_sessionmaker(engine, expire_on_commit=False)


class Base(DeclarativeBase):
    """Lớp cha của mọi model (bước 3)."""


async def get_db():
    """Dependency của FastAPI: mỗi request một session, tự đóng khi xong."""
    async with SessionLocal() as session:
        yield session
