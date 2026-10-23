import { Body, Controller, Delete, HttpCode, Get, Param, Post, Query, Req, UseGuards } from '@nestjs/common'
import { InjectDataSource } from '@nestjs/typeorm'
import { DataSource } from 'typeorm'
import { CurrentUser, InternalGuard, JwtGuard } from './auth.guard'
import { apiError } from './errors'

const PAGE = 20
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uuid = (v: unknown, field: string): string => {
  if (typeof v !== 'string' || !UUID_RE.test(v)) throw apiError(422, 'VALIDATION_ERROR', `${field} phải là UUID hợp lệ`)
  return v
}

/** Bỏ bài đã ẩn và bài của người đã bị "ẩn mọi bài" (BR-FE3). $1 là id người xem. */
const notHidden = (postCol: string, authorCol: string) => `
  AND NOT EXISTS (SELECT 1 FROM hidden_posts h WHERE h.user_id = $1 AND h.post_id = ${postCol})
  AND NOT EXISTS (SELECT 1 FROM muted_users m WHERE m.user_id = $1 AND m.muted_user_id = ${authorCol})`

/** Người theo dõi `$2` cộng với chính `$2`: những ai sẽ thấy bài / lượt đăng lại của `$2`. */
const AUDIENCE = `(SELECT follower_id AS o FROM follow_refs WHERE following_id = $2 UNION SELECT $2::uuid) t`

/** Bảng tin: dựng sẵn từ sự kiện (fan-out on write), nội dung bài lấy từ Post Service khi trả về. */
@Controller()
export class FeedController {
  constructor(@InjectDataSource() private db: DataSource) {}

  @Get('health')
  async health() {
    await this.db.query('SELECT 1')
    return { service: 'feed-service', database: 'ok' }
  }

