import { InkMark } from './InkMark'

interface Props {
  /** The name in two halves; the second half is written in blue ink. */
  first?: string
  second?: string
  size?: number
}

/**
 * The logo lockup: the turning mark, the name, and a pen stroke under it that
 * writes itself in when the lockup mounts. `pathLength` normalises the stroke
 * to 1, so the draw-on animation needs no measuring however wide the name is.
 */
export function Wordmark({ first = 'Ink', second = 'Sync', size = 64 }: Props) {
  return (
    <div className="welcome-logo">
      <InkMark size={size} />
      <span className="logo-word">
        <span className="logo-ink">{first}</span>
        <span className="logo-sync">{second}</span>
        <svg className="logo-swash" viewBox="0 0 200 18" aria-hidden="true">
          <path d="M4 12.5C52 5.5 120 3.4 196 9.2" pathLength={1} />
        </svg>
      </span>
    </div>
  )
}
