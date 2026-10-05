from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import engine, get_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(title="Search & Trending Service", lifespan=lifespan)


@app.get("/health", tags=["system"])
async def health(db: AsyncSession = Depends(get_db)):
    """Kiểm tra service chạy và kết nối được search_db."""
    await db.execute(text("SELECT 1"))
    return {"service": settings.service_name, "database": "ok"}
