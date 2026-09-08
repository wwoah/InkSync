import { pickWords, WORDS } from './words.js'
import { judgeGuess, maskWord } from './guess.js'

export const GAME_CAPACITY = 8
export const MIN_PLAYERS = 2

const PICK_MS = 15000
const DEFAULT_DRAW_SECONDS = 80
const REVEAL_MS = 6000
/** Nobody is still thinking once everyone has it, so move along quickly. */
const REVEAL_FAST_MS = 2500
const DEFAULT_ROUNDS = 3
const WORD_CHOICES = 3

/** Bounds for anything the host can dial. Values arrive from a client, so they
 *  are clamped here rather than trusted. */
export const LIMITS = {
  rounds: { min: 1, max: 8 },
  drawSeconds: { min: 20, max: 240 },
  wordLength: { min: 2, max: 24 },
  maxCustomWords: 200,
}

const defaultSettings = () => ({
  rounds: DEFAULT_ROUNDS,
  drawSeconds: DEFAULT_DRAW_SECONDS,
  customWords: [],
  /** Ignored unless there are enough custom words to offer a real choice. */
  customOnly: false,
})

const clampInt = (value, { min, max }, fallback) => {
  const n = Math.round(Number(value))
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback
}

/**
 * Accepts a raw blob or a list and returns clean, deduped words. Anything with
 * characters the mask cannot render, or that is too long to guess, is dropped.
 */
const SPLITTER = new RegExp('[,;\r\n]+')

export function cleanWords(input) {
  const raw = Array.isArray(input) ? input.join(',') : String(input ?? '')
  const seen = new Set()
  const out = []
  for (const piece of raw.split(SPLITTER)) {
    const w = piece.trim().toLowerCase().replace(/[^a-z0-9 -]/g, '').replace(/\s+/g, ' ')
    if (w.length < LIMITS.wordLength.min || w.length > LIMITS.wordLength.max) continue
    if (seen.has(w)) continue
    seen.add(w)
    out.push(w)
    if (out.length >= LIMITS.maxCustomWords) break
  }
  return out
}

/** The pool a turn draws from, honouring custom-only when it is viable. */
export function wordBank(game) {
  const custom = game.settings.customWords
  if (game.settings.customOnly && custom.length >= WORD_CHOICES) return custom
  return custom.length ? [...WORDS, ...custom] : WORDS
}

const drawMs = (game) => game.settings.drawSeconds * 1000

/** Guessing early is worth more; the floor keeps a late correct guess worthwhile. */
const GUESS_MIN = 100
const GUESS_MAX = 350
/** What the drawer earns per person who gets it. */
const DRAWER_PER_GUESS = 60

/**
 * Once someone has it, the rest of the lobby should not wait out the full clock
 * on an easy drawing. The first correct guess trims what is left, with a floor
 * so nobody is cut off mid-thought.
 */
const RUSH_FACTOR = 0.6
const RUSH_FLOOR_MS = 15000

const games = new Map()

export const gameRoom = (code) => `game:${code}`

export function getGame(code) {
  if (!games.has(code)) {
    games.set(code, {
      code,
      phase: 'lobby',
      players: new Map(), // socketId -> { user, score, ready, guessedAt, roundScore }
      order: [],
      turnIndex: 0,
      round: 1,
      /** The first person through the door sets the rules. */
      hostId: null,
      settings: defaultSettings(),
      word: null,
      choices: [],
      used: new Set(),
      revealed: [],
      endsAt: 0,
      timer: null,
      hintTimers: [],
      /** Standings after each completed turn — the lead timeline is built from this. */
      history: [],
      /** Strokes for the current turn, replayed to anyone joining mid-draw. */
      strokes: [],
      lastWinner: null,
      /** Frozen final standings, so the podium survives the lobby churn. */
      result: null,
    })
  }
  return games.get(code)
}

export function hasGame(code) {
  return games.has(code)
}

function clearTimer(game) {
  if (game.timer) clearTimeout(game.timer)
  game.timer = null
  game.hintTimers.forEach(clearTimeout)
  game.hintTimers = []
}

export const drawerId = (game) => game.order[game.turnIndex] ?? null

/**
 * What everyone may see. The word is masked here; the answer itself only ever
 * reaches the drawer, and the room once the turn is over.
 */
