import { useEffect, useState } from 'react'
import Cropper from 'react-easy-crop'
import { RotateCw, Upload, Trash2 } from 'lucide-react'
import { Modal, useAction } from './ui'
import { processPhoto, PHOTO_W, PHOTO_H } from '../lib/photo'

/** Crop / replace / rotate one student's photo. */
export default function CropDialog({ student, onClose, onSaved }) {
  const [bytes, setBytes] = useState(null) // bytes being edited
  const [isNew, setIsNew] = useState(false) // true when bytes come from a newly picked file
  const [url, setUrl] = useState(null)
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [area, setArea] = useState(null)
  const [run, busy] = useAction()

  useEffect(() => {
    window.api.readOriginalPhoto(student.nisn).then((b) => b && setBytes(b))
  }, [student.nisn])

  useEffect(() => {
    if (!bytes) return
    const u = URL.createObjectURL(new Blob([bytes]))
    setUrl(u)
    setZoom(1)
    setCrop({ x: 0, y: 0 })
    return () => URL.revokeObjectURL(u)
  }, [bytes])

  const pickFile = () =>
    run(async () => {
      const b = await window.api.pickSinglePhoto()
      if (!b) return null
      // normalisasi dulu (orientasi EXIF + ukuran), lalu edit dari hasil itu
      const { orig } = await processPhoto(b)
      setBytes(orig)
      setIsNew(true)
      return null
    })

  const rotate = () =>
    run(async () => {
      const { orig } = await processPhoto(bytes, { rotate: 90 })
      setBytes(orig)
      setIsNew(true)
      return null
    })

  const save = () =>
    run(async () => {
      const { crop: out } = await processPhoto(bytes, { crop: area, keepOriginal: false })
      await window.api.savePhoto(student.nisn, isNew ? bytes : null, out)
      onSaved()
      onClose()
    }, 'Foto disimpan')

  const remove = () =>
    run(async () => {
      if (!confirm(`Hapus foto ${student.nama}?`)) return null
      await window.api.deletePhoto(student.nisn)
      onSaved()
      onClose()
    }, 'Foto dihapus')

  return (
    <Modal
      title={`Foto: ${student.nama} (${student.nisn})`}
      onClose={onClose}
      wide
      footer={
        <>
          {student.has_photo ? (
            <button className="btn ghost danger" onClick={remove} disabled={busy}>
              <Trash2 size={16} /> Hapus Foto
            </button>
          ) : null}
          <span style={{ flex: 1 }} />
          <button className="btn" onClick={onClose}>
            Batal
          </button>
          <button className="btn primary" onClick={save} disabled={!bytes || !area || busy}>
            Simpan
          </button>
        </>
      }
    >
      <div className="crop-area">
        {url ? (
          <Cropper
            image={url}
            crop={crop}
            zoom={zoom}
            aspect={PHOTO_W / PHOTO_H}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_, px) => setArea(px)}
            showGrid
          />
        ) : (
          <div className="crop-empty">Belum ada foto. Klik "Pilih File".</div>
        )}
      </div>
      <div className="row gap center" style={{ marginTop: 12 }}>
        <button className="btn" onClick={pickFile} disabled={busy}>
          <Upload size={16} /> Pilih File
        </button>
        <button className="btn" onClick={rotate} disabled={!bytes || busy}>
          <RotateCw size={16} /> Putar 90°
        </button>
        <label className="row gap-s">
          Zoom
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} />
        </label>
      </div>
    </Modal>
  )
}
