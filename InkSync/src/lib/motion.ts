import gsap from 'gsap'

/**
 * Animations are decoration — anyone who has asked their system to calm down
 * gets the static layout instead.
 */
export function prefersReducedMotion() {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  )
}

/*
 * Paper moves like paper. It is set down rather than faded in, it lands a
 * little askew and settles, and it leaves by being peeled off or screwed up.
 *
 * Each helper returns its tween so a caller can sequence or kill it, and all
 * of them are meant to run inside a gsap.context so that reverting the context
 * cleans them up. Entrances end with clearProps, so the element hands its
 * transform back to the stylesheet once it has landed.
 */

type Target = gsap.TweenTarget

/** A sheet set down on the desk: it drops in tilted, swings past level once, and settles flat. */
export function setDown(target: Target, { lift = 36, tilt = -4, delay = 0 } = {}) {
  return gsap
    .timeline({ delay })
    .fromTo(
      target,
      { y: -lift, rotation: tilt, opacity: 0 },
      { y: 0, rotation: -tilt * 0.3, opacity: 1, duration: 0.5, ease: 'power2.out' }
    )
    .to(target, {
      rotation: 0,
      duration: 0.55,
      ease: 'elastic.out(1, 0.45)',
      clearProps: 'opacity,transform',
    })
}

/** A folded note opened out along one crease — the top edge, unless told otherwise. */
export function unfold(target: Target, { origin = 'top center', duration = 0.5 } = {}) {
  return gsap.fromTo(
    target,
    { rotationX: -78, opacity: 0, transformPerspective: 900, transformOrigin: origin },
    { rotationX: 0, opacity: 1, duration, ease: 'power3.out', clearProps: 'opacity,transform' }
  )
}

/**
 * The tilt a sheet rests at, from its own CSS `rotate`. GSAP folds that
 * property into the transform it animates, so a tween that ended at 0 would
 * leave the sheet level and then snap to its tilt when clearProps hands the
 * transform back to the stylesheet. Landing on the resting tilt avoids that.
 */
function restingTilt(target: Target) {
  const el = gsap.utils.toArray<Element>(target)[0]
  return el ? parseFloat(getComputedStyle(el).rotate) || 0 : 0
}

/** A sticky note pressed on: it lands a touch large and askew, then flattens. */
export function stickOn(target: Target, { tilt = -7, origin = 'top left', delay = 0 } = {}) {
  const rest = restingTilt(target)
  return gsap.fromTo(
    target,
    { opacity: 0, scale: 1.14, rotation: rest + tilt, y: -6, transformOrigin: origin },
    {
      opacity: 1,
      scale: 1,
      rotation: rest,
      y: 0,
      duration: 0.42,
      delay,
      ease: 'back.out(1.8)',
      clearProps: 'opacity,transform',
    }
  )
}

/** Peeled off by its top corner and flicked away. */
export function peelOff(target: Target, { delay = 0, onComplete }: { delay?: number; onComplete?: () => void } = {}) {
  return gsap.to(target, {
    opacity: 0,
    x: 30,
    y: -18,
    rotation: 16,
    scale: 0.94,
    transformOrigin: 'top left',
    duration: 0.34,
    delay,
    ease: 'power2.in',
    onComplete,
  })
}

/** Screwed up into a ball and gone. */
export function crumple(target: Target, { onComplete }: { onComplete?: () => void } = {}) {
  return gsap
    .timeline({ onComplete })
    .to(target, { scaleX: 0.74, scaleY: 0.86, rotation: -14, duration: 0.1, ease: 'power1.in' })
    .to(target, { scale: 0.12, rotation: 48, opacity: 0, duration: 0.22, ease: 'power2.in' })
}
