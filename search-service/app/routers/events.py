"""Nhận sự kiện từ Auth và Post để dựng chỉ mục tìm kiếm (không service nào khác được gọi vào đây)."""
import hmac
import re
import uuid
from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Header
from pydantic import BaseModel, ConfigDict
from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from app.config import settings
from app.database import get_db
from app.errors import api_error

router = APIRouter(prefix="/internal", tags=["internal"])
HASHTAG_RE = re.compile(r"#(\w{1,50})")

# Cột tìm kiếm: bỏ dấu + chữ thường để gõ "viet nam" vẫn ra "Việt Nam" (BR-SE1-01)
VECTOR = "to_tsvector('simple', unaccent(lower(coalesce(:content, ''))))"


def internal_only(x_internal_key: str = Header("")):
    if not settings.internal_api_key or not hmac.compare_digest(x_internal_key, settings.internal_api_key):
        raise api_error(403, "FORBIDDEN", "Chỉ service nội bộ được gọi API này")


class Event(BaseModel):
    model_config = ConfigDict(extra="allow")
    name: str


async def _reindex_hashtags(db: AsyncSession, post_id, author_id, content, created_at) -> None:
    await db.execute(text("DELETE FROM hashtag_usages WHERE post_id = :p"), {"p": post_id})
    for tag in {t.lower() for t in HASHTAG_RE.findall(content or "")}:
        await db.execute(text("INSERT INTO hashtag_usages (post_id, hashtag, author_id, created_at) "
                              "VALUES (:p, :t, :a, :c) ON CONFLICT DO NOTHING"),
                         {"p": post_id, "t": tag, "a": author_id, "c": created_at})


@router.post("/events", dependencies=[Depends(internal_only)])
async def handle(e: Event, db: AsyncSession = Depends(get_db)):
    d = e.model_dump()
    uid = lambda k: uuid.UUID(str(d[k]))  # noqa: E731
    match e.name:
        case "UserIndexed":  # đăng ký xác minh xong, sửa hồ sơ, khôi phục tài khoản
            await db.execute(text(
                "INSERT INTO user_index (user_id, username, display_name, avatar_url, status) "
                "VALUES (:id, :u, :n, :a, :s) ON CONFLICT (user_id) DO UPDATE SET username = :u, display_name = :n, "
                "avatar_url = :a, status = :s, updated_at = now()"),
                {"id": uid("user_id"), "u": d["username"], "n": d["display_name"], "a": d.get("avatar_url"),
                 "s": d.get("status", "ACTIVE")})
        case "UserBanned" | "UserUnbanned" | "UserDeactivated":
            status = {"UserBanned": "BANNED", "UserUnbanned": "ACTIVE", "UserDeactivated": "DEACTIVATED"}[e.name]
            await db.execute(text("UPDATE user_index SET status = :s WHERE user_id = :id"), {"s": status, "id": uid("user_id")})
        case "UserFollowed" | "UserUnfollowed":
            delta = 1 if e.name == "UserFollowed" else -1
            await db.execute(text("UPDATE user_index SET follower_count = GREATEST(follower_count + :d, 0) WHERE user_id = :id"),
                             {"d": delta, "id": uid("recipient_id")})
        case "UserBlocked":
            await db.execute(text("INSERT INTO block_refs VALUES (:a, :b) ON CONFLICT DO NOTHING"),
                             {"a": uid("actor_id"), "b": uid("recipient_id")})
        case "UserUnblocked":
            await db.execute(text("DELETE FROM block_refs WHERE blocker_id = :a AND blocked_id = :b"),
                             {"a": uid("actor_id"), "b": uid("recipient_id")})
        case "PostCreated":
            created = datetime.fromisoformat(d.get("created_at") or datetime.now(timezone.utc).isoformat())
            await db.execute(text(f"INSERT INTO post_index (post_id, author_id, content, search_vector, created_at) "
                                  f"VALUES (:p, :a, :content, {VECTOR}, :c) ON CONFLICT DO NOTHING"),
                             {"p": uid("post_id"), "a": uid("author_id"), "content": d.get("content"), "c": created})
            await _reindex_hashtags(db, uid("post_id"), uid("author_id"), d.get("content"), created)
        case "PostEdited":
            await db.execute(text(f"UPDATE post_index SET content = :content, search_vector = {VECTOR} WHERE post_id = :p"),
                             {"p": uid("post_id"), "content": d.get("content")})
            row = (await db.execute(text("SELECT author_id, created_at FROM post_index WHERE post_id = :p"),
                                    {"p": uid("post_id")})).first()
            if row:
                await _reindex_hashtags(db, uid("post_id"), row.author_id, d.get("content"), row.created_at)
        case "PostDeleted":
            await db.execute(text("DELETE FROM post_index WHERE post_id = :p"), {"p": uid("post_id")})
            await db.execute(text("DELETE FROM hashtag_usages WHERE post_id = :p"), {"p": uid("post_id")})
        case "PostLiked" | "PostReposted" | "PostReplied" | "PostUnliked" | "PostUnreposted":
            delta = 1 if e.name in ("PostLiked", "PostReposted", "PostReplied") else -1
            await db.execute(text("UPDATE post_index SET popularity = GREATEST(popularity + :d, 0) WHERE post_id = :p"),
                             {"d": delta, "p": uid("post_id")})
    await db.commit()
    return {"status": "ok"}
