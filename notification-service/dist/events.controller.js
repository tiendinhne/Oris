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
exports.EventsController = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const auth_guard_1 = require("./auth.guard");
const dto_1 = require("./dto");
const errors_1 = require("./errors");
const notification_entity_1 = require("./notification.entity");
const CONFIGURABLE = ['LIKE', 'REPLY', 'REPOST', 'FOLLOW', 'MENTION'];
const GROUPED = ['LIKE', 'REPOST', 'FOLLOW']; // BR-NO1-02: gộp "A và N người khác"
const ACTION = {
    LIKE: 'đã thích bài viết của bạn', REPOST: 'đã đăng lại bài viết của bạn', FOLLOW: 'đã bắt đầu theo dõi bạn',
    REPLY: 'đã trả lời bài viết của bạn', MENTION: 'đã nhắc đến bạn trong một bài viết',
};
const text = (type, name, n) => name === null ? `${n} người ${ACTION[type]}` : n <= 1 ? `${name} ${ACTION[type]}` : `${name} và ${n - 1} người khác ${ACTION[type]}`;
let EventsController = class EventsController {
    constructor(notifs, actors, settings) {
        this.notifs = notifs;
        this.actors = actors;
        this.settings = settings;
    }
    /** Auth / Post báo có người thích, trả lời, theo dõi... `remove: true` khi họ hoàn tác (BR-NO1-05). */
    async event(e) {
        if (e.recipient_id === e.actor_id)
            return { status: 'ignored' };
        const setting = await this.settings.findOneBy({ userId: e.recipient_id, type: e.type });
        // ponytail: mới xét bật/tắt; phạm vi FOLLOWING cần hỏi Auth xem có theo dõi không, thêm khi cần
        if (setting && !setting.enabled)
            return { status: 'disabled' };
        if (!GROUPED.includes(e.type)) {
            if (e.remove)
                return { status: 'ignored' };
            await this.notifs.save(this.notifs.create({
                userId: e.recipient_id, kind: e.type, postId: e.post_id ?? null, message: text(e.type, e.actor_name, 1), actorCount: 1,
            }));
            return { status: 'created' };
        }
        const groupKey = `${e.type}:${e.post_id ?? 'profile'}:${new Date().toISOString().slice(0, 10)}`;
        let n = await this.notifs.findOneBy({ userId: e.recipient_id, groupKey });
        if (e.remove) {
            if (!n)
                return { status: 'ignored' };
            await this.actors.delete({ notificationId: n.id, actorId: e.actor_id });
            const count = await this.actors.countBy({ notificationId: n.id });
            if (count === 0)
                await this.notifs.delete(n.id);
            else
                await this.notifs.update(n.id, { actorCount: count, message: text(e.type, count === 1 ? e.actor_name : null, count) });
            return { status: 'removed' };
        }
        n ??= await this.notifs.save(this.notifs.create({
            userId: e.recipient_id, kind: e.type, postId: e.post_id ?? null, groupKey, message: '',
        }));
        await this.actors.createQueryBuilder().insert().values({ notificationId: n.id, actorId: e.actor_id })
            .orIgnore().execute();
        const count = await this.actors.countBy({ notificationId: n.id });
        await this.notifs.update(n.id, {
            actorCount: count, message: text(e.type, e.actor_name, count), readAt: null, lastActivityAt: new Date(),
        });
        return { status: 'grouped', count };
    }
    /** Cài đặt từng loại; loại chưa có dòng nghĩa là bật cho mọi người. */
    async getSettings(req) {
        const rows = await this.settings.findBy({ userId: req.user.id });
        return CONFIGURABLE.map(type => {
            const r = rows.find(x => x.type === type);
            return { type, enabled: r?.enabled ?? true, scope: r?.scope ?? 'EVERYONE' };
        });
    }
    async putSetting(req, type, dto) {
        if (!CONFIGURABLE.includes(type)) {
            throw (0, errors_1.apiError)(404, 'UNKNOWN_NOTIFICATION_TYPE', 'Loại thông báo không hợp lệ'); // SYSTEM luôn bật
        }
        const cur = await this.settings.findOneBy({ userId: req.user.id, type });
        const next = { userId: req.user.id, type, enabled: dto.enabled ?? cur?.enabled ?? true, scope: dto.scope ?? cur?.scope ?? 'EVERYONE' };
        await this.settings.save(next);
        return { type, enabled: next.enabled, scope: next.scope };
    }
};
exports.EventsController = EventsController;
__decorate([
    (0, common_1.Post)('internal/events'),
    (0, common_1.HttpCode)(200),
    (0, common_1.UseGuards)(auth_guard_1.InternalGuard),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [dto_1.EventDto]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "event", null);
__decorate([
    (0, common_1.Get)('notifications/settings'),
    (0, common_1.UseGuards)(auth_guard_1.JwtGuard),
    __param(0, (0, common_1.Req)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "getSettings", null);
__decorate([
    (0, common_1.Put)('notifications/settings/:type'),
    (0, common_1.UseGuards)(auth_guard_1.JwtGuard),
    __param(0, (0, common_1.Req)()),
    __param(1, (0, common_1.Param)('type')),
    __param(2, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object, String, dto_1.UpdateSettingDto]),
    __metadata("design:returntype", Promise)
], EventsController.prototype, "putSetting", null);
exports.EventsController = EventsController = __decorate([
    (0, common_1.Controller)(),
    __param(0, (0, typeorm_1.InjectRepository)(notification_entity_1.Notification)),
    __param(1, (0, typeorm_1.InjectRepository)(notification_entity_1.NotificationActor)),
    __param(2, (0, typeorm_1.InjectRepository)(notification_entity_1.NotificationSetting)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], EventsController);
//# sourceMappingURL=events.controller.js.map