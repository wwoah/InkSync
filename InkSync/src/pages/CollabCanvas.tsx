import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import gsap from 'gsap'
import { io, Socket } from 'socket.io-client'
import { ChatFeed } from '../components/ChatFeed'
import { BrushHint } from '../components/BrushHint'
import { CursorIcon, FillIcon, InfoIcon } from '../components/icons'
import { InkMark } from '../components/InkMark'
import { InfoPanel } from '../components/InfoPanel'
import { useBrushSize } from '../hooks/useBrushSize'
import { prefersReducedMotion } from '../lib/motion'
import { floodFill } from '../lib/fill'
import { isTypingTarget } from '../lib/keys'
import { SERVER_URL } from '../lib/server'
import type { Message, User } from '../types'

interface Pin {
  id: string
  xPct: number
  yPct: number
  text: string
  user: User
  timestamp: number
}

interface DrawSegment {
  x1: number
  y1: number
  x2: number
  y2: number
  color: string
  size: number
  tool: string
  strokeId?: string
  kind?: undefined
}

interface FillOp {
  kind: 'fill'
  x: number
  y: number
  color: string
  strokeId?: string
}

/** Anything replayable: the op log holds both, in the order they happened. */
type CanvasOp = DrawSegment | FillOp

interface RemoteCursor {
  user: User
  xPct: number
  yPct: number
  /** Last time we heard from them; stale cursors are pruned. */
  t: number
}

type Tool = 'select' | 'pen' | 'eraser' | 'fill' | 'pin'

const COLORS = [
  '#111111', '#ff4757', '#ff6b2b', '#ffd32a',
  '#2ed573', '#1e90ff', '#a55eea', '#ff6eb4',
  '#ffffff', '#8395a7',
]

const TOOLS: {
  id: Tool
  icon: ReactNode
  name: string
  key?: string
  hint: string
}[] = [
  {
    id: 'select',
    icon: <CursorIcon />,
    name: 'Select',
    key: 'V',
    hint: 'Drag to pan the canvas, and click pins to open or close their comments.',
  },
  { id: 'pen', icon: '✏', name: 'Pen', key: 'P', hint: 'Freehand strokes in the colour in hand.' },
  {
    id: 'eraser',
    icon: '⬜',
    name: 'Eraser',
    key: 'E',
    hint: 'Paints the canvas back to white, five times the brush width.',
  },
  {
    id: 'fill',
    icon: <FillIcon />,
    name: 'Fill',
    key: 'F',
    hint: 'Floods the area you click, bleeding slightly into soft stroke edges.',
  },
  {
    id: 'pin',
    icon: '◎',
    name: 'Pin',
    hint: 'Click anywhere to leave a comment anchored to that spot.',
  },
]

const CURSORS: Record<Tool, string> = {
  select: 'grab',
  pen: 'crosshair',
  eraser: 'crosshair',
  fill: 'crosshair',
  pin: 'cell',
}

/** Right-dragging paints with the secondary colour; white makes it an eraser. */
const DEFAULT_ALT_COLOR = '#ffffff'

const newStrokeId = () =>
  globalThis.crypto?.randomUUID?.() ?? `${Date.now()}_${Math.random().toString(36).slice(2)}`

/** The open canvas everyone shares; any other id is a private canvas code. */
export const LIVE_CANVAS_ID = 'live'

const MIN_SIZE = 1
const MAX_SIZE = 30

/** The drawing surface is far larger than the viewport; you pan around it. */
const SURFACE_W = 4096
const SURFACE_H = 2304
/** Pointer travel past which a select-drag counts as a pan, not a click. */
const CLICK_SLOP = 4

/** Cursor broadcast rate while drawing, and how long one lives unheard-from. */
const CURSOR_EMIT_MS = 33
const CURSOR_STALE_MS = 1500

/** Unread chat toasts: how many stack up, and how long each one lingers. */
const MAX_TOASTS = 3
const TOAST_MS = 5500

/** Keep the surface covering the viewport, so it can never be dragged off-screen. */
function clampPan(x: number, y: number) {
  const minX = Math.min(0, window.innerWidth - SURFACE_W)
  const minY = Math.min(0, window.innerHeight - SURFACE_H)
  return {
    x: Math.min(0, Math.max(minX, x)),
    y: Math.min(0, Math.max(minY, y)),
  }
}

