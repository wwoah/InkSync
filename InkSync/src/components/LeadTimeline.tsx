import { useState } from 'react'
import type { TurnRecord } from '../pages/ThinkInk'

interface Props {
  history: TurnRecord[]
}

/**
 * Who was ahead, turn by turn.
 *
 * A multi-series line of everyone's score was the obvious choice and the wrong
 * one: player colours are chosen by players, so two of them can be all but
 * identical — the palette validator puts purple/blue at ΔE 3.5 for deuteranopes
 * and orange/red at 8.4 even with full colour vision. Eight such lines in a
 * sidebar would be unreadable, and recolouring them would break the link
 * between a line and the avatar it belongs to.
 *
 * So the form answers the question directly instead: one segment per turn,
 * filled with that turn's leader. Colour is a cue, never the identity — the
 * names are written out below and in the tooltip.
 */
export function LeadTimeline({ history }: Props) {
  const [at, setAt] = useState<number | null>(null)

  if (!history.length) {
    return (
      <div className="lead-empty">
        The lead is tracked here once the first turn is done.
      </div>
    )
  }

  // Only the moments the lead actually changed hands are worth listing.
  const changes = history.filter((h, i) => i === 0 || h.leaderId !== history[i - 1].leaderId)
  const shown = at != null ? history[at] : null

  return (
    <div className="lead-panel">
      <div className="lead-head">
        <span className="lead-title">Who led</span>
        <span className="lead-count">
          {changes.length === 1 ? 'no changes' : `${changes.length - 1} lead changes`}
        </span>
      </div>

      <div className="lead-strip" onMouseLeave={() => setAt(null)}>
        {history.map((h, i) => (
          <button
            key={h.turn}
            className={`lead-seg ${at === i ? 'on' : ''}`}
            style={{ background: h.leaderColor }}
            onMouseEnter={() => setAt(i)}
            onFocus={() => setAt(i)}
            aria-label={`Turn ${h.turn}: ${h.leaderName} leading`}
            title={`Turn ${h.turn} — ${h.leaderName}`}
          />
        ))}
      </div>

      {/* The readout is a fixed-height region and the tooltip overlays it.
          Swapping one for the other changed the panel's height, which moved the
          strip out from under the cursor — that dropped the hover, restored the
          old height, and the whole thing flickered. Nothing here reflows now,
          and the tooltip cannot take the pointer. */}
      <div className="lead-body">
        <ol className="lead-log">
          {changes.slice(-4).map((h) => (
            <li key={h.turn}>
              <span className="lead-dot" style={{ background: h.leaderColor }} />
              <span className="lead-log-name">{h.leaderName}</span>
              <span className="lead-log-turn">turn {h.turn}</span>
            </li>
          ))}
        </ol>

        {shown && (
          <div className="lead-tip">
            <div className="lead-tip-head">
              Turn {shown.turn}
              {shown.word && <span className="lead-tip-word">“{shown.word}”</span>}
            </div>
            {shown.standings.slice(0, 4).map((st, i) => (
              <div key={st.id} className="lead-tip-row">
                <span className="lead-dot" style={{ background: st.color }} />
                <span className="lead-tip-name">
                  {i + 1}. {st.name}
                </span>
                <span className="lead-tip-score">{st.score}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