export function publicState(game) {
  return {
    phase: game.phase,
    round: game.round,
    maxRounds: game.settings.rounds,
    hostId: game.hostId,
    settings: game.settings,
    limits: LIMITS,
    drawerId: drawerId(game),
    endsAt: game.endsAt,
    minPlayers: MIN_PLAYERS,
    capacity: GAME_CAPACITY,
    word: game.word ? maskWord(game.word, game.revealed) : null,
    wordLength: game.word ? game.word.length : 0,
    lastWinner: game.lastWinner,
    result: game.result,
    history: game.history,
    players: [...game.players.entries()].map(([id, p]) => ({
      id,
      user: p.user,
      score: p.score,
      ready: p.ready,
      guessed: p.guessedAt != null,
      roundScore: p.roundScore,
    })),
  }
}

/** Everyone but the drawer — the people who can score by guessing. */
const guessers = (game) => [...game.players.entries()].filter(([id]) => id !== drawerId(game))

function allGuessed(game) {
  const rest = guessers(game)
  return rest.length > 0 && rest.every(([, p]) => p.guessedAt != null)
}

/**
 * The state machine. `io` is injected rather than imported so this module stays
 * independent of the server wiring, and can be driven directly from a test.
 *
 * Phases: lobby -> picking -> drawing -> reveal -> (picking | over)
 */
