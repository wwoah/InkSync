/** Strips case, spaces and punctuation so "ice-cream" matches "ice cream". */
export function normalize(text) {
  return String(text).toLowerCase().replace(/[^a-z0-9]/g, '')
}

/** Classic edit distance, bailing out once it exceeds `max`. */
export function editDistance(a, b, max = 3) {
  if (Math.abs(a.length - b.length) > max) return max + 1
  let prev = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const row = [i]
    let best = i
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1
      row[j] = Math.min(prev[j] + 1, row[j - 1] + 1, prev[j - 1] + cost)
      best = Math.min(best, row[j])
    }
    if (best > max) return max + 1
    prev = row
  }
  return prev[b.length]
}

/**
 * How a guess relates to the answer.
 *
 * "close" is only reported back to the guesser — announcing it to the room
 * would hand everyone else a strong hint for free.
 */
export function judgeGuess(guess, word) {
  const g = normalize(guess)
  const w = normalize(word)
  if (!g) return 'miss'
  if (g === w) return 'correct'
  // One typo for short words, a little more slack as they get longer.
  const slack = Math.max(1, Math.floor(w.length / 5))
  return editDistance(g, w, slack) <= slack ? 'close' : 'miss'
}

/** The answer as underscores, with `revealed` letter positions shown. */
export function maskWord(word, revealed = []) {
  const shown = new Set(revealed)
  return word
    .split('')
    .map((ch, i) => (ch === ' ' ? ' ' : shown.has(i) ? ch : '_'))
    .join('')
}
