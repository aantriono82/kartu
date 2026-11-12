import { useEffect, useState } from 'react'
import { ScaledCard, CARD_W } from '../components/Card'
import { waitForAssets } from '../lib/ready'
import './print.css'

// A4 potret, 2 kolom × 4 baris, kartu 95 × 68 mm
export const PAGE = { w: 210, h: 297 }
export const CARD_MM = { w: 95, h: 68 }
export const GRID = { cols: 2, rows: 4 }
export const MARGIN = {
  x: (PAGE.w - CARD_MM.w * GRID.cols) / 2, // 10 mm
  y: (PAGE.h - CARD_MM.h * GRID.rows) / 2 // 12.5 mm
}
const PER_PAGE = GRID.cols * GRID.rows
const MM_TO_PX = 96 / 25.4
const SCALE = (CARD_MM.w * MM_TO_PX) / CARD_W

/** Posisi slot (mm). Halaman belakang dicerminkan kiri-kanan (kertas dibalik pada sisi panjang). */
export function slotPos(i, back, offset) {
  const row = Math.floor(i / GRID.cols)
  let col = i % GRID.cols
  if (back) col = GRID.cols - 1 - col
  return {
    x: MARGIN.x + col * CARD_MM.w + (back ? offset.x : 0),
    y: MARGIN.y + row * CARD_MM.h + (back ? offset.y : 0)
  }
}

function CropMarks() {
  const L = 6 // panjang tanda potong (mm)
  const xs = Array.from({ length: GRID.cols + 1 }, (_, i) => MARGIN.x + i * CARD_MM.w)
  const ys = Array.from({ length: GRID.rows + 1 }, (_, i) => MARGIN.y + i * CARD_MM.h)
  const lines = []
  for (const x of xs) {
    lines.push([x, MARGIN.y - L - 1, x, MARGIN.y - 1])
    lines.push([x, PAGE.h - MARGIN.y + 1, x, PAGE.h - MARGIN.y + L + 1])
  }
  for (const y of ys) {
    lines.push([MARGIN.x - L - 1, y, MARGIN.x - 1, y])
    lines.push([PAGE.w - MARGIN.x + 1, y, PAGE.w - MARGIN.x + L + 1, y])
  }
  return (
    <svg className="crop-marks" width={PAGE.w + 'mm'} height={PAGE.h + 'mm'} viewBox={`0 0 ${PAGE.w} ${PAGE.h}`}>
      {lines.map(([x1, y1, x2, y2], i) => (
        <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#000" strokeWidth="0.2" />
      ))}
    </svg>
  )
}

function Sheet({ items, side, data, offset }) {
  const back = side === 'back'
  return (
    <div className="sheet">
      {!back && <CropMarks />}
      {items.map((p, i) => {
        const pos = slotPos(i, back, offset)
        return (
          <div key={p.id} className="slot" style={{ left: pos.x + 'mm', top: pos.y + 'mm' }}>
            <ScaledCard
              scale={SCALE}
              width={CARD_MM.w + 'mm'}
              height={CARD_MM.h + 'mm'}
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

function CalibrationSheet({ back, offset }) {
  return (
    <div className="sheet">
      <CropMarks />
      {Array.from({ length: PER_PAGE }, (_, i) => {
        const pos = slotPos(i, back, offset)
        return (
          <div
            key={i}
            className={'calib ' + (back ? 'calib-back' : '')}
            style={{ left: pos.x + 'mm', top: pos.y + 'mm', width: CARD_MM.w + 'mm', height: CARD_MM.h + 'mm' }}
          >
            <div className="calib-cross" />
            <div className="calib-label">
              {back ? 'BELAKANG' : 'DEPAN'} {i + 1}
            </div>
          </div>
        )
      })}
      <div className="calib-help">
        {back
          ? `Halaman 2 (BELAKANG) — offset X ${offset.x} mm, Y ${offset.y} mm`
          : 'Halaman 1 (DEPAN). Cetak halaman ini, balik kertas pada sisi panjang, lalu cetak halaman 2 di baliknya. Terawang ke cahaya: geser offset di Pengaturan sampai kotak depan & belakang berimpit.'}
      </div>
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
  const offset = { x: Number(data.settings.offsetX) || 0, y: Number(data.settings.offsetY) || 0 }

  if (job.side === 'calib') {
    return (
      <div className="print-root">
        <CalibrationSheet back={false} offset={offset} />
        <CalibrationSheet back offset={offset} />
      </div>
    )
  }

  const pages = []
  for (let i = 0; i < data.participants.length; i += PER_PAGE) pages.push(data.participants.slice(i, i + PER_PAGE))
  return (
    <div className="print-root">
      {pages.map((items, i) => (
        <Sheet key={i} items={items} side={job.side} data={data} offset={offset} />
      ))}
    </div>
  )
}
