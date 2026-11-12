import { useCallback, useEffect, useMemo, useState } from 'react'
import { Plus, Trash2, FileSpreadsheet, Download, FileText, Image, Crosshair, Pencil, Search, Save } from 'lucide-react'
import { ScaledCard, TEMPLATE_OPTIONS } from '../components/Card'
import { Field, ImportResult, Modal, useAction, useToast } from '../components/ui'
import { uniqueSorted } from '../lib/format'
import { duplicateSummary, findDuplicates } from '../lib/check'

const EMPTY_EXAM = { nama: 'UJIAN SEKOLAH', tahun: '', template: 'terang' }
const P_FIELDS = [
  ['no_urut', 'No Urut'],
  ['nomor_peserta', 'Nomor Peserta'],
  ['ruang', 'Ruang'],
  ['sesi', 'Sesi'],
  ['username', 'Username'],
  ['password', 'Password']
]

function defaultTahun() {
  const d = new Date()
  const y = d.getMonth() >= 6 ? d.getFullYear() : d.getFullYear() - 1
  return `${y}/${y + 1}`
}

export default function Exams({ settings }) {
  const [exams, setExams] = useState([])
  const [selected, setSelected] = useState(null)
  const [creating, setCreating] = useState(null)
  const [run, busy] = useAction()

  const reload = useCallback(
    () =>
      window.api.listExams().then((list) => {
        setExams(list)
        setSelected((cur) => (cur && list.some((e) => e.id === cur) ? cur : list[0]?.id ?? null))
      }),
    []
  )
  useEffect(() => {
    reload()
  }, [reload])

  const create = () =>
    run(async () => {
      const id = await window.api.saveExam(creating)
      setCreating(null)
      await reload()
      setSelected(id)
    }, 'Ujian dibuat')

  const exam = exams.find((e) => e.id === selected)

  return (
    <div className="page exams-page">
      <div className="exam-list">
        <div className="row between">
          <h2>Ujian</h2>
          <button className="btn small primary" onClick={() => setCreating({ ...EMPTY_EXAM, tahun: defaultTahun() })}>
            <Plus size={14} /> Baru
          </button>
        </div>
        {exams.map((e) => (
          <button key={e.id} className={'exam-item' + (e.id === selected ? ' active' : '')} onClick={() => setSelected(e.id)}>
            <b>{e.nama}</b>
            <small>
              T.P {e.tahun || '-'} · {e.jumlah} peserta · {e.template}
            </small>
          </button>
        ))}
        {!exams.length && <p className="muted">Belum ada ujian. Klik "Baru".</p>}
      </div>

      <div className="exam-detail">
        {exam ? (
          <ExamDetail key={exam.id} exam={exam} settings={settings} onChanged={reload} />
        ) : (
          <div className="empty-state">Pilih atau buat ujian.</div>
        )}
      </div>

      {creating && (
        <Modal
          title="Ujian Baru"
          onClose={() => setCreating(null)}
          footer={
            <>
              <button className="btn" onClick={() => setCreating(null)}>
                Batal
              </button>
              <button className="btn primary" onClick={create} disabled={busy || !creating.nama.trim()}>
                Buat
              </button>
            </>
          }
        >
          <ExamForm value={creating} onChange={setCreating} />
        </Modal>
      )}
    </div>
  )
}

