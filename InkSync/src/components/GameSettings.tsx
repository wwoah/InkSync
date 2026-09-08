import type { GameLimits, GameSettings as Settings, SettingsPatch } from '../pages/ThinkInk'

interface Props {
  settings: Settings
  limits: GameLimits
  /** Only the host may change anything; everyone else sees the same values, read-only. */
  isHost: boolean
  hostName: string | null
  onChange: (patch: SettingsPatch) => void
}

const TIMES = [30, 45, 60, 80, 100, 120, 180]

export function GameSettings({ settings, limits, isHost, hostName, onChange }: Props) {
  // The word list is deliberately uncontrolled: typing stays untouched, and the
  // key remounts the field only when the server's cleaned list actually
  // changes, so it resets to the canonical words without fighting the caret.
  const canonical = settings.customWords.join(', ')

  if (!isHost) {
    return (
      <div className="settings read-only">
        <div className="settings-title">
          Match settings
          <span className="settings-host">{hostName ? `set by ${hostName}` : ''}</span>
        </div>
        <div className="settings-summary">
          <span>{settings.rounds} rounds</span>
          <span>{settings.drawSeconds}s per turn</span>
          <span>
            {settings.customWords.length
              ? `${settings.customWords.length} custom word${settings.customWords.length === 1 ? '' : 's'}${settings.customOnly ? ' only' : ' added'}`
              : 'standard words'}
          </span>
        </div>
      </div>
    )
  }

  return (
    <div className="settings">
      <div className="settings-title">
        Match settings
        <span className="settings-host">you are the host</span>
      </div>

      <label className="settings-row">
        <span className="settings-label">Rounds</span>
        <span className="settings-stepper">
          <button
            onClick={() => onChange({ rounds: settings.rounds - 1 })}
            disabled={settings.rounds <= limits.rounds.min}
            aria-label="Fewer rounds"
          >
            −
          </button>
          <span className="settings-value">{settings.rounds}</span>
          <button
            onClick={() => onChange({ rounds: settings.rounds + 1 })}
            disabled={settings.rounds >= limits.rounds.max}
            aria-label="More rounds"
          >
            +
          </button>
        </span>
      </label>

      <label className="settings-row">
        <span className="settings-label">Time per turn</span>
        <select
          className="settings-select"
          value={settings.drawSeconds}
          onChange={(e) => onChange({ drawSeconds: Number(e.target.value) })}
        >
          {TIMES.map((t) => (
            <option key={t} value={t}>
              {t}s
            </option>
          ))}
        </select>
      </label>

      <div className="settings-words">
        <span className="settings-label">Extra words</span>
        <textarea
          key={canonical}
          className="settings-textarea"
          defaultValue={canonical}
          onBlur={(e) => onChange({ customWords: e.target.value })}
          placeholder="pizza, hovercraft, my dog…"
          rows={2}
        />
        <div className="settings-words-foot">
          <span>
            {settings.customWords.length} accepted
            {settings.customWords.length ? '' : ' — separate with commas'}
          </span>
          <label className="settings-check">
            <input
              type="checkbox"
              checked={settings.customOnly}
              disabled={settings.customWords.length < 3}
              onChange={(e) => onChange({ customOnly: e.target.checked })}
            />
            only these
          </label>
        </div>
        {settings.customWords.length > 0 && settings.customWords.length < 3 && (
          <p className="settings-note">
            Three or more are needed before a turn can be built from your list alone.
          </p>
        )}
      </div>
    </div>
  )
}
