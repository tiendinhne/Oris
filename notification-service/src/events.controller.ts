import { Body, Controller, Get, Param, Put, Post, HttpCode, Req, UseGuards } from '@nestjs/common'
import { InjectRepository } from '@nestjs/typeorm'
import { Repository } from 'typeorm'
import { CurrentUser, InternalGuard, JwtGuard } from './auth.guard'
import { EventDto, UpdateSettingDto } from './dto'
import { apiError } from './errors'
import { Notification, NotificationActor, NotificationSetting } from './notification.entity'

const CONFIGURABLE = ['LIKE', 'REPLY', 'REPOST', 'FOLLOW', 'MENTION'] as const
const GROUPED = ['LIKE', 'REPOST', 'FOLLOW']  // BR-NO1-02: gộp "A và N người khác"
const ACTION: Record<string, string> = {
  LIKE: 'đã thích bài viết của bạn', REPOST: 'đã đăng lại bài viết của bạn', FOLLOW: 'đã bắt đầu theo dõi bạn',
  REPLY: 'đã trả lời bài viết của bạn', MENTION: 'đã nhắc đến bạn trong một bài viết',
}

const text = (type: string, name: string | null, n: number) =>
  name === null ? `${n} người ${ACTION[type]}` : n <= 1 ? `${name} ${ACTION[type]}` : `${name} và ${n - 1} người khác ${ACTION[type]}`

@Controller()
export class EventsController {
  constructor(
    @InjectRepository(Notification) private notifs: Repository<Notification>,
    @InjectRepository(NotificationActor) private actors: Repository<NotificationActor>,
    @InjectRepository(NotificationSetting) private settings: Repository<NotificationSetting>,
  ) {}

  /** Auth / Post báo có người thích, trả lời, theo dõi... `remove: true` khi họ hoàn tác (BR-NO1-05). */
  @Post('internal/events')
  @HttpCode(200)
  @UseGuards(InternalGuard)
  async event(@Body() e: EventDto) {
    if (e.recipient_id === e.actor_id) return { status: 'ignored' }
    const setting = await this.settings.findOneBy({ userId: e.recipient_id, type: e.type })
    // ponytail: mới xét bật/tắt; phạm vi FOLLOWING cần hỏi Auth xem có theo dõi không, thêm khi cần
    if (setting && !setting.enabled) return { status: 'disabled' }

    if (!GROUPED.includes(e.type)) {
      if (e.remove) return { status: 'ignored' }
      await this.notifs.save(this.notifs.create({
        userId: e.recipient_id, kind: e.type, postId: e.post_id ?? null, message: text(e.type, e.actor_name, 1), actorCount: 1,
      }))
      return { status: 'created' }
    }

    const groupKey = `${e.type}:${e.post_id ?? 'profile'}:${new Date().toISOString().slice(0, 10)}`
    let n = await this.notifs.findOneBy({ userId: e.recipient_id, groupKey })
    if (e.remove) {
      if (!n) return { status: 'ignored' }
      await this.actors.delete({ notificationId: n.id, actorId: e.actor_id })
      const count = await this.actors.countBy({ notificationId: n.id })
      if (count === 0) await this.notifs.delete(n.id)
      else await this.notifs.update(n.id, { actorCount: count, message: text(e.type, count === 1 ? e.actor_name : null, count) })
      return { status: 'removed' }
    }
    n ??= await this.notifs.save(this.notifs.create({
      userId: e.recipient_id, kind: e.type, postId: e.post_id ?? null, groupKey, message: '',
    }))
    await this.actors.createQueryBuilder().insert().values({ notificationId: n.id, actorId: e.actor_id })
      .orIgnore().execute()
    const count = await this.actors.countBy({ notificationId: n.id })
    await this.notifs.update(n.id, {
      actorCount: count, message: text(e.type, e.actor_name, count), readAt: null, lastActivityAt: new Date(),
    })
    return { status: 'grouped', count }
  }

  /** Cài đặt từng loại; loại chưa có dòng nghĩa là bật cho mọi người. */
  @Get('notifications/settings')
  @UseGuards(JwtGuard)
  async getSettings(@Req() req: { user: CurrentUser }) {
    const rows = await this.settings.findBy({ userId: req.user.id })
    return CONFIGURABLE.map(type => {
      const r = rows.find(x => x.type === type)
      return { type, enabled: r?.enabled ?? true, scope: r?.scope ?? 'EVERYONE' }
    })
  }

  @Put('notifications/settings/:type')
  @UseGuards(JwtGuard)
  async putSetting(@Req() req: { user: CurrentUser }, @Param('type') type: string, @Body() dto: UpdateSettingDto) {
    if (!(CONFIGURABLE as readonly string[]).includes(type)) {
      throw apiError(404, 'UNKNOWN_NOTIFICATION_TYPE', 'Loại thông báo không hợp lệ')  // SYSTEM luôn bật
    }
    const cur = await this.settings.findOneBy({ userId: req.user.id, type })
    const next = { userId: req.user.id, type, enabled: dto.enabled ?? cur?.enabled ?? true, scope: dto.scope ?? cur?.scope ?? 'EVERYONE' }
    await this.settings.save(next)
    return { type, enabled: next.enabled, scope: next.scope }
  }
}
