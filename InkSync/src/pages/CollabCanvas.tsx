import { useCallback, useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { ChatFeed } from '../components/ChatFeed'
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
}

type Tool = 'pen' | 'eraser' | 'pin'

const COLORS = [
  '#111111', '#ff4757', '#ff6b2b', '#ffd32a',
  '#2ed573', '#1e90ff', '#a55eea', '#ff6eb4',
  '#ffffff', '#8395a7',
]

interface Props {
  user: User
  onLeave: () => void
}

export function CollabCanvas({ user, onLeave }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const socketRef = useRef<Socket | null>(null)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(user.color)
  const [size, setSize] = useState(5)
  const [messages, setMessages] = useState<Message[]>([])
  const [pins, setPins] = useState<Pin[]>([])
  const [userCount, setUserCount] = useState(0)
  const [chatOpen, setChatOpen] = useState(true)
  const [chatText, setChatText] = useState('')
  const [pendingPin, setPendingPin] = useState<{ xPct: number; yPct: number } | null>(null)
  const [pinText, setPinText] = useState('')
  const [activePin, setActivePin] = useState<string | null>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  function applySegment(ctx: CanvasRenderingContext2D, seg: DrawSegment) {
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
    const socket = io('http://localhost:3001')
    socketRef.current = socket

    socket.on('connect', () => socket.emit('join_canvas', user))

    socket.on('canvas_init', ({ dataUrl, messages: msgs, pins: initPins }) => {
      if (dataUrl) {
        const canvas = canvasRef.current
        if (!canvas) return
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const img = new Image()
        img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
        img.src = dataUrl
      }
      setMessages(msgs ?? [])
      setPins(initPins ?? [])
    })

    socket.on('canvas_draw', (seg: DrawSegment) => {
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return
      applySegment(ctx, seg)
    })

    socket.on('canvas_pin', (pin: Pin) => setPins((p) => [...p, pin]))

    socket.on('canvas_message', (msg: Message) =>
      setMessages((prev) => [...prev, msg])
    )

    socket.on('canvas_user_count', (n: number) => setUserCount(n))

    return () => socket.disconnect()
  }, [user])

  const getCanvasPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const sx = canvas.width / rect.width
    const sy = canvas.height / rect.height
    if ('touches' in e) {
      const t = e.touches[0]
      return { x: (t.clientX - rect.left) * sx, y: (t.clientY - rect.top) * sy }
    }
    return {
      x: ((e as MouseEvent).clientX - rect.left) * sx,
      y: ((e as MouseEvent).clientY - rect.top) * sy,
    }
  }

  const handleMouseDown = useCallback(
    (e: MouseEvent) => {
      if (tool === 'pin') {
        const container = containerRef.current
        if (!container) return
        const rect = container.getBoundingClientRect()
        setPendingPin({
          xPct: ((e.clientX - rect.left) / rect.width) * 100,
          yPct: ((e.clientY - rect.top) / rect.height) * 100,
        })
        setPinText('')
        return
      }
      const canvas = canvasRef.current
      if (!canvas) return
      isDrawing.current = true
      lastPos.current = getCanvasPos(e, canvas)
    },
    [tool]
  )

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
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
        color,
        size,
        tool,
      }
      applySegment(ctx, seg)
      socketRef.current?.emit('canvas_draw', seg)
      lastPos.current = pos
    },
    [color, size, tool]
  )

  const handleMouseUp = useCallback(() => {
    if (!isDrawing.current) return
    isDrawing.current = false
    const canvas = canvasRef.current
    if (!canvas) return
    socketRef.current?.emit('canvas_save', {
      dataUrl: canvas.toDataURL('image/jpeg', 0.7),
    })
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    canvas.addEventListener('mousedown', handleMouseDown)
    canvas.addEventListener('mousemove', handleMouseMove)
    canvas.addEventListener('mouseup', handleMouseUp)
    canvas.addEventListener('mouseleave', handleMouseUp)
    canvas.addEventListener('touchstart', handleMouseDown as EventListener, { passive: true })
    canvas.addEventListener('touchmove', handleMouseMove as EventListener, { passive: true })
    canvas.addEventListener('touchend', handleMouseUp)
    return () => {
      canvas.removeEventListener('mousedown', handleMouseDown)
      canvas.removeEventListener('mousemove', handleMouseMove)
      canvas.removeEventListener('mouseup', handleMouseUp)
      canvas.removeEventListener('mouseleave', handleMouseUp)
      canvas.removeEventListener('touchstart', handleMouseDown as EventListener)
      canvas.removeEventListener('touchmove', handleMouseMove as EventListener)
      canvas.removeEventListener('touchend', handleMouseUp)
    }
  }, [handleMouseDown, handleMouseMove, handleMouseUp])

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

  return (
    <div className="collab-root" ref={containerRef}>
      <canvas
        ref={canvasRef}
        width={2560}
        height={1440}
        className="collab-canvas"
        style={{ cursor: tool === 'pin' ? 'cell' : 'crosshair' }}
      />

      {/* Pin markers */}
      {pins.map((pin) => (
        <div
          key={pin.id}
          className={`pin-marker ${activePin === pin.id ? 'open' : ''}`}
          style={{ left: `${pin.xPct}%`, top: `${pin.yPct}%` }}
          onClick={(e) => {
            e.stopPropagation()
            setActivePin(activePin === pin.id ? null : pin.id)
          }}
        >
          <div className="pin-dot" style={{ background: pin.user.color }} />
          {activePin === pin.id && (
            <div className="pin-bubble">
              <span className="pin-author" style={{ color: pin.user.color }}>
                {pin.user.username}
              </span>
              <p className="pin-text">{pin.text}</p>
            </div>
          )}
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

      {/* Floating toolbar */}
      <div className="collab-toolbar">
        <button className="collab-ctrl-btn" onClick={onLeave} title="Back">
          ←
        </button>
        <span className="collab-logo">InkSync</span>

        <div className="collab-sep" />

        {(['pen', 'eraser', 'pin'] as Tool[]).map((t) => (
          <button
            key={t}
            className={`collab-tool-btn ${tool === t ? 'active' : ''}`}
            onClick={() => setTool(t)}
            title={t}
          >
            {t === 'pen' ? '✏' : t === 'eraser' ? '⬜' : '◎'}
          </button>
        ))}

        <div className="collab-sep" />

        <div className="collab-swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`collab-swatch ${c === color ? 'sel' : ''}`}
              style={{ background: c }}
              onClick={() => { setColor(c); if (tool === 'pin') setTool('pen') }}
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
            }}
          />
          <input
            type="range"
            min={1}
            max={30}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="collab-size-slider"
          />
        </div>

        <div className="collab-sep" />

        <span className="collab-online">{userCount} online</span>

        <button
          className={`collab-ctrl-btn ${chatOpen ? 'hi' : ''}`}
          onClick={() => setChatOpen((o) => !o)}
          title="Toggle chat"
        >
          ✦
        </button>
      </div>

      {/* Chat panel */}
      <div className={`collab-chat ${chatOpen ? 'open' : ''}`}>
        <div className="collab-chat-head">
          <span>Chat</span>
          <span className="collab-chat-user" style={{ color: user.color }}>
            {user.username}
          </span>
          <button onClick={() => setChatOpen(false)}>×</button>
        </div>
        <ChatFeed messages={messages} currentUser={user} />
        <div className="text-bar collab-chat-bar">
          <input
            className="text-input"
            value={chatText}
            onChange={(e) => setChatText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendChat()}
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
