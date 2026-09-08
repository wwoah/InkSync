import { normalizeAvatar, DEFAULT_AVATAR } from './avatar'
import type { User } from '../types'

const KEY = 'inksync.profile'

/**
 * The handle, colour and avatar persist locally so nobody rebuilds their face
 * on every visit. Storage can throw outright in private mode, so every access
 * is guarded and simply falls back to a fresh profile.
 */
export function loadProfile(): User | null {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return null
    const p = JSON.parse(raw) as Partial<User>
    if (!p.username || !p.color) return null
    return { username: p.username, color: p.color, avatar: normalizeAvatar(p.avatar) }
  } catch {
    return null
  }
}

export function saveProfile(user: User) {
  try {
    localStorage.setItem(
      KEY,
      JSON.stringify({
        username: user.username,
        color: user.color,
        avatar: user.avatar ?? DEFAULT_AVATAR,
      })
    )
  } catch {
    // Nothing to do — the profile simply will not persist.
  }
}
