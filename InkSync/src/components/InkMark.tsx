import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { prefersReducedMotion } from '../lib/motion'

interface Props {
  size?: number
  /** Seconds per revolution. */
  spin?: number
}

/**
 * Placeholder brand mark: an orbiting satellite around an ink dot, turning
 * slowly beside the InkSync wordmark. Swap the paths for real artwork later.
 */
export function InkMark({ size = 22, spin = 9 }: Props) {
  const ref = useRef<SVGSVGElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.to('.ink-mark-orbit', {
        rotation: 360,
        duration: spin,
        repeat: -1,
        ease: 'none',
        transformOrigin: '50% 50%',
      })
    }, ref)
    return () => ctx.revert()
  }, [spin])

  return (
    <svg
      ref={ref}
      className="ink-mark"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <g className="ink-mark-orbit">
        <circle
          cx="12"
          cy="12"
          r="9"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeDasharray="15 9"
          opacity="0.5"
        />
        <circle cx="12" cy="3" r="2.1" fill="currentColor" />
      </g>
      <circle cx="12" cy="12" r="3.4" fill="currentColor" />
    </svg>
  )
}
