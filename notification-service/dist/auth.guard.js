"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.InternalGuard = exports.JwtGuard = void 0;
const common_1 = require("@nestjs/common");
const crypto_1 = require("crypto");
const jwt = __importStar(require("jsonwebtoken"));
const errors_1 = require("./errors");
/** Đọc access token do Auth Service phát (cùng JWT_SECRET), gắn người dùng vào request. */
let JwtGuard = class JwtGuard {
    canActivate(ctx) {
        const req = ctx.switchToHttp().getRequest();
        const header = req.headers.authorization ?? '';
        if (!header.startsWith('Bearer '))
            throw (0, errors_1.apiError)(401, 'NOT_AUTHENTICATED', 'Chưa đăng nhập');
        try {
            const c = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] });
            if (c.type !== 'access')
                throw new Error('not an access token');
            req.user = { id: c.sub, username: c.username, role: c.role };
            return true;
        }
        catch (e) {
            if (e instanceof jwt.TokenExpiredError)
                throw (0, errors_1.apiError)(401, 'TOKEN_EXPIRED', 'Phiên đăng nhập đã hết hạn');
            throw (0, errors_1.apiError)(401, 'INVALID_TOKEN', 'Token không hợp lệ');
        }
    }
};
exports.JwtGuard = JwtGuard;
exports.JwtGuard = JwtGuard = __decorate([
    (0, common_1.Injectable)()
], JwtGuard);
/** Chỉ cho các service khác gọi vào: phải có khóa chung trong header X-Internal-Key. */
let InternalGuard = class InternalGuard {
    canActivate(ctx) {
        const expected = Buffer.from(process.env.INTERNAL_API_KEY ?? '');
        const given = Buffer.from(ctx.switchToHttp().getRequest().headers['x-internal-key'] ?? '');
        if (!expected.length || expected.length !== given.length || !(0, crypto_1.timingSafeEqual)(expected, given)) {
            throw (0, errors_1.apiError)(403, 'FORBIDDEN', 'Chỉ service nội bộ được gọi API này');
        }
        return true;
    }
};
exports.InternalGuard = InternalGuard;
exports.InternalGuard = InternalGuard = __decorate([
    (0, common_1.Injectable)()
], InternalGuard);
//# sourceMappingURL=auth.guard.js.map