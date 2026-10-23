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
exports.UpdateSettingDto = exports.EventDto = exports.CreateNotificationDto = void 0;
const class_validator_1 = require("class-validator");
class CreateNotificationDto {
}
exports.CreateNotificationDto = CreateNotificationDto;
__decorate([
    (0, class_validator_1.IsUUID)(undefined, { message: 'user_id phải là UUID hợp lệ' }),
    __metadata("design:type", String)
], CreateNotificationDto.prototype, "user_id", void 0);
__decorate([
    (0, class_validator_1.IsString)({ message: 'message phải là chuỗi' }),
    (0, class_validator_1.MinLength)(1, { message: 'message không được để trống' }),
    (0, class_validator_1.MaxLength)(1000, { message: 'message tối đa 1000 ký tự' }),
    __metadata("design:type", String)
], CreateNotificationDto.prototype, "message", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['SYSTEM', 'EMAIL'], { message: 'kind chỉ nhận SYSTEM hoặc EMAIL' }),
    __metadata("design:type", String)
], CreateNotificationDto.prototype, "kind", void 0);
class EventDto {
}
exports.EventDto = EventDto;
__decorate([
    (0, class_validator_1.IsIn)(['LIKE', 'REPLY', 'REPOST', 'FOLLOW', 'MENTION'], { message: 'type không hợp lệ' }),
    __metadata("design:type", String)
], EventDto.prototype, "type", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(undefined, { message: 'recipient_id phải là UUID hợp lệ' }),
    __metadata("design:type", String)
], EventDto.prototype, "recipient_id", void 0);
__decorate([
    (0, class_validator_1.IsUUID)(undefined, { message: 'actor_id phải là UUID hợp lệ' }),
    __metadata("design:type", String)
], EventDto.prototype, "actor_id", void 0);
__decorate([
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(50),
    __metadata("design:type", String)
], EventDto.prototype, "actor_name", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(undefined, { message: 'post_id phải là UUID hợp lệ' }),
    __metadata("design:type", String)
], EventDto.prototype, "post_id", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], EventDto.prototype, "remove", void 0);
class UpdateSettingDto {
}
exports.UpdateSettingDto = UpdateSettingDto;
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)({ message: 'enabled phải là true hoặc false' }),
    __metadata("design:type", Boolean)
], UpdateSettingDto.prototype, "enabled", void 0);
__decorate([
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['EVERYONE', 'FOLLOWING'], { message: 'scope chỉ nhận EVERYONE hoặc FOLLOWING' }),
    __metadata("design:type", String)
], UpdateSettingDto.prototype, "scope", void 0);
//# sourceMappingURL=dto.js.map