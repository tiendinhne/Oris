"""API người dùng thường của Post Service: đăng bài, trả lời, thích, đăng lại, báo cáo (UC Bài viết, Tương tác)."""
import re
import uuid
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Depends, Query
from pydantic import BaseModel, Field
from sqlalchemy import func, select, update
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients import auth_client
from app.database import get_db
from app.errors import api_error
from app.models import (
    CaseStatus, Hashtag, Like, Mention, Post, PostHashtag, PostMedia, Repost, Report, ReportCase, ReplyPermission,
    Visibility,
)
from app.notify import publish_event
from app.pagination import PAGE_SIZE, keyset_filter, page
from app.schemas import (
    CreatePostRequest, MediaOut, PostListPage, PostOut, ReportRequest, UpdatePostRequest, UserCard, UserListPage,
)
from app.security import CurrentUser, get_current_user

router = APIRouter(tags=["posts"])

EDIT_WINDOW = timedelta(minutes=15)  # BR-PO1-05
HASHTAG_RE = re.compile(r"#(\w{1,50})")
MENTION_RE = re.compile(r"@([a-z0-9_.]{3,30})", re.I)


def _now() -> datetime:
    return datetime.now(timezone.utc)


# ---------- Dựng dữ liệu ----------

async def _hidden(me: CurrentUser) -> set[uuid.UUID]:
    """Người chặn mình hoặc bị mình chặn: bài của họ không hiện (BR-GEN-05)."""
    rel = await auth_client.relations(me)
    return rel["blocked"] | rel["blocked_by"]


def _visible_to(stmt, me: CurrentUser, hidden: set[uuid.UUID]):
    stmt = stmt.where(Post.deleted_at.is_(None), (Post.visibility == Visibility.PUBLIC) | (Post.author_id == me.id))
    return stmt.where(Post.author_id.not_in(hidden)) if hidden else stmt


async def _get_visible(db: AsyncSession, me: CurrentUser, post_id: uuid.UUID) -> Post:
    post = await db.scalar(_visible_to(select(Post).where(Post.id == post_id), me, await _hidden(me)))
    if post is None:
        raise api_error(404, "POST_NOT_FOUND", "Không tìm thấy bài viết hoặc bài đã bị xóa")
    return post


async def _to_out(db: AsyncSession, me: CurrentUser, posts: list[Post]) -> list[PostOut]:
    ids = [p.id for p in posts]
    if not ids:
        return []
    authors = await auth_client.lookup_cards(me, ids=[p.author_id for p in posts])
    media: dict = {}
    for m in await db.scalars(select(PostMedia).where(PostMedia.post_id.in_(ids)).order_by(PostMedia.position)):
        media.setdefault(m.post_id, []).append(MediaOut(type=m.type.value, url=m.url))
    tags: dict = {}
    for pid, name in (await db.execute(select(PostHashtag.post_id, Hashtag.name).join(Hashtag)
                                       .where(PostHashtag.post_id.in_(ids)))).all():
        tags.setdefault(pid, []).append(name)
    liked = set(await db.scalars(select(Like.post_id).where(Like.user_id == me.id, Like.post_id.in_(ids))))
    reposted = set(await db.scalars(select(Repost.post_id).where(Repost.user_id == me.id, Repost.post_id.in_(ids))))
    out = []
    for p in posts:
        a = authors.get(p.author_id, {})
        out.append(PostOut(
            id=p.id, author=UserCard(id=p.author_id, username=a.get("username"), display_name=a.get("display_name"),
                                     avatar_url=a.get("avatar_url")),
            parent_id=p.parent_id, root_id=p.root_id, content=p.content, visibility=p.visibility.value,
            reply_permission=p.reply_permission.value, media=media.get(p.id, []), hashtags=tags.get(p.id, []),
            like_count=p.like_count, reply_count=p.reply_count, repost_count=p.repost_count,
            liked_by_me=p.id in liked, reposted_by_me=p.id in reposted, is_mine=p.author_id == me.id,
            created_at=p.created_at, edited_at=p.edited_at,
        ))
    return out


async def _list(db: AsyncSession, me: CurrentUser, stmt, cursor: str | None) -> PostListPage:
    stmt = _visible_to(stmt, me, await _hidden(me))
    rows, nxt = page(list((await db.scalars(keyset_filter(stmt, Post.created_at, Post.id, cursor))).all()))
    return PostListPage(items=await _to_out(db, me, rows), next_cursor=nxt)


