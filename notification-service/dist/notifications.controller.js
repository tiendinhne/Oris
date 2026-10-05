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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.NotificationsController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const auth_guard_1 = require("./auth.guard");
const cursor_1 = require("./cursor");
const dto_1 = require("./dto");
const errors_1 = require("./errors");
const notification_entity_1 = require("./notification.entity");
let NotificationsController = class NotificationsController {
    constructor(repo, db) {
        this.repo = repo;
        this.db = db;
    }
    async health() {
        await this.db.query('SELECT 1');
        return { service: 'notification-service', database: 'ok' };
    }
    /** Các service khác (Auth, Post) gọi vào để tạo thông báo cho một người dùng. */
    async create(dto) {
        return this.repo.save(this.repo.create({ userId: dto.user_id, message: dto.message, kind: dto.kind ?? 'SYSTEM' }));
    }
    /** Thông báo của người đang đăng nhập, mới nhất trước. Phân trang theo cursor (created_at, id). */
    async list(req, unread, limit, cursor) {
        const take = Math.min(Math.max(parseInt(limit ?? '20', 10) || 20, 1), 100);
        const qb = this.repo.createQueryBuilder('n').where('n.user_id = :uid', { uid: req.user.id });
        if (unread === 'true')
            qb.andWhere('n.read_at IS NULL');
        if (cursor) {
            const c = (0, cursor_1.decodeCursor)(cursor);
            // So cả cặp (created_at, id): hai thông báo tạo cùng lúc không bị sót khi sang trang
            qb.andWhere('(n.created_at, n.id) < (:ts, :id)', { ts: c.createdAt, id: c.id });
        }
        const rows = await qb.orderBy('n.created_at', 'DESC').addOrderBy('n.id', 'DESC').limit(take + 1).getMany();
        const items = rows.slice(0, take);
        const last = items[items.length - 1];
        return { items, next_cursor: rows.length > take ? (0, cursor_1.encodeCursor)(last.createdAt, last.id) : null };
    }
    async unreadCount(req) {
        return { count: await this.repo.count({ where: { userId: req.user.id, readAt: (0, typeorm_2.IsNull)() } }) };
    }
    async readAll(req) {
        const res = await this.repo.update({ userId: req.user.id, readAt: (0, typeorm_2.IsNull)() }, { readAt: new Date() });
        return { updated: res.affected ?? 0 };
    }
    async read(req, id) {
        // Lọc theo userId: người này không đánh dấu được thông báo của người khác
        const n = await this.repo.findOneBy({ id, userId: req.user.id });
        if (!n)
            throw (0, errors_1.apiError)(404, 'NOTIFICATION_NOT_FOUND', 'Không tìm thấy thông báo');
        if (!n.readAt)
            n.readAt = new Date();
        return this.repo.save(n);
    }
};
exports.NotificationsController = NotificationsController;
__decorate([
    (0, common_1.Get)('health'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "health", null);
__decorate([
    (0, common_1.Post)('internal/notifications'),
    (0, common_1.UseGuards)(auth_guard_1.InternalGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.CreateNotificationDto]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "create", null);
__decorate([
    (0, common_1.Get)('notifications'),
    (0, common_1.UseGuards)(auth_guard_1.JwtGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Query)('unread')),
    __param(2, (0, common_1.Query)('limit')),
    __param(3, (0, common_1.Query)('cursor')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, String, String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "list", null);
__decorate([
    (0, common_1.Get)('notifications/unread-count'),
    (0, common_1.UseGuards)(auth_guard_1.JwtGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "unreadCount", null);
__decorate([
    (0, common_1.Post)('notifications/read-all'),
    (0, common_1.HttpCode)(200),
    (0, common_1.UseGuards)(auth_guard_1.JwtGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "readAll", null);
__decorate([
    (0, common_1.Post)('notifications/:id/read'),
    (0, common_1.HttpCode)(200),
    (0, common_1.UseGuards)(auth_guard_1.JwtGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('id', new common_1.ParseUUIDPipe({ exceptionFactory: () => (0, errors_1.validationError)([{ field: 'id', message: 'id phải là UUID hợp lệ' }]) }))),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String]),
    __metadata("design:returntype", Promise)
], NotificationsController.prototype, "read", null);
exports.NotificationsController = NotificationsController = __decorate([
    (0, common_1.Controller)(),
    __param(0, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __param(1, (0, typeorm_1.InjectDataSource)()),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource])
], NotificationsController);
//# sourceMappingURL=notifications.controller.js.map