import { useState } from 'react'
import type { User } from '../types'

interface Props {
  onJoin: (user: User) => void
}

const COLOR_OPTIONS = [
  '#ff4757', '#ff6b2b', '#ffd32a', '#2ed573',
  '#1e90ff', '#a55eea', '#ff6eb4', '#ffffff',
]

export function Welcome({ onJoin }: Props) {
  const [username, setUsername] = useState('')
  const [color, setColor] = useState(COLOR_OPTIONS[4])

  const handleJoin = () => {
    const trimmed = username.trim()
    if (!trimmed) return
    onJoin({ username: trimmed, color })
  }

  return (
    <div className="welcome-page">
      <div className="welcome-card">
        <div className="welcome-logo">
          <span className="logo-ink">Ink</span>
          <span className="logo-sync">Sync</span>
        </div>
        <p className="welcome-sub">draw. share. vibe.</p>

        <div className="field">
          <label className="field-label">handle</label>
          <input
            className="field-input"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleJoin()}
            placeholder="what do they call you?"
            maxLength={20}
            autoFocus
          />
        </div>

        <div className="field">
          <label className="field-label">your color</label>
          <div className="color-row">
            {COLOR_OPTIONS.map((c) => (
              <button
                key={c}
                className={`welcome-swatch ${c === color ? 'selected' : ''}`}
                style={{ background: c }}
                onClick={() => setColor(c)}
              />
            ))}
          </div>
        </div>

        <button
          className="join-btn"
          onClick={handleJoin}
          disabled={!username.trim()}
          style={{
            borderColor: color,
            color: color,
          }}
        >
          Enter Room
        </button>
      </div>
    </div>
  )
}
