import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: 'http://localhost:5173', methods: ['GET', 'POST'] }
})

// Private rooms
const rooms = new Map()

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, { messages: [], users: new Map() })
  return rooms.get(roomId)
}

// Collaborative canvas
const CANVAS_CAPACITY = 5

const canvas = {
  dataUrl: null,
  messages: [],
  pins: [],
  users: new Map(),
}

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function sys(content) {
  return { id: uid(), type: 'system', content, timestamp: Date.now() }
}

function trim(arr, max = 300) {
  if (arr.length > max) arr.splice(0, arr.length - max)
}

io.on('connection', (socket) => {
  // ── Private Room ──────────────────────────────

  socket.on('join_room', ({ username, color, roomId }) => {
    const room = getRoom(roomId)
    room.users.set(socket.id, { username, color })
    socket.join(`room:${roomId}`)
    socket.data.roomId = roomId

    socket.emit('room_history', room.messages.slice(-100))
    io.to(`room:${roomId}`).emit('room_user_count', room.users.size)

    const msg = sys(`${username} joined`)
    room.messages.push(msg)
    io.to(`room:${roomId}`).emit('message', msg)
  })

  socket.on('send_message', (data) => {
    const roomId = socket.data.roomId
    if (!roomId) return
    const room = rooms.get(roomId)
    if (!room) return
    const user = room.users.get(socket.id)
    if (!user) return

    const msg = { id: uid(), user, type: data.type, content: data.content, timestamp: Date.now() }
    room.messages.push(msg)
    trim(room.messages)
    io.to(`room:${roomId}`).emit('message', msg)
  })

  // ── Collaborative Canvas ───────────────────────

  socket.on('join_canvas', ({ username, color }) => {
    // The live canvas seats a fixed number of people; turn the rest away
    // before they join the room, so they receive nothing further.
    if (!canvas.users.has(socket.id) && canvas.users.size >= CANVAS_CAPACITY) {
      socket.emit('canvas_full', { capacity: CANVAS_CAPACITY })
      return
    }

    canvas.users.set(socket.id, { username, color })
    socket.join('canvas')
    socket.data.canvasUser = { username, color }

    socket.emit('canvas_init', {
      dataUrl: canvas.dataUrl,
      messages: canvas.messages.slice(-100),
      pins: canvas.pins,
      capacity: CANVAS_CAPACITY,
    })
    io.to('canvas').emit('canvas_user_count', canvas.users.size)

    const msg = sys(`${username} joined`)
    canvas.messages.push(msg)
    io.to('canvas').emit('canvas_message', msg)
  })

  socket.on('canvas_draw', (data) => {
    if (!canvas.users.has(socket.id)) return
    socket.to('canvas').emit('canvas_draw', data)
  })

  socket.on('canvas_save', ({ dataUrl }) => {
    if (!canvas.users.has(socket.id)) return
    canvas.dataUrl = dataUrl
  })

  socket.on('canvas_pin', ({ xPct, yPct, text }) => {
    const user = canvas.users.get(socket.id)
    if (!user) return
    const pin = { id: uid(), xPct, yPct, text, user, timestamp: Date.now() }
    canvas.pins.push(pin)
    io.to('canvas').emit('canvas_pin', pin)
  })

  socket.on('canvas_chat', ({ text }) => {
    const user = canvas.users.get(socket.id)
    if (!user) return
    const msg = { id: uid(), user, type: 'text', content: text, timestamp: Date.now() }
    canvas.messages.push(msg)
    trim(canvas.messages)
    io.to('canvas').emit('canvas_message', msg)
  })

  // ── Disconnect ────────────────────────────────

  socket.on('disconnect', () => {
    const roomId = socket.data.roomId
    if (roomId) {
      const room = rooms.get(roomId)
      if (room) {
        const user = room.users.get(socket.id)
        if (user) {
          room.users.delete(socket.id)
          io.to(`room:${roomId}`).emit('room_user_count', room.users.size)
          const msg = sys(`${user.username} left`)
          room.messages.push(msg)
          io.to(`room:${roomId}`).emit('message', msg)
        }
      }
    }

    const cu = socket.data.canvasUser
    if (cu) {
      canvas.users.delete(socket.id)
      io.to('canvas').emit('canvas_user_count', canvas.users.size)
      const msg = sys(`${cu.username} left`)
      canvas.messages.push(msg)
      io.to('canvas').emit('canvas_message', msg)
    }
  })
})

httpServer.listen(3001, () => {
  console.log('InkSync server running on :3001')
})
