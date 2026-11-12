import { useEffect, useState } from 'react'
import { ScaledCard } from '../components/Card'
import { cardSpec } from '../../../shared/templates'
import { waitForAssets } from '../lib/ready'
import './print.css'

// A4 potret. Kartu 95 × 68 mm: 2 kolom × 4 baris; ukuran ATM 85,6 × 54 mm: 2 kolom × 5 baris.
export const PAGE = { w: 210, h: 297 }
const MM_TO_PX = 96 / 25.4
const SCALE = MM_TO_PX / 10 // 1 px desain = 0,1 mm

/** Tata letak lembar (mm) untuk template & jarak antarkartu tertentu. Kartu selalu di tengah halaman. */
export function makeLayout(settings, template) {
  const spec = cardSpec(template)
  const card = { w: spec.w, h: spec.h }
  const grid = { cols: spec.cols, rows: spec.rows }
  const gap = Math.min(spec.maxGap, Math.max(0, Number(settings.cardGap) || 0))
  const usedW = card.w * grid.cols + gap * (grid.cols - 1)
  const usedH = card.h * grid.rows + gap * (grid.rows - 1)
  return {
    card,
    grid,
    perPage: grid.cols * grid.rows,
    gap,
    margin: { x: (PAGE.w - usedW) / 2, y: (PAGE.h - usedH) / 2 },
    offset: { x: Number(settings.offsetX) || 0, y: Number(settings.offsetY) || 0 }
  }
}

/** Posisi slot (mm). Halaman belakang dicerminkan kiri-kanan (kertas dibalik pada sisi panjang). */
export function slotPos(i, back, layout) {
  const { margin, gap, offset, card, grid } = layout
  const row = Math.floor(i / grid.cols)
  let col = i % grid.cols
  if (back) col = grid.cols - 1 - col
  return {
    x: margin.x + col * (card.w + gap) + (back ? offset.x : 0),
    y: margin.y + row * (card.h + gap) + (back ? offset.y : 0)
  }
}

/** Tanda potong di margin luar, di setiap tepi kartu. */
function CropMarks({ layout }) {
  const { margin, gap, card: CARD_MM, grid: GRID } = layout
  const L = Math.min(5, margin.y - 1.5) // panjang tanda (mm)
  const xs = []
  const ys = []
  for (let c = 0; c < GRID.cols; c++) {
    const x = margin.x + c * (CARD_MM.w + gap)
    xs.push(x, x + CARD_MM.w)
  }
  for (let r = 0; r < GRID.rows; r++) {
    const y = margin.y + r * (CARD_MM.h + gap)
    ys.push(y, y + CARD_MM.h)
  }
  const lines = []
  for (const x of new Set(xs)) {
    lines.push([x, margin.y - L - 1, x, margin.y - 1])
    lines.push([x, PAGE.h - margin.y + 1, x, PAGE.h - margin.y + L + 1])
  }
  for (const y of new Set(ys)) {
    lines.push([margin.x - L - 1, y, margin.x - 1, y])
    lines.push([PAGE.w - margin.x + 1, y, PAGE.w - margin.x + L + 1, y])
  }
  return (
    <svg className="crop-marks" width={PAGE.w + 'mm'} height={PAGE.h + 'mm'} viewBox={`0 0 ${PAGE.w} ${PAGE.h}`}>
      {lines.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#000" strokeWidth="0.2" />
      ))}
    </svg>
  )
}

function Sheet({ items, side, data, layout }) {
  const back = side === 'back'
  return (
    <div className="sheet">
      {!back && <CropMarks layout={layout} />}
      {items.map((p, i) => {
        const pos = slotPos(i, back, layout)
        return (
          <div key={p.id} className={'slot' + (!back && layout.gap > 0 ? ' slot-cutline' : '')} style={{ left: pos.x + 'mm', top: pos.y + 'mm' }}>
            <ScaledCard
              scale={SCALE}
              width={layout.card.w + 'mm'}
              height={layout.card.h + 'mm'}
              template={data.exam?.template}
              side={side}
              p={p}
              settings={data.settings}
              exam={data.exam}
            />
          </div>
        )
      })}
    </div>
  )
}

function CalibrationSheet({ back, layout }) {
  return (
    <div className="sheet">
      <CropMarks layout={layout} />
      {Array.from({ length: layout.perPage }, (_, i) => {
        const pos = slotPos(i, back, layout)
        return (
          <div
            key={i}
            className={'calib ' + (back ? 'calib-back' : '')}
            style={{ left: pos.x + 'mm', top: pos.y + 'mm', width: layout.card.w + 'mm', height: layout.card.h + 'mm' }}
          >
            <div className="calib-cross" />
            <div className="calib-label">
              {back ? 'BELAKANG' : 'DEPAN'} {i + 1}
            </div>
            {i === 0 && (
              <div className={'calib-help' + (back ? ' calib-help-back' : '')}>
                {back
                  ? `Halaman 2 (BELAKANG). Offset saat ini: X ${layout.offset.x} mm, Y ${layout.offset.y} mm.`
                  : 'Cetak halaman 1, balik kertas pada sisi panjang, lalu cetak halaman 2 di baliknya. Terawang ke cahaya: atur offset di Pengaturan sampai garis merah berimpit dengan garis hitam.'}
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

export default function PrintView({ job }) {
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)

  useEffect(() => {
    window.api
      .getPrintData(job.side === 'calib' ? {} : job)
      .then(setData)
      .catch((e) => {
        setError(e.message)
        window.api.printReady({ error: e.message })
      })
  }, [job])

  useEffect(() => {
    if (!data) return
    waitForAssets().then(() => window.api.printReady({ pages: document.querySelectorAll('.sheet').length }))
  }, [data])

  if (error) return <div>{error}</div>
  if (!data) return null
  const layout = makeLayout(data.settings, data.exam?.template)

  if (job.side === 'calib') {
    return (
      <div className="print-root">
        <CalibrationSheet back={false} layout={layout} />
        <CalibrationSheet back layout={layout} />
      </div>
    )
  }

  const pages = []
  const per = layout.perPage
  for (let i = 0; i < data.participants.length; i += per) pages.push(data.participants.slice(i, i + per))
  return (
    <div className="print-root">
      {pages.map((items, i) => (
        <Sheet key={i} items={items} side={job.side} data={data} layout={layout} />
      ))}
    </div>
  )
}
