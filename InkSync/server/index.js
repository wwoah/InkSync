import express from 'express'
import { createServer } from 'http'
import { Server } from 'socket.io'
import { createEngine, getGame, hasGame, gameRoom, GAME_CAPACITY } from './thinkink.js'

const app = express()
const httpServer = createServer(app)

// Hosts inject the port; 3001 is only the local default.
const PORT = Number(process.env.PORT) || 3001

/**
 * Adds the scheme when it is missing. Render's blueprint can only hand over a
 * bare hostname, and a scheme-less origin never matches, so it would silently
 * block every connection.
 */
function toOrigin(value) {
  const v = value.trim()
  if (!v || v.includes('://')) return v
  return /^(localhost|127\.0\.0\.1)/.test(v) ? `http://${v}` : `https://${v}`
}

/**
 * Origins the browser may load the app from, comma-separated.
 *
 * Unset means "any origin". That is deliberate: this server has no auth, no
 * cookies and no private data, and CORS only ever constrains browsers — a
 * script can open a socket regardless. Defaulting to a locked-down localhost
 * made a deploy that forgot this variable fail *silently*, with every visitor
 * turned away and nothing in the logs to say why. Working-but-open is the
 * better default here; set CLIENT_ORIGIN to restrict it to your own site.
 */
const rawOrigin = process.env.CLIENT_ORIGIN?.trim()
const CLIENT_ORIGINS = rawOrigin
  ? rawOrigin.split(',').map(toOrigin).filter(Boolean)
  : '*'

const io = new Server(httpServer, {
  cors: { origin: CLIENT_ORIGINS, methods: ['GET', 'POST'] },
  // Canvas bakes are full-resolution lossless PNGs, well over the 1MB default.
  maxHttpBufferSize: 3.2e7,
})

// Private rooms
const rooms = new Map()

function getRoom(roomId) {
  if (!rooms.has(roomId)) rooms.set(roomId, { messages: [], users: new Map() })
  return rooms.get(roomId)
}

// Collaborative canvases. The open one is just a well-known id; every private
// canvas is the same thing keyed by its share code.
const CANVAS_CAPACITY = 5
const LIVE_CANVAS_ID = 'live'

const canvases = new Map()

function getCanvas(id) {
  if (!canvases.has(id)) {
    canvases.set(id, {
      // A baked full-resolution image, plus every stroke drawn since that bake.
      // Joiners paint the image then replay the strokes, so what they see is
      // pixel-identical to what everyone else has rather than a rescaled JPEG.
      dataUrl: null,
      segments: [],
      messages: [],
      pins: [],
      users: new Map(),
      // socket.id -> { undo: strokeId[], redo: strokeId[] }. Undo only ever
      // retires the caller's own strokes, never a collaborator's.
      history: new Map(),
      lastBakeRequest: 0,
      touched: Date.now(),
    })
  }
  const c = canvases.get(id)
  c.touched = Date.now()
  return c
}

const canvasRoom = (id) => `canvas:${id}`

// Once this many strokes pile up, ask a client for a fresh bake so replay
// stays short. Requests are rate-limited in case the chosen client is gone.
const BAKE_AT_SEGMENTS = 1200
const BAKE_COOLDOWN_MS = 15000
const SEGMENT_HARD_CAP = 20000
// Strokes this recent survive a bake: they may not have reached the baking
// client before it rendered. Replaying a stroke twice is idempotent.
const BAKE_OVERLAP_MS = 2500

const liveOps = (canvas) => canvas.segments.filter((o) => !o.undone)

function historyFor(canvas, socketId) {
  if (!canvas.history.has(socketId)) canvas.history.set(socketId, { undo: [], redo: [] })
  return canvas.history.get(socketId)
}

function recordOp(canvas, socket, op) {
  canvas.segments.push({ ...op, t: Date.now(), by: socket.id, undone: false })
  if (canvas.segments.length > SEGMENT_HARD_CAP) {
    canvas.segments.splice(0, canvas.segments.length - SEGMENT_HARD_CAP)
  }
  const h = historyFor(canvas, socket.id)
  if (h.undo[h.undo.length - 1] !== op.strokeId) h.undo.push(op.strokeId)
  h.redo.length = 0
  maybeRequestBake(canvas)
}

