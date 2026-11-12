import { useCallback, useEffect, useMemo, useState } from 'react'
import { FileSpreadsheet, FolderOpen, FileArchive, Plus, Pencil, Trash2, Camera, Download, Search } from 'lucide-react'
import CropDialog from '../components/CropDialog'
import { Field, ImportResult, Modal, useAction, useToast } from '../components/ui'
import { photoUrl, uniqueSorted } from '../lib/format'
import { processPhoto } from '../lib/photo'

export default function Students() {
  const [students, setStudents] = useState([])
  const [q, setQ] = useState('')
  const [kelas, setKelas] = useState('')
  const [onlyNoPhoto, setOnlyNoPhoto] = useState(false)
  const [editing, setEditing] = useState(null) // {nisn?, nama, kelas}
  const [cropping, setCropping] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [photoJob, setPhotoJob] = useState(null) // {done,total,ok,unmatched,failed,finished}
  const [run, busy] = useAction()
  const toast = useToast()

  const reload = useCallback(() => window.api.listStudents().then(setStudents), [])
  useEffect(() => {
    reload()
  }, [reload])

  const kelasList = useMemo(() => uniqueSorted(students.map((s) => s.kelas)), [students])
  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase()
    return students.filter(
      (s) =>
        (!kelas || s.kelas === kelas) &&
        (!onlyNoPhoto || !s.has_photo) &&
        (!needle || s.nama.toLowerCase().includes(needle) || s.nisn.includes(needle))
    )
  }, [students, q, kelas, onlyNoPhoto])
  const withPhoto = students.filter((s) => s.has_photo).length

  const importExcel = () =>
    run(async () => {
      const r = await window.api.importStudents()
      if (r) {
        setImportResult(r)
        reload()
      }
      return null
    })

  const importPhotos = (kind) =>
    run(async () => {
      const src = await window.api.openPhotoSource(kind)
      if (!src) return null
      const known = new Set(students.map((s) => s.nisn))
      const matched = src.entries.filter((e) => known.has(e.nisn))
      const job = {
        total: matched.length,
        done: 0,
        ok: 0,
        failed: [],
        unmatched: src.entries.filter((e) => !known.has(e.nisn)).map((e) => e.name),
        finished: false
      }
      setPhotoJob({ ...job })
      for (const e of matched) {
        try {
          const bytes = await window.api.readPhotoEntry(src.sessionId, e.key)
          const { orig, crop } = await processPhoto(bytes)
          await window.api.savePhoto(e.nisn, orig, crop)
          job.ok++
        } catch (err) {
          job.failed.push(`${e.name}: ${err.message}`)
        }
        job.done++
        if (job.done % 5 === 0 || job.done === job.total) setPhotoJob({ ...job })
      }
      await window.api.closePhotoSource()
      setPhotoJob({ ...job, finished: true })
      reload()
      return null
    })

  const saveStudent = () =>
    run(async () => {
      await window.api.saveStudent(editing.oldNisn || null, editing)
      setEditing(null)
      reload()
    }, 'Data siswa disimpan')

  const remove = (s) =>
    run(async () => {
      if (!confirm(`Hapus ${s.nama} (${s.nisn})? Siswa juga dihapus dari semua ujian.`)) return null
      await window.api.deleteStudents([s.nisn])
      reload()
    }, 'Siswa dihapus')

  const removeFiltered = () =>
    run(async () => {
      if (!filtered.length) return null
      const label = kelas ? `kelas ${kelas}` : q || onlyNoPhoto ? 'hasil filter' : 'SEMUA siswa'
      if (!confirm(`Hapus ${filtered.length} siswa (${label})? Data juga dihapus dari semua ujian. Tidak bisa dibatalkan.`)) return null
      await window.api.deleteStudents(filtered.map((s) => s.nisn))
      reload()
    }, 'Siswa dihapus')

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h1>Data Siswa</h1>
          <p className="muted">
            {students.length} siswa · {withPhoto} dengan foto ·{' '}
            <span className={students.length - withPhoto ? 'text-warn' : ''}>{students.length - withPhoto} tanpa foto</span>
          </p>
        </div>
        <div className="row gap-s wrap">
          <button className="btn" onClick={() => window.api.downloadTemplate('siswa').catch((e) => toast(e.message, 'error'))}>
            <Download size={16} /> Template Excel
          </button>
          <button className="btn" onClick={importExcel} disabled={busy}>
            <FileSpreadsheet size={16} /> Import Excel
          </button>
          <button className="btn" onClick={() => importPhotos('folder')} disabled={busy}>
            <FolderOpen size={16} /> Import Foto (Folder)
          </button>
          <button className="btn" onClick={() => importPhotos('zip')} disabled={busy}>
            <FileArchive size={16} /> Import Foto (ZIP)
          </button>
          <button className="btn primary" onClick={() => setEditing({ nisn: '', nama: '', kelas: kelas || '' })}>
            <Plus size={16} /> Tambah
          </button>
        </div>
      </div>
      <p className="muted small">
        Foto massal: nama file = NISN siswa, mis. <code>0101234567.jpg</code>. Foto otomatis dipotong 3×4; perbaiki per siswa
        lewat tombol kamera.
      </p>

      <div className="toolbar">
        <div className="search">
          <Search size={16} />
          <input placeholder="Cari nama / NISN" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <select value={kelas} onChange={(e) => setKelas(e.target.value)}>
          <option value="">Semua kelas</option>
          {kelasList.map((k) => (
            <option key={k}>{k}</option>
          ))}
        </select>
        <label className="row gap-s">
          <input type="checkbox" checked={onlyNoPhoto} onChange={(e) => setOnlyNoPhoto(e.target.checked)} /> Hanya tanpa foto
        </label>
        <span style={{ flex: 1 }} />
        <button className="btn ghost danger small" onClick={removeFiltered} disabled={busy || !filtered.length}>
          <Trash2 size={14} /> Hapus {filtered.length === students.length ? 'semua' : filtered.length + ' siswa'}
        </button>
      </div>

      <div className="table-wrap">
        <table className="table">
          <thead>
            <tr>
              <th style={{ width: 56 }}>Foto</th>
              <th style={{ width: 140 }}>NISN</th>
              <th>Nama</th>
              <th style={{ width: 100 }}>Kelas</th>
              <th style={{ width: 130 }} />
            </tr>
          </thead>
          <tbody>
            {filtered.map((s) => (
              <tr key={s.nisn}>
                <td>
                  {s.has_photo ? (
                    <img className="thumb" src={photoUrl(s)} loading="lazy" alt="" />
                  ) : (
                    <div className="thumb thumb-empty">?</div>
                  )}
                </td>
                <td className="mono">{s.nisn}</td>
                <td>{s.nama}</td>
                <td>{s.kelas}</td>
                <td className="actions">
                  <button className="icon-btn" title="Foto" onClick={() => setCropping(s)}>
                    <Camera size={16} />
                  </button>
                  <button className="icon-btn" title="Edit" onClick={() => setEditing({ ...s, oldNisn: s.nisn })}>
                    <Pencil size={16} />
                  </button>
                  <button className="icon-btn danger" title="Hapus" onClick={() => remove(s)}>
                    <Trash2 size={16} />
                  </button>
                </td>
              </tr>
            ))}
            {!filtered.length && (
              <tr>
                <td colSpan={5} className="empty">
                  {students.length ? 'Tidak ada yang cocok.' : 'Belum ada siswa. Import dari Excel atau klik Tambah.'}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {editing && (
        <Modal
          title={editing.oldNisn ? 'Edit Siswa' : 'Tambah Siswa'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditing(null)}>
                Batal
              </button>
              <button className="btn primary" onClick={saveStudent} disabled={busy || !editing.nisn || !editing.nama}>
                Simpan
              </button>
            </>
          }
        >
          <Field label="NISN" hint="Hanya angka/huruf, tanpa spasi">
            <input value={editing.nisn} onChange={(e) => setEditing({ ...editing, nisn: e.target.value.trim() })} autoFocus />
          </Field>
          <Field label="Nama">
            <input value={editing.nama} onChange={(e) => setEditing({ ...editing, nama: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Kelas">
            <input value={editing.kelas} onChange={(e) => setEditing({ ...editing, kelas: e.target.value })} list="kelas-list" />
            <datalist id="kelas-list">
              {kelasList.map((k) => (
                <option key={k} value={k} />
              ))}
            </datalist>
          </Field>
        </Modal>
      )}

      {cropping && <CropDialog student={cropping} onClose={() => setCropping(null)} onSaved={reload} />}
      <ImportResult result={importResult} onClose={() => setImportResult(null)} />

      {photoJob && (
        <Modal
          title="Import Foto"
          onClose={photoJob.finished ? () => setPhotoJob(null) : undefined}
          footer={
            photoJob.finished && (
              <button className="btn primary" onClick={() => setPhotoJob(null)}>
                OK
              </button>
            )
          }
        >
          <div className="progress">
            <div style={{ width: (photoJob.total ? (photoJob.done / photoJob.total) * 100 : 100) + '%' }} />
          </div>
          <p>
            {photoJob.finished ? 'Selesai: ' : 'Memproses '}
            {photoJob.done} / {photoJob.total} foto cocok
            {photoJob.finished && <> — {photoJob.ok} tersimpan</>}
          </p>
          {photoJob.finished && photoJob.failed.length > 0 && (
            <>
              <b className="text-danger">Gagal ({photoJob.failed.length})</b>
              <div className="error-list">
                {photoJob.failed.map((f) => (
                  <div key={f}>{f}</div>
                ))}
              </div>
            </>
          )}
          {photoJob.finished && photoJob.unmatched.length > 0 && (
            <>
              <b className="text-warn">NISN tidak dikenal ({photoJob.unmatched.length} file)</b>
              <div className="error-list">
                {photoJob.unmatched.slice(0, 300).map((f) => (
                  <div key={f}>{f}</div>
                ))}
              </div>
            </>
          )}
        </Modal>
      )}
    </div>
  )
}
