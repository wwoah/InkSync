export interface User {
  username: string
  color: string
}

export interface Message {
  id: string
  user?: User
  type: 'text' | 'drawing' | 'system'
  content: string
  timestamp: number
}