async def _index_content(db: AsyncSession, me: CurrentUser, post: Post) -> list[uuid.UUID]:
    """Ghi lại hashtag và mention theo nội dung hiện tại (BR-PO1-03). Trả về id người được nhắc."""
    await db.execute(PostHashtag.__table__.delete().where(PostHashtag.post_id == post.id))
    await db.execute(Mention.__table__.delete().where(Mention.post_id == post.id))
    text = post.content or ""
    for name in {m.lower() for m in HASHTAG_RE.findall(text)}:
        await db.execute(insert(Hashtag).values(id=uuid.uuid4(), name=name).on_conflict_do_nothing(index_elements=["name"]))
        tag_id = await db.scalar(select(Hashtag.id).where(Hashtag.name == name))
        db.add(PostHashtag(post_id=post.id, hashtag_id=tag_id))
    names = {m.rstrip(".").lower() for m in MENTION_RE.findall(text)}
    mentioned = [uid for uid in await auth_client.lookup_cards(me, usernames=names) if uid != me.id] if names else []
    for uid in mentioned:
        db.add(Mention(post_id=post.id, user_id=uid))
    return mentioned


async def _create(db: AsyncSession, me: CurrentUser, body: CreatePostRequest, parent: Post | None) -> PostOut:
    if not body.content and not body.media:
        raise api_error(422, "EMPTY_POST", "Bài viết cần có nội dung hoặc ảnh / video")
    post = Post(id=uuid.uuid4(), author_id=me.id, content=body.content, visibility=body.visibility,
                reply_permission=body.reply_permission,
                parent_id=parent.id if parent else None, root_id=(parent.root_id or parent.id) if parent else None)
    db.add(post)
    await db.flush()
    for i, m in enumerate(body.media):
        db.add(PostMedia(post_id=post.id, type=m.type, url=m.url, storage_key=m.url, position=i))
    mentioned = await _index_content(db, me, post)
    if parent:
        await db.execute(update(Post).where(Post.id == parent.id).values(reply_count=Post.reply_count + 1))
    await db.commit()
    await db.refresh(post)
    if parent:  # tự trả lời bài mình thì Notification tự bỏ qua, Feed vẫn cộng điểm
        publish_event("PostReplied", post_id=str(post.id), actor_id=str(me.id), actor_name=me.username,
                      recipient_id=str(parent.author_id))
    for uid in mentioned:
        publish_event("UserMentioned", post_id=str(post.id), actor_id=str(me.id), actor_name=me.username,
                      recipient_id=str(uid))
    if not parent and post.visibility == Visibility.PUBLIC:  # ponytail: bài Riêng tư đổi sang Công khai sau đó chưa vào bảng tin
        publish_event("PostCreated", post_id=str(post.id), author_id=str(me.id), created_at=post.created_at.isoformat(),
                      content=post.content)
    return (await _to_out(db, me, [post]))[0]


# ---------- Bài viết ----------

