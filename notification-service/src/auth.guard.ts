import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common'
import { timingSafeEqual } from 'crypto'
import * as jwt from 'jsonwebtoken'
import { apiError } from './errors'

export interface CurrentUser { id: string; username: string; role: string }

/** Đọc access token do Auth Service phát (cùng JWT_SECRET), gắn người dùng vào request. */
@Injectable()
export class JwtGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const req = ctx.switchToHttp().getRequest()
    const header: string = req.headers.authorization ?? ''
    if (!header.startsWith('Bearer ')) throw apiError(401, 'NOT_AUTHENTICATED', 'Chưa đăng nhập')
    try {
      const c = jwt.verify(header.slice(7), process.env.JWT_SECRET!, { algorithms: ['HS256'] }) as jwt.JwtPayload
      if (c.type !== 'access') throw new Error('not an access token')
      req.user = { id: c.sub, username: c.username, role: c.role } as CurrentUser
      return true
    } catch (e) {
      if (e instanceof jwt.TokenExpiredError) throw apiError(401, 'TOKEN_EXPIRED', 'Phiên đăng nhập đã hết hạn')
      throw apiError(401, 'INVALID_TOKEN', 'Token không hợp lệ')
    }
  }
}

/** Chỉ cho các service khác gọi vào: phải có khóa chung trong header X-Internal-Key. */
@Injectable()
export class InternalGuard implements CanActivate {
  canActivate(ctx: ExecutionContext) {
    const expected = Buffer.from(process.env.INTERNAL_API_KEY ?? '')
    const given = Buffer.from(ctx.switchToHttp().getRequest().headers['x-internal-key'] ?? '')
    if (!expected.length || expected.length !== given.length || !timingSafeEqual(expected, given)) {
      throw apiError(403, 'FORBIDDEN', 'Chỉ service nội bộ được gọi API này')
    }
    return true
  }
}
