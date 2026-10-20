import type { ReactNode } from 'react'

/** Mouse-pointer glyph for the select tool. */
export function CursorIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M3 1.5 12.5 8.6l-4 .5-1.9 4.4z"
        fill="currentColor"
        stroke="currentColor"
        strokeWidth="1.2"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Paint-bucket glyph for the fill tool. */
export function FillIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <path
        d="M6.2 1.6 4.8 3l-3.4 3.4a1 1 0 0 0 0 1.4l3.9 3.9a1 1 0 0 0 1.4 0l3.4-3.4z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinejoin="round"
      />
      <path d="M13.2 9.4s1.5 1.9 1.5 2.8a1.5 1.5 0 1 1-3 0c0-.9 1.5-2.8 1.5-2.8" fill="currentColor" />
    </svg>
  )
}

/** Discreet "what does this do" marker. */
export function InfoIcon({ size = 13 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" aria-hidden="true">
      <circle cx="8" cy="8" r="6.4" fill="none" stroke="currentColor" strokeWidth="1.4" />
      <circle cx="8" cy="4.9" r="0.95" fill="currentColor" />
      <path d="M8 7.1v4.4" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
    </svg>
  )
}

/**
 * Carousel chevron. Drawn rather than typed: the `‹` and `›` glyphs carry
 * uneven side bearings, so they never sit centred in a square button however
 * the padding is nudged. This path is symmetric about the viewBox centre.
 */
