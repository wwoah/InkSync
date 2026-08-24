import { useRef, useEffect, useState, useCallback } from 'react'

interface Props {
  onSendDrawing: (dataUrl: string) => void
}

type Tool = 'pen' | 'eraser'

const COLORS = [
  '#111111', '#ff4757', '#ff6b2b', '#ffd32a',
  '#2ed573', '#1e90ff', '#a55eea', '#ff6eb4',
  '#ffffff', '#8395a7',
]

export function DrawingCanvas({ onSendDrawing }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [tool, setTool] = useState<Tool>('pen')
  const [color, setColor] = useState('#111111')
  const [size, setSize] = useState(5)
  const isDrawing = useRef(false)
  const lastPos = useRef({ x: 0, y: 0 })

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

  const startDraw = useCallback((e: MouseEvent | TouchEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    isDrawing.current = true
    lastPos.current = getPos(e, canvas)
  }, [])

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

    canvas.addEventListener('mousedown', startDraw)
    canvas.addEventListener('mousemove', draw)
    canvas.addEventListener('mouseup', stopDraw)
    canvas.addEventListener('mouseleave', stopDraw)
    canvas.addEventListener('touchstart', startDraw, { passive: true })
    canvas.addEventListener('touchmove', draw, { passive: true })
    canvas.addEventListener('touchend', stopDraw)

    return () => {
      canvas.removeEventListener('mousedown', startDraw)
      canvas.removeEventListener('mousemove', draw)
      canvas.removeEventListener('mouseup', stopDraw)
      canvas.removeEventListener('mouseleave', stopDraw)
      canvas.removeEventListener('touchstart', startDraw)
      canvas.removeEventListener('touchmove', draw)
      canvas.removeEventListener('touchend', stopDraw)
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
        />
      </div>

      <div className="toolbar">
        <div className="toolbar-tools">
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
                setTool('pen')
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
            min={1}
            max={24}
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