function clientPoint(e: MouseEvent | TouchEvent) {
  if ('touches' in e) {
    const t = e.touches[0] ?? e.changedTouches[0]
    return { x: t?.clientX ?? 0, y: t?.clientY ?? 0 }
  }
  return { x: e.clientX, y: e.clientY }
}

/**
 * Bakes are lossless and full-resolution: a joiner paints this at 1:1, so any
 * downscaling or JPEG here is quality every future joiner would inherit.
 * The server only asks for one once enough strokes have piled up.
 */
function snapshot(canvas: HTMLCanvasElement) {
  return canvas.toDataURL('image/png')
}

/** A pin pops in when it arrives, and its bubble springs open on click. */
function PinMarker({
  pin,
  open,
  onToggle,
}: {
  pin: Pin
  open: boolean
  onToggle: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const bubbleRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { scale: 0, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.45, ease: 'back.out(2.4)', clearProps: 'opacity,transform' }
      )
    }, ref)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    if (!open || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        bubbleRef.current,
        { opacity: 0, x: -10, scale: 0.9 },
        {
          opacity: 1,
          x: 0,
          scale: 1,
          duration: 0.26,
          ease: 'back.out(2)',
          transformOrigin: 'left center',
          clearProps: 'opacity,transform',
        }
      )
    }, bubbleRef)
    return () => ctx.revert()
  }, [open])

  return (
    <div
      ref={ref}
      className={`pin-marker ${open ? 'open' : ''}`}
      style={{ left: `${pin.xPct}%`, top: `${pin.yPct}%` }}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
    >
      <div className="pin-dot" style={{ background: pin.user.color }} />
      {open && (
        <div className="pin-bubble" ref={bubbleRef}>
          <span className="pin-author" style={{ color: pin.user.color }}>
            {pin.user.username}
          </span>
          <p className="pin-text">{pin.text}</p>
        </div>
      )}
    </div>
  )
}

/** Slides in, holds, slides out — then tells the parent to drop it. */
function Toast({
  msg,
  onOpen,
  onExpire,
}: {
  msg: Message
  onOpen: () => void
  onExpire: (id: string) => void
}) {
  const ref = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (prefersReducedMotion()) {
      const t = setTimeout(() => onExpire(msg.id), TOAST_MS)
      return () => clearTimeout(t)
    }
    const ctx = gsap.context(() => {
      gsap
        .timeline()
        .fromTo(
          el,
          { opacity: 0, x: 30, scale: 0.95 },
          { opacity: 1, x: 0, scale: 1, duration: 0.34, ease: 'back.out(1.6)' }
        )
        .to(el, {
          opacity: 0,
          x: 30,
          duration: 0.3,
          ease: 'power2.in',
          delay: TOAST_MS / 1000,
          onComplete: () => onExpire(msg.id),
        })
    }, ref)
    return () => ctx.revert()
  }, [msg.id, onExpire])

  return (
    <button ref={ref} className="collab-toast" onClick={onOpen} title="Open chat (M)">
      <span className="toast-author" style={{ color: msg.user?.color }}>
        {msg.user?.username}
      </span>
      <span className="toast-text">{msg.content}</span>
    </button>
  )
}

interface Props {
  user: User
  canvasId: string
  onLeave: () => void
}

