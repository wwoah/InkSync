import { useState } from 'react'
import type { User } from '../types'

interface Props {
  user: User
  onJoinRoom: (roomId: string) => void
  onJoinCanvas: () => void
}

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function Home({ user, onJoinRoom, onJoinCanvas }: Props) {
  const [roomMode, setRoomMode] = useState<'idle' | 'create' | 'join'>('idle')
  const [code, setCode] = useState('')

  return (
    <div className="home-page">
      <nav className="home-nav">
        <span className="home-logo">InkSync</span>
        <span className="home-user" style={{ color: user.color }}>
          {user.username}
        </span>
      </nav>

      <div className="home-modes">
        {/* Live Canvas */}
        <button className="mode-card canvas-card" onClick={onJoinCanvas}>
          <div className="mode-icon">◈</div>
          <h2>Live Canvas</h2>
          <p>
            Draw with everyone in real time on a shared canvas. Pin comments,
            chat while you create.
          </p>
          <span className="mode-tag">Full screen · Collaborative · Real-time</span>
        </button>

        {/* Private Room */}
        <div className="mode-card room-card">
          <div className="mode-icon">◇</div>
          <h2>Private Room</h2>
          <p>
            Draw and chat in a private space. Send your canvas as a message or
            just type.
          </p>
          <span className="mode-tag">Rooms · Drawings as messages</span>

          {roomMode === 'idle' && (
            <div className="room-actions">
              <button
                className="room-btn primary"
                onClick={() => {
                  setCode(randomCode())
                  setRoomMode('create')
                }}
              >
                Create Room
              </button>
              <button className="room-btn" onClick={() => { setCode(''); setRoomMode('join') }}>
                Join Room
              </button>
            </div>
          )}

          {roomMode === 'create' && (
            <div className="room-create">
              <div className="room-code-display">
                <span className="room-code-label">Share this code</span>
                <span className="room-code">{code}</span>
              </div>
              <div className="room-actions">
                <button className="room-btn primary" onClick={() => onJoinRoom(code)}>
                  Enter Room
                </button>
                <button className="room-btn" onClick={() => setRoomMode('idle')}>
                  Back
                </button>
              </div>
            </div>
          )}

          {roomMode === 'join' && (
            <div className="room-join">
              <input
                className="room-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                onKeyDown={(e) =>
                  e.key === 'Enter' && code.trim() && onJoinRoom(code.trim())
                }
                placeholder="ENTER CODE"
                autoFocus
                maxLength={10}
              />
              <div className="room-actions">
                <button
                  className="room-btn primary"
                  disabled={!code.trim()}
                  onClick={() => code.trim() && onJoinRoom(code.trim())}
                >
                  Join
                </button>
                <button className="room-btn" onClick={() => { setCode(''); setRoomMode('idle') }}>
                  Back
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
