import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Link, MemoryRouter, Route, Routes } from 'react-router-dom'
import FollowList from './FollowList'
import { userApi, miscApi, ApiError } from '../api'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal()
  return {
    ...actual,
    userApi: { profile: vi.fn(), followers: vi.fn(), following: vi.fn(), relations: vi.fn(), follow: vi.fn() },
    miscApi: { trending: vi.fn(), unread: vi.fn() },
  }
})
const me = { id: 'u1', username: 'minhanh', display_name: 'Minh Anh' }
vi.mock('../auth', () => ({ useAuth: () => ({ me, unread: 0, signOut: vi.fn(), reloadMe: vi.fn() }) }))

const profileOf = (extra = {}) => ({
  id: 'u1', username: 'minhanh', display_name: 'Minh Anh', avatar_url: null,
  followers_count: 1204, following_count: 312, ...extra,
})
const person = (id, username, display_name, bio = null) => ({ id, username, display_name, avatar_url: null, bio })
const page = (items, next_offset = null) => ({ items, next_offset })

const thuha = person('u2', 'thuha', 'Lê Thu Hà', 'Viết về đồ ăn.')
const thinh = person('u3', 'thinh', 'Bùi Đức Thịnh')

const setup = (path = '/u/minhanh/followers') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/u/:username" element={<p>TRANG HỒ SƠ</p>} />
        <Route path="/u/:username/:list" element={<FollowList />} />
      </Routes>
      <Link to="/u/b/followers">sang b</Link>
    </MemoryRouter>,
  )

const rowOf = async (name) => (await screen.findByRole('link', { name })).closest('li')

beforeEach(() => {
  vi.resetAllMocks()
  userApi.profile.mockResolvedValue(profileOf())
  userApi.followers.mockResolvedValue(page([thuha, thinh]))
  userApi.following.mockResolvedValue(page([thuha]))
  userApi.relations.mockResolvedValue({ blocked: [], blocked_by: [], following: [] })
  miscApi.trending.mockResolvedValue([]) // Trending nằm trong Shell
})

