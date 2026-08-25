import { useCallback, useEffect, useRef, useState } from 'react'
import type { RefObject } from 'react'

export interface BrushHintState {
  x: number
  y: number
  /** Screen pixels per canvas pixel, so the preview matches the real stroke. */
  scale: number
}

/** Wheel distance that equals one size step — roughly one notch of a mouse wheel. */
const WHEEL_STEP = 50
/** How long the brush preview lingers after the last scroll. */
const HINT_MS = 900

interface Options {
  initial: number
  min: number
  max: number
  /** False while a non-drawing tool is active, so the page scrolls normally. */
  enabled: boolean
  canvasRef: RefObject<HTMLCanvasElement | null>
}

/**
 * Brush size with scroll-wheel control: scroll up to grow, down to shrink,
 * plus the transient preview state for showing it at the cursor.
 */
export function useBrushSize({ initial, min, max, enabled, canvasRef }: Options) {
  const [size, setSize] = useState(initial)
  const [hint, setHint] = useState<BrushHintState | null>(null)
  const acc = useRef(0)
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      if (!enabled) return
      if (e.ctrlKey) return // leave pinch/browser zoom alone
      e.preventDefault()

      // deltaY is reported in pixels, lines or pages depending on the device;
      // normalise to pixels so a wheel notch and a trackpad flick agree.
      const delta =
        e.deltaMode === 1 ? e.deltaY * 16
        : e.deltaMode === 2 ? e.deltaY * window.innerHeight
        : e.deltaY

      acc.current += delta
      const steps = Math.trunc(acc.current / WHEEL_STEP)
      if (steps !== 0) {
        acc.current -= steps * WHEEL_STEP
        // Scrolling up (negative delta) grows the brush.
        setSize((s) => Math.min(max, Math.max(min, s - steps)))
      }

      // The stroke width is in canvas pixels; the preview is drawn in screen
      // pixels, so carry the ratio between them.
      const canvas = canvasRef.current
      const rect = canvas?.getBoundingClientRect()
      const scale = canvas && rect ? rect.width / canvas.width : 1

      setHint({ x: e.clientX, y: e.clientY, scale })
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(() => setHint(null), HINT_MS)
    },
    [enabled, min, max, canvasRef]
  )

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    // Not passive: sizing the brush has to be able to swallow the scroll.
    canvas.addEventListener('wheel', handleWheel, { passive: false })
    return () => canvas.removeEventListener('wheel', handleWheel)
  }, [canvasRef, handleWheel])

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current)
    },
    []
  )

  return { size, setSize, hint }
}
