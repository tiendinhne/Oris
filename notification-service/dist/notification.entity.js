"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationSetting = exports.NotificationActor = exports.Notification = exports.NOTIFICATION_TYPES = void 0;
const typeorm_1 = require("typeorm");
/** Loại thông báo (BR-NO1-01). EMAIL dùng cho thông báo gửi qua email như khóa tài khoản. */
exports.NOTIFICATION_TYPES = ['LIKE', 'REPLY', 'REPOST', 'FOLLOW', 'MENTION', 'SYSTEM', 'EMAIL'];
// Thời gian lưu độ chính xác mili giây (precision 3) để khớp đúng với Date của JS khi dùng làm cursor phân trang.
let Notification = class Notification {
};
exports.Notification = Notification;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('uuid'),
    __metadata("design:type", String)
], Notification.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], Notification.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 32, default: 'SYSTEM' }),
    __metadata("design:type", String)
], Notification.prototype, "kind", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], Notification.prototype, "message", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'post_id', type: 'uuid', nullable: true }),
    __metadata("design:type", Object)
], Notification.prototype, "postId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'group_key', type: 'varchar', length: 120, nullable: true }),
    __metadata("design:type", Object)
], Notification.prototype, "groupKey", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'actor_count', type: 'int', default: 0 }),
    __metadata("design:type", Number)
], Notification.prototype, "actorCount", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'read_at', type: 'timestamptz', precision: 3, nullable: true }),
    __metadata("design:type", Object)
], Notification.prototype, "readAt", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'last_activity_at', type: 'timestamptz', precision: 3, default: () => 'now()' }),
    __metadata("design:type", Date)
], Notification.prototype, "lastActivityAt", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz', precision: 3 }),
    __metadata("design:type", Date)
], Notification.prototype, "createdAt", void 0);
exports.Notification = Notification = __decorate([
    (0, typeorm_1.Entity)('notifications'),
    (0, typeorm_1.Index)('idx_notifications_user_created', ['userId', 'createdAt', 'id']),
    (0, typeorm_1.Index)('idx_notifications_user_group', ['userId', 'groupKey'])
], Notification);
/** Từng người gây ra một thông báo gộp; gỡ được đúng người khi họ bỏ thích (BR-NO1-05). */
let NotificationActor = class NotificationActor {
};
exports.NotificationActor = NotificationActor;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'notification_id', type: 'uuid' }),
    __metadata("design:type", String)
], NotificationActor.prototype, "notificationId", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'actor_id', type: 'uuid' }),
    __metadata("design:type", String)
], NotificationActor.prototype, "actorId", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => Notification, { onDelete: 'CASCADE' }),
    (0, typeorm_1.JoinColumn)({ name: 'notification_id' }),
    __metadata("design:type", Notification)
], NotificationActor.prototype, "notification", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'timestamptz', precision: 3 }),
    __metadata("design:type", Date)
], NotificationActor.prototype, "createdAt", void 0);
exports.NotificationActor = NotificationActor = __decorate([
    (0, typeorm_1.Entity)('notification_actors')
], NotificationActor);
/** Cài đặt từng loại thông báo của người dùng (BR-NO4). Không có dòng nào nghĩa là bật tất cả. */
let NotificationSetting = class NotificationSetting {
};
exports.NotificationSetting = NotificationSetting;
__decorate([
    (0, typeorm_1.PrimaryColumn)({ name: 'user_id', type: 'uuid' }),
    __metadata("design:type", String)
], NotificationSetting.prototype, "userId", void 0);
__decorate([
    (0, typeorm_1.PrimaryColumn)({ type: 'varchar', length: 16 }),
    __metadata("design:type", String)
], NotificationSetting.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'boolean', default: true }),
    __metadata("design:type", Boolean)
], NotificationSetting.prototype, "enabled", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'varchar', length: 16, default: 'EVERYONE' }),
    __metadata("design:type", String)
], NotificationSetting.prototype, "scope", void 0);
exports.NotificationSetting = NotificationSetting = __decorate([
    (0, typeorm_1.Entity)('notification_settings')
], NotificationSetting);
//# sourceMappingURL=notification.entity.js.map