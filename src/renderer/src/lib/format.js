export function formatNip(nip) {
  const d = String(nip ?? '').replace(/\D/g, '')
  if (d.length !== 18) return String(nip ?? '').trim()
  return `${d.slice(0, 8)} ${d.slice(8, 14)} ${d.slice(14, 15)} ${d.slice(15)}`
}

export const nipValid = (nip) => !nip || String(nip).replace(/\D/g, '').length === 18

export function cardTitle(exam) {
  const nama = (exam?.nama || 'UJIAN').toUpperCase()
  const tahun = exam?.tahun ? ` T.P ${exam.tahun}` : ''
  return `KARTU TANDA PESERTA ${nama}${tahun}`
}

export function qrText(p, settings, exam) {
  return [
    `NOPES:${p.nomor_peserta || '-'}`,
    `NISN:${p.nisn}`,
    `NAMA:${p.nama}`,
    `KELAS:${p.kelas || '-'}`,
    `RUANG:${p.ruang || '-'}`,
    `SESI:${p.sesi || '-'}`,
    `SEKOLAH:${settings.namaSekolah}`,
    `UJIAN:${[exam?.nama, exam?.tahun].filter(Boolean).join(' ')}`
  ].join('\n')
}

export const photoUrl = (p) =>
  p?.photo_src || (p?.has_photo ? `kartu://photo/${encodeURIComponent(p.nisn)}?v=${p.photo_ver}` : null)

// Foto ilustrasi untuk pratinjau bila belum ada siswa berfoto (bukan foto orang sungguhan).
const SAMPLE_PHOTO_SVG = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 400">
<defs><linearGradient id="b" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9363e"/><stop offset="1" stop-color="#b3242b"/></linearGradient></defs>
<rect width="300" height="400" fill="url(#b)"/>
<path d="M28 400c6-84 52-122 122-122s116 38 122 122z" fill="#ffffff"/>
<path d="M108 286l42 48 42-48-16-10h-52z" fill="#e9edf3"/>
<path d="M150 300l-12 14 12 70 12-70z" fill="#1f3a68"/>
<rect x="128" y="226" width="44" height="58" rx="18" fill="#e8b48f"/>
<ellipse cx="150" cy="168" rx="70" ry="80" fill="#f2c4a0"/>
<path d="M78 160c-4-62 34-98 74-98s76 34 72 98c-10-30-28-46-72-46s-62 16-74 46z" fill="#2b2b33"/>
<ellipse cx="124" cy="172" rx="7" ry="8" fill="#2b2b33"/><ellipse cx="176" cy="172" rx="7" ry="8" fill="#2b2b33"/>
<path d="M130 208q20 14 40 0" stroke="#b5725a" stroke-width="5" fill="none" stroke-linecap="round"/>
</svg>`
export const SAMPLE_PHOTO = 'data:image/svg+xml;utf8,' + encodeURIComponent(SAMPLE_PHOTO_SVG)
export const assetUrl = (settings, key) => (settings.assets?.[key] ? `kartu://asset/${key}?v=${settings.assets[key]}` : null)

const nat = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'id', { numeric: true, sensitivity: 'base' })
export const uniqueSorted = (arr) => [...new Set(arr.filter(Boolean))].sort(nat)

// Hanya untuk pratinjau di Pengaturan; nama dibuat jelas-jelas contoh agar tidak tertukar dengan siswa sungguhan.
export const SAMPLE_PARTICIPANT = {
  nisn: '0101234567',
  nama: 'NAMA SISWA CONTOH',
  kelas: 'IX.1',
  no_urut: '2',
  nomor_peserta: '10801923',
  ruang: '1',
  sesi: '1',
  username: 'peserta-10801923',
  password: 'ab12cd',
  has_photo: 0
}