export function ChevronIcon({
  size = 16,
  dir = 'left',
}: {
  size?: number
  dir?: 'left' | 'right'
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      aria-hidden="true"
      style={dir === 'right' ? { transform: 'scaleX(-1)' } : undefined}
    >
      <path
        d="M10.5 3.5 5.5 8l5 4.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/*
 * Everything below is drawn as if with a fineliner: open strokes, round ends,
 * and lines that are allowed to wander a little. They replace the emoji and
 * Unicode glyphs the toolbars used to borrow, which rendered differently on
 * every platform — and as full-colour emoji on some.
 */

/** Shared pen settings. Tool glyphs use a 16 box; the larger doodles a 24 one. */
function Pen({ size, box = 16, children }: { size: number; box?: 16 | 24; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${box} ${box}`}
      fill="none"
      stroke="currentColor"
      strokeWidth={box === 16 ? 1.45 : 1.7}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  )
}

export function PencilIcon({ size = 15 }: { size?: number }) {
  return (
    <Pen size={size}>
      <path d="M10.8 2.7a1.5 1.5 0 0 1 2.1 0l.4.4a1.5 1.5 0 0 1 0 2.1L6.1 12.4l-3.6 1.1 1.1-3.6z" />
      <path d="M9.5 4l2.5 2.5M3.6 9.9l2.5 2.5" />
      <path d="M2.5 13.5l.5-1.7 1.2 1.2z" fill="currentColor" />
    </Pen>
  )
}

export function EraserIcon({ size = 15 }: { size?: number }) {
  return (
    <Pen size={size}>
      <path d="M6 13.4 2.6 10a1.3 1.3 0 0 1 0-1.8l5.8-5.8a1.3 1.3 0 0 1 1.8 0l3.4 3.4a1.3 1.3 0 0 1 0 1.8L8 13.4z" />
      <path d="M5.2 5.6l5.2 5.2M9.4 13.5h4.2" />
    </Pen>
  )
}

/** A drawing pin, for the comment tool — comments are notes pinned to the sheet. */
export function PinIcon({ size = 15 }: { size?: number }) {
  return (
    <Pen size={size}>
      <path d="M5.4 2.3h5.2" />
      <path d="M6.4 2.5 6.1 6.8 4 9h8L9.9 6.8 9.6 2.5" />
      <path d="M8 9.2v4.9" />
    </Pen>
  )
}

export function UndoIcon({ size = 15 }: { size?: number }) {
  return (
    <Pen size={size}>
      <path d="M5.3 3.2 2.4 6.1l2.9 2.9" />
      <path d="M2.7 6.1h6.5a3.9 3.9 0 0 1 0 7.8H6.6" />
    </Pen>
  )
}

export function RedoIcon({ size = 15 }: { size?: number }) {
  return (
    <Pen size={size}>
      <g transform="matrix(-1 0 0 1 16 0)">
        <path d="M5.3 3.2 2.4 6.1l2.9 2.9" />
        <path d="M2.7 6.1h6.5a3.9 3.9 0 0 1 0 7.8H6.6" />
      </g>
    </Pen>
  )
}

export function ChatIcon({ size = 15 }: { size?: number }) {
  return (
    <Pen size={size}>
      <path d="M3.3 2.9h9.4c.8 0 1.4.6 1.4 1.4v5.5c0 .8-.6 1.4-1.4 1.4H7.6l-3 2.6v-2.6H3.3c-.8 0-1.4-.6-1.4-1.4V4.3c0-.8.6-1.4 1.4-1.4z" />
      <path d="M5 6.1h6M5 8.4h3.8" />
    </Pen>
  )
}

export function BackIcon({ size = 15 }: { size?: number }) {
  return (
    <Pen size={size}>
      <path d="M13.3 8.1c-3.5-.3-6.9-.1-10.4 0" />
      <path d="M6.8 4.1 2.9 8.1l3.9 3.9" />
    </Pen>
  )
}

export function CloseIcon({ size = 14 }: { size?: number }) {
  return (
    <Pen size={size}>
      <path d="M4 4.2c2.7 2.5 5.4 5.1 8 7.7M12.1 4c-2.8 2.6-5.4 5.3-8 8.1" />
    </Pen>
  )
}

export function DiceIcon({ size = 15 }: { size?: number }) {
  return (
    <Pen size={size}>
      <g transform="rotate(-9 8 8)">
        <rect x="2.4" y="2.4" width="11.2" height="11.2" rx="2.6" />
        <g fill="currentColor" stroke="none">
          <circle cx="5.4" cy="5.4" r="0.95" />
          <circle cx="10.6" cy="5.4" r="0.95" />
          <circle cx="8" cy="8" r="0.95" />
          <circle cx="5.4" cy="10.6" r="0.95" />
          <circle cx="10.6" cy="10.6" r="0.95" />
        </g>
      </g>
    </Pen>
  )
}

export function CrownIcon({ size = 18 }: { size?: number }) {
  return (
    <Pen size={size}>
      <path d="M2.9 11.4 2 4.8l3.4 2.8L8 3l2.6 4.6L14 4.8l-.9 6.6z" fill="currentColor" />
      <path d="M2.8 13.2h10.4" />
    </Pen>
  )
}

/** A quick tick, the way you'd mark something done on a list. */
export function CheckIcon({ size = 13 }: { size?: number }) {
  return (
    <Pen size={size}>
      <path d="M2.8 8.7c1.1.9 2.1 2 3.1 3.2 1.9-3 4.1-5.8 7.4-8.4" />
    </Pen>
  )
}

export function ScrollIcon({ size = 15 }: { size?: number }) {
  return (
    <Pen size={size}>
      <rect x="4.4" y="1.8" width="7.2" height="12.4" rx="3.6" />
      <path d="M8 4.4v2.2" />
    </Pen>
  )
}

export function PanIcon({ size = 15 }: { size?: number }) {
  return (
    <Pen size={size}>
      <path d="M8 2v12M2 8h12" />
      <path d="M6.3 3.7 8 2l1.7 1.7M6.3 12.3 8 14l1.7-1.7M3.7 6.3 2 8l1.7 1.7M12.3 6.3 14 8l-1.7 1.7" />
    </Pen>
  )
}

/** Two fingertips, for the touch gestures. */
export function TouchIcon({ size = 15 }: { size?: number }) {
  return (
    <Pen size={size}>
      <path d="M5.4 14V6.2a1.4 1.4 0 0 1 2.8 0V14" />
      <path d="M8.2 13.8V4.6a1.4 1.4 0 0 1 2.8 0v9.2" />
    </Pen>
  )
}

export function SoundOnIcon({ size = 15 }: { size?: number }) {
  return (
    <Pen size={size}>
      <path d="M2.4 6.1h2.4L8.5 3v10L4.8 9.9H2.4z" />
      <path d="M10.7 5.7c.8.7 1.2 1.4 1.2 2.3s-.4 1.7-1.2 2.4M12.6 3.9c1.4 1.1 2.1 2.5 2.1 4.1s-.7 3.1-2.1 4.2" />
    </Pen>
  )
}

export function SoundOffIcon({ size = 15 }: { size?: number }) {
  return (
    <Pen size={size}>
      <path d="M2.4 6.1h2.4L8.5 3v10L4.8 9.9H2.4z" />
      <path d="M10.9 6.1c1.2 1.2 2.3 2.5 3.5 3.8M14.4 6c-1.2 1.3-2.3 2.6-3.5 3.9" />
    </Pen>
  )
}

/** A sheet with a doodle on it — the shared canvas. */
export function SheetIcon({ size = 24 }: { size?: number }) {
  return (
    <Pen size={size} box={24}>
      <path d="M5.2 3.4h9.6l4.4 4.4v12.4c0 .4-.3.7-.7.7H5.2a.7.7 0 0 1-.7-.7V4.1c0-.4.3-.7.7-.7z" />
      <path d="M14.6 3.6v4.4h4.4" />
      <path d="M7.6 15.6c1.3-2.9 2.6-3.4 3.4-1.7.8 1.8 1.9 2.3 3.4-.5.6-1.1 1.4-1.5 2.2-.6" />
    </Pen>
  )
}

/** A padlock — the private room. */
export function LockIcon({ size = 24 }: { size?: number }) {
  return (
    <Pen size={size} box={24}>
      <rect x="5" y="10.4" width="14" height="10.2" rx="2.3" />
      <path d="M8.1 10.4V7.7a3.9 3.9 0 0 1 7.8 0v2.7M12 14.2v2.7" />
    </Pen>
  )
}

/** A light bulb — ThinkInk. */
export function BulbIcon({ size = 24 }: { size?: number }) {
  return (
    <Pen size={size} box={24}>
      <path d="M9.3 16.9c0-1.9-1-2.8-1.9-4.1a5.4 5.4 0 1 1 9.2 0c-.9 1.3-1.9 2.2-1.9 4.1z" />
      <path d="M9.7 19.4h4.6M10.6 21.6h2.8" />
      <path d="M12 1.6v1.3M4.4 4.6l.9.9M19.6 4.6l-.9.9" />
    </Pen>
  )
}