  /** Hỏi Post Service nội dung các bài (đã lọc bài riêng tư, đã xóa, người bị chặn theo người xem). */
  private async hydrate(auth: string, ids: string[]): Promise<Map<string, any>> {
    if (!ids.length) return new Map()
    let res: Response
    try {
      res = await fetch(`${process.env.POST_SERVICE_URL ?? 'http://post-service:8000'}/posts/batch`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: auth }, body: JSON.stringify({ ids }),
      })
    } catch {
      throw apiError(502, 'POST_SERVICE_UNAVAILABLE', 'Không kết nối được Post Service')
    }
    if (!res.ok) throw apiError(502, 'POST_SERVICE_ERROR', 'Post Service trả lỗi')
    return new Map(((await res.json()) as any[]).map(p => [p.id, p]))
  }

  /** Bảng tin những người mình theo dõi, mới nhất trước. */
  @Get('feed')
  @UseGuards(JwtGuard)
  async feed(@Req() req: { user: CurrentUser; headers: any }, @Query('cursor') cursor?: string) {
    let after = ''
    const params: any[] = [req.user.id]
    if (cursor) {
      const [ts, id] = Buffer.from(cursor, 'base64url').toString().split('|')
      if (!id || isNaN(Date.parse(ts)) || !UUID_RE.test(id)) throw apiError(400, 'INVALID_CURSOR', 'Cursor không hợp lệ')
      after = 'AND (f.activity_at, f.id) < ($2::timestamptz, $3::uuid)'
      params.push(ts, id)
    }
    // ts giữ đủ micro giây để cursor so sánh chính xác
    const rows: any[] = await this.db.query(
      `SELECT f.id, f.post_id, f.reposter_id, to_char(f.activity_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"') AS ts
       FROM feed_items f WHERE f.owner_id = $1 ${after} ${notHidden('f.post_id', 'f.author_id')}
       ORDER BY f.activity_at DESC, f.id DESC LIMIT ${PAGE + 1}`, params)
    const page = rows.slice(0, PAGE)
    const posts = await this.hydrate(req.headers.authorization, page.map(r => r.post_id))
    const last = page[page.length - 1]
    return {
      // bài đã bị xóa / không xem được thì Post Service không trả về nên bỏ qua
      items: page.filter(r => posts.has(r.post_id)).map(r => ({ post: posts.get(r.post_id), reposted_by: r.reposter_id })),
      next_cursor: rows.length > PAGE ? Buffer.from(`${last.ts}|${last.id}`).toString('base64url') : null,
    }
  }

  /** Khám phá: bài nhiều tương tác nhất 7 ngày qua (BR-FE2). Xếp theo điểm nên phân trang bằng offset. */
  @Get('feed/explore')
  @UseGuards(JwtGuard)
  async explore(@Req() req: { user: CurrentUser; headers: any }, @Query('offset') offset?: string) {
    const off = Math.max(parseInt(offset ?? '0', 10) || 0, 0)
    const rows: any[] = await this.db.query(
      `SELECT s.post_id FROM post_scores s
       WHERE s.post_created_at > now() - interval '7 days' AND s.author_id <> $1 ${notHidden('s.post_id', 's.author_id')}
       ORDER BY s.score DESC, s.post_created_at DESC, s.post_id LIMIT ${PAGE + 1} OFFSET ${off}`, [req.user.id])
    const page = rows.slice(0, PAGE)
    const posts = await this.hydrate(req.headers.authorization, page.map(r => r.post_id))
    return {
      items: page.filter(r => posts.has(r.post_id)).map(r => ({ post: posts.get(r.post_id), reposted_by: null })),
      next_offset: rows.length > PAGE ? off + PAGE : null,
    }
  }

  // ---------- Ẩn bài / ẩn mọi bài của một người (BR-FE3) ----------
  @Post('feed/hide/:postId') @HttpCode(204) @UseGuards(JwtGuard)
  async hide(@Req() req: { user: CurrentUser }, @Param('postId') postId: string) {
    await this.db.query('INSERT INTO hidden_posts (user_id, post_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, uuid(postId, 'postId')])
  }

  @Delete('feed/hide/:postId') @HttpCode(204) @UseGuards(JwtGuard)
  async unhide(@Req() req: { user: CurrentUser }, @Param('postId') postId: string) {
    await this.db.query('DELETE FROM hidden_posts WHERE user_id = $1 AND post_id = $2', [req.user.id, uuid(postId, 'postId')])
  }

  @Post('feed/mute/:userId') @HttpCode(204) @UseGuards(JwtGuard)
  async mute(@Req() req: { user: CurrentUser }, @Param('userId') userId: string) {
    if (userId === req.user.id) throw apiError(400, 'CANNOT_MUTE_SELF', 'Không thể tự ẩn chính mình')
    await this.db.query('INSERT INTO muted_users (user_id, muted_user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [req.user.id, uuid(userId, 'userId')])
  }

  @Delete('feed/mute/:userId') @HttpCode(204) @UseGuards(JwtGuard)
  async unmute(@Req() req: { user: CurrentUser }, @Param('userId') userId: string) {
    await this.db.query('DELETE FROM muted_users WHERE user_id = $1 AND muted_user_id = $2', [req.user.id, uuid(userId, 'userId')])
  }

  // ---------- Sự kiện từ Auth / Post ----------
  /** Cùng tên sự kiện với `publish_event` bên Python; sự kiện không liên quan bị bỏ qua. */
  @Post('internal/events')
  @HttpCode(200)
  @UseGuards(InternalGuard)
  async event(@Body() e: { name: string; [k: string]: any }) {
    const q = (sql: string, p: any[]) => this.db.query(sql, p)
    const score = (delta: number) =>
      q('UPDATE post_scores SET score = GREATEST(score + $2, 0), updated_at = now() WHERE post_id = $1', [uuid(e.post_id, 'post_id'), delta])
    switch (e.name) {
      case 'PostCreated': { // chỉ bài gốc mới có sự kiện này (trả lời không vào bảng tin)
        const [post, author] = [uuid(e.post_id, 'post_id'), uuid(e.author_id, 'author_id')]
        const at = e.created_at ?? new Date().toISOString()
        await q('INSERT INTO post_scores (post_id, author_id, score, post_created_at) VALUES ($1, $2, 0, $3) ON CONFLICT DO NOTHING', [post, author, at])
        await q(`INSERT INTO feed_items (id, owner_id, post_id, author_id, activity_at)
                 SELECT gen_random_uuid(), o, $1, $2, $3 FROM ${AUDIENCE} ON CONFLICT DO NOTHING`, [post, author, at])
        break
      }
      case 'PostDeleted':
        await q('DELETE FROM feed_items WHERE post_id = $1', [uuid(e.post_id, 'post_id')])
        await q('DELETE FROM post_scores WHERE post_id = $1', [e.post_id])
        break
      case 'PostReposted': // bài hiện trong bảng tin người theo dõi người đăng lại, nếu chưa có
        await q(`INSERT INTO feed_items (id, owner_id, post_id, author_id, reposter_id, activity_at)
                 SELECT gen_random_uuid(), o, $1, $3, $2, now() FROM ${AUDIENCE} ON CONFLICT DO NOTHING`,
          [uuid(e.post_id, 'post_id'), uuid(e.actor_id, 'actor_id'), uuid(e.author_id, 'author_id')])
        await score(1)
        break
      case 'PostUnreposted':
        await q('DELETE FROM feed_items WHERE post_id = $1 AND reposter_id = $2', [uuid(e.post_id, 'post_id'), uuid(e.actor_id, 'actor_id')])
        await score(-1)
        break
      case 'PostLiked': case 'PostReplied': // ponytail: cộng dồn, chưa giảm dần theo thời gian
        await score(1)
        break
      case 'PostUnliked':
        await score(-1)
        break
      case 'UserFollowed':
        await q('INSERT INTO follow_refs (follower_id, following_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [uuid(e.actor_id, 'actor_id'), uuid(e.recipient_id, 'recipient_id')])
        break
      case 'UserUnfollowed': // bỏ theo dõi thì bài của họ biến khỏi bảng tin
        await q('DELETE FROM follow_refs WHERE follower_id = $1 AND following_id = $2', [uuid(e.actor_id, 'actor_id'), uuid(e.recipient_id, 'recipient_id')])
        await q('DELETE FROM feed_items WHERE owner_id = $1 AND (author_id = $2 OR reposter_id = $2)', [e.actor_id, e.recipient_id])
        break
    }
    return { status: 'ok' }
  }
}
