import { useEffect, useRef } from 'react'
import gsap from 'gsap'
import { Avatar } from './Avatar'
import { CrownIcon } from './icons'
import { normalizeAvatar } from '../lib/avatar'
import { prefersReducedMotion } from '../lib/motion'
import type { FinalStanding } from '../pages/ThinkInk'

interface Props {
  standings: FinalStanding[]
  /**
   * Identifies the result, not the render. The socket re-sends the whole state
   * on every lobby change, so animating on the array would replay the podium
   * every time somebody readied up or tweaked a setting.
   */
  resultAt: number
}

/** Second, first, third — the classic arrangement, tallest in the middle. */
const SLOTS = [1, 0, 2]
/**
 * Fixed pixel heights, not percentages. As percentages of a fixed-height column
 * the blocks plus the figure above them overflowed, and flex shrank the tallest
 * hardest — which put first place lowest.
 */
const HEIGHTS = [74, 108, 52]

export function Podium({ standings, resultAt }: Props) {
  const ref = useRef<HTMLDivElement>(null)
  const top = standings.slice(0, 3)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      // Blocks rise from the floor, then the winners drop in on top — third,
      // second, first, so the eye finishes on the winner.
      gsap.fromTo(
        '.podium-block',
        { scaleY: 0 },
        {
          scaleY: 1,
          transformOrigin: 'bottom center',
          duration: 0.55,
          ease: 'power3.out',
          stagger: 0.12,
          clearProps: 'transform',
        }
      )
      gsap.fromTo(
        '.podium-figure',
        { y: -26, opacity: 0 },
        {
          y: 0,
          opacity: 1,
          duration: 0.45,
          ease: 'back.out(2)',
          stagger: 0.12,
          delay: 0.3,
          clearProps: 'opacity,transform',
        }
      )
      gsap.to('.podium-figure.first', {
        y: -6,
        duration: 1.1,
        ease: 'sine.inOut',
        yoyo: true,
        repeat: -1,
        delay: 1,
      })
    }, ref)
    return () => ctx.revert()
  }, [resultAt])

  return (
    <div className="podium" ref={ref}>
      {SLOTS.map((rank, i) => {
        const p = top[rank]
        if (!p) return <div className="podium-col empty" key={`empty-${rank}`} />
        const place = rank + 1
        return (
          <div className="podium-col" key={p.id}>
            <div className={`podium-figure ${place === 1 ? 'first' : ''}`}>
              {place === 1 && (
                <span className="podium-crown">
                  <CrownIcon size={20} />
                </span>
              )}
              <Avatar
                color={p.user.color}
                avatar={normalizeAvatar(p.user.avatar)}
                size={place === 1 ? 56 : 44}
                ring={place === 1}
              />
              <span className="podium-name">{p.user.username}</span>
              <span className="podium-score">{p.score}</span>
            </div>
            {/* backgroundColor, not background, so the stylesheet's grain survives. */}
            <div
              className={`podium-block place-${place}`}
              style={{ height: HEIGHTS[i], backgroundColor: p.user.color }}
            >
              <span className="podium-place">{place}</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
