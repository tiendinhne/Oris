import { useState } from 'react'
import { userApi } from '../api'

export default function FollowButton({ username, following, followsMe, onChange }) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  async function toggle() {
    setBusy(true)
    setError('')
    try {
      await userApi.follow(username, !following)
      onChange?.(!following)
    } catch (err) {
      setError(err.message)
    } finally {
      setBusy(false)
    }
  }

  const label = following ? 'Đang theo dõi' : followsMe ? 'Theo dõi lại' : 'Theo dõi'
  return (
    <>
      <button type="button" className={'btn ' + (following ? 'btn-outline' : 'btn-primary')} disabled={busy} onClick={toggle}>
        {label}
      </button>
      {error && <span role="alert" className="hint bad">{error}</span>}
    </>
  )
}
