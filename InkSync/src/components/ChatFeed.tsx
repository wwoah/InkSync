import { useEffect, useRef } from 'react'
import type { Message, User } from '../types'

interface Props {
  messages: Message[]
  currentUser: User
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

export function ChatFeed({ messages, currentUser }: Props) {
  const feedRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = feedRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [messages])

  return (
    <div className="chat-feed" ref={feedRef}>
      {messages.length === 0 && (
        <div className="feed-empty">No messages yet — draw something and send it!</div>
      )}
      {messages.map((msg) => {
        if (msg.type === 'system') {
          return (
            <div key={msg.id} className="sys-msg">
              {msg.content}
            </div>
          )
        }

        const isOwn = msg.user?.username === currentUser.username

        return (
          <div key={msg.id} className={`message ${isOwn ? 'own' : ''}`}>
            <div className="msg-meta">
              <span className="msg-author" style={{ color: msg.user?.color }}>
                {msg.user?.username}
              </span>
              <span className="msg-time">{formatTime(msg.timestamp)}</span>
            </div>

            {msg.type === 'drawing' ? (
              <img src={msg.content} className="msg-drawing" alt="drawing" />
            ) : (
              <div className="msg-text">{msg.content}</div>
            )}
          </div>
        )
      })}
    </div>
  )
}
