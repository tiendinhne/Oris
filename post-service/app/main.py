from contextlib import asynccontextmanager

from fastapi import Depends, FastAPI
from fastapi.exceptions import RequestValidationError
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import engine, get_db
from app.errors import validation_error_handler
from app.routers import admin


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await engine.dispose()


app = FastAPI(title="Post & Interaction Service", lifespan=lifespan)
app.add_exception_handler(RequestValidationError, validation_error_handler)
app.include_router(admin.router)


@app.get("/health", tags=["system"])
async def health(db: AsyncSession = Depends(get_db)):
    """Kiểm tra service chạy và kết nối được post_db."""
    await db.execute(text("SELECT 1"))
    return {"service": settings.service_name, "database": "ok"}
