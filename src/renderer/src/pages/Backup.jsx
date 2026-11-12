import { useEffect, useState } from 'react'
import { DatabaseBackup, ArchiveRestore, FolderOpen } from 'lucide-react'
import { useAction } from '../components/ui'

export default function Backup({ onRestored }) {
  const [dir, setDir] = useState('')
  const [run, busy] = useAction()
  useEffect(() => {
    window.api.dataDir().then(setDir)
  }, [])

  const restore = () =>
    run(async () => {
      if (!confirm('Restore akan MENGGANTI seluruh data saat ini (siswa, foto, ujian, pengaturan). Lanjutkan?')) return null
      const r = await window.api.restore()
      if (r) {
        alert('Restore berhasil. Data sebelum restore disimpan sebagai "sebelum-restore.zip" di folder data.')
        onRestored()
      }
      return r
    })

  return (
    <div className="page">
      <div className="page-head">
        <h1>Backup & Restore</h1>
      </div>
      <div className="panel narrow">
        <h2>Backup</h2>
        <p>Simpan seluruh data (siswa, foto, ujian, pengaturan, logo & tanda tangan) ke satu file ZIP. Lakukan rutin dan simpan di flashdisk / Google Drive.</p>
        <button className="btn primary" onClick={() => run(() => window.api.backup(), (f) => 'Backup tersimpan: ' + f)} disabled={busy}>
          <DatabaseBackup size={16} /> Buat Backup
        </button>

        <h2>Restore</h2>
        <p>Kembalikan data dari file backup. Bisa juga dipakai untuk memindahkan data ke komputer lain (Windows ↔ Linux).</p>
        <button className="btn danger" onClick={restore} disabled={busy}>
          <ArchiveRestore size={16} /> Restore dari Backup
        </button>

        <h2>Folder data</h2>
        <p className="mono small">{dir}</p>
        <button className="btn ghost" onClick={() => window.api.openDataDir()}>
          <FolderOpen size={16} /> Buka Folder
        </button>
      </div>
    </div>
  )
}