/** Flips one stroke on or off and has everyone repaint from the baseline. */
function setStrokeUndone(canvas, room, strokeId, undone) {
  let hit = false
  for (const op of canvas.segments) {
    if (op.strokeId === strokeId) {
      op.undone = undone
      hit = true
    }
  }
  if (hit) io.to(room).emit('canvas_rebuild', { ops: liveOps(canvas) })
  return hit
}

function maybeRequestBake(canvas) {
  if (canvas.segments.length < BAKE_AT_SEGMENTS) return
  const now = Date.now()
  if (now - canvas.lastBakeRequest < BAKE_COOLDOWN_MS) return
  const [firstId] = canvas.users.keys()
  if (!firstId) return
  canvas.lastBakeRequest = now
  io.to(firstId).emit('canvas_bake')
}

// Each private canvas holds a full-resolution PNG, so abandoned ones cannot be
// kept forever. The open canvas is never swept.
const CANVAS_IDLE_TTL_MS = 60 * 60 * 1000

setInterval(() => {
  const cutoff = Date.now() - CANVAS_IDLE_TTL_MS
  for (const [id, c] of canvases) {
    if (id === LIVE_CANVAS_ID) continue
    if (c.users.size === 0 && c.touched < cutoff) canvases.delete(id)
  }
}, 5 * 60 * 1000).unref()

function uid() {
  return `${Date.now()}_${Math.random().toString(36).slice(2)}`
}

function sys(content) {
  return { id: uid(), type: 'system', content, timestamp: Date.now() }
}

function trim(arr, max = 300) {
  if (arr.length > max) arr.splice(0, arr.length - max)
}

const engine = createEngine(io)

