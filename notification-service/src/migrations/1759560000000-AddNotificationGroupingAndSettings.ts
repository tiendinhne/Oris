import { MigrationInterface, QueryRunner } from 'typeorm'

/** Bổ sung theo ERD: gộp thông báo (post_id, group_key, actor_count), bảng người gây thông báo và cài đặt thông báo. */
export class AddNotificationGroupingAndSettings1759560000000 implements MigrationInterface {
  name = 'AddNotificationGroupingAndSettings1759560000000'

  async up(q: QueryRunner) {
    await q.query(`ALTER TABLE notifications
      ADD COLUMN IF NOT EXISTS post_id uuid,
      ADD COLUMN IF NOT EXISTS group_key varchar(120),
      ADD COLUMN IF NOT EXISTS actor_count integer NOT NULL DEFAULT 0,
      ADD COLUMN IF NOT EXISTS last_activity_at timestamptz(3) NOT NULL DEFAULT now()`)
    await q.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_group ON notifications (user_id, group_key)`)
    await q.query(`CREATE TABLE IF NOT EXISTS notification_actors (
      notification_id uuid NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
      actor_id        uuid NOT NULL,
      created_at      timestamptz(3) NOT NULL DEFAULT now(),
      PRIMARY KEY (notification_id, actor_id)
    )`)
    await q.query(`CREATE TABLE IF NOT EXISTS notification_settings (
      user_id uuid NOT NULL,
      type    varchar(16) NOT NULL,
      enabled boolean NOT NULL DEFAULT true,
      scope   varchar(16) NOT NULL DEFAULT 'EVERYONE',
      PRIMARY KEY (user_id, type)
    )`)
  }

  async down(q: QueryRunner) {
    await q.query('DROP TABLE IF EXISTS notification_settings')
    await q.query('DROP TABLE IF EXISTS notification_actors')
    await q.query('DROP INDEX IF EXISTS idx_notifications_user_group')
    await q.query(`ALTER TABLE notifications
      DROP COLUMN IF EXISTS last_activity_at, DROP COLUMN IF EXISTS actor_count,
      DROP COLUMN IF EXISTS group_key, DROP COLUMN IF EXISTS post_id`)
  }
}
