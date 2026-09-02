/**
 * True when a keystroke belongs to whatever the person is typing in, so
 * single-letter shortcuts never steal characters from a chat or a comment.
 */
export function isTypingTarget(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  if (!t) return false
  const tag = t.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
}
