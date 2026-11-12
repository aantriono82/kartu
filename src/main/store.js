import fs from 'node:fs'
import path from 'node:path'
import { all, get, run, tx, save } from './db'
import { paths, safeName } from './paths'

export const DEFAULT_SETTINGS = {
  pemerintah: 'PEMERINTAH KABUPATEN LAMPUNG TENGAH',
  dinas: 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
  uptd: 'UPTD SATUAN PENDIDIKAN',
  namaSekolah: 'SMP NEGERI 2 BANGUNREJO',
  wilayah: 'KABUPATEN LAMPUNG TENGAH',
  alamat: 'Jl. Sinarjaya-Sinarluas, Kec. Bangunrejo, Lampung Tengah',
  kepalaSekolah: 'EVI OKTAVIA, S.Pd., M.Pd.',
  nip: '',
  tempatTanggal: '', // mis. "Bangunrejo, Mei 2026" (template indigo)
  tataTertib: [
    'Peserta hadir di sekolah 15 menit sebelum ujian dimulai.',
    'Peserta wajib membawa kartu ini dan menunjukkannya kepada pengawas.',
    'Peserta berpakaian seragam sekolah lengkap, rapi, dan sopan.',
    'Peserta dilarang membawa alat komunikasi, buku, atau catatan ke dalam ruang ujian.',
    'Peserta dilarang bekerja sama, mencontek, atau memberi jawaban kepada peserta lain.',
    'Peserta wajib menjaga ketertiban dan ketenangan selama ujian berlangsung.',
    'Kartu ini wajib dijaga dan tidak boleh dipinjamkan kepada orang lain.'
  ].join('\n'),
  offsetX: 0,
  offsetY: 0,
  // ukuran (%) dan posisi (mm) tanda tangan & stempel di kartu
  cardGap: 4, // jarak antarkartu di lembar A4 (mm)
  ttdScale: 100,
  stempelScale: 150,
  stempelX: 0,
  stempelY: 0,
  // asset key -> version number (0 = belum ada)
  assets: { logoKab: 0, logoSekolah: 0, ttd: 0, stempel: 0 }
}

export const ASSET_KEYS = Object.keys(DEFAULT_SETTINGS.assets)

// ---------- settings ----------
function parseSaved(text) {
  try {
    const v = JSON.parse(text)
    if (v && typeof v === 'object' && !Array.isArray(v)) return v
  } catch {
    /* lihat di bawah */
  }
  // Data pengaturan rusak: pakai bawaan agar aplikasi tetap bisa dibuka (aset/logo tetap di folder assets).
  console.error('Pengaturan sekolah rusak, memakai pengaturan bawaan')
  return {}
}

export function getSettings() {
  const row = get("SELECT value FROM settings WHERE key = 'school'")
  const saved = row ? parseSaved(row.value) : {}
  // versi aset 0 tapi filenya ada (mis. pengaturan sempat rusak) → tetap tampilkan
  const assets = {}
  for (const k of ASSET_KEYS) assets[k] = Number(saved.assets?.[k]) || (fs.existsSync(assetPath(k)) ? 1 : 0)
  const out = { ...DEFAULT_SETTINGS, ...saved, assets }
  // nilai bertipe salah (mis. objek di kolom teks) → pakai bawaan agar tampilan tidak error
  for (const [k, def] of Object.entries(DEFAULT_SETTINGS)) {
    if (k === 'assets') continue
    if (typeof def === 'string' && typeof out[k] !== 'string') out[k] = out[k] == null || typeof out[k] === 'object' ? def : String(out[k])
    if (typeof def === 'number' && !Number.isFinite(Number(out[k]))) out[k] = def
  }
  return out
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch }
  next.offsetX = Number(next.offsetX) || 0
  next.offsetY = Number(next.offsetY) || 0
  for (const k of ['cardGap', 'ttdScale', 'stempelScale', 'stempelX', 'stempelY']) {
    const n = Number(next[k])
    next[k] = Number.isFinite(n) ? n : DEFAULT_SETTINGS[k]
  }
  run("INSERT INTO settings(key, value) VALUES('school', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [
    JSON.stringify(next)
  ])
  save()
  return next
}

export function assetPath(key) {
  if (!ASSET_KEYS.includes(key)) throw new Error('Aset tidak dikenal: ' + key)
  return path.join(paths.assets, key + '.png')
}

export function setAsset(key, pngBuffer) {
  const s = getSettings()
  if (pngBuffer) fs.writeFileSync(assetPath(key), pngBuffer)
  else fs.rmSync(assetPath(key), { force: true })
  return saveSettings({ assets: { ...s.assets, [key]: pngBuffer ? (s.assets[key] || 0) + 1 : 0 } })
}

// ---------- students ----------
export function listStudents() {
  return all('SELECT * FROM students ORDER BY kelas, nama')
}

export function upsertStudent({ nisn, nama, kelas }, persist = true) {
  nisn = safeName(nisn)
  if (!String(nama ?? '').trim()) throw new Error('Nama wajib diisi')
  const exists = get('SELECT 1 AS x FROM students WHERE nisn = ?', [nisn])
  run(
    `INSERT INTO students(nisn, nama, kelas) VALUES(?, ?, ?)
     ON CONFLICT(nisn) DO UPDATE SET nama = excluded.nama, kelas = excluded.kelas`,
    [nisn, String(nama).trim(), String(kelas ?? '').trim()]
  )
  if (persist) save()
  return exists ? 'updated' : 'added'
}

