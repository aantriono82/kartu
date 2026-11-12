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

export const photoUrl = (p) => (p?.has_photo ? `kartu://photo/${encodeURIComponent(p.nisn)}?v=${p.photo_ver}` : null)
export const assetUrl = (settings, key) => (settings.assets?.[key] ? `kartu://asset/${key}?v=${settings.assets[key]}` : null)

const nat = (a, b) => String(a ?? '').localeCompare(String(b ?? ''), 'id', { numeric: true, sensitivity: 'base' })
export const uniqueSorted = (arr) => [...new Set(arr.filter(Boolean))].sort(nat)

export const SAMPLE_PARTICIPANT = {
  nisn: '0101234567',
  nama: 'NARUTI UZUKIMI',
  kelas: 'IX.1',
  no_urut: '2',
  nomor_peserta: '10801923',
  ruang: '1',
  sesi: '1',
  username: 'peserta-10801923',
  password: 'ab12cd',
  has_photo: 0
}
