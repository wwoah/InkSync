/**
 * Colours chosen to sit on paper.
 *
 * The drawing inks are art-supply pigments rather than screen primaries: on a
 * cream sheet the old neon set looked pasted on rather than drawn. Player
 * colours are the same inks minus black and white, so the colour a player
 * arrives with is always a swatch in the toolbar, already selected.
 */
export const INKS = [
  '#1d1a16', // ink
  '#d8483a', // vermilion
  '#ec8a2f', // orange
  '#f0c23b', // marigold
  '#4d9a4a', // leaf
  '#2f62c4', // cobalt
  '#7a56b8', // violet
  '#e06d9c', // rose
  '#ffffff', // white: paints the sheet back to blank
  '#8d8780', // pencil
]

export const PLAYER_COLORS = [
  '#d8483a',
  '#ec8a2f',
  '#f0c23b',
  '#4d9a4a',
  '#2f62c4',
  '#7a56b8',
  '#e06d9c',
  '#8d8780',
]

/** Mirrors --paper and --ink in index.css. */
const PAPER: RGB = [251, 248, 241]
const INK: RGB = [42, 37, 31]
const LIGHT: RGB = [255, 253, 247]

type RGB = [number, number, number]

function parse(color: string): RGB | null {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(color.trim())
  if (!m) return null
  const hex = m[1].length === 3 ? [...m[1]].map((c) => c + c).join('') : m[1]
  const n = parseInt(hex, 16)
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
}

/** WCAG relative luminance. */
function luminance(rgb: RGB) {
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

function contrast(a: RGB, b: RGB) {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (hi + 0.05) / (lo + 0.05)
}

const toHex = (rgb: RGB) =>
  '#' + rgb.map((c) => Math.round(c).toString(16).padStart(2, '0')).join('')

const cache = new Map<string, string>()

/**
 * The colour as it should be written on paper.
 *
 * Player colours double as text — names in chat, on pins, in toasts — and the
 * light ones (marigold, or white from a profile saved under the old dark
 * theme) all but vanish on a cream sheet. Those are steeped in ink a tenth at
 * a time until they reach `ratio` against the paper; dark colours pass
 * through untouched. Use 3 for strokes and marks, 4.5 for text.
 */
export function onPaper(color: string, ratio = 4.5) {
  const key = `${color}|${ratio}`
  const hit = cache.get(key)
  if (hit) return hit

  const rgb = parse(color)
  let out = color
  if (rgb) {
    out = toHex(INK)
    for (let step = 0; step <= 10; step++) {
      const t = step / 10
      const mixed = rgb.map((c, i) => c + (INK[i] - c) * t) as RGB
      if (contrast(mixed, PAPER) >= ratio) {
        out = step === 0 ? color : toHex(mixed)
        break
      }
    }
  }
  cache.set(key, out)
  return out
}

/** Dark or light lettering, whichever reads on a fill of `color`. */
export function onFill(color: string) {
  const rgb = parse(color)
  if (!rgb) return toHex(INK)
  return contrast(rgb, INK) >= contrast(rgb, LIGHT) ? toHex(INK) : toHex(LIGHT)
}
