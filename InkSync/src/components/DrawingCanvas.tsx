import { useRef, useEffect, useState, useCallback } from 'react'
import { BrushHint } from './BrushHint'
import { CursorIcon, FillIcon, InfoIcon } from './icons'
import { InfoPanel } from './InfoPanel'
import type { ReactNode } from 'react'
import { useBrushSize } from '../hooks/useBrushSize'
import { floodFill } from '../lib/fill'
import { isTypingTarget } from '../lib/keys'

interface Props {
  onSendDrawing: (dataUrl: string) => void
}

type Tool = 'select' | 'pen' | 'eraser' | 'fill'

const COLORS = [
  '#111111', '#ff4757', '#ff6b2b', '#ffd32a',
  '#2ed573', '#1e90ff', '#a55eea', '#ff6eb4',
  '#ffffff', '#8395a7',
]

const MIN_SIZE = 1
const MAX_SIZE = 24
const DEFAULT_ALT_COLOR = '#ffffff'

const TOOLS: { id: Tool; icon: ReactNode; name: string; key: string; hint: string }[] = [
  {
    id: 'select',
    icon: <CursorIcon size={14} />,
    name: 'Select',
    key: 'V',
    hint: 'Pointer only — nothing you do on the canvas leaves a mark.',
  },
  { id: 'pen', icon: '✏', name: 'Pen', key: 'P', hint: 'Freehand strokes in the colour in hand.' },
  {
    id: 'eraser',
    icon: '◻',
    name: 'Eraser',
    key: 'E',
    hint: 'Paints the canvas back to white, five times the brush width.',
  },
  {
    id: 'fill',
    icon: <FillIcon size={14} />,
    name: 'Fill',
    key: 'F',
    hint: 'Floods the area you click, bleeding slightly into soft stroke edges.',
  },
]
/** This canvas is small, so undo can just keep whole snapshots. */
const HISTORY_LIMIT = 30

