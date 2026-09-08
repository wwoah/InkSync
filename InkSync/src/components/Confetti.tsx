import { useEffect, useMemo, useRef } from 'react'
import gsap from 'gsap'
import { prefersReducedMotion } from '../lib/motion'

interface Props {
  /** Drawn from the podium, so the burst is in the winners' colours. */
  colors: string[]
  /** Fires once per result rather than on every re-render. */
  fireKey: number
  count?: number
}

interface Bit {
  color: string
  w: number
  h: number
  round: boolean
  /** Where along the width it starts, as a percentage. */
  from: number
  drift: number
  rise: number
  spin: number
  delay: number
  dur: number
}

/**
 * Deterministic noise (mulberry32). Math.random cannot be called while
 * rendering, and seeding from the result's timestamp is better anyway: the
 * layout is stable across re-renders and still differs for every match.
 */
function seeded(seed: number) {
  let t = seed >>> 0
  return () => {
    t += 0x6d2b79f5
    let x = Math.imul(t ^ (t >>> 15), 1 | t)
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x)
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296
  }
}

export function Confetti({ colors, fireKey, count = 80 }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  // A string key keeps the memo stable: the parent builds a fresh colours array
  // on every render, which would otherwise rebuild the burst mid-flight.
  const paletteKey = colors.join(',')

  const bits = useMemo<Bit[]>(() => {
    const palette = paletteKey ? paletteKey.split(',') : ['#6c54f5']
    const rng = seeded(fireKey || 1)
    const rand = (a: number, b: number) => a + rng() * (b - a)
    return Array.from({ length: count }, (_, i) => ({
      color: palette[i % palette.length],
      w: rand(5, 11),
      h: rand(7, 15),
      round: rng() < 0.25,
      // Clustered toward the middle, where the podium is.
      from: 50 + rand(-34, 34),
      drift: rand(-190, 190),
      rise: rand(90, 240),
      spin: rand(-720, 720),
      delay: rand(0, 0.5),
      dur: rand(1.6, 2.8),
    }))
  }, [fireKey, count, paletteKey])

  useEffect(() => {
    if (prefersReducedMotion()) return
    const root = ref.current
    if (!root) return
    const els = Array.from(root.children) as HTMLElement[]

    const ctx = gsap.context(() => {
      els.forEach((el, i) => {
        const b = bits[i]
        if (!b) return
        gsap
          .timeline({ delay: b.delay })
          // Up and out of the podium first…
          .fromTo(
            el,
            { x: 0, y: 0, opacity: 1, rotation: 0, scale: 1 },
            {
              x: b.drift * 0.45,
              y: -b.rise,
              rotation: b.spin * 0.3,
              duration: 0.55,
              ease: 'power2.out',
            }
          )
          // …then down past the bottom, tumbling.
          .to(el, {
            x: b.drift,
            y: 460,
            rotation: b.spin,
            duration: b.dur,
            ease: 'power1.in',
          })
          .to(el, { opacity: 0, duration: 0.5 }, `-=0.5`)
      })
    }, root)

    return () => ctx.revert()
  }, [bits])

  if (prefersReducedMotion()) return null

  return (
    <div className="confetti" ref={ref} aria-hidden="true">
      {bits.map((b, i) => (
        <span
          key={i}
          className="confetti-bit"
          style={{
            left: `${b.from}%`,
            width: b.w,
            height: b.h,
            background: b.color,
            borderRadius: b.round ? '50%' : 2,
          }}
        />
      ))}
    </div>
  )
}
