/**
 * Sound, synthesised rather than sampled.
 *
 * Every effect is built in the Web Audio graph from filtered noise and a few
 * sine blips — paper is mostly noise anyway. There are no audio files to ship
 * or license, and every sheet, pin and pencil stroke comes out a little
 * different each time, the way paper does.
 *
 * Browsers only allow audio once the person has interacted with the page, so
 * the context is created on the first press or keypress. Anything played
 * before then is dropped, not queued: a burst of catch-up sounds on the first
 * click would be worse than silence.
 */

const KEY = 'inksync.sound'
const MASTER = 0.8

interface Out {
  ctx: BaseAudioContext
  dest: AudioNode
  noise: AudioBuffer
}

type Voice = (o: Out, t: number) => void

let ctx: AudioContext | null = null
let master: GainNode | null = null
let noise: AudioBuffer | null = null
let muted = readMuted()
const listeners = new Set<() => void>()

function readMuted() {
  try {
    return localStorage.getItem(KEY) === 'off'
  } catch {
    return false
  }
}

export function isMuted() {
  return muted
}

export function subscribeMuted(onChange: () => void) {
  listeners.add(onChange)
  return () => {
    listeners.delete(onChange)
  }
}

/** Called from a click, so turning sound on also counts as the unlocking gesture. */
export function setMuted(next: boolean) {
  muted = next
  try {
    localStorage.setItem(KEY, next ? 'off' : 'on')
  } catch {
    // The choice just won't outlive the tab.
  }
  if (!next) unlock()
  if (ctx && master) master.gain.setTargetAtTime(next ? 0 : MASTER, ctx.currentTime, 0.02)
  listeners.forEach((l) => l())
}

