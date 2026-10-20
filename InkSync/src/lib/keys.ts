/** Inputs that take characters. A slider or checkbox can hold focus, but typing V into one means nothing. */
const TEXT_INPUTS = new Set(['text', 'search', 'email', 'url', 'tel', 'password', 'number'])

/**
 * True when a keystroke belongs to whatever the person is typing in, so
 * single-letter shortcuts never steal characters from a chat or a comment.
 * A focused size slider does not count — otherwise every shortcut would go
 * dead after dragging it, until the canvas was clicked.
 */
export function isTypingTarget(e: KeyboardEvent) {
  const t = e.target as HTMLElement | null
  if (!t) return false
  if (t instanceof HTMLInputElement) return TEXT_INPUTS.has(t.type)
  const tag = t.tagName
  return tag === 'TEXTAREA' || tag === 'SELECT' || t.isContentEditable
}
