import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { InkMark } from '../components/InkMark'
import { prefersReducedMotion } from '../lib/motion'
import type { User } from '../types'

interface Props {
  initialUser?: User | null
  onEnterCanvas: (user: User, canvasId?: string) => void
  onEnterRoom: (user: User, roomId: string) => void
}

const COLOR_OPTIONS = [
  '#ff4757', '#ff6b2b', '#ffd32a', '#2ed573',
  '#1e90ff', '#a55eea', '#ff6eb4', '#ffffff',
]

function randomCode() {
  return Math.random().toString(36).slice(2, 8).toUpperCase()
}

/**
 * A destination card. Everything here is reached with a share code, except the
 * optional `onEnterOpen` — a public instance that needs none. Cards offering
 * both hide their options behind one button rather than fanning out three
 * choices the moment the step appears.
 */
function ChoiceCard({
  icon,
  title,
  desc,
  noun,
  openLabel,
  onEnterOpen,
  onEnterCode,
}: {
  icon: string
  title: string
  desc: string
  /** Used in the buttons: "Create Room", "Join Canvas", and so on. */
  noun: string
  openLabel?: string
  onEnterOpen?: () => void
  onEnterCode: (code: string) => void
}) {
  const gated = Boolean(onEnterOpen)
  const [mode, setMode] = useState<'idle' | 'menu' | 'create' | 'join'>('idle')
  const [code, setCode] = useState('')

  const enter = (c: string) => {
    const id = c.trim().toUpperCase()
    if (id) onEnterCode(id)
  }

  const startCreate = () => {
    setCode(randomCode())
    setMode('create')
  }

  const startJoin = () => {
    setCode('')
    setMode('join')
  }

  /** Back lands on the menu for gated cards, and closes the card otherwise. */
  const back = () => setMode(gated ? 'menu' : 'idle')

  return (
    <div className={`choice-card static ${mode !== 'idle' ? 'open' : ''}`}>
      <div className="choice-head">
        <span className="choice-icon">{icon}</span>
        <span className="choice-body">
          <span className="choice-title">{title}</span>
          <span className="choice-desc">{desc}</span>
        </span>
      </div>

      {mode === 'idle' && (
        <div className="room-actions">
          {gated ? (
            <button className="room-btn primary" onClick={() => setMode('menu')}>
              Join {noun}
            </button>
          ) : (
            <>
              <button className="room-btn primary" onClick={startCreate}>
                Create {noun}
              </button>
              <button className="room-btn" onClick={startJoin}>
                Join {noun}
              </button>
            </>
          )}
        </div>
      )}

      {mode === 'menu' && (
        <>
          <div className="room-group">
            <span className="room-code-label">open to everyone</span>
            <div className="room-actions">
              <button className="room-btn primary" onClick={onEnterOpen}>
                {openLabel}
              </button>
            </div>
          </div>
          <div className="room-group">
            <span className="room-code-label">or private, with a code</span>
            <div className="room-actions">
              <button className="room-btn" onClick={startCreate}>
                Create Private
              </button>
              <button className="room-btn" onClick={startJoin}>
                Join Private
              </button>
            </div>
          </div>
          <button className="room-btn" onClick={() => setMode('idle')}>
            Back
          </button>
        </>
      )}

      {mode === 'create' && (
        <>
          <div className="room-code-display">
            <span className="room-code-label">Share this code</span>
            <span className="room-code">{code}</span>
          </div>
          <div className="room-actions">
            <button className="room-btn primary" onClick={() => enter(code)}>
              Enter {noun}
            </button>
            <button className="room-btn" onClick={back}>
              Back
            </button>
          </div>
        </>
      )}

      {mode === 'join' && (
        <>
          <input
            className="room-input"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && enter(code)}
            placeholder="ENTER CODE"
            autoFocus
            maxLength={10}
          />
          <div className="room-actions">
            <button
              className="room-btn primary"
              disabled={!code.trim()}
              onClick={() => enter(code)}
            >
              Join
            </button>
            <button
              className="room-btn"
              onClick={() => {
                setCode('')
                back()
              }}
            >
              Back
            </button>
          </div>
        </>
      )}
    </div>
  )
}

export function Welcome({ initialUser, onEnterCanvas, onEnterRoom }: Props) {
  const [step, setStep] = useState<'identity' | 'destination'>(
    initialUser ? 'destination' : 'identity',
  )
  const [username, setUsername] = useState(initialUser?.username ?? '')
  const [color, setColor] = useState(initialUser?.color ?? COLOR_OPTIONS[4])
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

  return (
    <div className="welcome-page">
      <div className="welcome-card" ref={cardRef}>
        <div className="welcome-logo">
          <InkMark size={64} />
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
                onClick={() => setStep('identity')}
              >
                edit
              </button>
            </div>

            <div className="field">
              <label className="field-label">where to?</label>

              <div className="choice-list">
                <ChoiceCard
                  icon="◈"
                  title="Canvas"
                  desc="One big shared surface — draw together, pin comments, chat."
                  noun="Canvas"
                  openLabel="Live Canvas"
                  onEnterOpen={() => onEnterCanvas(user)}
                  onEnterCode={(id) => onEnterCanvas(user, id)}
                />

                <ChoiceCard
                  icon="◇"
                  title="Private Room"
                  desc="Draw and chat in a private space with a room code."
                  noun="Room"
                  onEnterCode={(id) => onEnterRoom(user, id)}
                />
              </div>
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  )
}
