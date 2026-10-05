import {
  Column, CreateDateColumn, Entity, Index, JoinColumn, ManyToOne, PrimaryColumn, PrimaryGeneratedColumn,
} from 'typeorm'

/** Loại thông báo (BR-NO1-01). EMAIL dùng cho thông báo gửi qua email như khóa tài khoản. */
export const NOTIFICATION_TYPES = ['LIKE', 'REPLY', 'REPOST', 'FOLLOW', 'MENTION', 'SYSTEM', 'EMAIL'] as const

// Thời gian lưu độ chính xác mili giây (precision 3) để khớp đúng với Date của JS khi dùng làm cursor phân trang.
@Entity('notifications')
@Index('idx_notifications_user_created', ['userId', 'createdAt', 'id'])
@Index('idx_notifications_user_group', ['userId', 'groupKey'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  /** Người nhận (ref auth_db.users, không có khóa ngoại) */
  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  /** Loại thông báo, xem NOTIFICATION_TYPES */
  @Column({ type: 'varchar', length: 32, default: 'SYSTEM' })
  kind!: string

  @Column({ type: 'text' })
  message!: string

  /** Bài viết liên quan (ref post_db.posts), null với FOLLOW / SYSTEM */
  @Column({ name: 'post_id', type: 'uuid', nullable: true })
  postId!: string | null

  /** Khóa gộp, ví dụ LIKE:<post_id>:<ngày> – BR-NO1-02 */
  @Column({ name: 'group_key', type: 'varchar', length: 120, nullable: true })
  groupKey!: string | null

  /** Số người gây ra thông báo sau khi gộp ("A và N người khác") */
  @Column({ name: 'actor_count', type: 'int', default: 0 })
  actorCount!: number

  @Column({ name: 'read_at', type: 'timestamptz', precision: 3, nullable: true })
  readAt!: Date | null

  /** Thời điểm hành động mới nhất, dùng để sắp xếp thông báo gộp */
  @Column({ name: 'last_activity_at', type: 'timestamptz', precision: 3, default: () => 'now()' })
  lastActivityAt!: Date

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', precision: 3 })
  createdAt!: Date
}

/** Từng người gây ra một thông báo gộp; gỡ được đúng người khi họ bỏ thích (BR-NO1-05). */
@Entity('notification_actors')
export class NotificationActor {
  @PrimaryColumn({ name: 'notification_id', type: 'uuid' })
  notificationId!: string

  /** ref auth_db.users */
  @PrimaryColumn({ name: 'actor_id', type: 'uuid' })
  actorId!: string

  @ManyToOne(() => Notification, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'notification_id' })
  notification!: Notification

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', precision: 3 })
  createdAt!: Date
}

/** Cài đặt từng loại thông báo của người dùng (BR-NO4). Không có dòng nào nghĩa là bật tất cả. */
@Entity('notification_settings')
export class NotificationSetting {
  /** ref auth_db.users */
  @PrimaryColumn({ name: 'user_id', type: 'uuid' })
  userId!: string

  /** LIKE, REPLY, REPOST, FOLLOW, MENTION (SYSTEM luôn bật nên không lưu) */
  @PrimaryColumn({ type: 'varchar', length: 16 })
  type!: string

  @Column({ type: 'boolean', default: true })
  enabled!: boolean

  /** EVERYONE hoặc FOLLOWING */
  @Column({ type: 'varchar', length: 16, default: 'EVERYONE' })
  scope!: string
}
