"""API quản trị của Post Service: bài viết và báo cáo vi phạm (UC Quản trị 2, 3)."""
import uuid
from collections import Counter, defaultdict
from datetime import datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, Depends, Query
from sqlalchemy import exists, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.clients import auth_client
from app.config import settings
from app.database import get_db
from app.errors import api_error
from app.models import CaseStatus, MediaType, Post, PostMedia, Report, ReportCase, ReportReason
from app.notify import publish_event, system_notification
from app.pagination import PAGE_SIZE, keyset_filter, page
from app.schemas import (
    AdminPostItem, ApproveRequest, Author, DeletePostRequest, DismissRequest, MediaSummary, ModerationResponse,
    PostPage, ReasonCount, ReportCaseDetail, ReportCaseItem, ReportCasePage,
)
from app.security import CurrentUser, require_admin

router = APIRouter(prefix="/admin", tags=["admin"], dependencies=[Depends(require_admin)])

REASON_VI = {"SPAM": "Spam", "HARASSMENT": "Quấy rối", "HATE": "Thù ghét", "VIOLENCE": "Bạo lực",
             "SENSITIVE": "Nội dung nhạy cảm", "OTHER": "Khác"}


def _now() -> datetime:
    return datetime.now(timezone.utc)


@router.get("/ping")
async def ping(admin: CurrentUser = Depends(require_admin)):
    return {"service": settings.service_name, "admin": admin.username}


# ---------- Dựng dữ liệu trả về ----------

async def _post_items(db: AsyncSession, admin: CurrentUser, posts: list[Post]) -> list[AdminPostItem]:
    ids = [p.id for p in posts]
    if not ids:
        return []
    media = defaultdict(MediaSummary)
    for post_id, mtype, n in (await db.execute(
            select(PostMedia.post_id, PostMedia.type, func.count()).where(PostMedia.post_id.in_(ids))
            .group_by(PostMedia.post_id, PostMedia.type))).all():
        if mtype == MediaType.IMAGE:
            media[post_id].images = n
        else:
            media[post_id].videos = n
    pending = dict((await db.execute(
        select(ReportCase.post_id, func.count(Report.id)).join(Report, Report.case_id == ReportCase.id)
        .where(ReportCase.post_id.in_(ids), ReportCase.status == CaseStatus.PENDING)
        .group_by(ReportCase.post_id))).all())
    authors = await auth_client.lookup_users(admin, ids=[p.author_id for p in posts])
    items = []
    for p in posts:
        a = authors.get(p.author_id, {})
        items.append(AdminPostItem(
            id=p.id, author=Author(id=p.author_id, username=a.get("username"), display_name=a.get("display_name"),
                          status=a.get("status")),
            type="REPLY" if p.parent_id else "POST", content=p.content, visibility=p.visibility.value,
            media=media.get(p.id, MediaSummary()), pending_reports=pending.get(p.id, 0), created_at=p.created_at,
        ))
    return items


async def _get_live_post(db: AsyncSession, post_id: uuid.UUID) -> Post:
    post = await db.get(Post, post_id)
    if post is None or post.deleted_at is not None:
        raise api_error(404, "POST_NOT_FOUND", "Không tìm thấy bài viết hoặc bài đã bị xóa")
    return post


async def _reporter_ids(db: AsyncSession, case_id: uuid.UUID) -> list[uuid.UUID]:
    return list((await db.scalars(select(Report.reporter_id).where(Report.case_id == case_id))).all())


async def _remove_post(db: AsyncSession, admin: CurrentUser, post: Post, reason: ReportReason,
                       action: str, target_type: str, target_id: uuid.UUID) -> ModerationResponse:
    """BR-AD2-02/03: xóa bài với mọi người, không khôi phục; báo Auth ghi nhật ký + vi phạm."""
    post.deleted_at, post.removed_by, post.removal_reason = _now(), admin.id, reason
    case = await db.scalar(select(ReportCase).where(ReportCase.post_id == post.id,
                                                    ReportCase.status == CaseStatus.PENDING))
    if case:  # báo cáo đang chờ của bài chuyển sang Đã duyệt
        case.status, case.resolved_by, case.resolved_at = CaseStatus.APPROVED, admin.id, _now()
    await db.flush()
    # Gọi Auth TRƯỚC khi commit: Auth lỗi thì toàn bộ thay đổi ở đây được hủy
    result = await auth_client.moderation_event(
        admin, action=action, target_type=target_type, target_id=target_id,
        reason=reason.value, author_id=post.author_id, post_id=post.id)
    await db.commit()
    system_notification(post.author_id, f"Bài viết của bạn đã bị xóa. Lý do: {REASON_VI[reason.value]}")
    if case:
        for rid in await _reporter_ids(db, case.id):
            system_notification(rid, "Nội dung bạn báo cáo đã được xử lý.")
    publish_event("PostDeleted", post_id=str(post.id), by_admin=True)
    return ModerationResponse(post_id=post.id, author_violations_90d=result.get("violations_90d"),
                              author_auto_banned=result.get("auto_banned", False))


