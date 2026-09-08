import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef, useState } from 'react'
import { CursorIcon, FillIcon } from './icons'
import { floodFill } from '../lib/fill'
import { isTypingTarget } from '../lib/keys'

export interface GameOp {
  kind?: 'fill'
  x1?: number
  y1?: number
  x2?: number
  y2?: number
  x?: number
  y?: number
  color: string
  size?: number
  tool?: string
}

export interface GameCanvasHandle {
  apply: (op: GameOp) => void
  replay: (ops: GameOp[]) => void
  clear: () => void
}

interface Props {
  /** Only the drawer may mark the canvas; everyone else just watches. */
  canDraw: boolean
  onOp: (op: GameOp) => void
  onClear: () => void
}

const W = 1200
const H = 800

const COLORS = [
  '#111111', '#ffffff', '#ff4757', '#ff6b2b', '#ffd32a',
  '#2ed573', '#1e90ff', '#a55eea', '#ff6eb4', '#8395a7',
]

const SIZES = [4, 10, 20, 34]

type Tool = 'pen' | 'eraser' | 'fill'

/**
 * The shared drawing surface for a turn. Deliberately simpler than the collab
 * canvas — no panning, pins or bakes — because a turn lasts eighty seconds and
 * starts from blank every time.
 */
export const GameCanvas = forwardRef<GameCanvasHandle, Props>(function GameCanvas(
  { canDraw, onOp, onClear },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const last = useRef({ x: 0, y: 0 })
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState(COLORS[0])
  const [size, setSize] = useState(SIZES[1])

  const ctxOf = () => canvasRef.current?.getContext('2d') ?? null

  const paint = useCallback((op: GameOp) => {
    const ctx = ctxOf()
    if (!ctx) return
    if (op.kind === 'fill') {
      floodFill(ctx, op.x ?? 0, op.y ?? 0, op.color)
      return
    }
    ctx.beginPath()
    ctx.moveTo(op.x1 ?? 0, op.y1 ?? 0)
    ctx.lineTo(op.x2 ?? 0, op.y2 ?? 0)
    ctx.strokeStyle = op.tool === 'eraser' ? '#ffffff' : op.color
    ctx.lineWidth = op.tool === 'eraser' ? (op.size ?? 10) * 3 : op.size ?? 10
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  }, [])

  const wipe = useCallback(() => {
    const ctx = ctxOf()
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, W, H)
  }, [])

  useEffect(wipe, [wipe])

  useImperativeHandle(
    ref,
    () => ({
      apply: paint,
      replay: (ops) => {
        wipe()
        ops.forEach(paint)
      },
      clear: wipe,
    }),
    [paint, wipe]
  )

  const posOf = (e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const r = canvas.getBoundingClientRect()
    const p = 'touches' in e ? (e.touches[0] ?? e.changedTouches[0]) : e
    return {
      x: ((p?.clientX ?? 0) - r.left) * (W / r.width),
      y: ((p?.clientY ?? 0) - r.top) * (H / r.height),
    }
  }

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const down = (e: MouseEvent | TouchEvent) => {
      if (!canDraw) return
      if ('button' in e && e.button !== 0) return
      const pos = posOf(e)

      if (tool === 'fill') {
        const ctx = ctxOf()
        if (!ctx || !floodFill(ctx, pos.x, pos.y, color)) return
        onOp({ kind: 'fill', x: pos.x, y: pos.y, color })
        return
      }
      drawing.current = true
      last.current = pos
    }

    const move = (e: MouseEvent | TouchEvent) => {
      if (!drawing.current || !canDraw) return
      const pos = posOf(e)
      const op: GameOp = {
        x1: last.current.x,
        y1: last.current.y,
        x2: pos.x,
        y2: pos.y,
        color,
        size,
        tool,
      }
      paint(op)
      onOp(op)
      last.current = pos
    }

    const up = () => {
      drawing.current = false
    }

    canvas.addEventListener('mousedown', down as EventListener)
    canvas.addEventListener('touchstart', down as EventListener, { passive: true })
    window.addEventListener('mousemove', move as EventListener)
    window.addEventListener('mouseup', up)
    window.addEventListener('touchmove', move as EventListener, { passive: true })
    window.addEventListener('touchend', up)
    window.addEventListener('blur', up)
    return () => {
      canvas.removeEventListener('mousedown', down as EventListener)
      canvas.removeEventListener('touchstart', down as EventListener)
      window.removeEventListener('mousemove', move as EventListener)
      window.removeEventListener('mouseup', up)
      window.removeEventListener('touchmove', move as EventListener)
      window.removeEventListener('touchend', up)
      window.removeEventListener('blur', up)
    }
  }, [canDraw, color, size, tool, onOp, paint])

  // Tool shortcuts, but only for whoever is actually drawing.
  useEffect(() => {
    if (!canDraw) return
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e) || e.ctrlKey || e.metaKey || e.altKey) return
      const keys: Record<string, Tool> = { p: 'pen', e: 'eraser', f: 'fill' }
      const t = keys[e.key.toLowerCase()]
      if (t) {
        e.preventDefault()
        setTool(t)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [canDraw])

  return (
    <div className="game-canvas-wrap">
      <canvas
        ref={canvasRef}
        width={W}
        height={H}
        className="game-canvas"
        style={{ cursor: canDraw ? 'crosshair' : 'default' }}
      />

      {canDraw && (
        <div className="game-tools">
          <div className="game-tool-group">
            {(
              [
                ['pen', '✏', 'Pen (P)'],
                ['eraser', '◻', 'Eraser (E)'],
                ['fill', <FillIcon key="f" size={14} />, 'Fill (F)'],
              ] as [Tool, React.ReactNode, string][]
            ).map(([id, icon, title]) => (
              <button
                key={id}
                className={`tool-btn ${tool === id ? 'active' : ''}`}
                onClick={() => setTool(id)}
                title={title}
              >
                {icon}
              </button>
            ))}
          </div>

          <div className="game-swatches">
            {COLORS.map((c) => (
              <button
                key={c}
                className={`swatch ${c === color ? 'selected' : ''}`}
                style={{ background: c }}
                onClick={() => {
                  setColor(c)
                  if (tool === 'eraser') setTool('pen')
                }}
                title={c}
              />
            ))}
          </div>

          <div className="game-sizes">
            {SIZES.map((s) => (
              <button
                key={s}
                className={`game-size ${s === size ? 'active' : ''}`}
                onClick={() => setSize(s)}
                title={`${s}px`}
              >
                <span style={{ width: s / 1.6, height: s / 1.6 }} />
              </button>
            ))}
          </div>

          <button className="clear-btn" onClick={onClear} title="Clear the canvas">
            Clear
          </button>
        </div>
      )}

      {!canDraw && (
        <div className="game-watching">
          <CursorIcon size={12} /> watching
        </div>
      )}
    </div>
  )
})
