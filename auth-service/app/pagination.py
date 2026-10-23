"""Phân trang theo cursor (BR-GEN-07): cursor mã hóa (created_at, id) của dòng cuối trang trước."""
import base64
import uuid
from datetime import datetime

from app.errors import api_error

PAGE_SIZE = 20


def encode_cursor(created_at: datetime, row_id: uuid.UUID) -> str:
    return base64.urlsafe_b64encode(f"{created_at.isoformat()}|{row_id}".encode()).decode()


def decode_cursor(cursor: str) -> tuple[datetime, uuid.UUID]:
    try:
        ts, rid = base64.urlsafe_b64decode(cursor.encode()).decode().split("|")
        return datetime.fromisoformat(ts), uuid.UUID(rid)
    except Exception:
        raise api_error(400, "INVALID_CURSOR", "Cursor không hợp lệ")


def keyset_filter(stmt, created_col, id_col, cursor: str | None):
    """Thêm điều kiện 'sau dòng cuối của trang trước' và sắp xếp mới nhất trước."""
    if cursor:
        ts, rid = decode_cursor(cursor)
        stmt = stmt.where((created_col < ts) | ((created_col == ts) & (id_col < rid)))
    return stmt.order_by(created_col.desc(), id_col.desc()).limit(PAGE_SIZE + 1)


def page(rows: list, created_attr: str = "created_at") -> tuple[list, str | None]:
    """Cắt về PAGE_SIZE và tính next_cursor (None nếu hết)."""
    if len(rows) <= PAGE_SIZE:
        return rows, None
    rows = rows[:PAGE_SIZE]
    last = rows[-1]
    return rows, encode_cursor(getattr(last, created_attr), last.id)
