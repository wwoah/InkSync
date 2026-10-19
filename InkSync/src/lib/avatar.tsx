import type { ReactNode } from 'react'

/**
 * Avatar parts, as data.
 *
 * Every part is drawn inside a 100×100 box, so a part never needs to know how
 * large it will be rendered. Art is a tagged union rather than raw JSX so that
 * hand-drawn placeholders and real asset files can coexist: when artwork
 * arrives, a part changes from `{ kind: 'draw' }` to `{ kind: 'image', src }`
 * and nothing that consumes the catalogue has to change.
 */
export type PartArt =
  /** `render` receives the player's colour; parts that ignore it just discard it. */
  | { kind: 'draw'; render: (color: string) => ReactNode }
  /**
   * A file. `tint` treats the image as a silhouette and fills it with the
   * player's colour — which is what a body asset needs, since a flat image
   * cannot pick up a colour on its own.
   */
  | { kind: 'image'; src: string; tint?: boolean }

/**
 * Marks a part as something to be earned. Absent means everyone has it.
 * The rule is only described here; awarding is up to whatever grants it.
 */
export interface UnlockRule {
  /** Shown in the picker, e.g. "Win 5 rounds". */
  label: string
}

export interface AvatarPart {
  id: string
  label: string
  art: PartArt
  unlock?: UnlockRule
}

export type PartKind = 'body' | 'eyes' | 'mouth'

export interface AvatarConfig {
  body: string
  eyes: string
  mouth: string
}

