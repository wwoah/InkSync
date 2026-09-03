import { useCallback, useEffect, useRef } from 'react'

/**
 * Touch stand-in for right-click.
 *
 * Returns `bind(value)` to spread onto an element, and `consumed()` for its
 * click handler — a long press is always followed by a click, so without
 * swallowing that click the element would run both actions at once.
 */
export function useLongPress<T>(onLongPress: (value: T) => void, ms = 450) {
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fired = useRef(false)

  const cancel = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
  }, [])

  useEffect(() => cancel, [cancel])

  const bind = useCallback(
    (value: T) => ({
      onTouchStart: () => {
        fired.current = false
        cancel()
        timer.current = setTimeout(() => {
          fired.current = true
          onLongPress(value)
        }, ms)
      },
      // Any drift means they are scrolling the toolbar, not pressing.
      onTouchMove: cancel,
      onTouchEnd: cancel,
      onTouchCancel: cancel,
    }),
    [cancel, ms, onLongPress]
  )

  const consumed = useCallback(() => {
    if (!fired.current) return false
    fired.current = false
    return true
  }, [])

  return { bind, consumed }
}
