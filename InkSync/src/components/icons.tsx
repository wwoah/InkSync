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
