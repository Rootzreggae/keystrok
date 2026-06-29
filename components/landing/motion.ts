// Functional motion for the schematic landing (ported from the design handoff's
// schematic-motion.js). Staged figure sequences, section-head ink draw, hero
// reveal, and a measuring crosshair. Gated on prefers-reduced-motion; the
// reduced-motion state is the final (fully visible) state.

export interface MotionOptions {
  scroll?: boolean
  crosshair?: boolean
}

function collectSteps(fig: Element): HTMLElement[] {
  return Array.from(fig.querySelectorAll<HTMLElement>('[data-step]')).sort(
    (a, b) => Number(a.dataset.step) - Number(b.dataset.step)
  )
}

function resetSeq(fig: Element) {
  collectSteps(fig).forEach((el) => el.classList.add('is-off'))
}

function runSeq(fig: Element, reduced: boolean) {
  const steps = collectSteps(fig)
  if (reduced) {
    steps.forEach((el) => el.classList.remove('is-off'))
    return
  }
  let t = 120
  steps.forEach((el) => {
    const isArrow = el.classList.contains('sch-arrow') || el.classList.contains('sch-varrow')
    setTimeout(() => el.classList.remove('is-off'), t)
    t += isArrow ? 240 : 340
  })
}

function armFigures(root: HTMLElement, useScroll: boolean, reduced: boolean) {
  const figs = Array.from(root.querySelectorAll<HTMLElement>('[data-fig-seq]'))
  figs.forEach((fig) => {
    if (fig.dataset.armed) return
    fig.dataset.armed = '1'
    if (!reduced) resetSeq(fig)
    const btn = fig.querySelector('[data-run]')
    if (btn) {
      btn.addEventListener('click', () => {
        if (reduced) return
        resetSeq(fig)
        requestAnimationFrame(() => requestAnimationFrame(() => runSeq(fig, reduced)))
      })
    }
    if (reduced) return
    if (useScroll && 'IntersectionObserver' in window) {
      const io = new IntersectionObserver(
        (entries) => {
          entries.forEach((e) => {
            if (e.isIntersecting) {
              runSeq(fig, reduced)
              io.disconnect()
            }
          })
        },
        { threshold: 0.35 }
      )
      io.observe(fig)
    } else {
      runSeq(fig, reduced)
    }
  })
}

function armInk(root: HTMLElement, useScroll: boolean, reduced: boolean) {
  const heads = Array.from(root.querySelectorAll<HTMLElement>('[data-ink]'))
  if (reduced || !useScroll || !('IntersectionObserver' in window)) {
    heads.forEach((h) => h.classList.add('is-in'))
    return
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in')
          io.unobserve(e.target)
        }
      })
    },
    { threshold: 0.6 }
  )
  heads.forEach((h) => io.observe(h))
}

function heroReveal(root: HTMLElement, reduced: boolean) {
  const h1 = root.querySelector<HTMLElement>('[data-hero-h1]')
  const outline = root.querySelector<HTMLElement>('[data-hero-outline]')
  if (!h1) return
  const sub = root.querySelector<HTMLElement>('.sch-hero .sub')
  const actions = root.querySelector<HTMLElement>('.sch-hero .actions')
  if (reduced) {
    if (outline) outline.classList.add('is-inked')
    return
  }
  ;[h1, sub, actions].forEach((el, i) => {
    if (!el) return
    el.classList.add('anim-in')
    setTimeout(() => el.classList.add('is-in'), 80 + i * 140)
  })
  if (outline) setTimeout(() => outline.classList.add('is-inked'), 1050)
}

function armCrosshair(root: HTMLElement) {
  if (!window.matchMedia('(pointer: fine)').matches) return
  root.querySelectorAll<HTMLElement>('.sch-figure').forEach((fig) => {
    if (fig.dataset.xhair) return
    fig.dataset.xhair = '1'
    const mk = (cls: string) => {
      const el = document.createElement('span')
      el.className = cls
      fig.appendChild(el)
      return el
    }
    const x = mk('sch-xhair-x')
    const y = mk('sch-xhair-y')
    const tag = mk('sch-xhair-tag')
    fig.addEventListener('pointermove', (e) => {
      const r = fig.getBoundingClientRect()
      const scale = r.width / fig.offsetWidth || 1
      const px = (e.clientX - r.left) / scale
      const py = (e.clientY - r.top) / scale
      x.style.top = py + 'px'
      y.style.left = px + 'px'
      const flipX = px > fig.offsetWidth - 130
      const flipY = py < 34
      tag.style.left = px + (flipX ? -12 : 12) + 'px'
      tag.style.top = py + (flipY ? 12 : -26) + 'px'
      tag.style.transform = flipX ? 'translateX(-100%)' : ''
      tag.textContent = 'x:' + Math.round(px) + ' y:' + Math.round(py)
      fig.classList.add('is-measuring')
    })
    fig.addEventListener('pointerleave', () => fig.classList.remove('is-measuring'))
  })
}

/** Initialise schematic motion on a mounted root element. Returns nothing. */
export function initSchematicMotion(root: HTMLElement | null, opts: MotionOptions = {}) {
  if (!root) return
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const useScroll = opts.scroll !== false
  armFigures(root, useScroll, reduced)
  armInk(root, useScroll, reduced)
  heroReveal(root, reduced)
  if (opts.crosshair !== false) armCrosshair(root)
}
