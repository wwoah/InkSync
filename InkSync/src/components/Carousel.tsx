import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import gsap from 'gsap'
import { ChevronIcon } from './icons'
import { prefersReducedMotion } from '../lib/motion'
import { isTypingTarget } from '../lib/keys'

export interface Slide {
  key: string
  /** Shown under the dots for the active slide. */
  label: string
  content: ReactNode
}

/** Horizontal travel past which a swipe counts, and beats vertical scrolling. */
const SWIPE_PX = 45

/**
 * Degrees of tilt per slot away from centre. Cards swing on their bottom edge
 * as they leave and straighten as they arrive, like index cards being dealt.
 * Tilting outward lifts each card's top corner away from the viewport, so an
 * off-screen card never pokes a sliver back into view.
 */
const DEAL_TILT = 3

/**
 * Where a slide sits relative to the one on show, as a signed number of slots.
 * Wrapping to the shortest way round is what lets the last slide sit just left
 * of the first, so stepping back from the first is a single step, not a sweep
 * across the whole strip.
 */
function slotOffset(slide: number, current: number, count: number) {
  let d = (((slide - current) % count) + count) % count
  if (d > count / 2) d -= count
  return d
}

/**
 * One-at-a-time carousel: arrows, dots, swipe and arrow keys, looping in both
 * directions.
 *
 * Slides are placed individually rather than as one sliding track. A single
 * track cannot loop without rewinding past every slide in between; positioning
 * each slide by its own offset means the strip always moves the way you asked
 * it to, even when the move wraps around the end.
 *
 * Every slide stays mounted so the browser can measure them, but the inactive
 * ones are `inert` — otherwise their buttons stay in the tab order and an
 * autoFocus input on an off-screen slide would steal the caret.
 */
export function Carousel({ slides }: { slides: Slide[] }) {
  const [index, setIndex] = useState(0)
  const viewportRef = useRef<HTMLDivElement>(null)
  const trackRef = useRef<HTMLDivElement>(null)
  const touch = useRef<{ x: number; y: number } | null>(null)
  /** Where each slide currently sits, so a move knows how far it is travelling. */
  const placed = useRef<number[]>([])

  const count = slides.length
  const go = (step: number) => setIndex((i) => (((i + step) % count) + count) % count)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e) || e.ctrlKey || e.metaKey || e.altKey) return
      if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return
      e.preventDefault()
      go(e.key === 'ArrowRight' ? 1 : -1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  // Laid out before paint so the first frame is already in position.
  useLayoutEffect(() => {
    const track = trackRef.current
    if (!track) return
    const kids = Array.from(track.children) as HTMLElement[]
    const firstRun = placed.current.length === 0
    const still = prefersReducedMotion()

    const tweens = kids.map((el, j) => {
      const next = slotOffset(j, index, count)
      const prev = placed.current[j]
      placed.current[j] = next
      // A slide moving more than one slot is off-screen at both ends — the far
      // side of a wrap. Sliding it would drag it across the viewport, so it is
      // simply put where it belongs.
      const teleport = firstRun || prev === undefined || Math.abs(next - prev) > 1
      const pose = {
        xPercent: next * 100,
        rotation: Math.sign(next) * DEAL_TILT,
        transformOrigin: '50% 100%',
      }
      if (teleport || still) {
        gsap.set(el, pose)
        return null
      }
      return gsap.to(el, { ...pose, duration: 0.45, ease: 'power3.out' })
    })

    return () => tweens.forEach((t) => t?.kill())
  }, [index, count])

  // The card is only as tall as the slide on show, and follows it when a slide
  // grows — picking a code expands the card underneath you.
  useEffect(() => {
    const slide = trackRef.current?.children[index] as HTMLElement | undefined
    const viewport = viewportRef.current
    if (!slide || !viewport) return

    const fit = () => {
      const h = slide.offsetHeight
      if (prefersReducedMotion()) gsap.set(viewport, { height: h })
      else gsap.to(viewport, { height: h, duration: 0.3, ease: 'power2.out' })
    }

    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(slide)
    return () => ro.disconnect()
  }, [index])

  const arrow = (dir: -1 | 1) => (
    <button
      className="carousel-arrow"
      onClick={() => go(dir)}
      aria-label={dir < 0 ? 'Previous option' : 'Next option'}
    >
      <ChevronIcon size={18} dir={dir < 0 ? 'left' : 'right'} />
    </button>
  )

  return (
    <div className="carousel">
      <div className="carousel-row">
        {arrow(-1)}
        <div
          className="carousel-viewport"
          ref={viewportRef}
          onTouchStart={(e) => {
            const t = e.touches[0]
            touch.current = { x: t.clientX, y: t.clientY }
          }}
          onTouchEnd={(e) => {
            const start = touch.current
            touch.current = null
            if (!start) return
            const t = e.changedTouches[0]
            const dx = t.clientX - start.x
            const dy = t.clientY - start.y
            // Ignore anything more vertical than horizontal; that is a scroll.
            if (Math.abs(dx) < SWIPE_PX || Math.abs(dx) <= Math.abs(dy)) return
            go(dx < 0 ? 1 : -1)
          }}
        >
          <div className="carousel-track" ref={trackRef}>
            {slides.map((s, i) => (
              <div
                key={s.key}
                className="carousel-slide"
                inert={i !== index}
                aria-hidden={i !== index}
              >
                {s.content}
              </div>
            ))}
          </div>
        </div>
        {arrow(1)}
      </div>

      <div className="carousel-dots" role="tablist">
        {slides.map((s, i) => (
          <button
            key={s.key}
            className={`carousel-dot ${i === index ? 'on' : ''}`}
            onClick={() => setIndex(i)}
            role="tab"
            aria-selected={i === index}
            aria-label={s.label}
            title={s.label}
          />
        ))}
      </div>
    </div>
  )
}
