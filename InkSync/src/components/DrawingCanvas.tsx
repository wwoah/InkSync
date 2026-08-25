import { useRef, useEffect, useState, useCallback } from 'react'
import { BrushHint } from './BrushHint'
import { CursorIcon } from './icons'
import { useBrushSize } from '../hooks/useBrushSize'

interface Props {
  onSendDrawing: (dataUrl: string) => void
}

type Tool = 'select' | 'pen' | 'eraser'

const COLORS = [
  '#111111', '#ff4757', '#ff6b2b', '#ffd32a',
  '#2ed573', '#1e90ff', '#a55eea', '#ff6eb4',
  '#ffffff', '#8395a7',
]

const MIN_SIZE = 1
const MAX_SIZE = 24

export function DrawingCanvas({ onSendDrawing }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#111111')
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

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
      if ('button' in e && e.button !== 0) return
      const canvas = canvasRef.current
      if (!canvas) return
      isDrawing.current = true
      lastPos.current = getPos(e, canvas)
    },
    [tool]
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
      ctx.strokeStyle = tool === 'eraser' ? '#ffffff' : color
      ctx.lineWidth = tool === 'eraser' ? size * 5 : size
      ctx.lineCap = 'round'
      ctx.lineJoin = 'round'
      ctx.stroke()
      lastPos.current = pos
    },
    [tool, color, size]
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

  const clearCanvas = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }

  const handleSend = () => {
    const canvas = canvasRef.current
    if (!canvas) return
    onSendDrawing(canvas.toDataURL('image/png'))
    clearCanvas()
  }

  return (
    <div className="drawing-canvas-root">
      <div className="canvas-area">
        <canvas
          ref={canvasRef}
          width={1400}
          height={560}
          className="drawing-canvas"
          style={{ cursor: tool === 'select' ? 'default' : 'crosshair' }}
        />
      </div>

      <BrushHint
        hint={hint}
        width={tool === 'eraser' ? size * 5 : size}
        label={size}
        color={tool === 'eraser' ? '#8395a7' : color}
      />

      <div className="toolbar">
        <div className="toolbar-tools">
          <button
            className={`tool-btn ${tool === 'select' ? 'active' : ''}`}
            onClick={() => setTool('select')}
            title="Select — pointer only, no drawing"
          >
            <CursorIcon size={14} />
          </button>
          <button
            className={`tool-btn ${tool === 'pen' ? 'active' : ''}`}
            onClick={() => setTool('pen')}
            title="Pen"
          >
            ✏
          </button>
          <button
            className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`}
            onClick={() => setTool('eraser')}
            title="Eraser"
          >
            ◻
          </button>
        </div>

        <div className="toolbar-divider" />

        <div className="color-swatches">
          {COLORS.map((c) => (
            <button
              key={c}
              className={`swatch ${c === color ? 'selected' : ''}`}
              style={{ background: c }}
              onClick={() => {
                setColor(c)
                if (tool !== 'pen' && tool !== 'eraser') setTool('pen')
              }}
              title={c}
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

        <button className="clear-btn" onClick={clearCanvas}>
          Clear
        </button>
        <button className="send-drawing-btn" onClick={handleSend}>
          Send Drawing →
        </button>
      </div>
    </div>
  )
}
