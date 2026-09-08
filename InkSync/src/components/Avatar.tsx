import { useId } from 'react'
import { findPart } from '../lib/avatar'
import type { AvatarConfig, AvatarPart, PartKind } from '../lib/avatar'

interface Props {
  color: string
  avatar: AvatarConfig
  size?: number
  /** Draws a ring in the avatar colour — used to mark whose turn it is. */
  ring?: boolean
  className?: string
}

/**
 * One part, drawn or imported. A tinted image is used as a silhouette over a
 * fill, which is how a body asset picks up the player's colour.
 */
function Part({ part, color, uid }: { part: AvatarPart; color: string; uid: string }) {
  if (part.art.kind === 'draw') return <>{part.art.render(color)}</>

  if (!part.art.tint) {
    return <image href={part.art.src} x="0" y="0" width="100" height="100" />
  }

  const maskId = `m-${uid}-${part.id}`
  return (
    <>
      <mask id={maskId}>
        <image href={part.art.src} x="0" y="0" width="100" height="100" />
      </mask>
      <rect x="0" y="0" width="100" height="100" fill={color} mask={`url(#${maskId})`} />
    </>
  )
}

/** Parts stack in this order, back to front. */
const LAYERS: PartKind[] = ['body', 'eyes', 'mouth']

/**
 * A player's face. Everything is one SVG on a 100×100 grid, so it stays crisp
 * from a 20px chat row to a 120px preview and can be dropped anywhere a player
 * needs identifying.
 */
export function Avatar({ color, avatar, size = 40, ring = false, className = '' }: Props) {
  const uid = useId().replace(/[^a-zA-Z0-9_-]/g, '')

  return (
    <svg
      className={`avatar ${ring ? 'ringed' : ''} ${className}`}
      width={size}
      height={size}
      viewBox="0 0 100 100"
      style={ring ? { ['--avatar-ring' as string]: color } : undefined}
      aria-hidden="true"
    >
      {LAYERS.map((kind) => (
        <Part key={kind} part={findPart(kind, avatar[kind])} color={color} uid={uid} />
      ))}
    </svg>
  )
}
