import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { prefersReducedMotion } from '../lib/motion'
import type { BrushHintState } from '../hooks/useBrushSize'

interface Props {
  hint: BrushHintState | null
  /** Stroke width in canvas pixels — already multiplied for the eraser. */
  width: number
  label: number
  color: string
}

/** A true-to-size ring at the cursor, shown while the wheel changes the size. */
export function BrushHint({ hint, width, label, color }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const visible = hint !== null

  useEffect(() => {
    if (!visible || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { scale: 0.6, opacity: 0 },
        { scale: 1, opacity: 1, duration: 0.22, ease: 'back.out(2)', clearProps: 'opacity,transform' }
      )
    }, ref)
    return () => ctx.revert()
  }, [visible])

  if (!hint) return null
  const d = Math.max(width * hint.scale, 4)
  return (
    <div
      ref={ref}
      className="brush-hint"
      style={{ left: hint.x, top: hint.y, width: d, height: d, borderColor: color }}
    >
      <span className="brush-hint-label">{label}</span>
    </div>
  )
}
