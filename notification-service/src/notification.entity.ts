import { Column, CreateDateColumn, Entity, Index, PrimaryGeneratedColumn } from 'typeorm'

// Thời gian lưu độ chính xác mili giây (precision 3) để khớp đúng với Date của JS khi dùng làm cursor phân trang.
@Entity('notifications')
@Index('idx_notifications_user_created', ['userId', 'createdAt', 'id'])
export class Notification {
  @PrimaryGeneratedColumn('uuid')
  id!: string

  @Column({ name: 'user_id', type: 'uuid' })
  userId!: string

  @Column({ type: 'varchar', length: 32, default: 'SYSTEM' })
  kind!: string

  @Column({ type: 'text' })
  message!: string

  @Column({ name: 'read_at', type: 'timestamptz', precision: 3, nullable: true })
  readAt!: Date | null

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz', precision: 3 })
  createdAt!: Date
}
