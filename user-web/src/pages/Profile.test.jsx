import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import Profile from './Profile'
import { userApi, postApi, miscApi, ApiError } from '../api'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    userApi: { profile: vi.fn(), follow: vi.fn(), update: vi.fn() },
    postApi: { byUser: vi.fn(), like: vi.fn(), repost: vi.fn() },
    miscApi: { trending: vi.fn(), unread: vi.fn() },
  }
})
const reloadMe = vi.fn()
const me = { id: 'u1', username: 'minhanh', display_name: 'Minh Anh' }
vi.mock('../auth', () => ({ useAuth: () => ({ me, unread: 0, signOut: vi.fn(), reloadMe }) }))

const profileOf = (extra = {}) => ({
  id: 'u1', username: 'minhanh', display_name: 'Minh Anh', avatar_url: null,
  bio: 'Thiết kế giao diện ở Sài Gòn.', link_url: 'https://example.com',
  created_at: '2026-10-15T10:00:00Z', followers_count: 1204, following_count: 312,
  is_me: true, is_following: false, follows_me: false, ...extra,
})

const postOf = (id, content) => ({
  id, content, created_at: '2026-10-20T10:00:00Z', edited_at: null, media: [],
  author: { id: 'u1', username: 'minhanh', display_name: 'Minh Anh' },
  like_count: 0, reply_count: 0, repost_count: 0, liked_by_me: false, reposted_by_me: false,
  reply_permission: 'ALL',
})

const setup = (path = '/u/minhanh') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/u/:username" element={<Profile />} />
      </Routes>
      <Link to="/u/b">sang b</Link>
    </MemoryRouter>,
  )

beforeEach(() => {
  vi.resetAllMocks()
  userApi.profile.mockResolvedValue(profileOf())
  postApi.byUser.mockResolvedValue({ items: [postOf('p1', 'Bài đầu tiên')], next_cursor: null })
  reloadMe.mockResolvedValue(undefined)
  miscApi.trending.mockResolvedValue([]) // Trending nằm trong Shell
})

