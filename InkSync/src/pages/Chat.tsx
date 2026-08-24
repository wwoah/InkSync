import { useEffect, useRef, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { DrawingCanvas } from '../components/DrawingCanvas'
import { ChatFeed } from '../components/ChatFeed'
import type { User, Message } from '../types'

interface Props {
  user: User
  roomId: string
  onLeave: () => void
}

export function Chat({ user, roomId, onLeave }: Props) {
  const [messages, setMessages] = useState<Message[]>([])
  const [userCount, setUserCount] = useState(0)
  const [text, setText] = useState('')
  const socketRef = useRef<Socket | null>(null)

  useEffect(() => {
    const socket = io('http://localhost:3001')
    socketRef.current = socket

    socket.on('connect', () => {
      socket.emit('join_room', { ...user, roomId })
    })

    socket.on('room_history', (history: Message[]) => {
      setMessages(history)
    })

    socket.on('message', (msg: Message) => {
      setMessages((prev) => [...prev, msg])
    })

    socket.on('room_user_count', (count: number) => {
      setUserCount(count)
    })

    return () => {
      socket.disconnect()
    }
  }, [user, roomId])

  const sendText = () => {
    const trimmed = text.trim()
    if (!trimmed) return
    socketRef.current?.emit('send_message', { type: 'text', content: trimmed })
    setText('')
  }

  const sendDrawing = (dataUrl: string) => {
    socketRef.current?.emit('send_message', { type: 'drawing', content: dataUrl })
  }

  return (
    <div className="chat-page">
      <header className="chat-header">
        <div className="header-left">
          <button className="back-btn" onClick={onLeave}>←</button>
          <span className="header-logo">InkSync</span>
          <span className="header-room">/ {roomId}</span>
        </div>
        <div className="header-right">
          <span className="header-user" style={{ color: user.color }}>
            {user.username}
          </span>
          <span className="header-count">
            {userCount} {userCount === 1 ? 'person' : 'people'} online
          </span>
        </div>
      </header>

      <div className="canvas-section">
        <DrawingCanvas onSendDrawing={sendDrawing} />
      </div>

      <div className="chat-section">
        <ChatFeed messages={messages} currentUser={user} />
        <div className="text-bar">
          <input
            className="text-input"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && sendText()}
            placeholder="or just type something..."
          />
          <button className="text-send-btn" onClick={sendText}>
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
