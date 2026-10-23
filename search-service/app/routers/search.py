"""Tìm bài viết, tìm người dùng, hashtag thịnh hành (UC Tìm kiếm)."""
from datetime import datetime, timedelta, timezone

import httpx
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.errors import api_error
from app.security import CurrentUser, get_current_user

router = APIRouter(tags=["search"])
PAGE = 20
TRENDING_TTL = timedelta(minutes=15)  # BR-SE3-02

# Người có quan hệ chặn với người xem (hai chiều) thì không hiện trong kết quả (BR-SE2-02)
NOT_BLOCKED = """NOT EXISTS (SELECT 1 FROM block_refs b WHERE (b.blocker_id = :me AND b.blocked_id = {col})
                                                         OR (b.blocked_id = :me AND b.blocker_id = {col}))"""


def _clean(q: str) -> str:
    q = q.strip().lstrip("@#")
    if not q:
        raise api_error(422, "EMPTY_QUERY", "Nhập từ khóa để tìm kiếm")
    return q


@router.get("/search/users")
async def search_users(q: str = Query(max_length=50), offset: int = Query(0, ge=0),
                       me: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Khớp tiền tố username, không dấu, không phân biệt hoa thường; người nhiều người theo dõi lên trước."""
    q = _clean(q)
    rows = (await db.execute(text(
        f"""SELECT user_id, username, display_name, avatar_url, follower_count FROM user_index
            WHERE status = 'ACTIVE' AND username LIKE lower(unaccent(:q)) || '%' AND {NOT_BLOCKED.format(col='user_id')}
            ORDER BY follower_count DESC, username LIMIT {PAGE + 1} OFFSET :off"""),
        {"q": q.replace("%", "").replace("_", r"\_"), "me": me.id, "off": offset})).mappings().all()
    return {"items": [{**r, "id": r["user_id"]} for r in rows[:PAGE]],
            "next_offset": offset + PAGE if len(rows) > PAGE else None}


@router.get("/search/posts")
async def search_posts(request: Request, q: str = Query(max_length=100), offset: int = Query(0, ge=0),
                       me: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Toàn văn, không dấu. Xếp theo độ khớp rồi độ phổ biến; nội dung đầy đủ lấy từ Post Service."""
    q = _clean(q)
    rows = (await db.execute(text(
        f"""SELECT post_id FROM post_index, websearch_to_tsquery('simple', unaccent(lower(:q))) query
            WHERE is_visible AND search_vector @@ query AND {NOT_BLOCKED.format(col='author_id')}
            ORDER BY ts_rank(search_vector, query) DESC, popularity DESC, created_at DESC
            LIMIT {PAGE + 1} OFFSET :off"""), {"q": q, "me": me.id, "off": offset})).all()
    ids = [str(r.post_id) for r in rows[:PAGE]]
    posts = {}
    if ids:
        try:
            async with httpx.AsyncClient(base_url=settings.post_service_url, timeout=5) as c:
                res = await c.post("/posts/batch", json={"ids": ids}, headers={"Authorization": request.headers["authorization"]})
        except httpx.HTTPError:
            raise api_error(502, "POST_SERVICE_UNAVAILABLE", "Không kết nối được Post Service")
        if res.status_code >= 400:
            raise api_error(502, "POST_SERVICE_ERROR", "Post Service trả lỗi")
        posts = {p["id"]: p for p in res.json()}  # bài đã xóa / riêng tư / bị chặn thì không có
    return {"items": [posts[i] for i in ids if i in posts], "next_offset": offset + PAGE if len(rows) > PAGE else None}


@router.get("/trending/hashtags")
async def trending(_: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Top 10 hashtag trong 24 giờ; tính lại khi dữ liệu cũ hơn 15 phút."""
    computed = await db.scalar(text("SELECT max(computed_at) FROM trending_hashtags"))
    if computed is None or datetime.now(timezone.utc) - computed > TRENDING_TTL:
        await db.execute(text("DELETE FROM trending_hashtags"))
        await db.execute(text(
            """INSERT INTO trending_hashtags (rank, hashtag, post_count, computed_at)
               SELECT row_number() OVER (ORDER BY count(*) DESC, hashtag), hashtag, count(*), now()
               FROM hashtag_usages WHERE created_at > now() - interval '24 hours'
               GROUP BY hashtag ORDER BY count(*) DESC, hashtag LIMIT 10"""))
        await db.commit()
    rows = (await db.execute(text("SELECT rank, hashtag, post_count FROM trending_hashtags ORDER BY rank"))).mappings().all()
    return list(rows)