function ExamForm({ value, onChange }) {
  return (
    <>
      <Field label="Nama ujian" hint='Tercetak: "KARTU TANDA PESERTA {nama ujian} T.P {tahun}"'>
        <input value={value.nama} onChange={(e) => onChange({ ...value, nama: e.target.value.toUpperCase() })} />
      </Field>
      <Field label="Tahun pelajaran">
        <input value={value.tahun} onChange={(e) => onChange({ ...value, tahun: e.target.value })} placeholder="2025/2026" />
      </Field>
      <Field label="Template">
        <select value={value.template} onChange={(e) => onChange({ ...value, template: e.target.value })}>
          {TEMPLATE_OPTIONS.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </Field>
    </>
  )
}

function ExamDetail({ exam, settings, onChanged }) {
  const [form, setForm] = useState(exam)
  const [participants, setParticipants] = useState([])
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState({ by: '', value: '' }) // by: '' | 'kelas' | 'ruang'
  const [previewId, setPreviewId] = useState(null)
  const [editing, setEditing] = useState(null)
  const [importResult, setImportResult] = useState(null)
  const [includeBack, setIncludeBack] = useState(false)
  const [progress, setProgress] = useState(null)
  const [run, busy] = useAction()
  const toast = useToast()

  const reload = useCallback(() => window.api.listParticipants(exam.id).then(setParticipants), [exam.id])
  useEffect(() => {
    reload()
  }, [reload])
  useEffect(() => window.api.onExportProgress(setProgress), [])

  const kelasList = useMemo(() => uniqueSorted(participants.map((p) => p.kelas)), [participants])
  const ruangList = useMemo(() => uniqueSorted(participants.map((p) => p.ruang)), [participants])
  const printSet = useMemo(
    () => participants.filter((p) => !filter.by || !filter.value || p[filter.by] === filter.value),
    [participants, filter]
  )
  const shown = useMemo(() => {
    const n = q.trim().toLowerCase()
    return printSet.filter((p) => !n || p.nama.toLowerCase().includes(n) || p.nisn.includes(n) || p.nomor_peserta.includes(n))
  }, [printSet, q])
  const preview = participants.find((p) => p.id === previewId) || shown[0]
  const noPhoto = printSet.filter((p) => !p.has_photo).length
  const noNomor = printSet.filter((p) => !String(p.nomor_peserta ?? '').trim()).length
  // duplikat dicek terhadap seluruh peserta ujian, bukan hanya yang difilter
  const dups = useMemo(() => findDuplicates(participants), [participants])
  const dupsInPrint = dups.groups.filter((g) => g.people.some((p) => printSet.includes(p)))
  const liveExam = { ...exam, ...form }
  const dirty = form.nama !== exam.nama || form.tahun !== exam.tahun || form.template !== exam.template

  const saveExam = () =>
    run(async () => {
      await window.api.saveExam(form)
      onChanged()
    }, 'Ujian disimpan')

  const deleteExam = () =>
    run(async () => {
      if (!confirm(`Hapus ujian "${exam.nama}" beserta ${participants.length} data peserta? Data siswa & foto tetap aman.`)) return null
      await window.api.deleteExam(exam.id)
      onChanged()
    }, 'Ujian dihapus')

  const importExcel = () =>
    run(async () => {
      const r = await window.api.importParticipants(exam.id)
      if (r) {
        setImportResult(r)
        reload()
        onChanged()
      }
      return null
    })

  const clearAll = () =>
    run(async () => {
      if (!confirm(`Hapus semua ${participants.length} peserta dari ujian ini?`)) return null
      await window.api.clearParticipants(exam.id)
      reload()
      onChanged()
    }, 'Peserta dikosongkan')

  const saveParticipant = () =>
    run(async () => {
      await window.api.saveParticipant(exam.id, editing)
      setEditing(null)
      reload()
      onChanged()
    }, 'Peserta disimpan')

  const removeParticipant = (p) =>
    run(async () => {
      if (!confirm(`Keluarkan ${p.nama} dari ujian ini?`)) return null
      await window.api.deleteParticipants([p.id])
      reload()
      onChanged()
    })

  const filterLabel = filter.by && filter.value ? ` ${filter.by === 'kelas' ? 'Kelas' : 'Ruang'} ${filter.value}` : ''
  const baseName = `Kartu ${exam.nama} ${exam.tahun || ''}${filterLabel}`.replace(/[\\/:*?"<>|]+/g, '-').trim()
  const job = (side) => ({
    examId: exam.id,
    side,
    filter: filter.by && filter.value ? { [filter.by]: filter.value } : {}
  })
  const needSaved = () => {
    if (dirty) throw new Error('Simpan perubahan ujian dulu sebelum mencetak')
    if (!printSet.length) throw new Error('Tidak ada peserta untuk dicetak')
  }
  /** false jika pengguna membatalkan karena ada data ganda. */
  const confirmDuplicates = () =>
    !dupsInPrint.length ||
    confirm(
      `Ada ${duplicateSummary(dupsInPrint)} pada peserta yang akan dicetak:\n\n` +
        dupsInPrint
          .slice(0, 8)
          .map((g) => `• ${g.label} ${g.value}: ${g.people.map((p) => p.nama).join(', ')}`)
          .join('\n') +
        (dupsInPrint.length > 8 ? `\n• ...dan ${dupsInPrint.length - 8} lainnya` : '') +
        '\n\nSebaiknya perbaiki dulu. Tetap cetak?'
    )
  const exportPdf = (side) =>
    run(async () => {
      needSaved()
      if (!confirmDuplicates()) return null
      const r = await window.api.exportPdf(job(side), `${baseName} - ${side === 'back' ? 'Belakang' : 'Depan'}.pdf`)
      return r
    }, (r) => `PDF tersimpan (${r.pages} halaman)`)
  const exportPng = () =>
    run(async () => {
      needSaved()
      if (!confirmDuplicates()) return null
      setProgress({ done: 0, total: printSet.length })
      try {
        return await window.api.exportPng({ ...job('front'), includeBack }, `${baseName} - PNG.zip`)
      } finally {
        setProgress(null)
      }
    }, (r) => `${r.count} kartu PNG tersimpan`)
  const exportCalib = () =>
    run(() => window.api.exportPdf({ side: 'calib' }, 'Halaman Kalibrasi.pdf'), 'Halaman kalibrasi tersimpan')

  return (
    <>
      <div className="page-head">
        <div className="row gap wrap exam-form">
          <Field label="Nama ujian">
            <input value={form.nama} onChange={(e) => setForm({ ...form, nama: e.target.value.toUpperCase() })} />
          </Field>
          <Field label="Tahun pelajaran">
            <input value={form.tahun} onChange={(e) => setForm({ ...form, tahun: e.target.value })} style={{ width: 120 }} />
          </Field>
          <Field label="Template">
            <select value={form.template} onChange={(e) => setForm({ ...form, template: e.target.value })}>
              {TEMPLATE_OPTIONS.map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
          <button className="btn primary" disabled={!dirty || busy} onClick={saveExam}>
            <Save size={16} /> Simpan
          </button>
        </div>
        <button className="btn ghost danger" onClick={deleteExam} disabled={busy}>
          <Trash2 size={16} /> Hapus Ujian
        </button>
      </div>

      <div className="exam-grid">
        <div className="panel">
          <div className="row between wrap gap-s">
            <h2>Peserta ({participants.length})</h2>
            <div className="row gap-s wrap">
              <button className="btn small" onClick={() => window.api.downloadTemplate('peserta').catch((e) => toast(e.message, 'error'))}>
                <Download size={14} /> Template Excel
              </button>
              <button className="btn small" onClick={importExcel} disabled={busy}>
                <FileSpreadsheet size={14} /> Import Excel
              </button>
              <button className="btn small" onClick={() => setEditing({ nisn: '', ...Object.fromEntries(P_FIELDS.map(([k]) => [k, ''])) })}>
                <Plus size={14} /> Tambah
              </button>
              <button className="btn small ghost danger" onClick={clearAll} disabled={busy || !participants.length}>
                <Trash2 size={14} /> Kosongkan
              </button>
            </div>
          </div>
          <p className="muted small">
            Import Excel berisi kolom NISN, NAMA, KELAS, NO URUT, NOMOR PESERTA, RUANG, SESI, USERNAME, PASSWORD. Siswa baru otomatis
            ditambahkan ke Data Siswa; foto diambil dari Data Siswa berdasarkan NISN.
          </p>
          <div className="toolbar">
            <div className="search">
              <Search size={16} />
              <input placeholder="Cari nama / NISN / no. peserta" value={q} onChange={(e) => setQ(e.target.value)} />
            </div>
          </div>
          <div className="table-wrap">
            <table className="table compact">
              <thead>
                <tr>
                  <th>No</th>
                  <th>No. Peserta</th>
                  <th>Nama</th>
                  <th>Kelas</th>
                  <th>Ruang</th>
                  <th>Sesi</th>
                  <th>Foto</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {shown.map((p) => (
                  <tr key={p.id} className={preview?.id === p.id ? 'selected' : ''} onClick={() => setPreviewId(p.id)}>
                    <td>{p.no_urut}</td>
                    <td
                      className={'mono' + (dups.fieldsById.get(p.id)?.has('nomor_peserta') ? ' text-danger' : '')}
                      title={dups.fieldsById.has(p.id) ? 'Data ganda: ' + [...dups.fieldsById.get(p.id)].join(', ').replace('nomor_peserta', 'nomor peserta') : undefined}
                    >
                      {p.nomor_peserta}
                      {dups.ids.has(p.id) && ' ⚠'}
                    </td>
                    <td>{p.nama}</td>
                    <td>{p.kelas}</td>
                    <td>{p.ruang}</td>
                    <td>{p.sesi}</td>
                    <td>{p.has_photo ? '✓' : <span className="text-warn">✗</span>}</td>
                    <td className="actions">
                      <button className="icon-btn" title="Edit" onClick={(e) => (e.stopPropagation(), setEditing({ ...p }))}>
                        <Pencil size={15} />
                      </button>
                      <button
                        className="icon-btn danger"
                        title="Keluarkan"
                        onClick={(e) => (e.stopPropagation(), removeParticipant(p))}
                      >
                        <Trash2 size={15} />
                      </button>
                    </td>
                  </tr>
                ))}
                {!shown.length && (
                  <tr>
                    <td colSpan={8} className="empty">
                      {participants.length ? 'Tidak ada yang cocok.' : 'Belum ada peserta. Import dari Excel.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="panel side-panel">
          <h2>Cetak</h2>
          <div className="row gap-s">
            <select value={filter.by} onChange={(e) => setFilter({ by: e.target.value, value: '' })}>
              <option value="">Semua peserta</option>
              <option value="kelas">Per kelas</option>
              <option value="ruang">Per ruang</option>
            </select>
            {filter.by && (
              <select value={filter.value} onChange={(e) => setFilter({ ...filter, value: e.target.value })}>
                <option value="">— pilih {filter.by} —</option>
                {(filter.by === 'kelas' ? kelasList : ruangList).map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            )}
          </div>
          <p className="muted small">
            {printSet.length} kartu · {Math.ceil(printSet.length / 8)} lembar A4
            {noPhoto > 0 && <span className="text-warn"> · {noPhoto} tanpa foto</span>}
            {noNomor > 0 && <span className="text-warn"> · {noNomor} tanpa nomor peserta</span>}
          </p>
          {dups.groups.length > 0 && (
            <div className="warn-box">
              <b>⚠ {duplicateSummary(dups.groups)}</b>
              <ul>
                {dups.groups.slice(0, 5).map((g) => (
                  <li key={g.field + g.value}>
                    {g.label} <span className="mono">{g.value}</span>: {g.people.map((p) => p.nama).join(', ')}
                  </li>
                ))}
                {dups.groups.length > 5 && <li>...dan {dups.groups.length - 5} lainnya</li>}
              </ul>
              <span className="muted">Perbaiki lewat tombol edit (✎) di tabel atau import ulang Excel.</span>
            </div>
          )}
          <div className="export-buttons">
            <button className="btn primary" onClick={() => exportPdf('front')} disabled={busy}>
              <FileText size={16} /> PDF Depan
            </button>
            <button className="btn primary" onClick={() => exportPdf('back')} disabled={busy}>
              <FileText size={16} /> PDF Belakang
            </button>
            <button className="btn" onClick={exportPng} disabled={busy}>
              <Image size={16} /> PNG per siswa (ZIP)
            </button>
            <label className="row gap-s small">
              <input type="checkbox" checked={includeBack} onChange={(e) => setIncludeBack(e.target.checked)} /> PNG sertakan sisi
              belakang
            </label>
            <button className="btn ghost" onClick={exportCalib} disabled={busy}>
              <Crosshair size={16} /> Halaman Kalibrasi
            </button>
          </div>
          <p className="muted small">
            Bolak-balik manual: cetak PDF Depan → balik tumpukan kertas pada sisi panjang → cetak PDF Belakang. Posisi belakang sudah
            dicerminkan; atur offset di Pengaturan jika meleset.
          </p>
          {progress && (
            <div>
              <div className="progress">
                <div style={{ width: (progress.done / Math.max(1, progress.total)) * 100 + '%' }} />
              </div>
              <small>
                PNG {progress.done} / {progress.total}
              </small>
            </div>
          )}

          <h2>Pratinjau</h2>
          {preview ? (
            <>
              <ScaledCard scale={0.355} template={form.template} side="front" p={preview} settings={settings} exam={liveExam} />
              <div style={{ height: 8 }} />
              <ScaledCard scale={0.355} template={form.template} side="back" p={preview} settings={settings} exam={liveExam} />
            </>
          ) : (
            <p className="muted">Belum ada peserta.</p>
          )}
        </div>
      </div>

      {editing && (
        <Modal
          title={editing.id ? `Edit Peserta: ${editing.nama}` : 'Tambah Peserta'}
          onClose={() => setEditing(null)}
          footer={
            <>
              <button className="btn" onClick={() => setEditing(null)}>
                Batal
              </button>
              <button className="btn primary" onClick={saveParticipant} disabled={busy || !editing.nisn}>
                Simpan
              </button>
            </>
          }
        >
          <Field label="NISN" hint={editing.id ? '' : 'Siswa harus sudah ada di Data Siswa'}>
            <input value={editing.nisn} disabled={!!editing.id} onChange={(e) => setEditing({ ...editing, nisn: e.target.value.trim() })} />
          </Field>
          <div className="grid-2">
            {P_FIELDS.map(([k, label]) => (
              <Field key={k} label={label}>
                <input value={editing[k] ?? ''} onChange={(e) => setEditing({ ...editing, [k]: e.target.value })} />
              </Field>
            ))}
          </div>
        </Modal>
      )}
      <ImportResult result={importResult} onClose={() => setImportResult(null)} />
    </>
  )
}
