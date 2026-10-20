/**
 * A circle drawn in one pencil stroke, starting at twelve o'clock and going
 * clockwise. Slightly uneven on purpose; `pathLength` normalises it to 1, so
 * the remaining time maps straight onto how much of it is drawn.
 */
const RING = 'M20 4.8c8.6-.2 15.1 6.6 15.2 15.1.1 8.6-6.7 15.3-15.1 15.3-8.5.1-15.4-6.6-15.4-15.2C4.7 11.5 11.4 5 20 4.8'

interface Props {
  /** Whole seconds left. */
  left: number
  /** Seconds the phase started with, so the ring can show how much is gone. */
  total: number
}

/**
 * The turn timer: a paper disc with a pencil ring that runs down as the time
 * does, and the seconds typed in the middle. The ring only moves once a
 * second, so a one-second linear transition in the stylesheet smooths each
 * step into the next and it appears to drain continuously.
 */
export function GameClock({ left, total }: Props) {
  const remaining = total > 0 ? Math.min(1, left / total) : 0

  return (
    <span
      className={`game-clock ${left <= 10 ? 'urgent' : ''}`}
      role="timer"
      aria-label={`${left} seconds left`}
    >
      <svg viewBox="0 0 40 40" aria-hidden="true">
        <path className="game-clock-track" d={RING} />
        <path
          className="game-clock-left"
          d={RING}
          pathLength={1}
          style={{ strokeDashoffset: 1 - remaining }}
        />
      </svg>
      <span className="game-clock-num">{left}</span>
    </span>
  )
}
