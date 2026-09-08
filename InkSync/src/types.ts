import type { AvatarConfig } from './lib/avatar'

export interface User {
  username: string
  color: string
  /** Optional so messages stored before avatars existed still render. */
  avatar?: AvatarConfig
}

export interface Message {
  id: string
  user?: User
  type: 'text' | 'drawing' | 'system'
  content: string
  timestamp: number
}
