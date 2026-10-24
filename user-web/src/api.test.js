import { describe, it, expect, beforeEach, vi } from 'vitest'
import { userApi, postApi, fieldErrors, ApiError } from './api'

const ok = (status = 200, body = {}) => ({ ok: true, status, json: async () => body })

beforeEach(() => {
  globalThis.fetch = vi.fn(async () => ok())
})

const lastCall = () => globalThis.fetch.mock.calls.at(-1)

describe('userApi', () => {
  it('profile gọi GET đúng đường dẫn', async () => {
    await userApi.profile('a b')
    const [url, init] = lastCall()
    expect(url).toBe('/api/auth/users/a%20b')
    expect(init.method).toBe('GET')
  })

  it('update gửi PATCH với body JSON', async () => {
    await userApi.update({ display_name: 'An' })
    const [url, init] = lastCall()
    expect(url).toBe('/api/auth/users/me')
    expect(init.method).toBe('PATCH')
    expect(JSON.parse(init.body)).toEqual({ display_name: 'An' })
  })

  it('follow(…, true) gọi POST, false gọi DELETE', async () => {
    globalThis.fetch.mockResolvedValue(ok(204))
    await userApi.follow('a', true)
    expect(lastCall()[0]).toBe('/api/auth/users/a/follow')
    expect(lastCall()[1].method).toBe('POST')
    await userApi.follow('a', false)
    expect(lastCall()[1].method).toBe('DELETE')
  })

  it('followers và following nhận offset', async () => {
    await userApi.followers('a', { offset: 20 })
    expect(lastCall()[0]).toBe('/api/auth/users/a/followers?offset=20')
    await userApi.following('a', { offset: 20 })
    expect(lastCall()[0]).toBe('/api/auth/users/a/following?offset=20')
    await userApi.followers('a')
    expect(lastCall()[0]).toBe('/api/auth/users/a/followers')
  })

  it('relations gọi GET /users/me/relations', async () => {
    await userApi.relations()
    expect(lastCall()[0]).toBe('/api/auth/users/me/relations')
  })
})

describe('postApi.byUser', () => {
  it('thêm ?replies=true', async () => {
    await postApi.byUser('a', { replies: true })
    expect(lastCall()[0]).toBe('/api/post/posts/by-user/a?replies=true')
  })
})

describe('fieldErrors', () => {
  it('đọc dạng object của 409', () => {
    const err = new ApiError(409, { code: 'ALREADY_EXISTS', fields: { username: 'Đã được sử dụng' } })
    expect(fieldErrors(err)).toEqual({ username: 'Đã được sử dụng' })
  })

  it('đọc dạng mảng của 422', () => {
    const err = new ApiError(422, {
      code: 'VALIDATION_ERROR',
      fields: [{ field: 'display_name', message: 'Quá dài' }, { field: 'bio', message: 'Quá dài' }],
    })
    expect(fieldErrors(err)).toEqual({ display_name: 'Quá dài', bio: 'Quá dài' })
  })

  it('không có fields thì trả {}', () => {
    expect(fieldErrors(new ApiError(500, { code: 'X' }))).toEqual({})
    expect(fieldErrors(new Error('boom'))).toEqual({})
    expect(fieldErrors(undefined)).toEqual({})
  })
})
