"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ErrorFilter = exports.validationError = exports.apiError = void 0;
const common_1 = require("@nestjs/common");
/** Lỗi nghiệp vụ theo định dạng chung của các service: {"detail": {"code", "message"}}. */
const apiError = (status, code, message, extra = {}) => new common_1.HttpException({ code, message, ...extra }, status);
exports.apiError = apiError;
/** Lỗi dữ liệu 422, cùng dạng với Python: message là lỗi đầu tiên, fields là danh sách đầy đủ. */
const validationError = (fields) => (0, exports.apiError)(422, 'VALIDATION_ERROR', fields[0]?.message ?? 'Dữ liệu không hợp lệ', { fields });
exports.validationError = validationError;
let ErrorFilter = class ErrorFilter {
    catch(exception, host) {
        const res = host.switchToHttp().getResponse();
        if (exception instanceof common_1.HttpException) {
            const body = exception.getResponse();
            const detail = body?.code ? body : { code: 'HTTP_ERROR', message: body?.message ?? exception.message };
            return res.status(exception.getStatus()).json({ detail });
        }
        console.error(exception);
        res.status(common_1.HttpStatus.INTERNAL_SERVER_ERROR).json({ detail: { code: 'INTERNAL_ERROR', message: 'Đã có lỗi xảy ra, vui lòng thử lại' } });
    }
};
exports.ErrorFilter = ErrorFilter;
exports.ErrorFilter = ErrorFilter = __decorate([
    (0, common_1.Catch)()
], ErrorFilter);
//# sourceMappingURL=errors.js.map