# ---------- Bài viết ----------

@router.get("/posts", response_model=PostPage)
async def list_posts(
    q: str | None = Query(None, description="Tìm trong nội dung; bắt đầu bằng @ để tìm theo username tác giả"),
    type: Literal["POST", "REPLY"] | None = None,
    days: Literal[1, 7, 30] | None = Query(None, description="24 giờ / 7 ngày / 30 ngày"),
    reported_only: bool = False,
    cursor: str | None = None,
    admin: CurrentUser = Depends(require_admin), db: AsyncSession = Depends(get_db),
):
    """BR-AD2-01: mọi bài và trả lời chưa bị xóa, kể cả bài Riêng tư."""
    stmt = select(Post).where(Post.deleted_at.is_(None))
    if type == "POST":
        stmt = stmt.where(Post.parent_id.is_(None))
    elif type == "REPLY":
        stmt = stmt.where(Post.parent_id.is_not(None))
    if days:
        stmt = stmt.where(Post.created_at >= _now() - timedelta(days=days))
    if reported_only:
        stmt = stmt.where(exists().where(ReportCase.post_id == Post.id, ReportCase.status == CaseStatus.PENDING))
    if q and q.strip():
        q = q.strip()
        if q.startswith("@"):
            found = await auth_client.lookup_users(admin, usernames=[q])
            stmt = stmt.where(Post.author_id.in_(list(found.keys()) or [uuid.uuid4()]))
        else:
            stmt = stmt.where(Post.content.ilike(f"%{q}%"))
    rows = (await db.scalars(keyset_filter(stmt, Post.created_at, Post.id, cursor))).all()
    rows, next_cursor = page(list(rows))
    return PostPage(items=await _post_items(db, admin, rows), next_cursor=next_cursor)