@router.post("/posts", response_model=PostOut, status_code=201)
async def create_post(body: CreatePostRequest, me: CurrentUser = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    return await _create(db, me, body, None)


@router.get("/posts/by-user/{username}", response_model=PostListPage)
async def posts_by_user(username: str, replies: bool = False, cursor: str | None = None,
                        me: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Trang cá nhân: bài gốc, hoặc `replies=true` để xem các trả lời. Bài Riêng tư chỉ chủ bài thấy."""
    found = await auth_client.lookup_cards(me, usernames=[username])
    if not found:
        raise api_error(404, "USER_NOT_FOUND", "Không tìm thấy người dùng")
    uid = next(iter(found))
    stmt = select(Post).where(Post.author_id == uid, Post.parent_id.is_not(None) if replies else Post.parent_id.is_(None))
    return await _list(db, me, stmt, cursor)


@router.get("/hashtags/{name}/posts", response_model=PostListPage)
async def posts_by_hashtag(name: str, cursor: str | None = None, me: CurrentUser = Depends(get_current_user),
                           db: AsyncSession = Depends(get_db)):
    stmt = (select(Post).join(PostHashtag, PostHashtag.post_id == Post.id).join(Hashtag)
            .where(Hashtag.name == name.lstrip("#").lower()))
    return await _list(db, me, stmt, cursor)


class BatchRequest(BaseModel):
    ids: list[uuid.UUID] = Field(max_length=50)


@router.post("/posts/batch", response_model=list[PostOut])
async def batch(body: BatchRequest, me: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Cho Feed Service lấy nội dung nhiều bài một lúc; bài xóa / riêng tư / bị chặn thì không trả về."""
    posts = list(await db.scalars(_visible_to(select(Post).where(Post.id.in_(body.ids)), me, await _hidden(me))))
    return await _to_out(db, me, posts)


@router.get("/posts/{post_id}", response_model=PostOut)
async def get_post(post_id: uuid.UUID, me: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return (await _to_out(db, me, [await _get_visible(db, me, post_id)]))[0]


@router.patch("/posts/{post_id}", response_model=PostOut)
async def update_post(post_id: uuid.UUID, body: UpdatePostRequest, me: CurrentUser = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    post = await _get_visible(db, me, post_id)
    if post.author_id != me.id:
        raise api_error(403, "FORBIDDEN", "Chỉ tác giả được sửa bài viết")
    data = body.model_dump(exclude_unset=True)
    edited = False
    if "content" in data:
        content = (data["content"] or "").strip() or None
        if content != post.content:
            if _now() - post.created_at > EDIT_WINDOW:
                raise api_error(400, "EDIT_WINDOW_EXPIRED", "Chỉ được sửa nội dung trong 15 phút sau khi đăng")
            has_media = await db.scalar(select(func.count()).select_from(PostMedia).where(PostMedia.post_id == post.id))
            if not content and not has_media:
                raise api_error(422, "EMPTY_POST", "Bài viết cần có nội dung hoặc ảnh / video")
            post.content, post.edited_at = content, _now()
            await _index_content(db, me, post)
            edited = True
    if body.visibility:
        post.visibility = body.visibility
    if body.reply_permission:
        post.reply_permission = body.reply_permission
    await db.commit()
    if edited:
        publish_event("PostEdited", post_id=str(post.id), content=post.content)
    return (await _to_out(db, me, [post]))[0]


@router.delete("/posts/{post_id}", status_code=204)
async def delete_post(post_id: uuid.UUID, me: CurrentUser = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    post = await _get_visible(db, me, post_id)
    if post.author_id != me.id:
        raise api_error(403, "FORBIDDEN", "Chỉ tác giả được xóa bài viết")
    post.deleted_at = _now()
    if post.parent_id:
        await db.execute(update(Post).where(Post.id == post.parent_id)
                         .values(reply_count=func.greatest(Post.reply_count - 1, 0)))
    # báo cáo đang chờ của bài tự xóa thì đóng lại, admin không cần xử lý nữa
    await db.execute(update(ReportCase).where(ReportCase.post_id == post.id, ReportCase.status == CaseStatus.PENDING)
                     .values(status=CaseStatus.CLOSED, resolved_at=_now()))
    await db.commit()
    publish_event("PostDeleted", post_id=str(post.id), by_admin=False)


# ---------- Trả lời ----------

@router.post("/posts/{post_id}/replies", response_model=PostOut, status_code=201)
async def reply(post_id: uuid.UUID, body: CreatePostRequest, me: CurrentUser = Depends(get_current_user),
                db: AsyncSession = Depends(get_db)):
    parent = await _get_visible(db, me, post_id)
    if parent.reply_permission == ReplyPermission.OFF and parent.author_id != me.id:  # BR-PO1-04
        raise api_error(403, "REPLIES_OFF", "Tác giả đã tắt trả lời cho bài viết này")
    return await _create(db, me, body, parent)


@router.get("/posts/{post_id}/replies", response_model=PostListPage)
async def list_replies(post_id: uuid.UUID, cursor: str | None = None, me: CurrentUser = Depends(get_current_user),
                       db: AsyncSession = Depends(get_db)):
    await _get_visible(db, me, post_id)
    return await _list(db, me, select(Post).where(Post.parent_id == post_id), cursor)


# ---------- Thích / đăng lại ----------

async def _toggle(db: AsyncSession, me: CurrentUser, post_id: uuid.UUID, model, count_col: str, on: bool) -> PostOut:
    """Thêm / bỏ một dòng (user_id, post_id); số đếm chỉ đổi khi dòng thật sự thay đổi nên gọi lặp không lệch."""
    post = await _get_visible(db, me, post_id)
    if on:
        res = await db.execute(insert(model).values(user_id=me.id, post_id=post.id).on_conflict_do_nothing())
    else:
        res = await db.execute(model.__table__.delete().where(model.user_id == me.id, model.post_id == post.id))
    if res.rowcount:
        await db.execute(update(Post).where(Post.id == post.id)
                         .values({count_col: func.greatest(getattr(Post, count_col) + (1 if on else -1), 0)}))
    await db.commit()
    await db.refresh(post)
    if res.rowcount:
        name = ("PostLiked" if on else "PostUnliked") if model is Like else ("PostReposted" if on else "PostUnreposted")
        publish_event(name, post_id=str(post.id), actor_id=str(me.id), actor_name=me.username,
                      recipient_id=str(post.author_id), author_id=str(post.author_id))
    return (await _to_out(db, me, [post]))[0]


@router.post("/posts/{post_id}/like", response_model=PostOut)
async def like(post_id: uuid.UUID, me: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _toggle(db, me, post_id, Like, "like_count", True)


@router.delete("/posts/{post_id}/like", response_model=PostOut)
async def unlike(post_id: uuid.UUID, me: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _toggle(db, me, post_id, Like, "like_count", False)


@router.post("/posts/{post_id}/repost", response_model=PostOut)
async def repost(post_id: uuid.UUID, me: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _toggle(db, me, post_id, Repost, "repost_count", True)


@router.delete("/posts/{post_id}/repost", response_model=PostOut)
async def unrepost(post_id: uuid.UUID, me: CurrentUser = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    return await _toggle(db, me, post_id, Repost, "repost_count", False)


@router.get("/posts/{post_id}/likes", response_model=UserListPage)
async def list_likers(post_id: uuid.UUID, cursor: str | None = None, me: CurrentUser = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    """Danh sách người đã thích. Cursor ở đây là offset dạng chuỗi."""
    await _get_visible(db, me, post_id)
    offset = int(cursor) if cursor and cursor.isdigit() else 0
    rows = list(await db.scalars(select(Like.user_id).where(Like.post_id == post_id)
                                 .order_by(Like.created_at.desc(), Like.user_id).offset(offset).limit(PAGE_SIZE + 1)))
    hidden = await _hidden(me)
    cards = await auth_client.lookup_cards(me, ids=rows[:PAGE_SIZE])
    items = [UserCard(**{k: cards[u].get(k) for k in ("id", "username", "display_name", "avatar_url")})
             for u in rows[:PAGE_SIZE] if u in cards and u not in hidden]
    return UserListPage(items=items, next_cursor=str(offset + PAGE_SIZE) if len(rows) > PAGE_SIZE else None)


# ---------- Báo cáo ----------

@router.post("/posts/{post_id}/report", status_code=201)
async def report_post(post_id: uuid.UUID, body: ReportRequest, me: CurrentUser = Depends(get_current_user),
                      db: AsyncSession = Depends(get_db)):
    post = await _get_visible(db, me, post_id)
    if post.author_id == me.id:
        raise api_error(400, "CANNOT_REPORT_OWN_POST", "Không thể báo cáo bài của chính mình")
    pid = post.id  # rollback làm hết hạn đối tượng, nên giữ id ra ngoài
    desc = (body.description or "").strip() or None
    if body.reason.value == "OTHER" and not desc:  # BR-PO6-02
        raise api_error(422, "DESCRIPTION_REQUIRED", "Chọn \"Khác\" thì cần mô tả lý do",
                        fields={"description": "Bắt buộc"})
    if await db.scalar(select(Report.id).where(Report.reporter_id == me.id, Report.post_id == pid)):
        raise api_error(409, "ALREADY_REPORTED", "Bạn đã báo cáo nội dung này")  # BR-PO6-01
    for _ in range(2):  # lần 2 chỉ để xử lý hai người cùng tạo nhóm báo cáo một lúc
        case = await db.scalar(select(ReportCase).where(ReportCase.post_id == pid,
                                                        ReportCase.status == CaseStatus.PENDING))
        try:
            if case is None:
                case = ReportCase(id=uuid.uuid4(), post_id=pid)
                db.add(case)
                await db.flush()
            db.add(Report(case_id=case.id, post_id=pid, reporter_id=me.id, reason=body.reason, description=desc))
            await db.commit()
            return {"case_id": case.id}
        except IntegrityError:
            await db.rollback()
    raise api_error(409, "ALREADY_REPORTED", "Bạn đã báo cáo nội dung này")
