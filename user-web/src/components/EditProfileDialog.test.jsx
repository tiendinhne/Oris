import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import EditProfileDialog from './EditProfileDialog'
import { userApi, ApiError } from '../api'

vi.mock('../api', async (importOriginal) => {
  const actual = await importOriginal()
  return { ...actual, userApi: { update: vi.fn() } }
})
const reloadMe = vi.fn()
vi.mock('../auth', () => ({ useAuth: () => ({ reloadMe }) }))

const profile = { display_name: 'Minh Anh', username: 'minhanh', bio: 'Xin chào', link_url: null }

const setup = (props = {}) => {
  const onClose = vi.fn()
  const onSaved = vi.fn()
  render(<EditProfileDialog profile={profile} onClose={onClose} onSaved={onSaved} {...props} />)
  return { onClose, onSaved }
}

const save = () => userEvent.click(screen.getByRole('button', { name: 'Lưu thay đổi' }))

beforeEach(() => {
  vi.clearAllMocks()
  userApi.update.mockResolvedValue({ id: 1, username: 'minhanh', display_name: 'Anh Minh' })
  reloadMe.mockResolvedValue(undefined)
})

describe('EditProfileDialog', () => {
  it('là hộp thoại modal có tiêu đề', () => {
    setup()
    expect(screen.getByRole('dialog', { name: 'Chỉnh sửa hồ sơ' })).toHaveAttribute('aria-modal', 'true')
  })

  it('chỉ gửi trường đã đổi, rồi tải lại me và gọi onSaved', async () => {
    const { onSaved } = setup()
    const name = screen.getByLabelText('Tên hiển thị')
    await userEvent.clear(name)
    await userEvent.type(name, ' Anh Minh ')
    await save()
    expect(userApi.update).toHaveBeenCalledWith({ display_name: 'Anh Minh' })
    expect(reloadMe).toHaveBeenCalled()
    expect(onSaved).toHaveBeenCalledWith({ id: 1, username: 'minhanh', display_name: 'Anh Minh' })
  })

  it('xóa bio thì gửi chuỗi rỗng', async () => {
    setup()
    await userEvent.clear(screen.getByLabelText('Tiểu sử'))
    await save()
    expect(userApi.update).toHaveBeenCalledWith({ bio: '' })
  })

  it('không đổi gì thì không gọi API và đóng hộp thoại', async () => {
    const { onClose } = setup()
    await save()
    expect(userApi.update).not.toHaveBeenCalled()
    expect(onClose).toHaveBeenCalled()
  })

  it('tên hiển thị trống thì không cho lưu', async () => {
    setup()
    await userEvent.clear(screen.getByLabelText('Tên hiển thị'))
    expect(screen.getByRole('button', { name: 'Lưu thay đổi' })).toBeDisabled()
  })

  it('username tự chuyển chữ thường', async () => {
    setup()
    const u = screen.getByLabelText('Username')
    await userEvent.clear(u)
    await userEvent.type(u, 'AbC')
    expect(u).toHaveValue('abc')
  })

  it('lỗi 409 hiện dưới ô username', async () => {
    userApi.update.mockRejectedValue(new ApiError(409, { code: 'ALREADY_EXISTS', message: 'x', fields: { username: 'Username đã tồn tại' } }))
    const { onSaved } = setup()
    const u = screen.getByLabelText('Username')
    await userEvent.clear(u)
    await userEvent.type(u, 'trung')
    await save()
    expect(await screen.findByText('Username đã tồn tại')).toHaveClass('hint', 'bad')
    expect(onSaved).not.toHaveBeenCalled()
  })

  it('USERNAME_COOLDOWN hiện ngày được đổi lại dưới ô username', async () => {
    const at = '2026-11-20T12:00:00Z'
    userApi.update.mockRejectedValue(new ApiError(400, { code: 'USERNAME_COOLDOWN', message: 'x', available_at: at }))
    setup()
    const u = screen.getByLabelText('Username')
    await userEvent.clear(u)
    await userEvent.type(u, 'moi')
    await save()
    const msg = await screen.findByText(/30 ngày một lần/)
    expect(msg).toHaveTextContent(new Date(at).toLocaleDateString('vi-VN'))
    expect(msg).toHaveClass('hint', 'bad')
  })

  it('lỗi khác hiện thông báo chung', async () => {
    userApi.update.mockRejectedValue(new ApiError(500, { code: 'X', message: 'Máy chủ lỗi' }))
    setup()
    await userEvent.type(screen.getByLabelText(/Liên kết/), 'https://a.vn')
    await save()
    expect(await screen.findByRole('alert')).toHaveTextContent('Máy chủ lỗi')
  })

  it('hiện bộ đếm ký tự', async () => {
    setup()
    expect(screen.getByText('8/50')).toBeInTheDocument()
    expect(screen.getByText('8/150')).toBeInTheDocument()
    await userEvent.type(screen.getByLabelText('Tiểu sử'), '!!')
    expect(screen.getByText('10/150')).toBeInTheDocument()
  })

  it('Esc, nút đóng, Hủy và bấm nền đều gọi onClose', async () => {
    const { onClose } = setup()
    await userEvent.keyboard('{Escape}')
    expect(onClose).toHaveBeenCalledTimes(1)
    await userEvent.click(screen.getByRole('button', { name: 'Đóng' }))
    expect(onClose).toHaveBeenCalledTimes(2)
    await userEvent.click(screen.getByRole('button', { name: 'Hủy' }))
    expect(onClose).toHaveBeenCalledTimes(3)
    await userEvent.click(screen.getByRole('dialog').parentElement)
    expect(onClose).toHaveBeenCalledTimes(4)
  })
})