export function createEngine(io) {
  const push = (game) => io.to(gameRoom(game.code)).emit('game_state', publicState(game))

  const say = (game, content) =>
    io.to(gameRoom(game.code)).emit('game_message', {
      id: `${Date.now()}_${Math.random().toString(36).slice(2)}`,
      type: 'system',
      content,
      timestamp: Date.now(),
    })

  function dropGame(game) {
    clearTimer(game)
    games.delete(game.code)
  }

  function startPicking(game) {
    clearTimer(game)
    game.phase = 'picking'
    game.word = null
    game.revealed = []
    game.strokes = []
    game.lastWinner = null
    for (const p of game.players.values()) {
      p.guessedAt = null
      p.roundScore = 0
    }

    const drawer = drawerId(game)
    if (!drawer) return endGame(game)

    game.choices = pickWords(WORD_CHOICES, game.used, wordBank(game))
    game.endsAt = Date.now() + PICK_MS
    io.to(gameRoom(game.code)).emit('game_clear')
    push(game)
    io.to(drawer).emit('game_choices', { choices: game.choices })

    // Dithering forfeits the choice rather than stalling everyone else.
    game.timer = setTimeout(() => chooseWord(game, drawer, game.choices[0]), PICK_MS)
  }

  function chooseWord(game, socketId, word) {
    if (game.phase !== 'picking' || socketId !== drawerId(game)) return
    if (!game.choices.includes(word)) return
    clearTimer(game)

    game.word = word
    game.used.add(word)
    game.choices = []
    game.phase = 'drawing'
    game.endsAt = Date.now() + drawMs(game)
    push(game)
    io.to(socketId).emit('game_word', { word })

    scheduleHints(game, drawMs(game))
    game.timer = setTimeout(() => endTurn(game, 'time'), drawMs(game))
  }

  /** How many letters a word gives away over a full turn. */
  function hintBudget(game) {
    const letters = game.word.replace(/ /g, '').length
    return Math.max(1, Math.floor(letters / 2))
  }

  /**
   * Spreads the hints still owed across `windowMs`. Called again when the clock
   * is cut short, so a shorter turn still surrenders the same letters — losing
   * time and hints at once would be too harsh on whoever is still guessing.
   */
  function scheduleHints(game, windowMs) {
    game.hintTimers.forEach(clearTimeout)
    game.hintTimers = []
    const owed = hintBudget(game) - game.revealed.length
    if (owed <= 0) return
    const gap = windowMs / (owed + 1)
    for (let n = 1; n <= owed; n++) {
      const t = setTimeout(() => {
        if (game.phase !== 'drawing' || !game.word) return
        const hidden = []
        game.word.split('').forEach((ch, i) => {
          if (ch !== ' ' && !game.revealed.includes(i)) hidden.push(i)
        })
        if (!hidden.length) return
        game.revealed.push(hidden[Math.floor(Math.random() * hidden.length)])
        push(game)
      }, gap * n)
      game.hintTimers.push(t)
    }
  }

  /**
   * Shortens the turn once the word is out. Returns the new seconds remaining,
   * or null when the clock is already short enough to leave alone.
   */
  function rushClock(game) {
    const now = Date.now()
    const remaining = game.endsAt - now
    if (remaining <= 0) return null

    const cut = Math.max(remaining * RUSH_FACTOR, Math.min(remaining, RUSH_FLOOR_MS))
    if (cut >= remaining) return null

    game.endsAt = now + cut
    if (game.timer) clearTimeout(game.timer)
    game.timer = setTimeout(() => endTurn(game, 'time'), cut)
    scheduleHints(game, cut)
    return Math.ceil(cut / 1000)
  }

  function endTurn(game, reason) {
    if (game.phase !== 'drawing' && game.phase !== 'picking') return
    clearTimer(game)

    const word = game.word

    // Standings at the close of this turn, so the lead can be traced later.
    const standings = [...game.players.entries()]
      .map(([id, p]) => ({ id, name: p.user.username, color: p.user.color, score: p.score }))
      .sort((x, y) => y.score - x.score)
    if (standings.length) {
      game.history.push({
        turn: game.history.length + 1,
        round: game.round,
        word,
        leaderId: standings[0].id,
        leaderName: standings[0].name,
        leaderColor: standings[0].color,
        standings,
      })
    }

    const fast = reason === 'all-guessed'
    game.phase = 'reveal'
    game.endsAt = Date.now() + (fast ? REVEAL_FAST_MS : REVEAL_MS)
    // Scores are already banked; show the answer in full.
    game.revealed = word ? word.split('').map((_, i) => i) : []
    push(game)
    io.to(gameRoom(game.code)).emit('game_reveal', { word, reason })
    if (word) say(game, 'The word was "' + word + '".')

    game.timer = setTimeout(() => nextTurn(game), fast ? REVEAL_FAST_MS : REVEAL_MS)
  }

  function nextTurn(game) {
    clearTimer(game)
    game.turnIndex += 1
    if (game.turnIndex >= game.order.length) {
      game.turnIndex = 0
      game.round += 1
    }
    if (game.round > game.settings.rounds) return endGame(game)
    if (game.players.size < MIN_PLAYERS) return toLobby(game, 'Not enough players.')
    startPicking(game)
  }

  function endGame(game) {
    clearTimer(game)
    game.phase = 'over'
    game.word = null
    game.endsAt = 0

    // A snapshot, not a view of the roster: whoever finished on the podium stays
    // on it even if they close the tab, and later lobby changes cannot disturb it.
    const ranked = [...game.players.entries()]
      .map(([id, p]) => ({ id, user: p.user, score: p.score }))
      .sort((a, b) => b.score - a.score)
    game.result = {
      /** Stable across pushes, so the client can tell a new result from a re-send. */
      at: Date.now(),
      rounds: game.settings.rounds,
      turns: game.history.length,
      standings: ranked,
    }

    const best = ranked[0]
    game.lastWinner = best ? best.user.username : null
    push(game)
    if (best) say(game, best.user.username + ' wins with ' + best.score + ' points.')
  }

  function toLobby(game, why) {
    clearTimer(game)
    game.phase = 'lobby'
    game.word = null
    game.choices = []
    game.revealed = []
    game.endsAt = 0
    for (const p of game.players.values()) p.ready = false
    push(game)
    if (why) say(game, why)
  }

  function startGame(game) {
    if (game.phase !== 'lobby' && game.phase !== 'over') return
    if (game.players.size < MIN_PLAYERS) return
    game.order = [...game.players.keys()]
    game.turnIndex = 0
    game.round = 1
    game.used = new Set()
    game.history = []
    game.result = null
    for (const p of game.players.values()) {
      p.score = 0
      p.ready = false
    }
    say(game, 'Game on — good luck!')
    startPicking(game)
  }

  return {
    push,
    say,
    startGame,
    chooseWord,
    endTurn,
    toLobby,

    join(game, socketId, user) {
      // Whoever opens the room owns its settings.
      if (!game.hostId) game.hostId = socketId
      game.players.set(socketId, {
        user,
        score: game.players.get(socketId)?.score ?? 0,
        ready: false,
        guessedAt: null,
        roundScore: 0,
      })
      // Someone arriving mid-game joins the end of the order, so they draw
      // eventually rather than never.
      if (!game.order.includes(socketId)) game.order.push(socketId)
      push(game)
    },

    leave(game, socketId) {
      const player = game.players.get(socketId)
      if (!player) return
      const wasDrawer = drawerId(game) === socketId
      game.players.delete(socketId)

      const at = game.order.indexOf(socketId)
      if (at >= 0) {
        game.order.splice(at, 1)
        // Keep the pointer on the same person when someone earlier drops out.
        if (at < game.turnIndex) game.turnIndex -= 1
      }

      if (!game.players.size) return dropGame(game)

      // The settings must stay reachable, so the room is never left hostless.
      // Player keys are in join order, so the badge passes to whoever arrived
      // next, and down the line from there.
      if (game.hostId === socketId) game.hostId = game.players.keys().next().value ?? null

      if (game.phase !== 'lobby' && game.phase !== 'over') {
        if (game.players.size < MIN_PLAYERS) return toLobby(game, 'Not enough players.')
        // The turn cannot continue without the person drawing it.
        if (wasDrawer) {
          if (game.turnIndex >= game.order.length) game.turnIndex = 0
          say(game, player.user.username + ' left mid-turn.')
          game.phase = 'drawing'
          return endTurn(game, 'drawer-left')
        }
        if (allGuessed(game)) return endTurn(game, 'all-guessed')
      }
      push(game)
    },

    /**
     * Host-only, and only between matches — changing the clock or the round
     * count mid-turn would move the goalposts under everyone.
     */
    setSettings(game, socketId, patch) {
      if (socketId !== game.hostId) return false
      if (game.phase !== 'lobby' && game.phase !== 'over') return false
      const next = { ...game.settings }

      if (patch.rounds !== undefined) {
        next.rounds = clampInt(patch.rounds, LIMITS.rounds, next.rounds)
      }
      if (patch.drawSeconds !== undefined) {
        next.drawSeconds = clampInt(patch.drawSeconds, LIMITS.drawSeconds, next.drawSeconds)
      }
      if (patch.customWords !== undefined) {
        next.customWords = cleanWords(patch.customWords)
      }
      if (patch.customOnly !== undefined) {
        next.customOnly = Boolean(patch.customOnly)
      }

      // Promising to use only custom words with too few of them would leave the
      // drawer without a real choice, so the flag simply does not stick.
      if (next.customOnly && next.customWords.length < WORD_CHOICES) next.customOnly = false

      game.settings = next
      game.maxRounds = next.rounds
      push(game)
      return true
    },

    setReady(game, socketId, ready) {
      const p = game.players.get(socketId)
      if (!p) return
      if (game.phase !== 'lobby' && game.phase !== 'over') return
      p.ready = ready
      push(game)
      const all = [...game.players.values()].every((x) => x.ready)
      if (all && game.players.size >= MIN_PLAYERS) startGame(game)
    },

    /**
     * Returns how the message was handled, so the caller knows whether to relay
     * it as ordinary chat. A correct guess is never echoed — that would hand
     * the answer to everyone still thinking.
     */
    handleMessage(game, socketId, text) {
      const p = game.players.get(socketId)
      if (!p) return 'ignored'
      if (game.phase !== 'drawing' || !game.word) return 'chat'

      // The drawer must not type near the answer, and neither may anyone who
      // already has it — either would be telling the room.
      if (socketId === drawerId(game) || p.guessedAt != null) {
        return judgeGuess(text, game.word) === 'miss' ? 'chat' : 'blocked'
      }

      const verdict = judgeGuess(text, game.word)
      if (verdict === 'miss') return 'chat'
      if (verdict === 'close') return 'close'

      p.guessedAt = Date.now()
      const left = Math.max(0, game.endsAt - p.guessedAt) / drawMs(game)
      p.roundScore = Math.round(GUESS_MIN + (GUESS_MAX - GUESS_MIN) * left)
      p.score += p.roundScore

      const drawer = game.players.get(drawerId(game))
      if (drawer) {
        drawer.roundScore += DRAWER_PER_GUESS
        drawer.score += DRAWER_PER_GUESS
      }

      say(game, p.user.username + ' guessed the word!')

      // The first solver puts the rest on the clock. Later ones change nothing:
      // the turn ends by itself the moment everyone has it.
      const solved = [...game.players.values()].filter((x) => x.guessedAt != null).length
      if (solved === 1 && !allGuessed(game)) {
        const secs = rushClock(game)
        if (secs) say(game, 'Clock cut — ' + secs + 's left!')
      }

      push(game)
      if (allGuessed(game)) endTurn(game, 'all-guessed')
      return 'correct'
    },

    addStroke(game, socketId, op) {
      if (game.phase !== 'drawing' || socketId !== drawerId(game)) return false
      game.strokes.push(op)
      if (game.strokes.length > 20000) game.strokes.splice(0, game.strokes.length - 20000)
      return true
    },

    clearStrokes(game, socketId) {
      if (game.phase !== 'drawing' || socketId !== drawerId(game)) return false
      game.strokes = []
      return true
    },
  }
}
