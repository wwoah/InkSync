import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { InkMark } from '../components/InkMark'
import { prefersReducedMotion } from '../lib/motion'
import type { User } from '../types'

interface Props {
  initialUser?: User | null
  onEnterCanvas: (user: User) => void
  onEnterRoom: (user: User, roomId: string) => void
}

const COLOR_OPTIONS = [
  '#ff4757', '#ff6b2b', '#ffd32a', '#2ed573',
  '#1e90ff', '#a55eea', '#ff6eb4', '#ffffff',
]

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

export function Welcome({ initialUser, onEnterCanvas, onEnterRoom }: Props) {
  const [step, setStep] = useState<'identity' | 'destination'>(
    initialUser ? 'destination' : 'identity',
  )
  const [username, setUsername] = useState(initialUser?.username ?? '')
  const [color, setColor] = useState(initialUser?.color ?? COLOR_OPTIONS[4])
  const [roomMode, setRoomMode] = useState<'idle' | 'create' | 'join'>('idle')
  const [code, setCode] = useState('')

  const cardRef = useRef<HTMLDivElement>(null)
  const stepRef = useRef<HTMLDivElement>(null)

  // The card arrives once; its contents re-stagger on every step change.
  // These are fromTo, not from: a from-tween ends at whatever the element
  // measures when it is built, which under StrictMode's double-invoked effects
  // can be the previous tween's opacity: 0 — leaving the element stuck hidden.
  useEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        cardRef.current,
        { y: 24, scale: 0.96, opacity: 0 },
        { y: 0, scale: 1, opacity: 1, duration: 0.55, ease: 'power3.out', clearProps: 'opacity,transform' }
      )
    }, cardRef)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        gsap.utils.toArray<HTMLElement>(stepRef.current?.children ?? []),
        { y: 12, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.4,
          stagger: 0.07,
          ease: 'power2.out',
          clearProps: 'opacity,transform',
        }
      )
    }, stepRef)
    return () => ctx.revert()
  }, [step])

  const trimmed = username.trim()
  const user: User = { username: trimmed, color }

  const handleContinue = () => {
    if (!trimmed) return
    setStep('destination')
  }

  const enterRoom = (roomId: string) => {
    const id = roomId.trim().toUpperCase()
    if (!id) return
    onEnterRoom(user, id)
  }

  return (
    <div className="welcome-page">
      <div className="welcome-card" ref={cardRef}>
        <div className="welcome-logo">
          <InkMark size={30} />
          <span className="logo-ink">Ink</span>
          <span className="logo-sync">Sync</span>
        </div>
        <p className="welcome-sub">draw and share live.</p>

        <div className="welcome-step" ref={stepRef}>
        {step === 'identity' ? (
          <>
            <div className="field">
              <label className="field-label">handle</label>
              <input
                className="field-input"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleContinue()}
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
              onClick={handleContinue}
              disabled={!trimmed}
              style={{ borderColor: color, color }}
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <div className="welcome-identity">
              <span className="identity-dot" style={{ background: color }} />
              <span className="identity-name" style={{ color }}>{trimmed}</span>
              <button
                className="identity-edit"
                onClick={() => {
                  setRoomMode('idle')
                  setCode('')
                  setStep('identity')
                }}
              >
                edit
              </button>
            </div>

            <div className="field">
              <label className="field-label">where to?</label>

              <div className="choice-list">
                {/* Live Canvas */}
                <button
                  className="choice-card"
                  onClick={() => onEnterCanvas(user)}
                >
                  <span className="choice-icon">◈</span>
                  <span className="choice-body">
                    <span className="choice-title">Live Canvas</span>
                    <span className="choice-desc">
                      Draw with everyone in real time on one shared canvas.
                    </span>
                  </span>
                </button>

                {/* Private Room */}
                <div className={`choice-card static ${roomMode !== 'idle' ? 'open' : ''}`}>
                  <div className="choice-head">
                    <span className="choice-icon">◇</span>
                    <span className="choice-body">
                      <span className="choice-title">Private Room</span>
                      <span className="choice-desc">
                        Draw and chat in a private space with a room code.
                      </span>
                    </span>
                  </div>

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
                      <button
                        className="room-btn"
                        onClick={() => {
                          setCode('')
                          setRoomMode('join')
                        }}
                      >
                        Join Room
                      </button>
                    </div>
                  )}

                  {roomMode === 'create' && (
                    <>
                      <div className="room-code-display">
                        <span className="room-code-label">Share this code</span>
                        <span className="room-code">{code}</span>
                      </div>
                      <div className="room-actions">
                        <button className="room-btn primary" onClick={() => enterRoom(code)}>
                          Enter Room
                        </button>
                        <button className="room-btn" onClick={() => setRoomMode('idle')}>
                          Back
                        </button>
                      </div>
                    </>
                  )}

                  {roomMode === 'join' && (
                    <>
                      <input
                        className="room-input"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && enterRoom(code)}
                        placeholder="ENTER CODE"
                        autoFocus
                        maxLength={10}
                      />
                      <div className="room-actions">
                        <button
                          className="room-btn primary"
                          disabled={!code.trim()}
                          onClick={() => enterRoom(code)}
                        >
                          Join
                        </button>
                        <button
                          className="room-btn"
                          onClick={() => {
                            setCode('')
                            setRoomMode('idle')
                          }}
                        >
                          Back
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  )
}
