"""Hồ sơ, theo dõi, chặn, đổi mật khẩu, tắt tài khoản (BR-AU4 → BR-AU8)."""
import uuid
from datetime import datetime, timedelta, timezone

import bcrypt
from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field, field_validator
from sqlalchemy import delete, func, or_, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from app.database import get_db
from app.errors import api_error
from app.notify import publish_event
from app.models import Block, Follow, RefreshToken, User, UserStatus
from app.routers.account import USERNAME_RE, _password
from app.security import CurrentUser, get_current_user, verify_password

router = APIRouter(prefix="/users", tags=["users"])
USERNAME_COOLDOWN = timedelta(days=30)  # BR-AU4-03


def _index(u: User) -> None:
    """Báo Search cập nhật chỉ mục người dùng."""
    publish_event("UserIndexed", user_id=str(u.id), username=u.username, display_name=u.display_name,
                  avatar_url=u.avatar_url, status="ACTIVE")


def _now() -> datetime:
    return datetime.now(timezone.utc)


class UpdateProfile(BaseModel):
    display_name: str | None = Field(None, min_length=1, max_length=50)
    username: str | None = None
    bio: str | None = Field(None, max_length=150)
    avatar_url: str | None = Field(None, max_length=500)
    link_url: str | None = Field(None, max_length=500)

    @field_validator("username")
    @classmethod
    def _username(cls, v):
        if v is not None:
            v = v.strip().lower()
            if not USERNAME_RE.match(v):
                raise ValueError("Tên người dùng 3–30 ký tự: chữ thường, số, _ hoặc .")
        return v


class ChangePassword(BaseModel):
    old_password: str
    new_password: str

    _pw = field_validator("new_password")(_password)


class DeleteAccount(BaseModel):
    password: str


class LookupRequest(BaseModel):
    ids: list[uuid.UUID] = Field(default_factory=list, max_length=200)
    usernames: list[str] = Field(default_factory=list, max_length=200)


class UserCard(BaseModel):
    id: uuid.UUID
    username: str
    display_name: str
    avatar_url: str | None
    bio: str | None


class Profile(UserCard):
    link_url: str | None
    created_at: datetime
    followers_count: int
    following_count: int
    is_me: bool
    is_following: bool
    follows_me: bool


async def _by_username(db: AsyncSession, username: str) -> User:
    u = await db.scalar(select(User).where(User.username == username.lower()))
    if u is None or u.status in (UserStatus.UNVERIFIED, UserStatus.DEACTIVATED):
        raise api_error(404, "USER_NOT_FOUND", "Không tìm thấy người dùng")
    return u


async def _blocked_either_way(db: AsyncSession, a: uuid.UUID, b: uuid.UUID) -> bool:
    """BR-GEN-05: chặn có hiệu lực hai chiều."""
    return bool(await db.scalar(select(Block.blocker_id).where(
        or_((Block.blocker_id == a) & (Block.blocked_id == b), (Block.blocker_id == b) & (Block.blocked_id == a))
    ).limit(1)))


async def _visible(db: AsyncSession, me: CurrentUser, username: str) -> User:
    u = await _by_username(db, username)
    if u.id != me.id and await _blocked_either_way(db, me.id, u.id):
        raise api_error(404, "USER_NOT_FOUND", "Không tìm thấy người dùng")  # không lộ việc bị chặn
    return u


