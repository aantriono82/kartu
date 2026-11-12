import { useLayoutEffect, useRef } from 'react'

const LH = 1.05

/**
 * Text that shrinks its font to fit the available width.
 * With lines > 1 it may wrap onto several lines when a single line would get too small
 * (below `wrapBelow` × size).
 */
export function FitText({ children, size, min = Math.round(size * 0.5), lines = 1, wrapBelow = 0.72, className, style }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.whiteSpace = 'nowrap'
    el.style.lineHeight = ''
    el.style.fontSize = size + 'px'
    const avail = el.clientWidth
    const need = el.scrollWidth
    if (need <= avail || avail <= 0) return
    const single = Math.floor(size * (avail / need) * 10) / 10
    if (lines > 1 && single < size * wrapBelow) {
      el.style.whiteSpace = 'normal'
      el.style.lineHeight = String(LH)
      const fits = (fs) => {
        el.style.fontSize = fs + 'px'
        return el.scrollHeight <= Math.ceil(fs * LH * lines) + 1 && el.scrollWidth <= el.clientWidth
      }
      let lo = min
      let hi = size * wrapBelow
      if (fits(hi)) return
      for (let i = 0; i < 7; i++) {
        const mid = (lo + hi) / 2
        if (fits(mid)) lo = mid
        else hi = mid
      }
      // pilih yang lebih besar: dua baris atau satu baris
      if (lo >= single) {
        el.style.fontSize = lo + 'px'
        return
      }
      el.style.whiteSpace = 'nowrap'
      el.style.lineHeight = ''
    }
    let fs = Math.max(min, single)
    el.style.fontSize = fs + 'px'
    // koreksi pembulatan agar tidak muncul "..."
    for (let i = 0; i < 6 && fs > min && el.scrollWidth > el.clientWidth; i++) {
      fs = Math.max(min, fs - 0.3)
      el.style.fontSize = fs + 'px'
    }
  }, [children, size, min, lines, wrapBelow])
  return (
    <div ref={ref} className={'fit-text ' + (className || '')} style={{ ...style, fontSize: size }}>
      {children}
    </div>
  )
}

/** Multi-line block that shrinks its font until content fits its fixed height. */
export function FitBox({ children, size, min = 8, className, style, deps = [] }) {
  const ref = useRef(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    let lo = min
    let hi = size
    el.style.fontSize = hi + 'px'
    if (el.scrollHeight <= el.clientHeight) return
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2
      el.style.fontSize = mid + 'px'
      if (el.scrollHeight <= el.clientHeight) lo = mid
      else hi = mid
    }
    el.style.fontSize = lo + 'px'
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [size, min, ...deps])
  return (
    <div ref={ref} className={className} style={{ ...style, fontSize: size, overflow: 'hidden' }}>
      {children}
    </div>
  )
}
