import { useCallback, useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { io, Socket } from 'socket.io-client'
import { Avatar } from '../components/Avatar'
import { InkMark } from '../components/InkMark'
import { Wordmark } from '../components/Wordmark'
import { BackIcon, CheckIcon } from '../components/icons'
import { SoundToggle } from '../components/SoundToggle'
import { GameCanvas } from '../components/GameCanvas'
import { GameClock } from '../components/GameClock'
import { LeadTimeline } from '../components/LeadTimeline'
import { ScoreChart } from '../components/ScoreChart'
import { Podium } from '../components/Podium'
import { Confetti } from '../components/Confetti'
import { GameSettings as SettingsPanel } from '../components/GameSettings'
import type { GameCanvasHandle, GameOp } from '../components/GameCanvas'
import { normalizeAvatar } from '../lib/avatar'
import { prefersReducedMotion } from '../lib/motion'
import { onPaper } from '../lib/palette'
import { play } from '../lib/sound'
import { SERVER_URL } from '../lib/server'
import type { Message, User } from '../types'

export type GamePhase = 'lobby' | 'picking' | 'drawing' | 'reveal' | 'over'

export interface GamePlayer {
  id: string
  user: User
  score: number
  ready: boolean
  guessed: boolean
  roundScore: number
}

export interface Standing {
  id: string
  name: string
  color: string
  score: number
}

/** One completed turn, kept so the lead can be traced after the fact. */
export interface TurnRecord {
  turn: number
  round: number
  word: string | null
  leaderId: string
  leaderName: string
  leaderColor: string
  standings: Standing[]
}

/** A player's finish, frozen when the match ended. */
export interface FinalStanding {
  id: string
  user: User
  score: number
}

/** The whole result, kept until a new match starts. */
export interface GameResult {
  at: number
  rounds: number
  turns: number
  standings: FinalStanding[]
}

export interface GameSettings {
  rounds: number
  drawSeconds: number
  customWords: string[]
  customOnly: boolean
}

/**
 * What the host may send. `customWords` is deliberately loose: the textarea
 * hands over a raw blob and the server is what splits and sanitises it.
 */
export type SettingsPatch = Partial<Omit<GameSettings, 'customWords'>> & {
  customWords?: string | string[]
}

export interface GameLimits {
  rounds: { min: number; max: number }
  drawSeconds: { min: number; max: number }
  wordLength: { min: number; max: number }
  maxCustomWords: number
}

export interface GameState {
  phase: GamePhase
  round: number
  maxRounds: number
  drawerId: string | null
  endsAt: number
  minPlayers: number
  capacity: number
  /** Masked for guessers, so it is safe to render for everyone. */
  word: string | null
  wordLength: number
  lastWinner: string | null
  result: GameResult | null
  hostId: string | null
  settings: GameSettings
  limits: GameLimits
  history: TurnRecord[]
  players: GamePlayer[]
}

interface Props {
  user: User
  code: string
  onLeave: () => void
}

/**
 * Seconds left on the phase clock, ticking locally between server updates.
 * The value is derived during render and the interval only forces a repaint,
 * so nothing is written to state from inside the effect body.
 */
function useCountdown(endsAt: number) {
  const [left, setLeft] = useState(0)
  /** What the clock read when this deadline first arrived — the phase's length. */
  const [span, setSpan] = useState(0)

  useEffect(() => {
    if (!endsAt) return
    const secondsLeft = () => Math.max(0, Math.ceil((endsAt - Date.now()) / 1000))
    const tick = () => setLeft(secondsLeft())
    // The first reading happens on the next frame rather than in the effect
    // body, which keeps the clock out of both the cascading-render rule and the
    // purity rule that forbids reading Date.now() while rendering.
    const frame = requestAnimationFrame(() => {
      setSpan(secondsLeft())
      tick()
    })
    const id = setInterval(tick, 250)
    return () => {
      cancelAnimationFrame(frame)
      clearInterval(id)
    }
  }, [endsAt])

  return endsAt ? { left, span } : { left: 0, span: 0 }
}

export function ThinkInk({ user, code, onLeave }: Props) {
  const socketRef = useRef<Socket | null>(null)
  const canvasRef = useRef<GameCanvasHandle>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const wordRef = useRef<HTMLSpanElement>(null)

  const [state, setState] = useState<GameState | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [choices, setChoices] = useState<string[] | null>(null)
  const [secret, setSecret] = useState<string | null>(null)
  const [revealed, setRevealed] = useState<string | null>(null)
  const [nearMiss, setNearMiss] = useState(false)
  const [full, setFull] = useState<number | null>(null)
  const [text, setText] = useState('')
  /** Shared between the roster and the chart, so hovering either isolates a player. */
  const [focusId, setFocusId] = useState<string | null>(null)

  const me = state?.players.find((p) => p.user.username === user.username)
  const isDrawer = Boolean(state?.drawerId && me && state.drawerId === me.id)
  const isHost = Boolean(state?.hostId && me && state.hostId === me.id)
  const hostName = state?.players.find((p) => p.id === state.hostId)?.user.username ?? null
  const { left, span } = useCountdown(state?.endsAt ?? 0)
  // A drawing turn is measured against its full length, so when the first
  // correct guess cuts the clock the ring visibly drops. Picking and reveal
  // aren't in the state, so they use the length they started with.
  const clockTotal = state?.phase === 'drawing' ? state.settings.drawSeconds : span

  useEffect(() => {
    const socket = io(SERVER_URL)
    socketRef.current = socket

    // Sounds come from what changed between one state and the next, so the
    // first state after joining is silent and every push after it is compared.
    let lastPhase: GamePhase | null = null
    let lastSolved = 0
    let iSolved = false

    socket.on('connect', () => socket.emit('game_join', { ...user, code }))
    socket.on('game_full', ({ capacity }: { capacity: number }) => setFull(capacity))
    socket.on('game_state', (g: GameState) => {
      setState(g)
      const mine = g.players.find((p) => p.user.username === user.username)
      const solved = g.phase === 'drawing' ? g.players.filter((p) => p.guessed).length : 0
      if (lastPhase !== null) {
        if (g.phase !== lastPhase) {
          if (g.phase === 'picking' && mine && g.drawerId === mine.id) play('turn')
          // A beat late, so it never lands on top of the last guess's run.
          else if (g.phase === 'reveal') play('stick', { delay: 0.3 })
          else if (g.phase === 'over') play('win')
        }
        if (solved > lastSolved) play(mine?.guessed && !iSolved ? 'solved' : 'correct')
      }
      lastPhase = g.phase
      lastSolved = solved
      iSolved = g.phase === 'drawing' && Boolean(mine?.guessed)
    })
    socket.on('game_message', (m: Message) => setMessages((prev) => [...prev, m]))
    socket.on('game_choices', ({ choices: c }: { choices: string[] }) => setChoices(c))
    socket.on('game_word', ({ word }: { word: string }) => setSecret(word))
    socket.on('game_draw', (op: GameOp) => canvasRef.current?.apply(op))
    socket.on('game_replay', ({ strokes }: { strokes: GameOp[] }) =>
      canvasRef.current?.replay(strokes)
    )
    socket.on('game_clear', () => {
      play('rustle', { gain: 0.8 })
      canvasRef.current?.clear()
      setChoices(null)
      setSecret(null)
      setRevealed(null)
    })
    socket.on('game_reveal', ({ word }: { word: string | null }) => setRevealed(word))
    socket.on('game_close', () => {
      play('close')
      setNearMiss(true)
      setTimeout(() => setNearMiss(false), 1600)
    })

    return () => {
      socket.emit('game_leave')
      socket.disconnect()
    }
  }, [user, code])

  useEffect(() => {
    const el = feedRef.current
    if (el) el.scrollTop = el.scrollHeight
  }, [messages])

  // Count the letters showing; a jump means a hint just landed.
  const shownLetters = state?.word ? state.word.replace(/[^a-z0-9]/gi, '').length : 0

  useEffect(() => {
    if (!shownLetters || prefersReducedMotion()) return
    play('tick')
    const ctx = gsap.context(() => {
      gsap.fromTo(
        wordRef.current,
        { x: -7 },
        {
          x: 0,
          duration: 0.55,
          ease: 'elastic.out(1, 0.32)',
          clearProps: 'transform',
        }
      )
    }, wordRef)
    return () => ctx.revert()
  }, [shownLetters])

  // The last five seconds of a turn tick like a woodblock.
  const phase = state?.phase
  useEffect(() => {
    if (phase === 'drawing' && left > 0 && left <= 5) play('clock')
  }, [left, phase])

  const sendOp = useCallback((op: GameOp) => socketRef.current?.emit('game_draw', op), [])
  const clearCanvas = useCallback(() => socketRef.current?.emit('game_clear'), [])

  const send = () => {
    const body = text.trim()
    if (!body) return
    socketRef.current?.emit('game_guess', { text: body })
    setText('')
    play('flick')
  }

  if (full !== null) {
    return (
      <div className="welcome-page">
        <div className="welcome-card canvas-full-card">
          <span className="tape tape-left" aria-hidden="true" />
          <span className="tape tape-right" aria-hidden="true" />
          <Wordmark first="Think" second="Ink" size={56} />
          <p className="welcome-sub">this game is full</p>
          <p className="canvas-full-text">
            All {full} seats are taken. Try another code, or start your own game.
          </p>
          <button
            className="join-btn"
            onClick={onLeave}
            style={{ ['--who' as string]: user.color }}
          >
            Back
          </button>
        </div>
      </div>
    )
  }

  const ranked = [...(state?.players ?? [])].sort((a, b) => b.score - a.score)
  const waiting = state ? state.players.length < state.minPlayers : true

  return (
    <div className="game-page">
      <header className="game-header">
        <button className="back-btn" onClick={onLeave} aria-label="Back">
          <BackIcon />
        </button>
        <InkMark size={26} />
        <span className="game-logo">ThinkInk</span>
        <span className="game-code">/ {code}</span>

        <span className="game-word-slot" ref={wordRef}>
          {state?.phase === 'drawing' &&
            (isDrawer ? (
              <span className="game-word drawer">{secret}</span>
            ) : (
              <span className="game-word">{state.word}</span>
            ))}
          {revealed && <span className="game-word reveal">{revealed}</span>}
        </span>

        {state && state.phase !== 'lobby' && state.phase !== 'over' && (
          <>
            <span className="game-round">
              Round {state.round}/{state.maxRounds}
            </span>
            <GameClock left={left} total={clockTotal} />
          </>
        )}
        <SoundToggle />
      </header>

      <div className="game-body">
        <aside className="game-players">
          {ranked.map((p, i) => (
            <div
              key={p.id}
              className={`game-player ${p.guessed ? 'guessed' : ''} ${
                state?.drawerId === p.id ? 'drawing' : ''
              } ${focusId === p.id ? 'focus' : ''}`}
              onMouseEnter={() => setFocusId(p.id)}
              onMouseLeave={() => setFocusId(null)}
            >
              <span className="game-rank">{i + 1}</span>
              <Avatar
                color={p.user.color}
                avatar={normalizeAvatar(p.user.avatar)}
                size={30}
                ring={state?.drawerId === p.id}
              />
              <span className="game-player-name">
                {p.user.username}
                {p.user.username === user.username && ' (you)'}
              </span>
              <span className="game-score">{p.score}</span>
              {state?.phase === 'lobby' && p.ready && (
                <span className="game-tick" aria-label="ready">
                  <CheckIcon />
                </span>
              )}
            </div>
          ))}

          <div className="game-analytics">
            <ScoreChart
              history={state?.history ?? []}
              focusId={focusId}
              onFocus={setFocusId}
            />
            <LeadTimeline history={state?.history ?? []} />
          </div>
        </aside>

        <main className="game-stage">
          <GameCanvas
            ref={canvasRef}
            canDraw={isDrawer && state?.phase === 'drawing'}
            onOp={sendOp}
            onClear={clearCanvas}
          />

          {/* Everything that interrupts play sits over the canvas. */}
          {state?.phase === 'lobby' && (
            <div className="game-overlay lobby">
              <h2>Waiting to start</h2>
              <p>
                {waiting
                  ? `At least ${state.minPlayers} players are needed — share the code ${code}.`
                  : 'Everyone readies up, then the first turn begins.'}
              </p>

              <SettingsPanel
                settings={state.settings}
                limits={state.limits}
                isHost={isHost}
                hostName={hostName}
                onChange={(patch) => socketRef.current?.emit('game_settings', patch)}
              />

              <button
                className="room-btn primary"
                onClick={() => socketRef.current?.emit('game_ready', { ready: !me?.ready })}
                disabled={waiting}
              >
                {me?.ready ? 'Not ready' : "I'm ready"}
              </button>
            </div>
          )}

          {state?.phase === 'picking' && isDrawer && choices && (
            <div className="game-overlay">
              <h2>Pick a word</h2>
              <p>You are drawing this turn.</p>
              <div className="game-choices">
                {choices.map((w) => (
                  <button
                    key={w}
                    className="room-btn primary"
                    onClick={() => {
                      socketRef.current?.emit('game_choose', { word: w })
                      setChoices(null)
                    }}
                  >
                    {w}
                  </button>
                ))}
              </div>
            </div>
          )}

          {state?.phase === 'picking' && !isDrawer && (
            <div className="game-overlay soft">
              <h2>
                {state.players.find((p) => p.id === state.drawerId)?.user.username ?? 'Someone'} is
                choosing…
              </h2>
            </div>
          )}

          {state?.phase === 'over' && (
            <div className="game-overlay over">
              <h2>{state.result?.standings[0]?.user.username ?? state.lastWinner ?? 'Game'} wins!</h2>
              {state.result && (
                <>
                  <Confetti
                    colors={state.result.standings.slice(0, 3).map((p) => p.user.color)}
                    fireKey={state.result.at}
                  />
                  <Podium standings={state.result.standings} resultAt={state.result.at} />
                  <p className="game-final-note">
                    Final after {state.result.turns} turn
                    {state.result.turns === 1 ? '' : 's'} — this result stays put while you
                    set up the next match.
                  </p>
                </>
              )}
              {state.history.length > 0 && (
                <div className="game-final-chart">
                  <ScoreChart history={state.history} height={170} />
                </div>
              )}
              <SettingsPanel
                settings={state.settings}
                limits={state.limits}
                isHost={isHost}
                hostName={hostName}
                onChange={(patch) => socketRef.current?.emit('game_settings', patch)}
              />
              <button
                className="room-btn primary"
                onClick={() => socketRef.current?.emit('game_ready', { ready: true })}
              >
                Play again
              </button>
            </div>
          )}
        </main>

        <section className="game-chat">
          <div className="game-feed" ref={feedRef}>
            {messages.map((m) => (
              <div key={m.id} className={`game-msg ${m.type === 'system' ? 'sys' : ''}`}>
                {m.type === 'system' ? (
                  m.content
                ) : (
                  <>
                    <span
                      className="game-msg-author"
                      style={{ color: m.user ? onPaper(m.user.color) : undefined }}
                    >
                      {m.user?.username}
                    </span>
                    {m.content}
                  </>
                )}
              </div>
            ))}
          </div>

          <div className={`text-bar ${nearMiss ? 'near' : ''}`}>
            <input
              className="text-input"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && send()}
              placeholder={
                isDrawer && state?.phase === 'drawing'
                  ? 'You are drawing — no hints!'
                  : me?.guessed
                    ? 'You got it! Sit tight.'
                    : 'Type your guess…'
              }
            />
            <button className="text-send-btn" onClick={send}>
              Send
            </button>
          </div>
          {nearMiss && <div className="game-near">So close!</div>}
        </section>
      </div>
    </div>
  )
}
