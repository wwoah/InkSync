import { onPaper } from './palette'

/**
 * Cursors for the drawing surfaces, drawn in ink.
 *
 * The system crosshair and hand are white on many setups — Windows' default
 * pointer style among them — and white all but disappears on a white sheet.
 * These are ink outlines over a white halo, so they read on blank paper and
 * on dark ink alike, and the pencil, bucket and pin carry the colour in hand.
 *
 * Each hotspot is where the tool meets the page: the pencil's point, the drip
 * from the bucket, the needle of the pin. They are drawn on the same 16-unit
 * grid as the toolbar icons and shown at 24px, so a hotspot is its grid point
 * times 1.5.
 *
 * Only the canvases get these. Everywhere else keeps the system pointer, so
 * anyone who has enlarged or recoloured theirs in accessibility settings
 * still has it wherever they aren't drawing.
 */

export type CursorTool = 'select' | 'pan' | 'pen' | 'eraser' | 'fill' | 'pin'

/** Mirrors --ink in index.css. */
const INK = '#2a251f'

const LINE = `stroke='${INK}' stroke-width='1.1' stroke-linejoin='round' stroke-linecap='round'`

const PENCIL = 'M10.8 2.7a1.5 1.5 0 0 1 2.1 0l.4.4a1.5 1.5 0 0 1 0 2.1L6.1 12.4l-3.6 1.1 1.1-3.6z'
const ERASER =
  'M6 13.4 2.6 10a1.3 1.3 0 0 1 0-1.8l5.8-5.8a1.3 1.3 0 0 1 1.8 0l3.4 3.4a1.3 1.3 0 0 1 0 1.8L8 13.4z'
const SLEEVE = 'M5.2 5.6 8.4 2.4a1.3 1.3 0 0 1 1.8 0l3.4 3.4a1.3 1.3 0 0 1 0 1.8l-3.2 3.2z'
const BUCKET = 'M6.2 1.6 4.8 3l-3.4 3.4a1 1 0 0 0 0 1.4l3.9 3.9a1 1 0 0 0 1.4 0l3.4-3.4z'
const DROP = 'M13.2 9.4s1.5 1.9 1.5 2.8a1.5 1.5 0 1 1-3 0c0-.9 1.5-2.8 1.5-2.8z'
const PIN_HEAD = 'M6.4 2.5 6.1 6.8 4 9h8L9.9 6.8 9.6 2.5z'
const PIN_LINES = 'M5.4 2.3h5.2M8 9.2v4.9'
const ARROW = 'M3 1.5 12.5 8.6l-4 .5-1.9 4.4z'
const PAN =
  'M8 2v12M2 8h12M6.3 3.7 8 2l1.7 1.7M6.3 12.3 8 14l1.7-1.7M3.7 6.3 2 8l1.7 1.7M12.3 6.3 14 8l-1.7 1.7'

interface Drawing {
  /** Every outline in the glyph, traced fat in white underneath it. */
  halo: string
  body: (color: string) => string
  hotspot: [number, number]
  /** The system cursor, if the image is refused. */
  fallback: string
}

const DRAWINGS: Record<CursorTool, Drawing> = {
  // A coloured pencil: body and lead in the colour in hand, bare wood at the tip.
  pen: {
    halo: PENCIL,
    body: (c) =>
      `<path d='${PENCIL}' fill='${c}' ${LINE}/>` +
      `<path d='M3.6 9.9 6.1 12.4 2.5 13.5z' fill='#f3dab0' ${LINE}/>` +
      `<path d='M2.5 13.5l.5-1.7 1.2 1.2z' fill='${onPaper(c, 3)}'/>` +
      `<path d='M9.5 4l2.5 2.5' fill='none' ${LINE}/>`,
    hotspot: [4, 20],
    fallback: 'crosshair',
  },
  // Pink rubber in a blue sleeve, rubbing out at its lower edge.
  eraser: {
    halo: ERASER,
    body: () => `<path d='${ERASER}' fill='#f0a8b8' ${LINE}/><path d='${SLEEVE}' fill='#7f9ad6' ${LINE}/>`,
    hotspot: [10, 20],
    fallback: 'crosshair',
  },
  // A paper bucket with a drop of the colour falling from it, landing on the spot.
  fill: {
    halo: `${BUCKET}${DROP}`,
    body: (c) => `<path d='${BUCKET}' fill='#fff' ${LINE}/><path d='${DROP}' fill='${c}' ${LINE}/>`,
    hotspot: [20, 20],
    fallback: 'crosshair',
  },
  // A drawing pin with a head in the colour in hand, needle on the spot.
  pin: {
    halo: `${PIN_HEAD}${PIN_LINES}`,
    body: (c) => `<path d='${PIN_HEAD}' fill='${c}' ${LINE}/><path d='${PIN_LINES}' fill='none' ${LINE}/>`,
    hotspot: [12, 21],
    fallback: 'cell',
  },
  // The select arrow from the toolbar, filled with ink.
  select: {
    halo: ARROW,
    body: () => `<path d='${ARROW}' fill='${INK}' stroke='${INK}' stroke-width='1.2' stroke-linejoin='round'/>`,
    hotspot: [4, 2],
    fallback: 'default',
  },
  // Mid-drag under the select tool: four ways to go.
  pan: {
    halo: PAN,
    body: () => `<path d='${PAN}' fill='none' ${LINE.replace("'1.1'", "'1.4'")}/>`,
    hotspot: [12, 12],
    fallback: 'grabbing',
  },
}

const cache = new Map<string, string>()

/** The CSS cursor for a tool, with the colour in hand where the glyph shows one. */
export function inkCursor(tool: CursorTool, color: string = INK) {
  // Colours reach here from the palette or a saved profile; anything that
  // isn't a plain hex colour is not interpolated into the image.
  const c = /^#[0-9a-f]{3,8}$/i.test(color) ? color : INK
  const key = `${tool}|${c}`
  const hit = cache.get(key)
  if (hit) return hit

  const d = DRAWINGS[tool]
  const svg =
    `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 16 16'>` +
    `<path d='${d.halo}' fill='none' stroke='#fff' stroke-width='2.8' stroke-linejoin='round' stroke-linecap='round'/>` +
    `${d.body(c)}</svg>`
  const css = `url("data:image/svg+xml,${encodeURIComponent(svg)}") ${d.hotspot[0]} ${d.hotspot[1]}, ${d.fallback}`
  cache.set(key, css)
  return css
}
