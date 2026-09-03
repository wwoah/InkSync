import { useEffect, useRef } from 'react'
import type { ReactNode } from 'react'
import gsap from 'gsap'
import { prefersReducedMotion } from '../lib/motion'

export interface ToolInfo {
  icon: ReactNode
  name: string
  /** Single-key shortcut, if the tool has one. */
  key?: string
  hint: string
}

interface Props {
  open: boolean
  onClose: () => void
  tools: ToolInfo[]
  /** False for the room canvas, which has no pins, panning, chat or cursors. */
  full?: boolean
}

function Row({ chip, label, hint }: { chip: ReactNode; label: string; hint: string }) {
  return (
    <div className="info-row">
      <span className="info-chip">{chip}</span>
      <span className="info-text">
        <span className="info-label">{label}</span>
        <span className="info-hint">{hint}</span>
      </span>
    </div>
  )
}

/** Reference card for the tools, the shortcuts and the two-colour system. */
export function InfoPanel({ open, onClose, tools, full = true }: Props) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  useEffect(() => {
    if (!open || prefersReducedMotion()) return
    const ctx = gsap.context(() => {
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: -12, scale: 0.98 },
        {
          opacity: 1,
          y: 0,
          scale: 1,
          duration: 0.24,
          ease: 'power3.out',
          clearProps: 'opacity,transform',
        }
      )
    }, ref)
    return () => ctx.revert()
  }, [open])

  if (!open) return null

  return (
    <>
      <div className="info-backdrop" onClick={onClose} />
      <div className="info-panel" ref={ref} role="dialog" aria-label="Tools and shortcuts">
        <div className="info-head">
          <span>Tools &amp; shortcuts</span>
          <button onClick={onClose} aria-label="Close">
            ×
          </button>
        </div>

        <div className="info-body">
          <section>
            <h4>Tools</h4>
            {tools.map((t) => (
              <Row
                key={t.name}
                chip={
                  <>
                    {t.icon}
                    {t.key && <kbd className="collab-kbd">{t.key}</kbd>}
                  </>
                }
                label={t.name}
                hint={t.hint}
              />
            ))}
          </section>

          <section>
            <h4>Two colours at once</h4>
            <Row
              chip={
                <span className="info-duo">
                  <span className="collab-duo-alt" style={{ background: '#ffffff' }} />
                  <span className="collab-duo-main" style={{ background: '#1e90ff' }} />
                </span>
              }
              label="Front and back"
              hint="The paired chip in the toolbar shows both colours in hand. Click it to swap them."
            />
            <Row
              chip={<span className="info-word">L</span>}
              label="Left-click a swatch"
              hint="Sets the front colour — what a normal left-drag paints with."
            />
            <Row
              chip={<span className="info-word">R</span>}
              label="Right-click a swatch"
              hint="Sets the back colour. The swatch gets a small corner mark."
            />
            <Row
              chip={<span className="info-word">R</span>}
              label="Right-drag on the canvas"
              hint="Paints with the back colour. Leave it white and right-drag becomes a quick eraser for touch-ups."
            />
          </section>

          <section>
            <h4>Canvas</h4>
            <Row
              chip={<span className="info-word">⇅</span>}
              label="Scroll wheel"
              hint="Grows and shrinks the brush, with a true-to-size ring at the cursor."
            />
            {full && (
              <>
                <Row
                  chip={<span className="info-word">⤧</span>}
                  label="Drag to pan"
                  hint="With Select active, drag the canvas to move around it. Middle-drag pans with any tool."
                />
                <Row
                  chip={<span className="info-word">◎</span>}
                  label="Comments"
                  hint="Drop one with the Pin tool. Switch to Select to open and close them — drawing tools pass straight over."
                />
                <Row
                  chip={<span className="info-word">×</span>}
                  label="Clearing comments"
                  hint="Open a comment and hit the × in its corner. Anyone on the canvas can clear any comment, so clutter never gets stuck."
                />
                <Row
                  chip={<span className="info-word">✎</span>}
                  label="Live cursors"
                  hint="You only see other people's cursors while they are actually drawing."
                />
              </>
            )}
          </section>

          <section>
            <h4>History</h4>
            <Row
              chip={<kbd className="collab-kbd">Ctrl Z</kbd>}
              label="Undo"
              hint={
                full
                  ? 'Lifts your own last stroke or fill. Never touches anyone else’s work.'
                  : 'Steps back through your strokes, fills and clears.'
              }
            />
            <Row
              chip={<kbd className="collab-kbd">Ctrl ⇧ Z</kbd>}
              label="Redo"
              hint="Puts it back. Drawing something new discards the redo trail."
            />
          </section>

          {full && (
            <section>
              <h4>Chat</h4>
              <Row
                chip={<kbd className="collab-kbd">M</kbd>}
                label="Toggle chat"
                hint="While it is closed, new messages arrive as notes in the top right."
              />
            </section>
          )}

          <p className="info-foot">
            Shortcuts stand down while you are typing. Press{' '}
            <kbd className="collab-kbd">?</kbd> to reopen this panel.
          </p>
        </div>
      </div>
    </>
  )
}
