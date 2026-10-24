import { describe, it, expect, beforeEach, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import FollowButton from './FollowButton'
import { userApi } from '../api'

vi.mock('../api', () => ({ userApi: { follow: vi.fn() } }))

beforeEach(() => {
  vi.clearAllMocks()
  userApi.follow.mockResolvedValue(null)
})

describe('FollowButton', () => {
  it('hiện đúng nhãn theo trạng thái', () => {
    const { rerender } = render(<FollowButton username="an" following={false} followsMe={false} />)
    expect(screen.getByRole('button', { name: 'Theo dõi' })).toBeInTheDocument()
    rerender(<FollowButton username="an" following={false} followsMe />)
    expect(screen.getByRole('button', { name: 'Theo dõi lại' })).toBeInTheDocument()
    rerender(<FollowButton username="an" following followsMe />)
    expect(screen.getByRole('button', { name: 'Đang theo dõi' })).toBeInTheDocument()
  })

  it('bấm khi chưa theo dõi thì gọi follow(u, true) và onChange(true)', async () => {
    const onChange = vi.fn()
    render(<FollowButton username="an" following={false} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button'))
    expect(userApi.follow).toHaveBeenCalledWith('an', true)
    expect(onChange).toHaveBeenCalledWith(true)
  })

  it('bấm khi đang theo dõi thì gọi follow(u, false)', async () => {
    const onChange = vi.fn()
    render(<FollowButton username="an" following onChange={onChange} />)
    await userEvent.click(screen.getByRole('button'))
    expect(userApi.follow).toHaveBeenCalledWith('an', false)
    expect(onChange).toHaveBeenCalledWith(false)
  })

  it('vô hiệu hóa nút trong lúc chờ', async () => {
    let done
    userApi.follow.mockReturnValue(new Promise((r) => { done = r }))
    render(<FollowButton username="an" following={false} onChange={() => {}} />)
    await userEvent.click(screen.getByRole('button'))
    expect(screen.getByRole('button')).toBeDisabled()
    done(null)
  })

  it('lỗi thì không gọi onChange và hiện thông báo', async () => {
    userApi.follow.mockRejectedValue(new Error('Không thể theo dõi chính mình'))
    const onChange = vi.fn()
    render(<FollowButton username="an" following={false} onChange={onChange} />)
    await userEvent.click(screen.getByRole('button'))
    expect(await screen.findByRole('alert')).toHaveTextContent('Không thể theo dõi chính mình')
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByRole('button', { name: 'Theo dõi' })).toBeEnabled()
  })
})