export function DrawingCanvas({ onSendDrawing }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#111111')
  const [altColor, setAltColor] = useState(DEFAULT_ALT_COLOR)
  const [infoOpen, setInfoOpen] = useState(false)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })
  const strokeColor = useRef('#111111')
  const undoStack = useRef<ImageData[]>([])
  const redoStack = useRef<ImageData[]>([])

  const { size, setSize, hint } = useBrushSize({
    initial: 5,
    min: MIN_SIZE,
    max: MAX_SIZE,
    enabled: tool === 'pen' || tool === 'eraser',
    canvasRef,
  })

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [])

  /** Called before any change, so the previous state can be restored. */
  const pushHistory = useCallback(() => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    undoStack.current.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
    if (undoStack.current.length > HISTORY_LIMIT) undoStack.current.shift()
    redoStack.current.length = 0
  }, [])

  const step = useCallback((from: ImageData[], to: ImageData[]) => {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    const prev = from.pop()
    if (!prev) return
    to.push(ctx.getImageData(0, 0, canvas.width, canvas.height))
    ctx.putImageData(prev, 0, 0)
  }, [])

  const getPos = (e: MouseEvent | TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    if ('touches' in e) {
      const touch = e.touches[0]
      return {
        x: (touch.clientX - rect.left) * scaleX,
        y: (touch.clientY - rect.top) * scaleY,
      }
    }
    return {
      x: ((e as MouseEvent).clientX - rect.left) * scaleX,
      y: ((e as MouseEvent).clientY - rect.top) * scaleY,
    }
  }

  const startDraw = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (tool === 'select') return
      const button = 'button' in e ? e.button : 0
      if (button !== 0 && button !== 2) return
      const canvas = canvasRef.current
      if (!canvas) return
      const paint = button === 2 ? altColor : color

      if (tool === 'fill') {
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        const pos = getPos(e, canvas)
        pushHistory()
        if (!floodFill(ctx, pos.x, pos.y, paint)) undoStack.current.pop()
        return
      }

      pushHistory()
      isDrawing.current = true
      strokeColor.current = paint
      lastPos.current = getPos(e, canvas)
    },
    [tool, color, altColor, pushHistory]
  )

  const draw = useCallback(
    (e: MouseEvent | TouchEvent) => {
      if (!isDrawing.current) return
      const canvas = canvasRef.current
      if (!canvas) return
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const pos = getPos(e, canvas)
      ctx.beginPath()
      ctx.moveTo(lastPos.current.x, lastPos.current.y)
      ctx.lineTo(pos.x, pos.y)
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : strokeColor.current
      ctx.lineWidth = tool === 'eraser' ? size * 5 : size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
      lastPos.current = pos
    },
    [tool, size]
  )

  const stopDraw = useCallback(() => {
    isDrawing.current = false
  }, [])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    // The stroke starts on the canvas, but move/up live on the window so that
    // drifting off the canvas mid-stroke doesn't cut the line short.
    canvas.addEventListener('mousedown', startDraw as EventListener)
    canvas.addEventListener('touchstart', startDraw as EventListener, { passive: true })
    window.addEventListener('mousemove', draw as EventListener)
    window.addEventListener('mouseup', stopDraw)
    window.addEventListener('touchmove', draw as EventListener, { passive: true })
    window.addEventListener('touchend', stopDraw)
    window.addEventListener('touchcancel', stopDraw)
    window.addEventListener('blur', stopDraw)

    return () => {
      canvas.removeEventListener('mousedown', startDraw as EventListener)
      canvas.removeEventListener('touchstart', startDraw as EventListener)
      window.removeEventListener('mousemove', draw as EventListener)
      window.removeEventListener('mouseup', stopDraw)
      window.removeEventListener('touchmove', draw as EventListener)
      window.removeEventListener('touchend', stopDraw)
      window.removeEventListener('touchcancel', stopDraw)
      window.removeEventListener('blur', stopDraw)
    }
  }, [startDraw, draw, stopDraw])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e)) return
      const key = e.key.toLowerCase()
      if ((e.ctrlKey || e.metaKey) && (key === 'z' || key === 'y')) {
        e.preventDefault()
        const redo = key === 'y' || e.shiftKey
        step(redo ? redoStack.current : undoStack.current,
             redo ? undoStack.current : redoStack.current)
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const toolKeys: Record<string, Tool> = { p: 'pen', e: 'eraser', f: 'fill', v: 'select' }
      if (toolKeys[key]) {
        e.preventDefault()
        setTool(toolKeys[key])
        return
      }
      if (key === '?' || key === '/') {
        e.preventDefault()
        setInfoOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [step])

  const clearCanvas = (recordHistory = true) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    if (recordHistory) pushHistory()
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const handleSend = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    onSendDrawing(canvas.toDataURL('image/png'))
    clearCanvas()
    redoStack.current.length = 0
  }

  return (
    <div className="drawing-canvas-root" onContextMenu={(e) => e.preventDefault()}>
      <div className="canvas-area">
        <canvas
          ref={canvasRef}
          width={1400}
          height={560}
          className="drawing-canvas"
          style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
        />
      </div>

      <InfoPanel open={infoOpen} onClose={() => setInfoOpen(false)} tools={TOOLS} full={false} />

      <BrushHint
        hint={hint}
        width={tool === 'eraser' ? size * 5 : size}
        label={size}
        color={tool === 'eraser' ? '#8395a7' : color}
      />

      <div className="toolbar">
        <div className="toolbar-tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              className={`tool-btn ${tool === t.id ? 'active' : ''}`}
              onClick={() => setTool(t.id)}
              title={`${t.name} (${t.key})`}
            >
              {t.icon}
            </button>
          ))}
          <button
            className={`tool-btn ${infoOpen ? 'active' : ''}`}
            onClick={() => setInfoOpen((o) => !o)}
            title="Tools & shortcuts (?)"
          >
            <InfoIcon size={14} />
          </button>
        </div>

        <div className="toolbar-divider" />

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

        <div className="color-swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch ${c === color ? 'selected' : ''} ${
                c === altColor ? 'alt' : ''
              }`}
              style={{ background: c }}
              onContextMenu={(e) => {
                e.preventDefault()
                setAltColor(c)
              }}
              onClick={() => {
                setColor(c)
                if (tool !== 'pen' && tool !== 'eraser' && tool !== 'fill') setTool('pen')
              }}
              title={`${c} — right-click to set as the second colour`}
            />
          ))}
        </div>

        <div className="toolbar-divider" />

        <div className="size-control">
          <div
            className="size-preview"
            style={{
              width: Math.max(size, 3),
              height: Math.max(size, 3),
              background: tool === 'eraser' ? '#ccc' : color,
            }}
          />
          <input
            type="range"
            min={MIN_SIZE}
            max={MAX_SIZE}
            value={size}
            onChange={(e) => setSize(Number(e.target.value))}
            className="size-slider"
          />
        </div>

        <div className="toolbar-spacer" />

        <button
          className="clear-btn"
          onClick={() => step(undoStack.current, redoStack.current)}
          title="Undo (Ctrl+Z)"
        >
          ↶
        </button>
        <button
          className="clear-btn"
          onClick={() => step(redoStack.current, undoStack.current)}
          title="Redo (Ctrl+Shift+Z)"
        >
          ↷
        </button>
        <button className="clear-btn" onClick={() => clearCanvas()}>
          Clear
        </button>
        <button className="send-drawing-btn" onClick={handleSend}>
          Send Drawing →
        </button>
      </div>
    </div>
  )
}