export function CollabCanvas({ user, canvasId, onLeave }: Props) {
  const isPrivate = canvasId !== LIVE_CANVAS_ID
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const surfaceRef = useRef<HTMLDivElement>(null)
  const chatInputRef = useRef<HTMLInputElement>(null)
  const toolbarRef = useRef<HTMLDivElement>(null)
  const fullCardRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const isDrawing = useRef(false)
  const didDraw = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const lastCursorEmit = useRef(0)
  // Fixed at mousedown: which colour this stroke paints with, and its id for undo.
  const strokeColor = useRef(user.color)
  const strokeId = useRef('')
  /** Last baked image, kept decoded so an undo can repaint without a round trip. */
  const baseline = useRef<HTMLImageElement | null>(null)

  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(user.color)
  const [altColor, setAltColor] = useState(DEFAULT_ALT_COLOR)
  const [messages, setMessages] = useState<Message[]>([])
  const [pins, setPins] = useState<Pin[]>([])
  const [userCount, setUserCount] = useState(0)
  const [chatOpen, setChatOpen] = useState(false)
  const [chatText, setChatText] = useState('')
  const [pendingPin, setPendingPin] = useState<{ xPct: number; yPct: number } | null>(null)
  const [pinText, setPinText] = useState('')
  const [activePin, setActivePin] = useState<string | null>(null)
  const [toasts, setToasts] = useState<Message[]>([])
  const [unread, setUnread] = useState(0)
  const [capacity, setCapacity] = useState<number | null>(null)
  const [full, setFull] = useState<number | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [cursors, setCursors] = useState<Record<string, RemoteCursor>>({})

  // The socket handlers are bound once, so they read the panel state off a ref.
  const chatOpenRef = useRef(chatOpen)

  const expireToast = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id))
  }, [])

  const { size, setSize, hint } = useBrushSize({
    initial: 5,
    min: MIN_SIZE,
    max: MAX_SIZE,
    enabled: tool === 'pen' || tool === 'eraser',
    canvasRef,
  })

  // Start centred on the surface.
  const [pan, setPan] = useState(() =>
    clampPan((window.innerWidth - SURFACE_W) / 2, (window.innerHeight - SURFACE_H) / 2)
  )
  const panRef = useRef(pan)
  const panStart = useRef<{ x: number; y: number; ox: number; oy: number } | null>(null)
  const panMoved = useRef(false)
  const [panning, setPanning] = useState(false)

  /** Opening the panel counts as reading everything waiting in it. */
  const showChat = useCallback((next: boolean) => {
    chatOpenRef.current = next
    setChatOpen(next)
    if (next) {
      setToasts([])
      setUnread(0)
    }
  }, [])

  const toggleChat = useCallback(() => showChat(!chatOpenRef.current), [showChat])

  const applyPan = useCallback((x: number, y: number) => {
    const next = clampPan(x, y)
    panRef.current = next
    setPan(next)
  }, [])

  useEffect(() => {
    const onResize = () => applyPan(panRef.current.x, panRef.current.y)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [applyPan])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  function applyOp(ctx: CanvasRenderingContext2D, op: CanvasOp) {
    if (op.kind === 'fill') {
      floodFill(ctx, op.x, op.y, op.color)
      return
    }
    const seg = op
    ctx.beginPath()
    ctx.moveTo(seg.x1, seg.y1)
    ctx.lineTo(seg.x2, seg.y2)
    ctx.strokeStyle = seg.tool === 'eraser' ? '#ffffff' : seg.color
    ctx.lineWidth = seg.tool === 'eraser' ? seg.size * 5 : seg.size
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }

  useEffect(() => {
    const socket = io(SERVER_URL)
    socketRef.current = socket

    socket.on('connect', () => socket.emit('join_canvas', { ...user, canvasId }))

    socket.on('canvas_full', ({ capacity: cap }: { capacity: number }) => setFull(cap))

    // Repaint from the cached baseline, then replay every op still standing.
    // Undo and redo both come back through here.
    const render = (ops: CanvasOp[]) => {
      const canvas = canvasRef.current
      const ctx = canvas?.getContext('2d')
      if (!canvas || !ctx) return
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, canvas.width, canvas.height)
      if (baseline.current) ctx.drawImage(baseline.current, 0, 0, canvas.width, canvas.height)
      ops.forEach((op) => applyOp(ctx, op))
    }

    const setBaseline = (dataUrl: string | null, then?: () => void) => {
      if (!dataUrl) {
        baseline.current = null
        then?.()
        return
      }
      const img = new Image()
      img.onload = () => {
        baseline.current = img
        then?.()
      }
      img.onerror = () => then?.()
      img.src = dataUrl
    }

    socket.on(
      'canvas_init',
      ({ dataUrl, segments, messages: msgs, pins: initPins, capacity: cap }) => {
        setCapacity(cap ?? null)
        // Strokes drawn since the last bake are replayed on top of it, so a
        // joiner ends up with exactly what everyone else has on screen.
        setBaseline(dataUrl ?? null, () => render(segments ?? []))
        setMessages(msgs ?? [])
        setPins(initPins ?? [])
      }
    )

    // Someone baked: adopt it as the baseline without repainting anything.
    socket.on('canvas_baked', ({ dataUrl }: { dataUrl: string }) => setBaseline(dataUrl))

    socket.on('canvas_rebuild', ({ ops }: { ops: CanvasOp[] }) => render(ops))

    // The server asks for a fresh bake once replay gets long.
    socket.on('canvas_bake', () => {
      const canvas = canvasRef.current
      if (!canvas) return
      const dataUrl = snapshot(canvas)
      setBaseline(dataUrl)
      socket.emit('canvas_save', { dataUrl })
    })

    socket.on('canvas_cursor', (c: RemoteCursor & { id: string }) => {
      setCursors((prev) => ({ ...prev, [c.id]: { ...c, t: Date.now() } }))
    })

    socket.on('canvas_cursor_end', ({ id }: { id: string }) => {
      setCursors((prev) => {
        if (!(id in prev)) return prev
        const next = { ...prev }
        delete next[id]
        return next
      })
    })

    socket.on('canvas_draw', (seg: DrawSegment) => {
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) applyOp(ctx, seg)
    })

    socket.on('canvas_fill', (op: FillOp) => {
      const ctx = canvasRef.current?.getContext('2d')
      if (ctx) applyOp(ctx, op)
    })

    socket.on('canvas_pin', (pin: Pin) => setPins((p) => [...p, pin]))

    socket.on('canvas_message', (msg: Message) => {
      setMessages((prev) => [...prev, msg])
      // Only announce what the open panel wouldn't already be showing, and
      // only for things a person actually said.
      if (chatOpenRef.current || msg.type !== 'text' || !msg.user) return
      setUnread((n) => n + 1)
      setToasts((t) => [...t, msg].slice(-MAX_TOASTS))
    })

    socket.on('canvas_user_count', (n: number) => setUserCount(n))

    return () => {
      socket.disconnect()
    }
  }, [user, canvasId])

  const getCanvasPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    // getBoundingClientRect already accounts for the pan transform.
    const rect = canvas.getBoundingClientRect()
    const p = clientPoint(e)
    return {
      x: (p.x - rect.left) * (canvas.width / rect.width),
      y: (p.y - rect.top) * (canvas.height / rect.height),
    }
  }

  const handleMouseDown = useCallback(
    (e: MouseEvent | TouchEvent) => {
      const button = 'button' in e ? e.button : 0
      const p = clientPoint(e)

      // Select-drag and middle-drag both pan, whatever tool is active.
      if (tool === 'select' || button === 1) {
        if (button === 1) e.preventDefault()
        panStart.current = { x: p.x, y: p.y, ox: panRef.current.x, oy: panRef.current.y }
        panMoved.current = false
        setPanning(true)
        return
      }
      // Left paints the primary colour, right the secondary one.
      if (button !== 0 && button !== 2) return
      const paint = button === 2 ? altColor : color

      if (tool === 'fill') {
        const canvas = canvasRef.current
        const ctx = canvas?.getContext('2d')
        if (!canvas || !ctx) return
        const pos = getCanvasPos(e, canvas)
        if (!floodFill(ctx, pos.x, pos.y, paint)) return
        socketRef.current?.emit('canvas_fill', {
          kind: 'fill',
          x: pos.x,
          y: pos.y,
          color: paint,
          strokeId: newStrokeId(),
        })
        return
      }

      if (tool === 'pin') {
        const surface = surfaceRef.current
        if (!surface) return
        const rect = surface.getBoundingClientRect()
        setPendingPin({
          xPct: ((p.x - rect.left) / rect.width) * 100,
          yPct: ((p.y - rect.top) / rect.height) * 100,
        })
        setPinText('')
        return
      }

      const canvas = canvasRef.current
      if (!canvas) return
      isDrawing.current = true
      didDraw.current = false
      strokeColor.current = paint
      strokeId.current = newStrokeId()
      lastPos.current = getCanvasPos(e, canvas)
    },
    [tool, color, altColor]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (panStart.current) {
        const p = clientPoint(e)
        const dx = p.x - panStart.current.x
        const dy = p.y - panStart.current.y
        if (Math.abs(dx) > CLICK_SLOP || Math.abs(dy) > CLICK_SLOP) panMoved.current = true
        applyPan(panStart.current.ox + dx, panStart.current.oy + dy)
        return
      }
      if (!isDrawing.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      const pos = getCanvasPos(e, canvas)
      const seg: DrawSegment = {
        x1: lastPos.current.x,
        y1: lastPos.current.y,
        x2: pos.x,
        y2: pos.y,
        color: strokeColor.current,
        size,
        tool,
        strokeId: strokeId.current,
      }
      applyOp(ctx, seg)
      socketRef.current?.emit('canvas_draw', seg)
      didDraw.current = true
      lastPos.current = pos

      // Cursors ride along with the strokes, so they only ever show up for
      // someone actively drawing — no idle pointers cluttering the canvas.
      const now = performance.now()
      if (now - lastCursorEmit.current >= CURSOR_EMIT_MS) {
        lastCursorEmit.current = now
        socketRef.current?.emit('canvas_cursor', {
          xPct: (pos.x / SURFACE_W) * 100,
          yPct: (pos.y / SURFACE_H) * 100,
        })
      }
    },
    [applyPan, size, tool]
  )

  const handleMouseUp = useCallback(() => {
    if (panStart.current) {
      panStart.current = null
      setPanning(false)
      // A press that never travelled is a click on empty space, which
      // dismisses whatever comment is open.
      if (!panMoved.current) setActivePin(null)
      return
    }
    if (!isDrawing.current) return
    isDrawing.current = false
    if (didDraw.current) socketRef.current?.emit('canvas_cursor_end')
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // The gesture starts on the canvas, but move/up live on the window so that
    // overlays sitting above it (pin markers, bubbles) can't break a line the
    // pointer happens to travel across.
    canvas.addEventListener('mousedown', handleMouseDown as EventListener)
    canvas.addEventListener('touchstart', handleMouseDown as EventListener, { passive: true })
    window.addEventListener('mousemove', handleMouseMove as EventListener)
    window.addEventListener('mouseup', handleMouseUp)
    window.addEventListener('touchmove', handleMouseMove as EventListener, { passive: true })
    window.addEventListener('touchend', handleMouseUp)
    window.addEventListener('touchcancel', handleMouseUp)
    window.addEventListener('blur', handleMouseUp)
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown as EventListener)
      canvas.removeEventListener('touchstart', handleMouseDown as EventListener)
      window.removeEventListener('mousemove', handleMouseMove as EventListener)
      window.removeEventListener('mouseup', handleMouseUp)
      window.removeEventListener('touchmove', handleMouseMove as EventListener)
      window.removeEventListener('touchend', handleMouseUp)
      window.removeEventListener('touchcancel', handleMouseUp)
      window.removeEventListener('blur', handleMouseUp)
    }
  }, [handleMouseDown, handleMouseMove, handleMouseUp])

  // Shortcuts. Every one of them stands down while the caret is in a text
  // field, so typing "problem" in chat never swaps your tool.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return
      const key = e.key.toLowerCase()

      if ((e.ctrlKey || e.metaKey) && key === 'z') {
        e.preventDefault()
        socketRef.current?.emit(e.shiftKey ? 'canvas_redo' : 'canvas_undo')
        return
      }
      if ((e.ctrlKey || e.metaKey) && key === 'y') {
        e.preventDefault()
        socketRef.current?.emit('canvas_redo')
        return
      }

      if (e.ctrlKey || e.metaKey || e.altKey) return

      const toolKeys: Record<string, Tool> = { p: 'pen', e: 'eraser', f: 'fill', v: 'select' }
      if (toolKeys[key]) {
        e.preventDefault()
        setTool(toolKeys[key])
        return
      }
      if (key === 'm') {
        e.preventDefault()
        toggleChat()
        return
      }
      if (key === '?' || key === '/') {
        e.preventDefault()
        setInfoOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [toggleChat])

  useEffect(() => {
    if (chatOpen) chatInputRef.current?.focus()
  }, [chatOpen])

  // A safety net for cursors whose owner went quiet without a clean end.
  useEffect(() => {
    const timer = setInterval(() => {
      setCursors((prev) => {
        const cutoff = Date.now() - CURSOR_STALE_MS
        const live = Object.entries(prev).filter(([, c]) => c.t > cutoff)
        if (live.length === Object.keys(prev).length) return prev
        return Object.fromEntries(live)
      })
    }, 500)
    return () => clearInterval(timer)
  }, [])

  // The toolbar drops in once the canvas is up.
  useEffect(() => {
    if (full !== null || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        toolbarRef.current,
        { y: -70, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.6, ease: 'back.out(1.5)', clearProps: 'opacity,transform' }
      )
    }, toolbarRef)
    return () => ctx.revert()
  }, [full])

  const submitPin = () => {
    if (!pendingPin || !pinText.trim()) return
    socketRef.current?.emit('canvas_pin', { ...pendingPin, text: pinText.trim() })
    setPendingPin(null)
    setPinText('')
  }

  const sendChat = () => {
    const t = chatText.trim()
    if (!t) return
    socketRef.current?.emit('canvas_chat', { text: t })
    setChatText('')
  }

  useEffect(() => {
    if (full === null || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        fullCardRef.current,
        { y: 20, scale: 0.95, opacity: 0 },
        { y: 0, scale: 1, opacity: 1, duration: 0.5, ease: 'power3.out', clearProps: 'opacity,transform' }
      )
    }, fullCardRef)
    return () => ctx.revert()
  }, [full])

  if (full !== null) {
    return (
      <div className="welcome-page">
        <div className="welcome-card canvas-full-card" ref={fullCardRef}>
          <div className="welcome-logo">
            <InkMark size={64} />
            <span className="logo-ink">Ink</span>
            <span className="logo-sync">Sync</span>
          </div>
          <p className="welcome-sub">
            {isPrivate ? `canvas ${canvasId} is full` : 'the live canvas is full'}
          </p>
          <p className="canvas-full-text">
            All {full} spots are taken right now. Hang back a moment and try again, or
            {isPrivate ? ' start a canvas of your own' : ' make a private canvas instead'}.
          </p>
          <button className="join-btn" onClick={onLeave} style={{ borderColor: user.color, color: user.color }}>
            Back
          </button>
        </div>
      </div>
    )
  }

  return (
    <div
      className={`collab-root ${tool === 'select' ? 'selecting' : ''} ${
        panning ? 'panning' : ''
      }`}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div
        className="collab-surface"
        ref={surfaceRef}
        style={{
          width: SURFACE_W,
          height: SURFACE_H,
          transform: `translate3d(${pan.x}px, ${pan.y}px, 0)`,
        }}
      >
        <canvas
          ref={canvasRef}
          width={SURFACE_W}
          height={SURFACE_H}
          className="collab-canvas"
          style={{ cursor: panning ? 'grabbing' : CURSORS[tool] }}
        />

        {/* Pin markers — inside the surface, so they pan with the drawing */}
        {pins.map((pin) => (
          <PinMarker
            key={pin.id}
            pin={pin}
            open={activePin === pin.id}
            onToggle={() => setActivePin(activePin === pin.id ? null : pin.id)}
          />
        ))}

        {/* Live cursors — present only while their owner is drawing */}
        {Object.entries(cursors).map(([id, c]) => (
          <div
            key={id}
            className="remote-cursor"
            style={{ left: `${c.xPct}%`, top: `${c.yPct}%`, color: c.user.color }}
          >
            <CursorIcon size={18} />
            <span className="remote-cursor-name" style={{ background: c.user.color }}>
              {c.user.username}
            </span>
          </div>
        ))}

        {/* Pending pin input */}
        {pendingPin && (
          <div
            className="pin-input-card"
            style={{ left: `${pendingPin.xPct}%`, top: `${pendingPin.yPct}%` }}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              value={pinText}
              onChange={(e) => setPinText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitPin()
                if (e.key === 'Escape') setPendingPin(null)
              }}
              placeholder="Add a comment..."
              className="pin-text-input"
              autoFocus
            />
            <div className="pin-input-row">
              <button className="pin-confirm-btn" onClick={submitPin} disabled={!pinText.trim()}>
                Pin
              </button>
              <button className="pin-cancel-btn" onClick={() => setPendingPin(null)}>
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      <BrushHint
        hint={hint}
        width={tool === 'eraser' ? size * 5 : size}
        label={size}
        color={tool === 'eraser' ? '#8395a7' : color}
      />

      {/* Unread chat, only while the panel is closed */}
      {!chatOpen && toasts.length > 0 && (
        <div className="collab-toasts">
          {toasts.map((msg) => (
            <Toast
              key={msg.id}
              msg={msg}
              onOpen={() => showChat(true)}
              onExpire={expireToast}
            />
          ))}
        </div>
      )}

      {/* Floating toolbar */}
      <div className="collab-toolbar" ref={toolbarRef}>
        <button className="collab-ctrl-btn" onClick={onLeave} title="Back">
          ←
        </button>
        <InkMark size={34} />
        <span className="collab-logo">InkSync</span>
        {isPrivate && <span className="collab-code">/ {canvasId}</span>}

        <div className="collab-sep" />

        {TOOLS.map((t) => (
          <button
            key={t.id}
            className={`collab-tool-btn ${tool === t.id ? 'active' : ''}`}
            onClick={() => setTool(t.id)}
            title={t.key ? `${t.name} (${t.key})` : t.name}
          >
            {t.icon}
          </button>
        ))}

        <button
          className={`collab-ctrl-btn ${infoOpen ? 'hi' : ''}`}
          onClick={() => setInfoOpen((o) => !o)}
          title="Tools & shortcuts (?)"
        >
          <InfoIcon />
        </button>

        <div className="collab-sep" />

        <button
          className="collab-duo"
          onClick={() => {
            setColor(altColor)
            setAltColor(color)
          }}
          title="Left draws the front colour, right-drag draws the back one — click to swap"
        >
          <span className="collab-duo-alt" style={{ background: altColor }} />
          <span className="collab-duo-main" style={{ background: color }} />
        </button>

        <div className="collab-swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`collab-swatch ${c === color ? 'sel' : ''} ${
                c === altColor ? 'alt' : ''
              }`}
              style={{ background: c }}
              title={`${c} — right-click to set as the second colour`}
              onContextMenu={(e) => {
                e.preventDefault()
                setAltColor(c)
              }}
              onClick={() => {
                setColor(c)
                if (tool !== 'pen' && tool !== 'eraser' && tool !== 'fill') setTool('pen')
              }}
            />
          ))}
        </div>

        <div className="collab-sep" />

        <div className="collab-size-row">
          <div
            className="collab-size-dot"
            style={{
              width: Math.max(size * 0.8, 3),
              height: Math.max(size * 0.8, 3),
              background: tool === 'eraser' ? '#888' : color,
              boxShadow: `0 0 0 2px ${altColor}44`,
            }}
          />
          <input
            type="range"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="collab-size-slider"
          />
        </div>

        <div className="collab-sep" />

        <span className="collab-online">
          {userCount}
          {capacity ? `/${capacity}` : ''} online
        </span>

        <button
          className={`collab-ctrl-btn ${chatOpen ? 'hi' : ''}`}
          onClick={toggleChat}
          title="Toggle chat (M)"
        >
          ✦
          {unread > 0 && !chatOpen && (
            <span className="collab-unread">{unread > 9 ? '9+' : unread}</span>
          )}
        </button>
      </div>

      <InfoPanel open={infoOpen} onClose={() => setInfoOpen(false)} tools={TOOLS} />

      {/* Floating chat panel */}
      <div className={`collab-chat ${chatOpen ? 'open' : ''}`}>
        <div className="collab-chat-head">
          <span>Chat</span>
          <kbd className="collab-kbd">M</kbd>
          <span className="collab-chat-user" style={{ color: user.color }}>
            {user.username}
          </span>
          <button onClick={() => showChat(false)}>×</button>
        </div>
        <ChatFeed messages={messages} currentUser={user} />
        <div className="text-bar collab-chat-bar">
          <input
            ref={chatInputRef}
            className="text-input"
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') sendChat()
              if (e.key === 'Escape') {
                e.currentTarget.blur()
                showChat(false)
              }
            }}
            placeholder="Say something..."
          />
          <button className="text-send-btn" onClick={sendChat}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
