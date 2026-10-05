"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CreateNotifications1759550000000 = void 0;
/**
 * Bảng đầu tiên của Notification Service. Viết theo kiểu "IF NOT EXISTS" vì trước đây bảng từng được
 * tạo tự động (synchronize), nên migration này cũng chạy được trên database đã có bảng.
 */
class CreateNotifications1759550000000 {
    constructor() {
        this.name = 'CreateNotifications1759550000000';
    }
    async up(q) {
        await q.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        user_id    uuid NOT NULL,
        kind       varchar(32) NOT NULL DEFAULT 'SYSTEM',
        message    text NOT NULL,
        read_at    timestamptz(3),
        created_at timestamptz(3) NOT NULL DEFAULT now()
      )`);
        await q.query(`ALTER TABLE notifications
      ALTER COLUMN read_at TYPE timestamptz(3), ALTER COLUMN created_at TYPE timestamptz(3)`);
        await q.query(`CREATE INDEX IF NOT EXISTS idx_notifications_user_created
      ON notifications (user_id, created_at, id)`);
    }
    async down(q) {
        await q.query('DROP TABLE IF EXISTS notifications');
    }
}
exports.CreateNotifications1759550000000 = CreateNotifications1759550000000;
//# sourceMappingURL=1759550000000-CreateNotifications.js.map