@router.get("/posts/{post_id}", response_model=AdminPostItem)
async def get_post(post_id: uuid.UUID, admin: CurrentUser = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    return (await _post_items(db, admin, [await _get_live_post(db, post_id)]))[0]


@router.delete("/posts/{post_id}", response_model=ModerationResponse)
async def delete_post(post_id: uuid.UUID, body: DeletePostRequest, admin: CurrentUser = Depends(require_admin),
                      db: AsyncSession = Depends(get_db)):
    post = await _get_live_post(db, post_id)
    return await _remove_post(db, admin, post, body.reason, "DELETE_POST", "POST", post.id)


# ---------- Báo cáo vi phạm ----------

async def _case_items(db: AsyncSession, admin: CurrentUser, rows) -> list[ReportCaseItem]:
    """rows: (ReportCase, số báo cáo, thời điểm báo cáo đầu)."""
    case_ids = [c.id for c, _, _ in rows]
    reason_counts = defaultdict(Counter)
    for cid, reason, n in (await db.execute(
            select(Report.case_id, Report.reason, func.count()).where(Report.case_id.in_(case_ids))
            .group_by(Report.case_id, Report.reason))).all():
        reason_counts[cid][reason] = n
    posts = {p.id: p for p in (await db.scalars(select(Post).where(Post.id.in_([c.post_id for c, _, _ in rows])))).all()}
    post_items = {i.id: i for i in await _post_items(db, admin, list(posts.values()))}
    return [ReportCaseItem(
        id=c.id, status=c.status, post=post_items[c.post_id], report_count=n,
        top_reason=reason_counts[c.id].most_common(1)[0][0], first_reported_at=first, resolved_at=c.resolved_at,
    ) for c, n, first in rows]


def _case_query():
    return (select(ReportCase, func.count(Report.id).label("n"), func.min(Report.created_at).label("first"))
            .join(Report, Report.case_id == ReportCase.id).group_by(ReportCase.id))


@router.get("/reports", response_model=ReportCasePage)
async def list_report_cases(status: CaseStatus = CaseStatus.PENDING, offset: int = Query(0, ge=0),
                            admin: CurrentUser = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """BR-AD3-01: nhóm đang chờ xếp theo số báo cáo giảm dần, rồi báo cáo sớm nhất.

    Dùng offset thay cho cursor vì thứ tự dựa trên số đếm, không phải thời gian.
    """
    stmt = _case_query().where(ReportCase.status == status)
    if status == CaseStatus.PENDING:
        stmt = stmt.order_by(func.count(Report.id).desc(), func.min(Report.created_at).asc())
    else:
        stmt = stmt.order_by(ReportCase.resolved_at.desc().nulls_last())
    rows = (await db.execute(stmt.offset(offset).limit(PAGE_SIZE + 1))).all()
    has_more = len(rows) > PAGE_SIZE
    rows = rows[:PAGE_SIZE]
    return ReportCasePage(items=await _case_items(db, admin, rows),
                          next_offset=offset + PAGE_SIZE if has_more else None)


async def _get_case_row(db: AsyncSession, case_id: uuid.UUID):
    row = (await db.execute(_case_query().where(ReportCase.id == case_id))).first()
    if row is None:
        raise api_error(404, "REPORT_CASE_NOT_FOUND", "Không tìm thấy nhóm báo cáo")
    return row


@router.get("/reports/{case_id}", response_model=ReportCaseDetail)
async def get_report_case(case_id: uuid.UUID, admin: CurrentUser = Depends(require_admin),
                          db: AsyncSession = Depends(get_db)):
    """BR-AD3-02: nội dung, tác giả, lý do kèm số lượng, lịch sử vi phạm của tác giả."""
    row = await _get_case_row(db, case_id)
    item = (await _case_items(db, admin, [row]))[0]
    reports = (await db.scalars(select(Report).where(Report.case_id == case_id))).all()
    counts = Counter(r.reason for r in reports)
    author = await auth_client.get_user(admin, item.post.author.id)
    return ReportCaseDetail(
        **item.model_dump(),
        reasons=[ReasonCount(reason=r, count=n) for r, n in counts.most_common()],
        other_descriptions=[r.description for r in reports if r.reason == ReportReason.OTHER and r.description],
        author_violations_90d=author.get("violations_90d"),
    )


async def _pending_case(db: AsyncSession, case_id: uuid.UUID) -> ReportCase:
    case = await db.get(ReportCase, case_id)
    if case is None:
        raise api_error(404, "REPORT_CASE_NOT_FOUND", "Không tìm thấy nhóm báo cáo")
    if case.status != CaseStatus.PENDING:
        raise api_error(409, "REPORT_CASE_RESOLVED", "Nhóm báo cáo này đã được xử lý")
    return case


@router.post("/reports/{case_id}/approve", response_model=ModerationResponse)
async def approve_report_case(case_id: uuid.UUID, body: ApproveRequest, admin: CurrentUser = Depends(require_admin),
                              db: AsyncSession = Depends(get_db)):
    """BR-AD3-03: duyệt = xóa nội dung theo BR-AD2, mọi báo cáo chuyển Đã duyệt."""
    case = await _pending_case(db, case_id)
    post = await _get_live_post(db, case.post_id)
    return await _remove_post(db, admin, post, body.reason, "APPROVE_REPORT", "REPORT_CASE", case.id)


@router.post("/reports/{case_id}/dismiss", response_model=ReportCaseItem)
async def dismiss_report_case(case_id: uuid.UUID, body: DismissRequest = DismissRequest(),
                              admin: CurrentUser = Depends(require_admin), db: AsyncSession = Depends(get_db)):
    """BR-AD3-04: bỏ qua, nội dung giữ nguyên; báo cáo mới sau này tạo nhóm mới."""
    case = await _pending_case(db, case_id)
    case.status, case.resolved_by, case.resolved_at = CaseStatus.DISMISSED, admin.id, _now()
    await db.flush()
    await auth_client.moderation_event(admin, action="DISMISS_REPORT", target_type="REPORT_CASE",
                                       target_id=case.id, reason=body.reason)
    await db.commit()
    for rid in await _reporter_ids(db, case.id):
        system_notification(rid, "Nội dung bạn báo cáo không vi phạm tiêu chuẩn cộng đồng.")
    return (await _case_items(db, admin, [await _get_case_row(db, case_id)]))[0]
