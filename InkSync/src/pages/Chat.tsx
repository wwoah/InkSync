import { useEffect, useRef, useState } from 'react'
import gsap from 'gsap'
import { io, Socket } from 'socket.io-client'
import { DrawingCanvas } from '../components/DrawingCanvas'
import { ChatFeed } from '../components/ChatFeed'
import { BackIcon } from '../components/icons'
import { prefersReducedMotion } from '../lib/motion'
import { onPaper } from '../lib/palette'
import { SERVER_URL } from '../lib/server'
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
  const pageRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      const rise = { y: 0, opacity: 1, duration: 0.45, ease: 'power3.out', clearProps: 'opacity,transform' }
      gsap
        .timeline()
        .fromTo('.chat-header', { y: -52, opacity: 0 }, rise)
        .fromTo('.canvas-section', { y: 18, opacity: 0 }, rise, '-=0.25')
        .fromTo('.chat-section', { y: 18, opacity: 0 }, rise, '<')
    }, pageRef)
    return () => ctx.revert()
  }, [])

  useEffect(() => {
    const socket = io(SERVER_URL)
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
    <div className="chat-page" ref={pageRef}>
      <header className="chat-header">
        <div className="header-left">
          <button className="back-btn" onClick={onLeave} aria-label="Back">
            <BackIcon />
          </button>
          <span className="header-logo">InkSync</span>
          <span className="header-room">/ {roomId}</span>
        </div>
        <div className="header-right">
          <span className="header-user" style={{ color: onPaper(user.color) }}>
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
