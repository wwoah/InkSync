import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import gsap from 'gsap'
import { Wordmark } from '../components/Wordmark'
import { Carousel } from '../components/Carousel'
import { AvatarPicker } from '../components/AvatarPicker'
import { Avatar } from '../components/Avatar'
import { BulbIcon, LockIcon, SheetIcon } from '../components/icons'
import { DEFAULT_AVATAR, normalizeAvatar } from '../lib/avatar'
import { saveProfile } from '../lib/profile'
import { prefersReducedMotion, setDown } from '../lib/motion'
import { PLAYER_COLORS, onPaper } from '../lib/palette'
import type { User } from '../types'

interface Props {
  initialUser?: User | null
  onEnterCanvas: (user: User, canvasId?: string) => void
  onEnterRoom: (user: User, roomId: string) => void
  onEnterGame: (user: User, code: string) => void
}

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
  icon: ReactNode
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

export function Welcome({ initialUser, onEnterCanvas, onEnterRoom, onEnterGame }: Props) {
  const [step, setStep] = useState<'identity' | 'destination'>(
    initialUser ? 'destination' : 'identity',
  )
  const [username, setUsername] = useState(initialUser?.username ?? '')
  const [color, setColor] = useState(initialUser?.color ?? PLAYER_COLORS[4])
  const [avatar, setAvatar] = useState(() =>
    initialUser?.avatar ? normalizeAvatar(initialUser.avatar) : DEFAULT_AVATAR
  )
  const cardRef = useRef<HTMLDivElement>(null)
  const stepRef = useRef<HTMLDivElement>(null)

  // The card is set down once, then taped; its contents re-stagger on every
  // step change. These are fromTo, not from: a from-tween ends at whatever the
  // element measures when it is built, which under StrictMode's double-invoked
  // effects can be the previous tween's opacity: 0 — leaving it stuck hidden.
  useEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      setDown(cardRef.current)
      gsap.fromTo(
        '.tape',
        { opacity: 0, scale: 1.25, y: -8 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.3,
          stagger: 0.12,
          delay: 0.42,
          ease: 'power2.out',
          clearProps: 'opacity,transform',
        }
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
  const user: User = { username: trimmed, color, avatar }

  const handleContinue = () => {
    if (!trimmed) return
    // Remember the face for next time before leaving this step.
    saveProfile(user)
    setStep('destination')
  }

  return (
    <div className="welcome-page">
      <div className="welcome-card" ref={cardRef}>
        <span className="tape tape-left" aria-hidden="true" />
        <span className="tape tape-right" aria-hidden="true" />
        <Wordmark />
        <p className="welcome-sub">draw and share live.</p>

        <div className="welcome-step" ref={stepRef}>
        {step === 'identity' ? (
          <>
            <AvatarPicker color={color} avatar={avatar} onChange={setAvatar} />

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
              <label className="field-label">your colour</label>
              <div className="color-row">
                {PLAYER_COLORS.map((c) => (
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
              style={{ ['--who' as string]: color }}
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <div className="welcome-identity">
              <Avatar color={color} avatar={avatar} size={28} />
              <span className="identity-name" style={{ color: onPaper(color) }}>{trimmed}</span>
              <button
                className="identity-edit"
                onClick={() => setStep('identity')}
              >
                edit
              </button>
            </div>

            <div className="field">
              <label className="field-label">where to?</label>

              <Carousel
                slides={[
                  {
                    key: 'canvas',
                    label: 'Canvas',
                    content: (
                      <ChoiceCard
                        icon={<SheetIcon />}
                        title="Canvas"
                        desc="One big shared surface. Draw together, pin comments, chat."
                        noun="Canvas"
                        openLabel="Live Canvas"
                        onEnterOpen={() => onEnterCanvas(user)}
                        onEnterCode={(id) => onEnterCanvas(user, id)}
                      />
                    ),
                  },
                  {
                    key: 'room',
                    label: 'Private Room',
                    content: (
                      <ChoiceCard
                        icon={<LockIcon />}
                        title="Private Room"
                        desc="Draw and chat in a private space with a room code."
                        noun="Room"
                        onEnterCode={(id) => onEnterRoom(user, id)}
                      />
                    ),
                  },
                  {
                    key: 'thinkink',
                    label: 'ThinkInk',
                    content: (
                      <ChoiceCard
                        icon={<BulbIcon />}
                        title="ThinkInk"
                        desc="One player draws a secret word, everyone else races to guess it."
                        noun="Game"
                        onEnterCode={(id) => onEnterGame(user, id)}
                      />
                    ),
                  },
                ]}
              />
            </div>
          </>
        )}
        </div>
      </div>
    </div>
  )
}