io.on('connection', (socket) => {
  // ── Private Room ──────────────────────────────

  socket.on('join_room', ({ username, color, avatar, roomId }) => {
    const room = getRoom(roomId)
    room.users.set(socket.id, { username, color, avatar })
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

  // Resolves the canvas this socket belongs to, or null if it never joined one.
  const myCanvas = () => {
    const id = socket.data.canvasId
    if (!id) return null
    const c = canvases.get(id)
    return c && c.users.has(socket.id) ? c : null
  }

  socket.on('join_canvas', ({ username, color, avatar, canvasId }) => {
    // Normalise once: codes are case-insensitive, and the open canvas keeps its
    // lowercase id. Deriving the key and the room from different strings would
    // leave the socket pointing at a canvas that does not exist.
    const code = String(canvasId || LIVE_CANVAS_ID).trim().toUpperCase().slice(0, 12)
    const id = code === LIVE_CANVAS_ID.toUpperCase() ? LIVE_CANVAS_ID : code
    const canvas = getCanvas(id)
    const room = canvasRoom(id)

    // Every canvas seats a fixed number of people; turn the rest away before
    // they join the room, so they receive nothing further.
    if (!canvas.users.has(socket.id) && canvas.users.size >= CANVAS_CAPACITY) {
      socket.emit('canvas_full', { capacity: CANVAS_CAPACITY })
      return
    }

    canvas.users.set(socket.id, { username, color, avatar })
    socket.join(room)
    socket.data.canvasUser = { username, color, avatar }
    socket.data.canvasId = id

    socket.emit('canvas_init', {
      dataUrl: canvas.dataUrl,
      segments: liveOps(canvas),
      messages: canvas.messages.slice(-100),
      pins: canvas.pins,
      capacity: CANVAS_CAPACITY,
    })
    io.to(room).emit('canvas_user_count', canvas.users.size)

    const msg = sys(`${username} joined`)
    canvas.messages.push(msg)
    io.to(room).emit('canvas_message', msg)
  })

  socket.on('canvas_draw', (data) => {
    const canvas = myCanvas()
    if (!canvas) return
    socket.to(canvasRoom(socket.data.canvasId)).emit('canvas_draw', data)
    recordOp(canvas, socket, data)
  })

  socket.on('canvas_fill', (data) => {
    const canvas = myCanvas()
    if (!canvas) return
    socket.to(canvasRoom(socket.data.canvasId)).emit('canvas_fill', data)
    recordOp(canvas, socket, { ...data, kind: 'fill' })
  })

  socket.on('canvas_undo', () => {
    const canvas = myCanvas()
    if (!canvas) return
    const h = historyFor(canvas, socket.id)
    const room = canvasRoom(socket.data.canvasId)
    // Walk back past strokes already baked into the image, which cannot be lifted.
    while (h.undo.length) {
      const strokeId = h.undo.pop()
      if (setStrokeUndone(canvas, room, strokeId, true)) {
        h.redo.push(strokeId)
        return
      }
    }
  })

  socket.on('canvas_redo', () => {
    const canvas = myCanvas()
    if (!canvas) return
    const h = historyFor(canvas, socket.id)
    const room = canvasRoom(socket.data.canvasId)
    while (h.redo.length) {
      const strokeId = h.redo.pop()
      if (setStrokeUndone(canvas, room, strokeId, false)) {
        h.undo.push(strokeId)
        return
      }
    }
  })

  socket.on('canvas_save', ({ dataUrl }) => {
    const canvas = myCanvas()
    if (!canvas) return
    canvas.dataUrl = dataUrl
    const cutoff = Date.now() - BAKE_OVERLAP_MS
    canvas.segments = canvas.segments.filter((s) => s.t > cutoff)

    // Everyone keeps the baseline so an undo only has to ship the op list.
    const room = canvasRoom(socket.data.canvasId)
    socket.to(room).emit('canvas_baked', { dataUrl })

    // Strokes folded into the image can no longer be lifted out of it.
    const alive = new Set(canvas.segments.map((o) => o.strokeId))
    for (const h of canvas.history.values()) {
      h.undo = h.undo.filter((id) => alive.has(id))
      h.redo = h.redo.filter((id) => alive.has(id))
    }
  })

  // Cursors are broadcast only while someone is actually drawing.
  socket.on('canvas_cursor', ({ xPct, yPct }) => {
    const canvas = myCanvas()
    if (!canvas) return
    const user = canvas.users.get(socket.id)
    socket
      .to(canvasRoom(socket.data.canvasId))
      .emit('canvas_cursor', { id: socket.id, user, xPct, yPct })
  })

  socket.on('canvas_cursor_end', () => {
    if (!myCanvas()) return
    socket.to(canvasRoom(socket.data.canvasId)).emit('canvas_cursor_end', { id: socket.id })
  })

  socket.on('canvas_pin', ({ xPct, yPct, text }) => {
    const canvas = myCanvas()
    if (!canvas) return
    const user = canvas.users.get(socket.id)
    const pin = { id: uid(), xPct, yPct, text, user, timestamp: Date.now() }
    canvas.pins.push(pin)
    io.to(canvasRoom(socket.data.canvasId)).emit('canvas_pin', pin)
  })

  /**
   * Anyone on the canvas can clear any comment. The alternative — author only —
   * leaves pins from people who have since left permanently stuck on the
   * canvas, which is the clutter this is meant to solve. Restricting it would
   * mean comparing `pin.user.username` against the caller's here.
   */
  socket.on('canvas_pin_delete', ({ id }) => {
    const canvas = myCanvas()
    if (!canvas) return
    const before = canvas.pins.length
    canvas.pins = canvas.pins.filter((p) => p.id !== id)
    if (canvas.pins.length === before) return
    io.to(canvasRoom(socket.data.canvasId)).emit('canvas_pin_removed', { id })
  })

  socket.on('canvas_chat', ({ text }) => {
    const canvas = myCanvas()
    if (!canvas) return
    const user = canvas.users.get(socket.id)
    const msg = { id: uid(), user, type: 'text', content: text, timestamp: Date.now() }
    canvas.messages.push(msg)
    trim(canvas.messages)
    io.to(canvasRoom(socket.data.canvasId)).emit('canvas_message', msg)
  })

  // ── ThinkInk ───────────────────────────────────

  const myGame = () => {
    const code = socket.data.gameCode
    if (!code || !hasGame(code)) return null
    const g = getGame(code)
    return g.players.has(socket.id) ? g : null
  }

  socket.on('game_join', ({ username, color, avatar, code }) => {
    const id = String(code || '').trim().toUpperCase().slice(0, 12)
    if (!id) return
    const game = getGame(id)

    if (!game.players.has(socket.id) && game.players.size >= GAME_CAPACITY) {
      socket.emit('game_full', { capacity: GAME_CAPACITY })
      return
    }

    socket.join(gameRoom(id))
    socket.data.gameCode = id
    engine.join(game, socket.id, { username, color, avatar })
    engine.say(game, username + ' joined')

    // Someone arriving mid-turn still needs to see what has been drawn.
    if (game.phase === 'drawing') socket.emit('game_replay', { strokes: game.strokes })
  })

  socket.on('game_settings', (patch) => {
    const game = myGame()
    if (game) engine.setSettings(game, socket.id, patch ?? {})
  })

  socket.on('game_ready', ({ ready }) => {
    const game = myGame()
    if (game) engine.setReady(game, socket.id, Boolean(ready))
  })

  socket.on('game_choose', ({ word }) => {
    const game = myGame()
    if (game) engine.chooseWord(game, socket.id, word)
  })

  socket.on('game_draw', (op) => {
    const game = myGame()
    if (!game || !engine.addStroke(game, socket.id, op)) return
    socket.to(gameRoom(game.code)).emit('game_draw', op)
  })

  socket.on('game_clear', () => {
    const game = myGame()
    if (!game || !engine.clearStrokes(game, socket.id)) return
    io.to(gameRoom(game.code)).emit('game_clear')
  })

  socket.on('game_guess', ({ text }) => {
    const game = myGame()
    if (!game) return
    const body = String(text || '').slice(0, 200).trim()
    if (!body) return

    const player = game.players.get(socket.id)
    const verdict = engine.handleMessage(game, socket.id, body)

    if (verdict === 'chat') {
      io.to(gameRoom(game.code)).emit('game_message', {
        id: uid(),
        user: player.user,
        type: 'text',
        content: body,
        timestamp: Date.now(),
      })
    } else if (verdict === 'close') {
      // Only the guesser hears this; announcing it would hint to everyone.
      socket.emit('game_close', { text: body })
    } else if (verdict === 'blocked') {
      socket.emit('game_blocked')
    }
  })

  socket.on('game_leave', () => {
    const game = myGame()
    if (!game) return
    socket.leave(gameRoom(game.code))
    engine.leave(game, socket.id)
    socket.data.gameCode = null
  })

  // ── Disconnect ────────────────────────────────

  socket.on('disconnect', () => {
    const gameCode = socket.data.gameCode
    if (gameCode && hasGame(gameCode)) {
      const g = getGame(gameCode)
      const p = g.players.get(socket.id)
      if (p) engine.say(g, p.user.username + ' left')
      engine.leave(g, socket.id)
    }

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
    const canvas = socket.data.canvasId ? canvases.get(socket.data.canvasId) : null
    if (cu && canvas) {
      const room = canvasRoom(socket.data.canvasId)
      canvas.users.delete(socket.id)
      canvas.history.delete(socket.id)
      canvas.touched = Date.now()
      io.to(room).emit('canvas_cursor_end', { id: socket.id })
      io.to(room).emit('canvas_user_count', canvas.users.size)
      const msg = sys(`${cu.username} left`)
      canvas.messages.push(msg)
      io.to(room).emit('canvas_message', msg)
    }
  })
})

// Hitting this host in a browser is a natural mistake — it looks like the app
// but only speaks WebSocket. Say so, rather than returning a bare 404.
app.get('/', (_req, res) => {
  res.type('text/plain').send(
    `InkSync realtime server.

This is not the app — it only carries the live drawing and chat.
Open the InkSync site instead; it connects here in the background.

Status: /health
`
  )
})

// Somewhere to point an uptime check, and a quick way to confirm from another
// network that the server is actually reachable.
app.get('/health', (_req, res) => {
  // `origins` and `sockets` are here so a misconfigured deploy can be diagnosed
  // from outside: if your site's URL is missing from the allowlist, browsers are
  // being turned away, and sockets stays at 0 however many people are looking.
  res.json({
    ok: true,
    origins: CLIENT_ORIGINS,
    sockets: io.engine.clientsCount,
    canvases: canvases.size,
    rooms: rooms.size,
  })
})

httpServer.listen(PORT, () => {
  console.log(`InkSync server running on :${PORT}`)
  console.log(
    'Allowed origins:',
    CLIENT_ORIGINS === '*' ? '* (any — set CLIENT_ORIGIN to restrict)' : CLIENT_ORIGINS.join(', ')
  )
})