const stroke = {
  fill: 'none',
  stroke: '#15151c',
  strokeWidth: 6,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const

const EYES: AvatarPart[] = [
  {
    id: 'dots',
    label: 'Dots',
    art: {
      kind: 'draw',
      render: () => (
        <>
          <circle cx="36" cy="43" r="6" fill="#15151c" />
          <circle cx="64" cy="43" r="6" fill="#15151c" />
        </>
      ),
    },
  },
  {
    id: 'wide',
    label: 'Wide',
    art: {
      kind: 'draw',
      render: () => (
        <>
          <circle cx="36" cy="43" r="11" fill="#fff" stroke="#15151c" strokeWidth="3" />
          <circle cx="64" cy="43" r="11" fill="#fff" stroke="#15151c" strokeWidth="3" />
          <circle cx="37" cy="45" r="5" fill="#15151c" />
          <circle cx="65" cy="45" r="5" fill="#15151c" />
        </>
      ),
    },
  },
  {
    id: 'happy',
    label: 'Happy',
    art: {
      kind: 'draw',
      render: () => (
        <>
          <path d="M28 46q8-11 16 0" {...stroke} />
          <path d="M56 46q8-11 16 0" {...stroke} />
        </>
      ),
    },
  },
  {
    id: 'sleepy',
    label: 'Sleepy',
    art: {
      kind: 'draw',
      render: () => (
        <>
          <path d="M28 43q8 8 16 0" {...stroke} />
          <path d="M56 43q8 8 16 0" {...stroke} />
        </>
      ),
    },
  },
  {
    id: 'angry',
    label: 'Angry',
    art: {
      kind: 'draw',
      render: () => (
        <>
          <path d="M28 36l15 7" {...stroke} />
          <path d="M72 36l-15 7" {...stroke} />
          <circle cx="38" cy="50" r="5" fill="#15151c" />
          <circle cx="62" cy="50" r="5" fill="#15151c" />
        </>
      ),
    },
  },
  {
    id: 'wink',
    label: 'Wink',
    art: {
      kind: 'draw',
      render: () => (
        <>
          <path d="M28 43q8 8 16 0" {...stroke} />
          <circle cx="64" cy="43" r="6" fill="#15151c" />
        </>
      ),
    },
  },
]

const MOUTHS: AvatarPart[] = [
  {
    id: 'smile',
    label: 'Smile',
    art: { kind: 'draw', render: () => <path d="M36 66q14 13 28 0" {...stroke} /> },
  },
  {
    id: 'flat',
    label: 'Flat',
    art: { kind: 'draw', render: () => <path d="M38 69h24" {...stroke} /> },
  },
  {
    id: 'grin',
    label: 'Grin',
    art: {
      kind: 'draw',
      render: () => (
        <>
          <path d="M34 64q16 18 32 0z" fill="#fff" stroke="#15151c" strokeWidth="5" strokeLinejoin="round" />
          <path d="M38 67h24" stroke="#15151c" strokeWidth="4" strokeLinecap="round" />
        </>
      ),
    },
  },
  {
    id: 'oh',
    label: 'Oh',
    art: {
      kind: 'draw',
      render: () => <ellipse cx="50" cy="69" rx="8" ry="10" fill="#15151c" />,
    },
  },
  {
    id: 'frown',
    label: 'Frown',
    art: { kind: 'draw', render: () => <path d="M36 72q14-13 28 0" {...stroke} /> },
  },
  {
    id: 'smirk',
    label: 'Smirk',
    art: { kind: 'draw', render: () => <path d="M37 68q14 10 26-4" {...stroke} /> },
  },
]

/** A soft floor shade, so a flat fill still reads as a head rather than a disc. */
const shade = (d: string) => <path d={d} fill="rgba(0,0,0,0.13)" />

/**
 * A marker outline round every body. On paper a pale body — marigold, or the
 * white some older profiles still carry — would otherwise melt into the sheet,
 * and the line makes the faces read as doodles, of a piece with the inked
 * eyes and mouths. Every body keeps at least 2 units clear of the box edge,
 * so half this width never gets clipped.
 */
const outline = { stroke: '#15151c', strokeWidth: 3.5 } as const

const BODIES: AvatarPart[] = [
  {
    id: 'round',
    label: 'Round',
    art: {
      kind: 'draw',
      render: (c) => (
        <>
          <circle cx="50" cy="50" r="46" fill={c} {...outline} />
          {shade('M50 96a46 46 0 0 0 44-32 46 46 0 0 1-88 0 46 46 0 0 0 44 32z')}
        </>
      ),
    },
  },
  {
    id: 'square',
    label: 'Blocky',
    art: {
      kind: 'draw',
      render: (c) => (
        <>
          <rect x="6" y="6" width="88" height="88" rx="24" fill={c} {...outline} />
          {shade('M50 94h20a24 24 0 0 0 24-24v-6a46 46 0 0 1-88 0v6a24 24 0 0 0 24 24z')}
        </>
      ),
    },
  },
  {
    id: 'egg',
    label: 'Egg',
    art: {
      kind: 'draw',
      render: (c) => (
        <>
          <ellipse cx="50" cy="51" rx="40" ry="46" fill={c} {...outline} />
          {shade('M50 97a40 46 0 0 0 38-28 40 46 0 0 1-76 0 40 46 0 0 0 38 28z')}
        </>
      ),
    },
  },
  {
    id: 'blob',
    label: 'Blob',
    art: {
      kind: 'draw',
      render: (c) => (
        <>
          <path
            d="M50 5c26 0 45 18 45 43 0 28-19 47-45 47S5 76 5 48C5 23 24 5 50 5z"
            fill={c}
            {...outline}
          />
          {shade('M50 95c26 0 45-19 45-47 0-4 0-7-1-10a45 45 0 0 1-88 0c-1 3-1 6-1 10 0 28 19 47 45 47z')}
        </>
      ),
    },
  },
]

export const AVATAR_PARTS: Record<PartKind, AvatarPart[]> = {
  body: BODIES,
  eyes: EYES,
  mouth: MOUTHS,
}

/** Parts the player can actually pick, given what they have unlocked. */
export function availableParts(kind: PartKind, owned: ReadonlySet<string> = new Set()) {
  return AVATAR_PARTS[kind].filter((p) => !p.unlock || owned.has(p.id))
}

export function findPart(kind: PartKind, id: string) {
  return AVATAR_PARTS[kind].find((p) => p.id === id) ?? AVATAR_PARTS[kind][0]
}

/** Steps through the unlocked parts of one kind, wrapping at both ends. */
export function cyclePart(
  kind: PartKind,
  current: string,
  step: 1 | -1,
  owned?: ReadonlySet<string>
) {
  const list = availableParts(kind, owned)
  const i = list.findIndex((p) => p.id === current)
  const next = (i < 0 ? 0 : i + step + list.length) % list.length
  return list[next].id
}

export const DEFAULT_AVATAR: AvatarConfig = { body: 'round', eyes: 'dots', mouth: 'smile' }

export function randomAvatar(owned?: ReadonlySet<string>): AvatarConfig {
  const pick = (kind: PartKind) => {
    const list = availableParts(kind, owned)
    return list[Math.floor(Math.random() * list.length)].id
  }
  return { body: pick('body'), eyes: pick('eyes'), mouth: pick('mouth') }
}

/** Guards against a saved or received avatar naming a part that no longer exists. */
export function normalizeAvatar(a: Partial<AvatarConfig> | undefined | null): AvatarConfig {
  return {
    body: findPart('body', a?.body ?? '').id,
    eyes: findPart('eyes', a?.eyes ?? '').id,
    mouth: findPart('mouth', a?.mouth ?? '').id,
  }
}
