import { Body, Controller, Get, HttpCode, Param, ParseUUIDPipe, Post, Query, Req, UseGuards } from '@nestjs/common'
import { InjectDataSource, InjectRepository } from '@nestjs/typeorm'
import { DataSource, IsNull, Repository } from 'typeorm'
import { CurrentUser, InternalGuard, JwtGuard } from './auth.guard'
import { decodeCursor, encodeCursor } from './cursor'
import { CreateNotificationDto } from './dto'
import { apiError, validationError } from './errors'
import { Notification } from './notification.entity'

@Controller()
export class NotificationsController {
  constructor(
    @InjectRepository(Notification) private repo: Repository<Notification>,
    @InjectDataSource() private db: DataSource,
  ) {}

  @Get('health')
  async health() {
    await this.db.query('SELECT 1')
    return { service: 'notification-service', database: 'ok' }
  }

  /** Các service khác (Auth, Post) gọi vào để tạo thông báo cho một người dùng. */
  @Post('internal/notifications')
  @UseGuards(InternalGuard)
  async create(@Body() dto: CreateNotificationDto) {
    return this.repo.save(this.repo.create({ userId: dto.user_id, message: dto.message, kind: dto.kind ?? 'SYSTEM' }))
  }

  /** Thông báo của người đang đăng nhập, mới nhất trước. Phân trang theo cursor (created_at, id). */
  @Get('notifications')
  @UseGuards(JwtGuard)
  async list(
    @Req() req: { user: CurrentUser },
    @Query('unread') unread?: string,
    @Query('limit') limit?: string,
    @Query('cursor') cursor?: string,
  ) {
    const take = Math.min(Math.max(parseInt(limit ?? '20', 10) || 20, 1), 100)
    const qb = this.repo.createQueryBuilder('n').where('n.user_id = :uid', { uid: req.user.id })
    if (unread === 'true') qb.andWhere('n.read_at IS NULL')
    if (cursor) {
      const c = decodeCursor(cursor)
      // So cả cặp (created_at, id): hai thông báo tạo cùng lúc không bị sót khi sang trang
      qb.andWhere('(n.created_at, n.id) < (:ts, :id)', { ts: c.createdAt, id: c.id })
    }
    const rows = await qb.orderBy('n.created_at', 'DESC').addOrderBy('n.id', 'DESC').limit(take + 1).getMany()
    const items = rows.slice(0, take)
    const last = items[items.length - 1]
    return { items, next_cursor: rows.length > take ? encodeCursor(last.createdAt, last.id) : null }
  }

  @Get('notifications/unread-count')
  @UseGuards(JwtGuard)
  async unreadCount(@Req() req: { user: CurrentUser }) {
    return { count: await this.repo.count({ where: { userId: req.user.id, readAt: IsNull() } }) }
  }

  @Post('notifications/read-all')
  @HttpCode(200)
  @UseGuards(JwtGuard)
  async readAll(@Req() req: { user: CurrentUser }) {
    const res = await this.repo.update({ userId: req.user.id, readAt: IsNull() }, { readAt: new Date() })
    return { updated: res.affected ?? 0 }
  }

  @Post('notifications/:id/read')
  @HttpCode(200)
  @UseGuards(JwtGuard)
  async read(@Req() req: { user: CurrentUser }, @Param('id', new ParseUUIDPipe({ exceptionFactory: () => validationError([{ field: 'id', message: 'id phải là UUID hợp lệ' }]) })) id: string) {
    // Lọc theo userId: người này không đánh dấu được thông báo của người khác
    const n = await this.repo.findOneBy({ id, userId: req.user.id })
    if (!n) throw apiError(404, 'NOTIFICATION_NOT_FOUND', 'Không tìm thấy thông báo')
    if (!n.readAt) n.readAt = new Date()
    return this.repo.save(n)
  }
}