function makeNoise(c: BaseAudioContext) {
  const buf = c.createBuffer(1, c.sampleRate * 2, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1
  return buf
}

/** Master gain into a gentle compressor, so stacked voices never clip. */
function makeBus(c: BaseAudioContext, level: number) {
  const gain = c.createGain()
  gain.gain.value = level
  const comp = c.createDynamicsCompressor()
  comp.threshold.value = -14
  comp.knee.value = 10
  comp.ratio.value = 4
  comp.attack.value = 0.003
  comp.release.value = 0.15
  gain.connect(comp).connect(c.destination)
  return gain
}

function unlock() {
  if (muted || typeof window.AudioContext !== 'function') return
  if (!ctx) {
    ctx = new AudioContext()
    master = makeBus(ctx, MASTER)
    noise = makeNoise(ctx)
  }
  if (ctx.state === 'suspended') void ctx.resume()
}

const rand = (a: number, b: number) => a + Math.random() * (b - a)

/** A burst of filtered noise: the grain every paper sound is made of. */
function hiss(
  o: Out,
  t: number,
  {
    dur,
    freq,
    to,
    q = 1,
    type = 'bandpass',
    gain,
    attack = 0.002,
  }: { dur: number; freq: number; to?: number; q?: number; type?: BiquadFilterType; gain: number; attack?: number }
) {
  const src = o.ctx.createBufferSource()
  src.buffer = o.noise
  const filter = o.ctx.createBiquadFilter()
  filter.type = type
  filter.Q.value = q
  filter.frequency.setValueAtTime(freq, t)
  if (to) filter.frequency.exponentialRampToValueAtTime(to, t + dur)
  const env = o.ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(gain, t + attack)
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  src.connect(filter).connect(env).connect(o.dest)
  // A random start into the noise, so repeats never sound identical.
  src.start(t, rand(0, 1.4))
  src.stop(t + dur + 0.02)
}

/** A pitched blip: the weight under a tap, or the body of a mallet note. */
function blip(
  o: Out,
  t: number,
  {
    freq,
    to,
    dur,
    type = 'sine',
    gain,
    attack = 0.003,
  }: { freq: number; to?: number; dur: number; type?: OscillatorType; gain: number; attack?: number }
) {
  const osc = o.ctx.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur)
  const env = o.ctx.createGain()
  env.gain.setValueAtTime(0.0001, t)
  env.gain.exponentialRampToValueAtTime(gain, t + attack)
  env.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  osc.connect(env).connect(o.dest)
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

/** A soft wooden mallet note — the only tonal colour, kept for game moments. */
function mallet(o: Out, t: number, freq: number, gain: number) {
  blip(o, t, { freq, dur: 0.34, gain })
  blip(o, t, { freq: freq * 4, dur: 0.07, gain: gain * 0.22 })
  hiss(o, t, { dur: 0.01, freq: 3000, gain: gain * 0.5 })
}

/** Paper sliding and settling: a flurry of soft grains over a faint bed. */
function rustle(o: Out, t: number) {
  hiss(o, t, { dur: 0.32, freq: 2400, q: 0.5, gain: 0.06, attack: 0.06 })
  for (let i = 0; i < 6; i++) {
    hiss(o, t + i * 0.04 + rand(0, 0.02), {
      dur: rand(0.05, 0.11),
      freq: rand(1400, 4200),
      q: 0.8,
      gain: rand(0.06, 0.14),
    })
  }
}

const VOICES = {
  /** A card pressed: a dry paper tap with a little weight under it. */
  tap(o, t) {
    hiss(o, t, { dur: 0.045, freq: 1900, q: 0.9, gain: 0.3 })
    blip(o, t, { freq: 150, to: 85, dur: 0.06, gain: 0.2 })
  },

  /** A pencil tick on the page, for small controls. */
  tick(o, t) {
    hiss(o, t, { dur: 0.022, freq: 4200, q: 1.4, gain: 0.32 })
  },

  /** A key going down: a soft click with a little body, a shade different every time. */
  key(o, t) {
    const pitch = rand(0.88, 1.14)
    hiss(o, t, { dur: 0.014, freq: 3200 * pitch, q: 1.6, gain: rand(0.14, 0.2) })
    blip(o, t, { freq: 210 * pitch, to: 140 * pitch, dur: 0.025, gain: rand(0.06, 0.09) })
  },

  /** The space bar: lower, broader, a touch longer. */
  space(o, t) {
    hiss(o, t, { dur: 0.024, freq: 1700, q: 1.1, gain: 0.13 })
    blip(o, t, { freq: 150, to: 100, dur: 0.035, gain: 0.08 })
  },

  /** Backspace: duller and softer — taking a letter back, not adding one. */
  erase(o, t) {
    hiss(o, t, { dur: 0.02, freq: 1400, q: 0.8, gain: 0.24 })
    blip(o, t, { freq: 120, to: 90, dur: 0.022, gain: 0.05 })
  },

  rustle,

  /** A card flicked across another: the carousel dealing, a note sent. */
  flick(o, t) {
    hiss(o, t, { dur: 0.1, freq: 1100, to: 3600, q: 1.1, gain: 0.3, attack: 0.02 })
    hiss(o, t + 0.085, { dur: 0.02, freq: 4600, q: 2, gain: 0.15 })
  },

  /** Masking tape off the roll: a quick ratchet of rising crackles. */
  tape(o, t) {
    for (let i = 0; i < 14; i++) {
      hiss(o, t + i * 0.011 + rand(0, 0.003), {
        dur: 0.016,
        freq: 1600 + i * 220,
        q: 2.2,
        gain: rand(0.13, 0.23),
      })
    }
  },

  /** Screwed up into a ball: irregular crackles over a rustle, dying away. */
  crumple(o, t) {
    hiss(o, t, { dur: 0.45, freq: 2000, q: 0.6, gain: 0.07, attack: 0.03 })
    for (let i = 0; i < 18; i++) {
      const at = rand(0, 0.42)
      hiss(o, t + at, {
        dur: rand(0.012, 0.045),
        freq: rand(900, 5200),
        q: rand(1, 3),
        gain: rand(0.08, 0.24) * (1 - at),
      })
    }
  },

  /** A sheet sliding away: a swell of air rising in pitch. */
  whoosh(o, t) {
    hiss(o, t, { dur: 0.42, freq: 450, to: 2600, q: 1.3, gain: 0.24, attack: 0.16 })
  },

  /** A drawing pin pushed home: the point's click, then a woody thock. */
  pin(o, t) {
    hiss(o, t, { dur: 0.012, freq: 5200, q: 2, gain: 0.2 })
    blip(o, t + 0.008, { freq: 230, to: 115, dur: 0.075, gain: 0.22 })
  },

  /** Pulled back out: a short rising pluck. */
  unpin(o, t) {
    blip(o, t, { freq: 160, to: 340, dur: 0.07, gain: 0.18 })
    hiss(o, t + 0.04, { dur: 0.03, freq: 3200, q: 1.5, gain: 0.1 })
  },

  /** A sticky note pressed flat. */
  stick(o, t) {
    blip(o, t, { freq: 175, to: 95, dur: 0.08, gain: 0.2 })
    hiss(o, t, { dur: 0.06, freq: 900, q: 0.7, gain: 0.13 })
  },

  /** Paint poured into a shape: a soft, wet sweep downward. */
  pour(o, t) {
    hiss(o, t, { dur: 0.28, freq: 1400, to: 320, type: 'lowpass', q: 4, gain: 0.18, attack: 0.02 })
    blip(o, t, { freq: 120, to: 70, dur: 0.12, gain: 0.12 })
  },

  /** A note arriving: paper slid across, and one soft mallet tone. */
  note(o, t) {
    hiss(o, t, { dur: 0.08, freq: 2400, q: 0.8, gain: 0.07 })
    mallet(o, t + 0.03, 988, 0.09)
  },

  /** A paper die rattling to a stop. */
  dice(o, t) {
    let at = t
    for (let i = 0; i < 5; i++) {
      hiss(o, at, { dur: 0.02, freq: rand(2400, 4200), q: 3, gain: rand(0.12, 0.2) })
      blip(o, at, { freq: rand(300, 420), to: 200, dur: 0.03, gain: 0.09 })
      at += rand(0.04, 0.08)
    }
  },

  /** Someone guessed it: a rising three-note run. */
  correct(o, t) {
    [1047, 1319, 1568].forEach((f, i) => mallet(o, t + i * 0.07, f, 0.09))
  },

  /** You guessed it: the same run, a step higher and a note longer. */
  solved(o, t) {
    [1175, 1480, 1760, 2349].forEach((f, i) => mallet(o, t + i * 0.07, f, 0.1))
  },

  /** So close: two notes that slip down instead of resolving. */
  close(o, t) {
    mallet(o, t, 784, 0.08)
    mallet(o, t + 0.09, 740, 0.08)
  },

  /** Your turn to draw: a page turned, and a two-note call. */
  turn(o, t) {
    rustle(o, t)
    mallet(o, t + 0.12, 784, 0.09)
    mallet(o, t + 0.22, 1175, 0.09)
  },

  /** The clock's last seconds: a woodblock. */
  clock(o, t) {
    blip(o, t, { freq: 920, to: 760, dur: 0.045, type: 'triangle', gain: 0.21 })
    hiss(o, t, { dur: 0.015, freq: 2600, q: 2, gain: 0.11 })
  },

  /** Game over: a mallet fanfare over a scatter of paper. */
  win(o, t) {
    [523, 659, 784, 1047, 1319].forEach((f, i) => mallet(o, t + i * 0.09, f, 0.09))
    rustle(o, t + 0.35)
    rustle(o, t + 0.6)
  },
} satisfies Record<string, Voice>

export type SoundName = keyof typeof VOICES

/** When each sound was last scheduled, keyed by name and delay. */
const recent = new Map<string, number>()

/**
 * Plays a sound if sound is on and unlocked. `gain` scales just this play —
 * remote events are a little quieter than your own.
 *
 * The same sound asked for twice within 30ms plays once. That absorbs
 * StrictMode running mount effects twice, and a press sound and an action
 * sound that land on the same voice.
 */
export function play(name: SoundName, { delay = 0, gain = 1 } = {}) {
  if (muted || !ctx || !master || !noise || ctx.state !== 'running') return
  const key = `${name}@${delay}`
  const now = ctx.currentTime
  if (now - (recent.get(key) ?? -1) < 0.03) return
  recent.set(key, now)

  let dest: AudioNode = master
  if (gain !== 1) {
    const g = ctx.createGain()
    g.gain.value = gain
    g.connect(master)
    dest = g
  }
  VOICES[name]({ ctx, dest, noise }, now + 0.005 + delay)
}

/** Inputs that take typing. Range sliders also fire `input`, and must stay silent. */
const TYPED = new Set(['text', 'search', 'email', 'url', 'tel', 'password'])

/** The quickest one key sound may follow another, so a held key or a fast
    burst never turns into a rattle. */
const KEY_GAP_MS = 55
let lastKey = 0

/**
 * A soft click per character typed. Driven by `input` rather than keydown,
 * because phone keyboards often report every key as "Unidentified", or
 * compose a word before committing it — but they always fire `input`.
 */
function onType(e: Event) {
  const field = e.target
  const typed =
    field instanceof HTMLTextAreaElement || (field instanceof HTMLInputElement && TYPED.has(field.type))
  if (!typed) return
  // A plain Event dispatched by script carries neither field.
  const { inputType = '', data = null } = e as Partial<InputEvent>
  // A paste or a dropped word is one action, not dozens of keys.
  if (inputType === 'insertFromPaste' || inputType === 'insertFromDrop') return
  const now = performance.now()
  if (now - lastKey < KEY_GAP_MS) return
  lastKey = now
  if (inputType.startsWith('delete')) play('erase')
  else if (data === ' ') play('space')
  else play('key')
}

/** Controls small enough that a tick suits them better than a tap. */
const SMALL =
  '.swatch, .collab-swatch, .welcome-swatch, .tool-btn, .collab-tool-btn, .collab-ctrl-btn, ' +
  '.avatar-step, .game-size, .back-btn, .pin-delete, .settings-stepper button'

/**
 * Starts listening for the unlocking gesture, and gives every button a press
 * sound without each one having to ask: small controls tick, the rest tap.
 * A button's `data-sound` picks another voice, or "none" for buttons whose
 * action already makes its own. Typing in any text field clicks softly.
 */
export function installSound() {
  for (const type of ['pointerdown', 'keydown'] as const) {
    window.addEventListener(type, unlock, { capture: true, passive: true })
  }
  window.addEventListener(
    'click',
    (e) => {
      const button = (e.target as Element | null)?.closest?.('button')
      if (!button || button.disabled) return
      const named = button.dataset.sound
      if (named === 'none') return
      if (named && named in VOICES) play(named as SoundName)
      else play(button.matches(SMALL) ? 'tick' : 'tap')
    },
    { capture: true }
  )
  window.addEventListener('input', onType, { capture: true })
}

/* ── The pencil ──
   One continuous voice per stroke: looping noise through a band-pass, its
   level following how fast the pen is moving. A small random wobble on every
   movement is the paper's tooth catching the lead. While the pointer is held
   still the energy decays each frame, so a paused pen falls silent. */

type Tip = 'pen' | 'eraser'

const PEAK: Record<Tip, number> = { pen: 0.075, eraser: 0.08 }
/** Screen pixels per millisecond that count as a full-speed stroke. */
const FULL_SPEED = 1.6

function scratch(o: Out, tip: Tip) {
  const src = o.ctx.createBufferSource()
  src.buffer = o.noise
  src.loop = true
  const band = o.ctx.createBiquadFilter()
  band.type = 'bandpass'
  band.frequency.value = tip === 'pen' ? 3600 : 900
  band.Q.value = tip === 'pen' ? 0.9 : 0.7
  const env = o.ctx.createGain()
  env.gain.value = 0
  src.connect(band).connect(env).connect(o.dest)
  src.start(o.ctx.currentTime, rand(0, 1.4))
  return { src, band, gain: env.gain, base: band.frequency.value }
}

let stroke: (ReturnType<typeof scratch> & { tip: Tip; x: number; y: number; at: number; energy: number }) | null =
  null
let frame = 0

function decay() {
  if (!stroke || !ctx) return
  stroke.energy *= 0.8
  stroke.gain.setTargetAtTime(stroke.energy, ctx.currentTime, 0.02)
  frame = requestAnimationFrame(decay)
}

/** Where the pointer is on screen, so speed means the same on every canvas size. */
function screenPoint(e: MouseEvent | TouchEvent) {
  const p = 'touches' in e ? (e.touches[0] ?? e.changedTouches[0]) : e
  return { x: p?.clientX ?? 0, y: p?.clientY ?? 0 }
}

export const pencil = {
  start(tip: Tip, e: MouseEvent | TouchEvent) {
    pencil.end()
    if (muted || !ctx || !master || !noise || ctx.state !== 'running') return
    const { x, y } = screenPoint(e)
    stroke = { ...scratch({ ctx, dest: master, noise }, tip), tip, x, y, at: performance.now(), energy: 0 }
    frame = requestAnimationFrame(decay)
  },

  move(e: MouseEvent | TouchEvent) {
    if (!stroke || !ctx) return
    const { x, y } = screenPoint(e)
    const now = performance.now()
    const speed = Math.hypot(x - stroke.x, y - stroke.y) / Math.max(8, now - stroke.at)
    stroke.x = x
    stroke.y = y
    stroke.at = now
    const pace = Math.min(1, speed / FULL_SPEED)
    stroke.energy = Math.max(stroke.energy, pace * rand(0.75, 1) * PEAK[stroke.tip])
    stroke.band.frequency.setTargetAtTime(stroke.base * (0.85 + pace * 0.4), ctx.currentTime, 0.05)
  },

  end() {
    cancelAnimationFrame(frame)
    if (stroke && ctx) {
      stroke.gain.setTargetAtTime(0, ctx.currentTime, 0.03)
      stroke.src.stop(ctx.currentTime + 0.25)
    }
    stroke = null
  },
}

/* ── Auditioning ──
   Offline renders of the same graphs, for level-checking every voice and for
   exporting them to listen to. Unused by the app, so they drop out of the
   production bundle. */

const RATE = 44100

export async function renderOffline(name: SoundName, seconds = 1.4) {
  const off = new OfflineAudioContext(1, Math.ceil(RATE * seconds), RATE)
  VOICES[name]({ ctx: off, dest: makeBus(off, MASTER), noise: makeNoise(off) }, 0.01)
  return off.startRendering()
}

/** A canned stroke: speeds up, scribbles, pauses, and lifts. */
export async function renderPencilOffline(tip: Tip) {
  const off = new OfflineAudioContext(1, Math.ceil(RATE * 1.4), RATE)
  const s = scratch({ ctx: off, dest: makeBus(off, MASTER), noise: makeNoise(off) }, tip)
  for (let i = 0; i < 70; i++) {
    const t = i * 0.016
    const pace = i < 40 ? Math.min(1, i / 12) * (0.6 + 0.4 * Math.abs(Math.sin(i / 3))) : i < 55 ? 0 : 0.5
    s.gain.setTargetAtTime(pace * rand(0.75, 1) * PEAK[tip], t, 0.025)
  }
  s.gain.setTargetAtTime(0, 1.15, 0.03)
  s.src.stop(1.35)
  return off.startRendering()
}
