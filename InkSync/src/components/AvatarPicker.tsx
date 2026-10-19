import { Avatar } from './Avatar'
import { ChevronIcon, DiceIcon } from './icons'
import { cyclePart, findPart, randomAvatar } from '../lib/avatar'
import type { AvatarConfig, PartKind } from '../lib/avatar'

interface Props {
  color: string
  avatar: AvatarConfig
  onChange: (next: AvatarConfig) => void
  /** Part ids the player has earned. Locked parts never enter the rotation. */
  owned?: ReadonlySet<string>
}

const ROWS: { kind: PartKind; label: string }[] = [
  { kind: 'body', label: 'Body' },
  { kind: 'eyes', label: 'Eyes' },
  { kind: 'mouth', label: 'Mouth' },
]

/** Preview plus one cycler per part, in the shape players expect from skribbl. */
export function AvatarPicker({ color, avatar, onChange, owned }: Props) {
  return (
    <div className="avatar-picker">
      <div className="avatar-stage">
        <Avatar color={color} avatar={avatar} size={96} />
        <button
          className="avatar-dice"
          onClick={() => onChange(randomAvatar(owned))}
          title="Surprise me"
          aria-label="Randomise avatar"
        >
          <DiceIcon size={16} />
        </button>
      </div>

      <div className="avatar-rows">
        {ROWS.map(({ kind, label }) => (
          <div className="avatar-row" key={kind}>
            <button
              className="avatar-step"
              onClick={() => onChange({ ...avatar, [kind]: cyclePart(kind, avatar[kind], -1, owned) })}
              aria-label={`Previous ${label.toLowerCase()}`}
            >
              <ChevronIcon size={14} dir="left" />
            </button>

            <span className="avatar-row-label">
              <span className="avatar-row-kind">{label}</span>
              <span className="avatar-row-value">{findPart(kind, avatar[kind]).label}</span>
            </span>

            <button
              className="avatar-step"
              onClick={() => onChange({ ...avatar, [kind]: cyclePart(kind, avatar[kind], 1, owned) })}
              aria-label={`Next ${label.toLowerCase()}`}
            >
              <ChevronIcon size={14} dir="right" />
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}
