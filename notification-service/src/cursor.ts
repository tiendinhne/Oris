import { isUUID } from 'class-validator'
import { apiError } from './errors'

/** Cursor mã hóa (created_at, id) của dòng cuối trang trước, giống pagination.py bên Python. */
export const encodeCursor = (createdAt: Date, id: string) =>
  Buffer.from(`${createdAt.toISOString()}|${id}`).toString('base64url')

export function decodeCursor(cursor: string): { createdAt: Date; id: string } {
  const [ts, id] = Buffer.from(cursor, 'base64url').toString().split('|')
  const createdAt = new Date(ts)
  if (!id || isNaN(createdAt.getTime()) || !isUUID(id)) throw apiError(400, 'INVALID_CURSOR', 'Cursor không hợp lệ')
  return { createdAt, id }
}