# ---------- /users/me (khai báo trước /{username}) ----------
@router.patch("/me", response_model=UserCard)
async def update_me(body: UpdateProfile, me: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    u = await db.get(User, me.id)
    data = body.model_dump(exclude_unset=True)
    new_name = data.pop("username", None)
    if new_name and new_name != u.username:
        if u.username_changed_at and _now() - u.username_changed_at < USERNAME_COOLDOWN:
            raise api_error(400, "USERNAME_COOLDOWN", "Chỉ được đổi tên người dùng 30 ngày một lần",
                            available_at=(u.username_changed_at + USERNAME_COOLDOWN).isoformat())
        if await db.scalar(select(User.id).where(User.username == new_name)):
            raise api_error(409, "ALREADY_EXISTS", "Tên người dùng đã được sử dụng",
                            fields={"username": "Đã được sử dụng"})
        u.username, u.username_changed_at = new_name, _now()
    for k, v in data.items():
        v = v.strip() if v else v
        if k == "display_name" and not v:
            continue  # tên hiển thị không được để trống
        setattr(u, k, v or None)  # chuỗi rỗng = xóa trường
    await db.commit()
    _index(u)
    return u


@router.post("/me/password", status_code=204)
async def change_password(body: ChangePassword, me: CurrentUser = Depends(get_current_user),
                          db: AsyncSession = Depends(get_db)):
    u = await db.get(User, me.id)
    if not verify_password(body.old_password, u.password_hash):
        raise api_error(400, "WRONG_PASSWORD", "Mật khẩu hiện tại không đúng")
    u.password_hash = bcrypt.hashpw(body.new_password.encode(), bcrypt.gensalt()).decode()
    await db.commit()


@router.delete("/me", status_code=204)
async def deactivate_me(body: DeleteAccount, me: CurrentUser = Depends(get_current_user),
                        db: AsyncSession = Depends(get_db)):
    """Tắt tài khoản; đăng nhập lại trong 30 ngày thì khôi phục (BR-AU5-03)."""
    u = await db.get(User, me.id)
    if not verify_password(body.password, u.password_hash):
        raise api_error(400, "WRONG_PASSWORD", "Mật khẩu không đúng")
    u.status, u.deactivated_at = UserStatus.DEACTIVATED, _now()
    await db.execute(update(RefreshToken).where(RefreshToken.user_id == u.id, RefreshToken.revoked_at.is_(None))
                     .values(revoked_at=_now()))
    await db.commit()
    publish_event("UserDeactivated", user_id=str(u.id))


@router.get("/me/blocks", response_model=list[UserCard])
async def my_blocks(me: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    rows = await db.scalars(select(User).join(Block, Block.blocked_id == User.id)
                            .where(Block.blocker_id == me.id).order_by(Block.created_at.desc()))
    return list(rows)


# ---------- cho Post / Feed / Search hỏi (chuyển tiếp token người dùng) ----------
@router.post("/lookup", response_model=list[UserCard])
async def lookup(body: LookupRequest, _: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Đổi id <-> username hàng loạt. Không trả tài khoản chưa xác minh hoặc đã tắt."""
    if not body.ids and not body.usernames:
        return []
    names = [n.lstrip("@").lower() for n in body.usernames]
    rows = await db.scalars(select(User).where(or_(User.id.in_(body.ids), User.username.in_(names)),
                                               User.status.in_([UserStatus.ACTIVE, UserStatus.BANNED])))
    return list(rows)


@router.get("/me/relations")
async def my_relations(me: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Id người mình chặn, người chặn mình, người mình theo dõi.

    ponytail: trả cả danh sách theo dõi; nếu có hàng chục nghìn người thì đổi sang API kiểm tra theo lô.
    """
    ids = lambda col, where: db.scalars(select(col).where(where))  # noqa: E731
    return {"blocked": list(await ids(Block.blocked_id, Block.blocker_id == me.id)),
            "blocked_by": list(await ids(Block.blocker_id, Block.blocked_id == me.id)),
            "following": list(await ids(Follow.following_id, Follow.follower_id == me.id))}


# ---------- người khác ----------
@router.get("/{username}", response_model=Profile)
async def get_profile(username: str, me: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    u = await _visible(db, me, username)

    async def count(col):
        return await db.scalar(select(func.count()).select_from(Follow).where(col == u.id))

    return Profile(**UserCard.model_validate(u, from_attributes=True).model_dump(), link_url=u.link_url,
                   created_at=u.created_at, followers_count=await count(Follow.following_id),
                   following_count=await count(Follow.follower_id), is_me=u.id == me.id,
                   is_following=bool(await db.get(Follow, (me.id, u.id))),
                   follows_me=bool(await db.get(Follow, (u.id, me.id))))


@router.post("/{username}/follow", status_code=204)
async def follow(username: str, me: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    u = await _visible(db, me, username)
    if u.id == me.id:
        raise api_error(400, "CANNOT_FOLLOW_SELF", "Không thể tự theo dõi chính mình")
    res = await db.execute(insert(Follow).values(follower_id=me.id, following_id=u.id).on_conflict_do_nothing())
    await db.commit()
    if res.rowcount:
        publish_event("UserFollowed", actor_id=str(me.id), actor_name=me.username, recipient_id=str(u.id))


@router.delete("/{username}/follow", status_code=204)
async def unfollow(username: str, me: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    u = await _by_username(db, username)
    res = await db.execute(delete(Follow).where(Follow.follower_id == me.id, Follow.following_id == u.id))
    await db.commit()
    if res.rowcount:
        publish_event("UserUnfollowed", actor_id=str(me.id), actor_name=me.username, recipient_id=str(u.id))


async def _follow_list(db: AsyncSession, me: CurrentUser, username: str, other_col, target_col, offset: int):
    """other_col: cột chứa người cần liệt kê; target_col: cột chứa chủ hồ sơ."""
    u = await _visible(db, me, username)
    users = list(await db.scalars(
        select(User).join(Follow, other_col == User.id)
        .where(target_col == u.id, User.status != UserStatus.DEACTIVATED)
        .order_by(Follow.created_at.desc(), User.id).offset(offset).limit(21)
    ))
    # ẩn những người có quan hệ chặn với người xem
    hidden = set(await db.scalars(select(Block.blocked_id).where(Block.blocker_id == me.id)))
    hidden |= set(await db.scalars(select(Block.blocker_id).where(Block.blocked_id == me.id)))
    return {"items": [UserCard.model_validate(x, from_attributes=True) for x in users[:20] if x.id not in hidden],
            "next_offset": offset + 20 if len(users) > 20 else None}


@router.get("/{username}/followers")
async def followers(username: str, offset: int = Query(0, ge=0), me: CurrentUser = Depends(get_current_user),
                    db: AsyncSession = Depends(get_db)):
    return await _follow_list(db, me, username, Follow.follower_id, Follow.following_id, offset)


@router.get("/{username}/following")
async def following(username: str, offset: int = Query(0, ge=0), me: CurrentUser = Depends(get_current_user),
                    db: AsyncSession = Depends(get_db)):
    return await _follow_list(db, me, username, Follow.following_id, Follow.follower_id, offset)


@router.post("/{username}/block", status_code=204)
async def block(username: str, me: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    u = await _by_username(db, username)
    if u.id == me.id:
        raise api_error(400, "CANNOT_BLOCK_SELF", "Không thể tự chặn chính mình")
    blocked = await db.execute(insert(Block).values(blocker_id=me.id, blocked_id=u.id).on_conflict_do_nothing())
    # chặn thì gỡ theo dõi hai chiều (BR-AU8)
    await db.execute(delete(Follow).where(or_((Follow.follower_id == me.id) & (Follow.following_id == u.id),
                                              (Follow.follower_id == u.id) & (Follow.following_id == me.id))))
    await db.commit()
    if blocked.rowcount:
        publish_event("UserBlocked", actor_id=str(me.id), recipient_id=str(u.id))


@router.delete("/{username}/block", status_code=204)
async def unblock(username: str, me: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    u = await _by_username(db, username)
    res = await db.execute(delete(Block).where(Block.blocker_id == me.id, Block.blocked_id == u.id))
    await db.commit()
    if res.rowcount:
        publish_event("UserUnblocked", actor_id=str(me.id), recipient_id=str(u.id))