describe('Profile', () => {
  it('hiện tên, username, tiểu sử, liên kết, ngày tham gia và số theo dõi', async () => {
    setup()
    const head = within((await screen.findByRole('heading', { level: 1, name: 'Minh Anh' })).closest('section'))
    expect(head.getByText('@minhanh')).toBeInTheDocument()
    expect(screen.getByText('Thiết kế giao diện ở Sài Gòn.')).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /example\.com/ })
    expect(link).toHaveAttribute('href', 'https://example.com')
    expect(link).toHaveAttribute('target', '_blank')
    expect(link).toHaveAttribute('rel', 'noopener noreferrer')
    expect(screen.getByText('Tham gia tháng 10/2026')).toBeInTheDocument()
    const followers = screen.getByRole('link', { name: /người theo dõi/ })
    expect(followers).toHaveAttribute('href', '/u/minhanh/followers')
    expect(followers).toHaveTextContent((1204).toLocaleString('vi-VN'))
    const following = screen.getByRole('link', { name: /đang theo dõi/ })
    expect(following).toHaveAttribute('href', '/u/minhanh/following')
    expect(following).toHaveTextContent('312')
    expect(userApi.profile).toHaveBeenCalledWith('minhanh')
  })

  it('không hiện liên kết khi hồ sơ không có link_url', async () => {
    userApi.profile.mockResolvedValue(profileOf({ link_url: null }))
    setup()
    await screen.findByRole('heading', { level: 1, name: 'Minh Anh' })
    expect(screen.queryByRole('link', { name: /example\.com/ })).not.toBeInTheDocument()
  })

  it('hồ sơ của mình có nút Chỉnh sửa hồ sơ và không có nút theo dõi', async () => {
    setup()
    expect(await screen.findByRole('button', { name: 'Chỉnh sửa hồ sơ' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /^Theo dõi|Đang theo dõi/ })).not.toBeInTheDocument()
    expect(screen.queryByText('Theo dõi bạn')).not.toBeInTheDocument()
  })

  it('người khác theo dõi mình: hiện nhãn Theo dõi bạn và nút Theo dõi lại', async () => {
    userApi.profile.mockResolvedValue(profileOf({ username: 'thuha', display_name: 'Lê Thu Hà', is_me: false, follows_me: true }))
    setup('/u/thuha')
    expect(await screen.findByText('Theo dõi bạn')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Theo dõi lại' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Chỉnh sửa hồ sơ' })).not.toBeInTheDocument()
  })

  it('bấm theo dõi thì gọi API rồi tải lại hồ sơ', async () => {
    userApi.profile.mockResolvedValue(profileOf({ username: 'thuha', display_name: 'Lê Thu Hà', is_me: false }))
    userApi.follow.mockResolvedValue(null)
    setup('/u/thuha')
    await userEvent.click(await screen.findByRole('button', { name: 'Theo dõi' }))
    expect(userApi.follow).toHaveBeenCalledWith('thuha', true)
    await waitFor(() => expect(userApi.profile).toHaveBeenCalledTimes(2))
  })

  it('hiện bài viết của người dùng, mặc định không lấy trả lời', async () => {
    setup()
    expect(await screen.findByText('Bài đầu tiên')).toBeInTheDocument()
    expect(postApi.byUser).toHaveBeenCalledWith('minhanh', { replies: false, cursor: undefined })
  })

  it('chuyển sang tab Trả lời thì gọi byUser với replies: true', async () => {
    setup()
    await screen.findByText('Bài đầu tiên')
    postApi.byUser.mockResolvedValue({ items: [postOf('p2', 'Một trả lời')], next_cursor: null })
    await userEvent.click(screen.getByRole('link', { name: 'Trả lời' }))
    expect(await screen.findByText('Một trả lời')).toBeInTheDocument()
    expect(screen.queryByText('Bài đầu tiên')).not.toBeInTheDocument()
    expect(postApi.byUser).toHaveBeenLastCalledWith('minhanh', { replies: true, cursor: undefined })
  })

  it('Xem thêm nạp trang kế tiếp theo cursor', async () => {
    postApi.byUser.mockResolvedValueOnce({ items: [postOf('p1', 'Bài đầu tiên')], next_cursor: 'c1' })
    setup()
    await screen.findByText('Bài đầu tiên')
    postApi.byUser.mockResolvedValueOnce({ items: [postOf('p3', 'Bài thứ ba')], next_cursor: null })
    await userEvent.click(screen.getByRole('button', { name: 'Xem thêm' }))
    expect(await screen.findByText('Bài thứ ba')).toBeInTheDocument()
    expect(screen.getByText('Bài đầu tiên')).toBeInTheDocument()
    expect(postApi.byUser).toHaveBeenLastCalledWith('minhanh', { replies: false, cursor: 'c1' })
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).not.toBeInTheDocument()
  })

  it('trạng thái trống theo từng tab', async () => {
    postApi.byUser.mockResolvedValue({ items: [], next_cursor: null })
    setup()
    expect(await screen.findByText('Chưa có bài viết.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: 'Trả lời' }))
    expect(await screen.findByText('Chưa có trả lời.')).toBeInTheDocument()
  })

  it('404 USER_NOT_FOUND hiện thông báo thay cho hồ sơ', async () => {
    userApi.profile.mockRejectedValue(new ApiError(404, { code: 'USER_NOT_FOUND', message: 'x' }))
    postApi.byUser.mockRejectedValue(new ApiError(404, { code: 'USER_NOT_FOUND', message: 'x' }))
    setup('/u/khongco')
    expect(await screen.findByText('Không tìm thấy người dùng này.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Trả lời' })).not.toBeInTheDocument()
  })

  it('lỗi khác khi tải hồ sơ hiện thông báo lỗi', async () => {
    userApi.profile.mockRejectedValue(new ApiError(500, { code: 'X', message: 'Máy chủ lỗi' }))
    setup()
    expect(await screen.findByRole('alert')).toHaveTextContent('Máy chủ lỗi')
  })

  it('lưu hồ sơ đổi username thì chuyển sang URL mới và tải hồ sơ mới', async () => {
    userApi.update.mockResolvedValue({ id: 'u1', username: 'moi', display_name: 'Minh Anh', avatar_url: null, bio: '' })
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa hồ sơ' }))
    const u = screen.getByLabelText('Username')
    await userEvent.clear(u)
    await userEvent.type(u, 'moi')
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    await waitFor(() => expect(userApi.profile).toHaveBeenLastCalledWith('moi'))
  })

  it('lưu hồ sơ không đổi username thì tải lại hồ sơ và đóng hộp thoại', async () => {
    userApi.update.mockResolvedValue({ id: 'u1', username: 'minhanh', display_name: 'Tên mới', avatar_url: null, bio: '' })
    setup()
    await userEvent.click(await screen.findByRole('button', { name: 'Chỉnh sửa hồ sơ' }))
    const n = screen.getByLabelText('Tên hiển thị')
    await userEvent.clear(n)
    await userEvent.type(n, 'Tên mới')
    await userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))
    await waitFor(() => expect(userApi.profile).toHaveBeenCalledTimes(2))
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument()
  })

  it('bỏ qua phản hồi cũ khi username trên URL đổi nhanh', async () => {
    let resolveA
    userApi.profile.mockImplementation((u) => (u === 'a'
      ? new Promise((r) => { resolveA = r })
      : Promise.resolve(profileOf({ username: 'b', display_name: 'Bê', is_me: false }))))
    setup('/u/a')
    await userEvent.click(screen.getByRole('link', { name: 'sang b' }))
    expect(await screen.findByRole('heading', { level: 1, name: 'Bê' })).toBeInTheDocument()
    resolveA(profileOf({ username: 'a', display_name: 'Ây' }))
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.getByRole('heading', { level: 1, name: 'Bê' })).toBeInTheDocument()
    expect(screen.queryByText('Ây')).not.toBeInTheDocument()
  })
})
