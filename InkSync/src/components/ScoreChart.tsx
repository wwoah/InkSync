import { useMemo, useState } from 'react'
import type { TurnRecord } from '../pages/ThinkInk'

interface Props {
  history: TurnRecord[]
  /** Dims every other line, so one player can be followed through the tangle. */
  focusId?: string | null
  onFocus?: (id: string | null) => void
  height?: number
}

const W = 320
const PAD = { top: 12, right: 46, bottom: 18, left: 26 }

/**
 * Dash patterns stand in for hue.
 *
 * Player colours are chosen by players, so the set cannot be validated: the
 * palette check puts purple/blue at ΔE 3.5 for deuteranopes and orange/red at
 * 8.4 even with normal vision. Recolouring would break the tie between a line
 * and its avatar, so identity is carried by a second channel instead — a dash
 * per series, plus names on hover and focus-dimming from the player list.
 */
const DASHES = ['', '6 4', '2 3', '10 4 2 4', '1 4', '8 3 2 3', '4 2', '12 5']

interface Series {
  id: string
  name: string
  color: string
  dash: string
  /** One entry per turn index; null before the player joined. */
  points: (number | null)[]
}

function buildSeries(history: TurnRecord[]): Series[] {
  const order: string[] = []
  const meta = new Map<string, { name: string; color: string }>()
  for (const h of history) {
    for (const s of h.standings) {
      if (!meta.has(s.id)) {
        meta.set(s.id, { name: s.name, color: s.color })
        order.push(s.id)
      }
    }
  }

  return order.map((id, i) => {
    const info = meta.get(id)!
    // Turn 0 is the shared start line; a late joiner picks up from their first
    // appearance rather than being drawn back to zero.
    const points: (number | null)[] = [history[0]?.standings.some((s) => s.id === id) ? 0 : null]
    for (const h of history) {
      const row = h.standings.find((s) => s.id === id)
      points.push(row ? row.score : null)
    }
    return { id, name: info.name, color: info.color, dash: DASHES[i % DASHES.length], points }
  })
}

export function ScoreChart({ history, focusId = null, onFocus, height = 150 }: Props) {
  const [hover, setHover] = useState<number | null>(null)

  const series = useMemo(() => buildSeries(history), [history])
  const turns = history.length

  if (turns < 1) {
    return <div className="chart-empty">Scores are plotted here once the first turn ends.</div>
  }

  const H = height
  const maxScore = Math.max(
    100,
    ...series.flatMap((s) => s.points.map((p) => p ?? 0))
  )
  // A round ceiling keeps the gridline labels readable.
  const ceiling = Math.ceil(maxScore / 100) * 100

  const x = (i: number) => PAD.left + (i / Math.max(1, turns)) * (W - PAD.left - PAD.right)
  const y = (v: number) => H - PAD.bottom - (v / ceiling) * (H - PAD.top - PAD.bottom)

  const path = (s: Series) => {
    let d = ''
    let pen = false
    s.points.forEach((p, i) => {
      if (p == null) {
        pen = false
        return
      }
      d += `${pen ? 'L' : 'M'}${x(i).toFixed(1)} ${y(p).toFixed(1)}`
      pen = true
    })
    return d
  }

  const ranked = [...series].sort(
    (a, b) => (b.points.at(-1) ?? 0) - (a.points.at(-1) ?? 0)
  )
  const atTurn = hover ?? turns
  const gridValues = [0, ceiling / 2, ceiling]

  return (
    <div className="chart">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="chart-svg"
        role="img"
        aria-label={`Points per turn for ${series.length} players over ${turns} turns`}
        onMouseLeave={() => {
          setHover(null)
          onFocus?.(null)
        }}
        onMouseMove={(e) => {
          const r = e.currentTarget.getBoundingClientRect()
          const px = ((e.clientX - r.left) / r.width) * W
          const i = Math.round(
            ((px - PAD.left) / (W - PAD.left - PAD.right)) * Math.max(1, turns)
          )
          setHover(Math.min(turns, Math.max(0, i)))
        }}
      >
        {/* Solid hairlines, one shade off the surface — never dashed. */}
        {gridValues.map((v) => (
          <g key={v}>
            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={y(v)}
              y2={y(v)}
              stroke="var(--border)"
              strokeWidth="1"
            />
            <text x={PAD.left - 5} y={y(v) + 3} className="chart-axis" textAnchor="end">
              {v}
            </text>
          </g>
        ))}

        {hover != null && (
          <line
            x1={x(hover)}
            x2={x(hover)}
            y1={PAD.top - 4}
            y2={H - PAD.bottom}
            stroke="var(--border-light)"
            strokeWidth="1"
          />
        )}

        {series.map((s) => {
          const dim = focusId != null && focusId !== s.id
          return (
            <path
              key={s.id}
              d={path(s)}
              fill="none"
              stroke={s.color}
              strokeWidth={focusId === s.id ? 2.6 : 2}
              strokeDasharray={s.dash || undefined}
              strokeLinecap="round"
              strokeLinejoin="round"
              opacity={dim ? 0.18 : 1}
              onMouseEnter={() => onFocus?.(s.id)}
            />
          )
        })}

        {/* Markers only where they carry information: the value being read. */}
        {series.map((s) => {
          const v = s.points[atTurn]
          if (v == null) return null
          const dim = focusId != null && focusId !== s.id
          return (
            <circle
              key={s.id}
              cx={x(atTurn)}
              cy={y(v)}
              r="4"
              fill={s.color}
              stroke="var(--surface)"
              strokeWidth="2"
              opacity={dim ? 0.25 : 1}
            />
          )
        })}

        {/* Only the leader is labelled; the rest are named in the readout. */}
        {ranked[0] && ranked[0].points[atTurn] != null && (
          <text
            x={x(atTurn) + 7}
            y={y(ranked[0].points[atTurn]!) + 3}
            className="chart-lead-label"
          >
            {ranked[0].name}
          </text>
        )}

        <text x={PAD.left} y={H - 5} className="chart-axis">
          start
        </text>
        <text x={W - PAD.right} y={H - 5} className="chart-axis" textAnchor="end">
          turn {turns}
        </text>
      </svg>

      <div className="chart-readout">
        <span className="chart-readout-head">
          {hover != null && hover > 0
            ? `After turn ${hover}`
            : hover === 0
              ? 'Start'
              : 'Now'}
        </span>
        {ranked.slice(0, 4).map((s) => (
          <button
            key={s.id}
            className={`chart-row ${focusId === s.id ? 'on' : ''}`}
            onMouseEnter={() => onFocus?.(s.id)}
            onMouseLeave={() => onFocus?.(null)}
          >
            <svg width="16" height="8" aria-hidden="true">
              <line
                x1="0"
                y1="4"
                x2="16"
                y2="4"
                stroke={s.color}
                strokeWidth="2"
                strokeDasharray={s.dash || undefined}
                strokeLinecap="round"
              />
            </svg>
            <span className="chart-row-name">{s.name}</span>
            <span className="chart-row-score">{s.points[atTurn] ?? '—'}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
