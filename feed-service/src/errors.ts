import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common'
import type { Response } from 'express'

/** Lỗi nghiệp vụ theo định dạng chung của các service: {"detail": {"code", "message"}}. */
export const apiError = (status: number, code: string, message: string, extra: object = {}) =>
  new HttpException({ code, message, ...extra }, status)

/** Lỗi dữ liệu 422, cùng dạng với Python: message là lỗi đầu tiên, fields là danh sách đầy đủ. */
export const validationError = (fields: { field: string; message: string }[]) =>
  apiError(422, 'VALIDATION_ERROR', fields[0]?.message ?? 'Dữ liệu không hợp lệ', { fields })

@Catch()
export class ErrorFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const res = host.switchToHttp().getResponse<Response>()
    if (exception instanceof HttpException) {
      const body = exception.getResponse() as any
      const detail = body?.code ? body : { code: 'HTTP_ERROR', message: body?.message ?? exception.message }
      return res.status(exception.getStatus()).json({ detail })
    }
    console.error(exception)
    res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({ detail: { code: 'INTERNAL_ERROR', message: 'Đã có lỗi xảy ra, vui lòng thử lại' } })
  }
}
