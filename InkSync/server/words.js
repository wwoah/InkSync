/** Drawable nouns. Kept deliberately concrete — nothing abstract. */
export const WORDS = [
  'apple', 'anchor', 'astronaut', 'axe', 'balloon', 'banana', 'bicycle', 'bridge',
  'butterfly', 'cactus', 'camera', 'candle', 'castle', 'cat', 'chair', 'cloud',
  'compass', 'cookie', 'crown', 'dinosaur', 'dolphin', 'donut', 'dragon', 'drum',
  'eagle', 'elephant', 'envelope', 'eyeball', 'feather', 'fireplace', 'fish',
  'flamingo', 'flashlight', 'fork', 'fountain', 'fox', 'ghost', 'giraffe', 'glasses',
  'globe', 'guitar', 'hammer', 'hamburger', 'headphones', 'hedgehog', 'helicopter',
  'honey', 'hourglass', 'igloo', 'island', 'jellyfish', 'kangaroo', 'kettle', 'key',
  'kite', 'ladder', 'lamp', 'lighthouse', 'lion', 'lobster', 'magnet', 'mailbox',
  'mermaid', 'microphone', 'monkey', 'moon', 'mountain', 'mushroom', 'narwhal',
  'necklace', 'octopus', 'owl', 'paintbrush', 'panda', 'parachute', 'penguin',
  'piano', 'pineapple', 'pirate', 'pizza', 'planet', 'popcorn', 'pretzel', 'pumpkin',
  'rabbit', 'raccoon', 'rainbow', 'robot', 'rocket', 'sandcastle', 'scarecrow',
  'scissors', 'shark', 'sheep', 'skateboard', 'skull', 'snail', 'snowman', 'sock',
  'spider', 'squirrel', 'starfish', 'strawberry', 'submarine', 'sunflower', 'sushi',
  'sword', 'telescope', 'tent', 'tiger', 'toaster', 'tornado', 'tractor', 'train',
  'treasure', 'tree', 'trophy', 'turtle', 'umbrella', 'unicorn', 'violin', 'volcano',
  'waffle', 'watermelon', 'whale', 'windmill', 'wizard', 'zebra',
]

/**
 * `count` distinct words from `bank`, avoiding anything already used this game.
 * Falls back to the whole bank once the unused words run low, so a short custom
 * list still keeps the game going rather than stalling.
 */
export function pickWords(count, used = new Set(), bank = WORDS) {
  const source = bank.length ? bank : WORDS
  const pool = source.filter((w) => !used.has(w))
  const from = pool.length >= count ? pool : source
  const out = []
  const taken = new Set()
  while (out.length < count && taken.size < from.length) {
    const i = Math.floor(Math.random() * from.length)
    if (taken.has(i)) continue
    taken.add(i)
    out.push(from[i])
  }
  return out
}
