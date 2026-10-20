import { useSyncExternalStore } from 'react'
import { SoundOffIcon, SoundOnIcon } from './icons'
import { isMuted, play, setMuted, subscribeMuted } from '../lib/sound'

/**
 * Sound on or off, remembered between visits. It makes its own noise —
 * a tap when sound comes back on, nothing when it goes off — so it opts out
 * of the generic press sound.
 */
export function SoundToggle({ className = '' }: { className?: string }) {
  const muted = useSyncExternalStore(subscribeMuted, isMuted, () => false)

  return (
    <button
      className={`sound-toggle ${className}`}
      data-sound="none"
      onClick={() => {
        setMuted(!muted)
        if (muted) play('tap')
      }}
      aria-pressed={!muted}
      aria-label={muted ? 'Turn sound on' : 'Turn sound off'}
      title={muted ? 'Sound is off' : 'Sound is on'}
    >
      {muted ? <SoundOffIcon /> : <SoundOnIcon />}
    </button>
  )
}
