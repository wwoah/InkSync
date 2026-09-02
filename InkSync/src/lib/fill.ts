/** Packs #rrggbb into the little-endian RGBA word an ImageData Uint32 view uses. */
function packColor(hex: string) {
  const h = hex.replace('#', '')
  const n = parseInt(h.length === 3 ? h.replace(/./g, (c) => c + c) : h, 16)
  const r = (n >> 16) & 0xff
  const g = (n >> 8) & 0xff
  const b = n & 0xff
  return ((255 << 24) | (b << 16) | (g << 8) | r) >>> 0
}

/**
 * Scanline flood fill. Tolerance matters here: strokes are drawn anti-aliased,
 * so an exact-match fill would stop at the soft edge and leave a halo behind.
 *
 * Returns false when nothing was painted, so callers can avoid broadcasting
 * a no-op to everyone else.
 */
export function floodFill(
  ctx: CanvasRenderingContext2D,
  px: number,
  py: number,
  hex: string,
  tolerance = 40
) {
  const { width: w, height: h } = ctx.canvas
  const x0 = Math.round(px)
  const y0 = Math.round(py)
  if (x0 < 0 || y0 < 0 || x0 >= w || y0 >= h) return false

  const img = ctx.getImageData(0, 0, w, h)
  const data = new Uint32Array(img.data.buffer)
  const target = data[y0 * w + x0]
  const fill = packColor(hex)

  const tr = target & 0xff
  const tg = (target >> 8) & 0xff
  const tb = (target >> 16) & 0xff
  const ta = (target >>> 24) & 0xff
  const tol2 = tolerance * tolerance * 4

  const match = (p: number) => {
    if (p === fill) return false
    const dr = (p & 0xff) - tr
    const dg = ((p >> 8) & 0xff) - tg
    const db = ((p >> 16) & 0xff) - tb
    const da = ((p >>> 24) & 0xff) - ta
    return dr * dr + dg * dg + db * db + da * da <= tol2
  }

  // If the fill colour is itself within tolerance of the target, filled pixels
  // would keep matching and the scan would never terminate.
  if (!match(target)) return false

  const stack = [x0, y0]
  let painted = false

  while (stack.length) {
    const y = stack.pop() as number
    const x = stack.pop() as number
    const row = y * w

    let left = x
    while (left >= 0 && match(data[row + left])) left--
    left++
    let right = x
    while (right < w && match(data[row + right])) right++
    right--
    if (left > right) continue

    let spanAbove = false
    let spanBelow = false
    for (let i = left; i <= right; i++) {
      data[row + i] = fill
      painted = true

      if (y > 0) {
        const up = match(data[row - w + i])
        if (up && !spanAbove) {
          stack.push(i, y - 1)
          spanAbove = true
        } else if (!up) {
          spanAbove = false
        }
      }
      if (y < h - 1) {
        const down = match(data[row + w + i])
        if (down && !spanBelow) {
          stack.push(i, y + 1)
          spanBelow = true
        } else if (!down) {
          spanBelow = false
        }
      }
    }
  }

  if (painted) ctx.putImageData(img, 0, 0)
  return painted
}