describe('FollowList', () => {
  it('tab Người theo dõi gọi followers, tab Đang theo dõi gọi following', async () => {
    setup('/u/minhanh/followers')
    await screen.findByText('Lê Thu Hà')
    expect(userApi.followers).toHaveBeenCalledWith('minhanh', { offset: undefined })
    expect(userApi.following).not.toHaveBeenCalled()
  })

  it('đường dẫn /following gọi API following', async () => {
    setup('/u/minhanh/following')
    await screen.findByText('Lê Thu Hà')
    expect(userApi.following).toHaveBeenCalledWith('minhanh', { offset: undefined })
    expect(userApi.followers).not.toHaveBeenCalled()
  })

  it('đầu trang có nút quay lại hồ sơ, tên hiển thị và @username', async () => {
    setup()
    const h1 = await screen.findByRole('heading', { level: 1, name: 'Minh Anh' })
    expect(within(h1.parentElement).getByText('@minhanh')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Quay lại hồ sơ' })).toHaveAttribute('href', '/u/minhanh')
    expect(userApi.profile).toHaveBeenCalledWith('minhanh')
  })

  it('hai tab là liên kết có số lượng, tab hiện tại có aria-current', async () => {
    setup('/u/minhanh/following')
    await screen.findByRole('heading', { level: 1, name: 'Minh Anh' })
    const nav = within(screen.getByRole('navigation', { name: 'Danh sách theo dõi' }))
    const followers = nav.getByRole('link', { name: /Người theo dõi/ })
    expect(followers).toHaveAttribute('href', '/u/minhanh/followers')
    expect(followers).toHaveTextContent((1204).toLocaleString('vi-VN'))
    expect(followers).not.toHaveAttribute('aria-current')
    const following = nav.getByRole('link', { name: /Đang theo dõi/ })
    expect(following).toHaveAttribute('href', '/u/minhanh/following')
    expect(following).toHaveTextContent('312')
    expect(following).toHaveAttribute('aria-current', 'page')
  })

  it('mỗi dòng có tên (link hồ sơ), @username, tiểu sử nếu có', async () => {
    setup()
    const row = within(await rowOf('Lê Thu Hà'))
    expect(row.getByRole('link', { name: 'Lê Thu Hà' })).toHaveAttribute('href', '/u/thuha')
    expect(row.getByText('@thuha')).toBeInTheDocument()
    expect(row.getByText('Viết về đồ ăn.')).toBeInTheDocument()
    const noBio = within(await rowOf('Bùi Đức Thịnh'))
    expect(noBio.getByText('@thinh')).toBeInTheDocument()
  })

  it('nút theo dõi đúng trạng thái theo relations', async () => {
    userApi.relations.mockResolvedValue({ blocked: [], blocked_by: [], following: ['u2'] })
    userApi.profile.mockResolvedValue(profileOf({ id: 'u9', username: 'khac', display_name: 'Khác' }))
    setup('/u/khac/following')
    const followed = within(await rowOf('Lê Thu Hà'))
    expect(await followed.findByRole('button', { name: 'Đang theo dõi' })).toBeInTheDocument()
  })

  it('người chưa được theo dõi hiện nút Theo dõi', async () => {
    userApi.relations.mockResolvedValue({ blocked: [], blocked_by: [], following: ['u2'] })
    userApi.following.mockResolvedValue(page([thuha, thinh]))
    setup('/u/minhanh/following')
    const row = within(await rowOf('Bùi Đức Thịnh'))
    expect(await row.findByRole('button', { name: 'Theo dõi' })).toBeInTheDocument()
  })

  it('tab Người theo dõi của chính mình: người chưa theo dõi lại hiện Theo dõi lại', async () => {
    userApi.relations.mockResolvedValue({ blocked: [], blocked_by: [], following: ['u2'] })
    setup('/u/minhanh/followers')
    expect(await within(await rowOf('Bùi Đức Thịnh')).findByRole('button', { name: 'Theo dõi lại' })).toBeInTheDocument()
    expect(within(await rowOf('Lê Thu Hà')).getByRole('button', { name: 'Đang theo dõi' })).toBeInTheDocument()
  })

  it('tab Người theo dõi của người khác: không biết ai theo dõi mình nên hiện Theo dõi', async () => {
    userApi.profile.mockResolvedValue(profileOf({ id: 'u9', username: 'khac', display_name: 'Khác' }))
    setup('/u/khac/followers')
    expect(await within(await rowOf('Bùi Đức Thịnh')).findByRole('button', { name: 'Theo dõi' })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Theo dõi lại' })).not.toBeInTheDocument()
  })

  it('không hiện nút ở dòng của chính mình', async () => {
    userApi.profile.mockResolvedValue(profileOf({ id: 'u9', username: 'khac', display_name: 'Khác' }))
    userApi.followers.mockResolvedValue(page([person('u1', 'minhanh', 'Minh Anh'), thuha]))
    setup('/u/khac/followers')
    const mine = within(await rowOf('Minh Anh'))
    expect(await within(await rowOf('Lê Thu Hà')).findByRole('button')).toBeInTheDocument()
    expect(mine.queryByRole('button')).not.toBeInTheDocument()
  })

  it('bấm theo dõi cập nhật nút tại chỗ, không tải lại danh sách', async () => {
    userApi.follow.mockResolvedValue(null)
    setup('/u/minhanh/followers')
    const row = within(await rowOf('Bùi Đức Thịnh'))
    await userEvent.click(await row.findByRole('button', { name: 'Theo dõi lại' }))
    expect(userApi.follow).toHaveBeenCalledWith('thinh', true)
    expect(await row.findByRole('button', { name: 'Đang theo dõi' })).toBeInTheDocument()
    expect(within(await rowOf('Lê Thu Hà')).getByRole('button', { name: 'Theo dõi lại' })).toBeInTheDocument()
    expect(userApi.followers).toHaveBeenCalledTimes(1)
    expect(userApi.profile).toHaveBeenCalledTimes(1)
  })

  it('hủy theo dõi trên tab Đang theo dõi của mình giảm số trên tab đi 1', async () => {
    userApi.relations.mockResolvedValue({ blocked: [], blocked_by: [], following: ['u2'] })
    userApi.follow.mockResolvedValue(null)
    setup('/u/minhanh/following')
    const row = within(await rowOf('Lê Thu Hà'))
    const tab = screen.getByRole('link', { name: /Đang theo dõi/ })
    await waitFor(() => expect(tab).toHaveTextContent('312'))
    await userEvent.click(await row.findByRole('button', { name: 'Đang theo dõi' }))
    expect(userApi.follow).toHaveBeenCalledWith('thuha', false)
    await waitFor(() => expect(tab).toHaveTextContent('311'))
    expect(await row.findByRole('button', { name: 'Theo dõi' })).toBeInTheDocument()
  })

  it('theo dõi lại từ tab Người theo dõi của mình tăng số trên tab Đang theo dõi thêm 1', async () => {
    userApi.follow.mockResolvedValue(null)
    setup('/u/minhanh/followers')
    const row = within(await rowOf('Bùi Đức Thịnh'))
    const tab = screen.getByRole('link', { name: /Đang theo dõi/ })
    await waitFor(() => expect(tab).toHaveTextContent('312'))
    await userEvent.click(await row.findByRole('button', { name: 'Theo dõi lại' }))
    await waitFor(() => expect(tab).toHaveTextContent('313'))
    expect(screen.getByRole('link', { name: /Người theo dõi/ })).toHaveTextContent((1204).toLocaleString('vi-VN'))
  })

  it('theo dõi trên danh sách của người khác không đổi số trên tab', async () => {
    userApi.profile.mockResolvedValue(profileOf({ id: 'u9', username: 'khac', display_name: 'Khác' }))
    userApi.follow.mockResolvedValue(null)
    setup('/u/khac/following')
    const row = within(await rowOf('Lê Thu Hà'))
    await userEvent.click(await row.findByRole('button', { name: 'Theo dõi' }))
    expect(await row.findByRole('button', { name: 'Đang theo dõi' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Đang theo dõi 312/ })).toBeInTheDocument()
  })

  it('Xem thêm gọi lại với next_offset và nối danh sách', async () => {
    userApi.followers.mockResolvedValueOnce(page([thuha], 20))
    setup()
    await screen.findByText('Lê Thu Hà')
    userApi.followers.mockResolvedValueOnce(page([thinh], null))
    await userEvent.click(screen.getByRole('button', { name: 'Xem thêm' }))
    expect(await screen.findByText('Bùi Đức Thịnh')).toBeInTheDocument()
    expect(screen.getByText('Lê Thu Hà')).toBeInTheDocument()
    expect(userApi.followers).toHaveBeenLastCalledWith('minhanh', { offset: 20 })
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).not.toBeInTheDocument()
  })

  it('không có next_offset thì không hiện Xem thêm', async () => {
    setup()
    await screen.findByText('Lê Thu Hà')
    expect(screen.queryByRole('button', { name: 'Xem thêm' })).not.toBeInTheDocument()
  })

  it('trạng thái trống theo từng tab', async () => {
    userApi.followers.mockResolvedValue(page([]))
    userApi.following.mockResolvedValue(page([]))
    setup('/u/minhanh/followers')
    expect(await screen.findByText('Chưa có ai theo dõi.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('link', { name: /Đang theo dõi/ }))
    expect(await screen.findByText('Chưa theo dõi ai.')).toBeInTheDocument()
    expect(screen.queryByText('Chưa có ai theo dõi.')).not.toBeInTheDocument()
  })

  it('chuyển tab bằng liên kết thì tải danh sách mới và bỏ danh sách cũ', async () => {
    setup('/u/minhanh/followers')
    await screen.findByText('Bùi Đức Thịnh')
    await userEvent.click(screen.getByRole('link', { name: /Đang theo dõi/ }))
    await waitFor(() => expect(userApi.following).toHaveBeenCalledWith('minhanh', { offset: undefined }))
    await waitFor(() => expect(screen.queryByText('Bùi Đức Thịnh')).not.toBeInTheDocument())
    expect(screen.getByText('Lê Thu Hà')).toBeInTheDocument()
  })

  it('404 USER_NOT_FOUND hiện thông báo thay cho danh sách', async () => {
    const notFound = new ApiError(404, { code: 'USER_NOT_FOUND', message: 'x' })
    userApi.profile.mockRejectedValue(notFound)
    userApi.followers.mockRejectedValue(notFound)
    setup('/u/khongco/followers')
    expect(await screen.findByText('Không tìm thấy người dùng này.')).toBeInTheDocument()
    expect(screen.queryByRole('heading', { level: 1 })).not.toBeInTheDocument()
    expect(screen.queryByRole('navigation', { name: 'Danh sách theo dõi' })).not.toBeInTheDocument()
  })

  it('lỗi khi tải danh sách hiện thông báo lỗi', async () => {
    userApi.followers.mockRejectedValue(new ApiError(500, { code: 'X', message: 'Máy chủ lỗi' }))
    setup()
    expect(await screen.findByRole('alert')).toHaveTextContent('Máy chủ lỗi')
    expect(screen.queryByText('Chưa có ai theo dõi.')).not.toBeInTheDocument()
  })

  it(':list không hợp lệ thì chuyển về hồ sơ', async () => {
    setup('/u/minhanh/linhtinh')
    expect(await screen.findByText('TRANG HỒ SƠ')).toBeInTheDocument()
    expect(userApi.followers).not.toHaveBeenCalled()
    expect(userApi.following).not.toHaveBeenCalled()
  })

  it('bỏ qua phản hồi cũ khi username trên URL đổi nhanh', async () => {
    let resolveA
    userApi.followers.mockImplementation((u) => (u === 'minhanh'
      ? new Promise((r) => { resolveA = r })
      : Promise.resolve(page([thinh]))))
    userApi.profile.mockImplementation((u) => Promise.resolve(profileOf({ username: u, display_name: u === 'b' ? 'Bê' : 'Ây' })))
    setup('/u/minhanh/followers')
    await userEvent.click(screen.getByRole('link', { name: 'sang b' }))
    expect(await screen.findByText('Bùi Đức Thịnh')).toBeInTheDocument()
    resolveA(page([thuha]))
    await new Promise((r) => setTimeout(r, 20))
    expect(screen.getByText('Bùi Đức Thịnh')).toBeInTheDocument()
    expect(screen.queryByText('Lê Thu Hà')).not.toBeInTheDocument()
  })
})