export function updateStudent(oldNisn, data) {
  oldNisn = safeName(oldNisn)
  const nisn = safeName(data.nisn)
  if (nisn === oldNisn) return upsertStudent(data)
  if (get('SELECT 1 AS x FROM students WHERE nisn = ?', [nisn])) throw new Error('NISN ' + nisn + ' sudah dipakai siswa lain')
  tx(() => {
    run('INSERT INTO students(nisn, nama, kelas, has_photo, photo_ver) SELECT ?, ?, ?, has_photo, photo_ver FROM students WHERE nisn = ?', [
      nisn,
      String(data.nama).trim(),
      String(data.kelas ?? '').trim(),
      oldNisn
    ])
    run('UPDATE participants SET nisn = ? WHERE nisn = ?', [nisn, oldNisn])
    run('DELETE FROM students WHERE nisn = ?', [oldNisn])
  })
  for (const dir of [paths.photos, paths.originals]) {
    const from = path.join(dir, oldNisn + '.jpg')
    if (fs.existsSync(from)) fs.renameSync(from, path.join(dir, nisn + '.jpg'))
  }
}

export function deleteStudents(nisns) {
  tx(() => nisns.forEach((n) => run('DELETE FROM students WHERE nisn = ?', [safeName(n)])))
  for (const n of nisns) removePhotoFiles(n)
}

export function removePhotoFiles(nisn) {
  nisn = safeName(nisn)
  fs.rmSync(path.join(paths.photos, nisn + '.jpg'), { force: true })
  fs.rmSync(path.join(paths.originals, nisn + '.jpg'), { force: true })
}

export function savePhoto(nisn, origBytes, cropBytes) {
  nisn = safeName(nisn)
  if (!get('SELECT 1 AS x FROM students WHERE nisn = ?', [nisn])) throw new Error('Siswa dengan NISN ' + nisn + ' tidak ada')
  if (origBytes) fs.writeFileSync(path.join(paths.originals, nisn + '.jpg'), Buffer.from(origBytes))
  fs.writeFileSync(path.join(paths.photos, nisn + '.jpg'), Buffer.from(cropBytes))
  run('UPDATE students SET has_photo = 1, photo_ver = photo_ver + 1 WHERE nisn = ?', [nisn])
  save()
}

export function deletePhoto(nisn) {
  removePhotoFiles(nisn)
  run('UPDATE students SET has_photo = 0, photo_ver = photo_ver + 1 WHERE nisn = ?', [safeName(nisn)])
  save()
}

export function readOriginal(nisn) {
  nisn = safeName(nisn)
  for (const f of [path.join(paths.originals, nisn + '.jpg'), path.join(paths.photos, nisn + '.jpg')]) {
    if (fs.existsSync(f)) return fs.readFileSync(f)
  }
  return null
}

// ---------- exams ----------
export function listExams() {
  return all(
    `SELECT e.*, (SELECT COUNT(*) FROM participants p WHERE p.exam_id = e.id) AS jumlah
     FROM exams e ORDER BY e.id DESC`
  )
}

export function saveExam({ id, nama, tahun, template }) {
  if (!String(nama ?? '').trim()) throw new Error('Nama ujian wajib diisi')
  template = ['gelap', 'hijau', 'indigo'].includes(template) ? template : 'terang'
  if (id) {
    run('UPDATE exams SET nama = ?, tahun = ?, template = ? WHERE id = ?', [nama.trim(), String(tahun ?? '').trim(), template, id])
    save()
    return id
  }
  const { lastId } = run('INSERT INTO exams(nama, tahun, template) VALUES(?, ?, ?)', [nama.trim(), String(tahun ?? '').trim(), template])
  save()
  return lastId
}

export function deleteExam(id) {
  tx(() => {
    run('DELETE FROM participants WHERE exam_id = ?', [id])
    run('DELETE FROM exams WHERE id = ?', [id])
  })
}

const PARTICIPANT_FIELDS = ['no_urut', 'nomor_peserta', 'ruang', 'sesi', 'username', 'password']

export function listParticipants(examId) {
  return all(
    `SELECT p.*, s.nama, s.kelas, s.has_photo, s.photo_ver
     FROM participants p JOIN students s ON s.nisn = p.nisn
     WHERE p.exam_id = ?`,
    [examId]
  ).sort(compareParticipants)
}

const nat = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'id', { numeric: true, sensitivity: 'base' })
export function compareParticipants(a, b) {
  return nat(a.kelas, b.kelas) || nat(a.ruang, b.ruang) || nat(a.no_urut, b.no_urut) || nat(a.nama, b.nama)
}

export function upsertParticipant(examId, p, persist = true) {
  const nisn = safeName(p.nisn)
  if (!get('SELECT 1 AS x FROM students WHERE nisn = ?', [nisn])) throw new Error('NISN ' + nisn + ' belum ada di data siswa')
  const exists = get('SELECT 1 AS x FROM participants WHERE exam_id = ? AND nisn = ?', [examId, nisn])
  const values = PARTICIPANT_FIELDS.map((f) => String(p[f] ?? '').trim())
  run(
    `INSERT INTO participants(exam_id, nisn, ${PARTICIPANT_FIELDS.join(', ')}) VALUES(?, ?, ${PARTICIPANT_FIELDS.map(() => '?').join(', ')})
     ON CONFLICT(exam_id, nisn) DO UPDATE SET ${PARTICIPANT_FIELDS.map((f) => `${f} = excluded.${f}`).join(', ')}`,
    [examId, nisn, ...values]
  )
  if (persist) save()
  return exists ? 'updated' : 'added'
}

export function deleteParticipants(ids) {
  tx(() => ids.forEach((id) => run('DELETE FROM participants WHERE id = ?', [id])))
}

export function clearParticipants(examId) {
  tx(() => run('DELETE FROM participants WHERE exam_id = ?', [examId]))
}

export function getExam(id) {
  return get('SELECT * FROM exams WHERE id = ?', [id])
}
