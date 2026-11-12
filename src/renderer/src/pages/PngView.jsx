import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { ScaledCard } from '../components/Card'
import { waitForAssets } from '../lib/ready'

/** Hidden offscreen window: shows one card at a time so the main process can capture it. */
export default function PngView({ job }) {
  const [data, setData] = useState(null)
  const [current, setCurrent] = useState(null)

  useEffect(() => {
    window.api
      .getPrintData(job)
      .then((d) => {
        setData(d)
        window.api.pngReady({ items: d.participants.map(({ nisn, nama, nomor_peserta }) => ({ nisn, nama, nomor_peserta })) })
      })
      .catch((e) => window.api.pngReady({ error: e.message }))
  }, [job])

  useEffect(() => {
    window.api.onPngShow(({ index, side }) => {
      flushSync(() => setCurrent({ index, side }))
      waitForAssets().then(() => window.api.pngShown({}))
    })
  }, [])

  if (!data || !current) return null
  const p = data.participants[current.index]
  return (
    <div style={{ margin: 0 }}>
      <ScaledCard
        key={p.id + current.side}
        scale={job.scale}
        template={data.exam?.template}
        side={current.side}
        p={p}
        settings={data.settings}
        exam={data.exam}
      />
    </div>
  )
}
