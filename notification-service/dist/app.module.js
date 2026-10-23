"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const data_source_1 = require("./data-source");
const notification_entity_1 = require("./notification.entity");
const notifications_controller_1 = require("./notifications.controller");
let AppModule = class AppModule {
};
exports.AppModule = AppModule;
exports.AppModule = AppModule = __decorate([
    (0, common_1.Module)({
        imports: [
            // Khởi động là tự chạy các migration chưa áp dụng (giống `alembic upgrade head` bên Python)
            typeorm_1.TypeOrmModule.forRoot({ ...data_source_1.dataSourceOptions, migrationsRun: true }),
            typeorm_1.TypeOrmModule.forFeature([notification_entity_1.Notification]),
        ],
        controllers: [notifications_controller_1.NotificationsController],
    })
], AppModule);
//# sourceMappingURL=app.module.js.map