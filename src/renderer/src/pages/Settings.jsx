import { useEffect, useState } from 'react'
import { Upload, Trash2, Save } from 'lucide-react'
import { ScaledCard } from '../components/Card'
import { Field, useAction } from '../components/ui'
import { assetUrl, formatNip, nipValid, SAMPLE_PARTICIPANT } from '../lib/format'

const TEXT_FIELDS = [
  ['pemerintah', 'Baris 1 – Pemerintah', 'Template terang'],
  ['dinas', 'Baris 2 – Dinas', 'Kedua template'],
  ['uptd', 'Baris 3 – UPTD', 'Template terang'],
  ['namaSekolah', 'Nama Sekolah', 'Kedua template'],
  ['wilayah', 'Wilayah', 'Template gelap, mis. KABUPATEN LAMPUNG TENGAH'],
  ['alamat', 'Alamat', '']
]

const ASSETS = [
  ['logoKab', 'Logo Kabupaten'],
  ['logoSekolah', 'Logo Sekolah'],
  ['ttd', 'Tanda Tangan Kepala Sekolah'],
  ['stempel', 'Stempel Sekolah']
]

export default function Settings({ settings, onChange }) {
  const [form, setForm] = useState(settings)
  const [template, setTemplate] = useState('terang')
  const [run, busy] = useAction()
  useEffect(() => setForm((f) => ({ ...f, assets: settings.assets })), [settings.assets])

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value })
  const dirty = JSON.stringify(form) !== JSON.stringify(settings)
  const saveAll = () =>
    run(async () => {
      const s = await window.api.saveSettings(form)
      setForm(s)
      onChange(s)
    }, 'Pengaturan disimpan')

  const pick = (key) =>
    run(async () => {
      const s = await window.api.pickAsset(key)
      if (s) onChange(s)
      return s
    }, 'Gambar disimpan')
  const clear = (key) => run(() => window.api.clearAsset(key).then(onChange))

  const exam = { nama: 'UJIAN SEKOLAH', tahun: '2025/2026', template }

  return (
    <div className="page">
      <div className="page-head">
        <h1>Pengaturan Sekolah</h1>
        <button className="btn primary" disabled={!dirty || busy} onClick={saveAll}>
          <Save size={16} /> Simpan
        </button>
      </div>

      <div className="settings-grid">
        <div className="panel">
          <h2>Kop Kartu</h2>
          {TEXT_FIELDS.map(([k, label, hint]) => (
            <Field key={k} label={label} hint={hint}>
              <input value={form[k]} onChange={set(k)} />
            </Field>
          ))}
          <h2>Kepala Sekolah</h2>
          <Field label="Nama & gelar">
            <input value={form.kepalaSekolah} onChange={set('kepalaSekolah')} />
          </Field>
          <Field
            label="NIP"
            error={!nipValid(form.nip) ? 'NIP PNS harus 18 digit' : null}
            hint={form.nip ? 'Tercetak: NIP. ' + formatNip(form.nip) : 'Kosongkan jika tidak ada'}
          >
            <input value={form.nip} onChange={set('nip')} placeholder="19710720 199702 2 002" />
          </Field>

          <h2>Gambar</h2>
          <p className="muted">Gunakan PNG transparan untuk logo, tanda tangan, dan stempel.</p>
          <div className="assets">
            {ASSETS.map(([key, label]) => (
              <div className="asset" key={key}>
                <div className="asset-preview">
                  {assetUrl(settings, key) ? <img src={assetUrl(settings, key)} alt={label} /> : <span>belum ada</span>}
                </div>
                <div className="asset-label">{label}</div>
                <div className="row gap-s">
                  <button className="btn small" onClick={() => pick(key)} disabled={busy}>
                    <Upload size={14} /> Pilih
                  </button>
                  {settings.assets[key] > 0 && (
                    <button className="btn small ghost" onClick={() => clear(key)} disabled={busy} title="Hapus">
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          <h2>Tata Tertib (kartu belakang)</h2>
          <Field label="Satu baris = satu poin">
            <textarea rows={8} value={form.tataTertib} onChange={set('tataTertib')} />
          </Field>

          <h2>Kalibrasi Cetak Bolak-balik</h2>
          <p className="muted">
            Geser posisi halaman belakang (mm). Nilai positif = ke kanan / ke bawah. Cetak "Halaman Kalibrasi" dari menu Ujian untuk
            mengukurnya.
          </p>
          <div className="row gap">
            <Field label="Offset X (mm)">
              <input type="number" step="0.5" value={form.offsetX} onChange={set('offsetX')} />
            </Field>
            <Field label="Offset Y (mm)">
              <input type="number" step="0.5" value={form.offsetY} onChange={set('offsetY')} />
            </Field>
          </div>
        </div>

        <div className="panel preview-panel">
          <div className="row between">
            <h2>Pratinjau</h2>
            <select value={template} onChange={(e) => setTemplate(e.target.value)}>
              <option value="terang">Template Terang</option>
              <option value="gelap">Template Gelap</option>
            </select>
          </div>
          <p className="muted">{dirty ? 'Pratinjau memakai isian yang belum disimpan.' : 'Contoh data siswa.'}</p>
          <ScaledCard scale={0.56} template={template} side="front" p={SAMPLE_PARTICIPANT} settings={form} exam={exam} />
          <div style={{ height: 12 }} />
          <ScaledCard scale={0.56} template={template} side="back" p={SAMPLE_PARTICIPANT} settings={form} exam={exam} />
        </div>
      </div>
    </div>
  )
}
