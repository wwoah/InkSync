import type { CSSProperties } from 'react'
import logoUrl from '../assets/InkSynclogoV1.svg'

interface Props {
  /** Box size. A number is px; a string can be any CSS length, e.g. clamp(). */
  size?: number | string
  /** Seconds per revolution. Drives the CSS animation via a custom property. */
  spin?: number
  /**
   * How much of that box the artwork fills. The logo file centres the art in a
   * generously padded canvas, so at 1 it only covers ~58% of the box. Raising
   * this scales the art up without changing the layout footprint.
   *
   * The ceiling is 1.61: the pens sit at 62% of the artwork's half-width, so
   * beyond that they cross the edge of the box and get clipped as they come
   * round. 1.55 leaves just enough margin for antialiasing. Past this, `size`
   * is the lever — the box has to grow.
   */
  artScale?: number
}

/**
 * The InkSync mark, self-animating in CSS: the pen arcs sweep around the ink
 * blot while the blot holds the centre.
 *
 * The artwork is one flat raster, so the two parts are separated at render time
 * rather than in the file — each layer draws the whole logo through a radial
 * mask, one keeping the outer ring and one the centre. The layers stack, so
 * together they still show the complete logo; only the outer one turns.
 */
export function InkMark({ size = 64, spin = 9, artScale = 1.55 }: Props) {
  const box = typeof size === 'number' ? `${size}px` : size

  return (
    <span
      className="ink-mark"
      style={
        {
          '--ink-logo': `url(${logoUrl})`,
          '--ink-spin': `${spin}s`,
          '--ink-art-scale': artScale,
          width: box,
          height: box,
        } as CSSProperties
      }
      aria-hidden="true"
    >
      <span className="ink-mark-pens">
        <span className="ink-mark-art" />
      </span>
      <span className="ink-mark-blot">
        <span className="ink-mark-art" />
      </span>
    </span>
  )
}
