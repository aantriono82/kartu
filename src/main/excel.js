import ExcelJS from 'exceljs'
import { tx } from './db'
import { upsertStudent, upsertParticipant } from './store'

const ALIASES = {
  nisn: ['NISN'],
  nama: ['NAMA', 'NAMA SISWA', 'NAMA LENGKAP', 'NAMA PESERTA'],
  kelas: ['KELAS', 'ROMBEL'],
  no_urut: ['NO URUT', 'NOMOR URUT', 'NO', 'NO.', 'URUT'],
  nomor_peserta: ['NOMOR PESERTA', 'NO PESERTA', 'NO. PESERTA', 'NOPES', 'NOMOR UJIAN'],
  ruang: ['RUANG', 'RUANGAN', 'RUANG UJIAN'],
  sesi: ['SESI'],
  username: ['USERNAME', 'USER', 'USER NAME'],
  password: ['PASSWORD', 'PASS', 'KATA SANDI']
}

const norm = (s) => String(s ?? '').toUpperCase().replace(/[_\s]+/g, ' ').trim()

function cellText(cell) {
  const v = cell.value
  if (v == null) return { text: '', numeric: false }
  if (typeof v === 'number') return { text: Number.isInteger(v) ? v.toFixed(0) : String(v), numeric: true }
  if (v instanceof Date) return { text: cell.text, numeric: false }
  if (typeof v === 'object') {
    if (v.richText) return { text: v.richText.map((r) => r.text).join(''), numeric: false }
    if ('result' in v) return cellText({ value: v.result, text: cell.text })
    if (v.text != null) return { text: String(v.text), numeric: false }
    return { text: cell.text ?? '', numeric: false }
  }
  return { text: String(v), numeric: false }
}

/** Read the first sheet; returns rows as { field: {text, numeric} } plus the Excel row number. */
async function readRows(file) {
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.readFile(file)
  const ws = wb.worksheets[0]
  if (!ws) throw new Error('File Excel tidak berisi sheet')

  let headerRow = null
  let map = null
  for (let r = 1; r <= Math.min(ws.rowCount, 15) && !map; r++) {
    const m = {}
    ws.getRow(r).eachCell((cell, col) => {
      const h = norm(cellText(cell).text)
      for (const [field, names] of Object.entries(ALIASES)) if (names.includes(h) && !(field in m)) m[field] = col
    })
    if ('nisn' in m) {
      headerRow = r
      map = m
    }
  }
  if (!map) throw new Error('Kolom "NISN" tidak ditemukan di 15 baris pertama. Gunakan template Excel dari aplikasi.')

  const rows = []
  for (let r = headerRow + 1; r <= ws.rowCount; r++) {
    const row = ws.getRow(r)
    const out = { _row: r }
    let empty = true
    for (const [field, col] of Object.entries(map)) {
      out[field] = cellText(row.getCell(col))
      out[field].text = out[field].text.trim()
      if (out[field].text) empty = false
    }
    if (!empty) rows.push(out)
  }
  return { rows, columns: Object.keys(map) }
}

function nisnOf(row) {
  let { text, numeric } = row.nisn
  text = text.replace(/\s+/g, '')
  // Excel menghapus angka 0 di depan jika kolom bertipe angka
  if (numeric && /^\d+$/.test(text) && text.length < 10) text = text.padStart(10, '0')
  return text
}

const val = (row, f) => row[f]?.text ?? ''

export async function importStudents(file) {
  const { rows } = await readRows(file)
  const result = { added: 0, updated: 0, errors: [] }
  tx(() => {
    for (const row of rows) {
      try {
        const nisn = nisnOf(row)
        if (!nisn) throw new Error('NISN kosong')
        result[upsertStudent({ nisn, nama: val(row, 'nama'), kelas: val(row, 'kelas') }, false)]++
      } catch (e) {
        result.errors.push({ row: row._row, message: e.message })
      }
    }
  })
  return result
}

export async function importParticipants(examId, file) {
  const { rows, columns } = await readRows(file)
  const result = { added: 0, updated: 0, errors: [] }
  tx(() => {
    for (const row of rows) {
      try {
        const nisn = nisnOf(row)
        if (!nisn) throw new Error('NISN kosong')
        if (columns.includes('nama') && val(row, 'nama')) {
          upsertStudent({ nisn, nama: val(row, 'nama'), kelas: val(row, 'kelas') }, false)
        }
        const p = { nisn }
        for (const f of ['no_urut', 'nomor_peserta', 'ruang', 'sesi', 'username', 'password']) p[f] = val(row, f)
        result[upsertParticipant(examId, p, false)]++
      } catch (e) {
        result.errors.push({ row: row._row, message: e.message })
      }
    }
  })
  return result
}

export async function writeTemplate(kind, file) {
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet(kind === 'siswa' ? 'Siswa' : 'Peserta')
  const cols =
    kind === 'siswa'
      ? [
          ['NISN', 16],
          ['NAMA', 36],
          ['KELAS', 10]
        ]
      : [
          ['NISN', 16],
          ['NAMA', 36],
          ['KELAS', 10],
          ['NO URUT', 10],
          ['NOMOR PESERTA', 18],
          ['RUANG', 10],
          ['SESI', 8],
          ['USERNAME', 16],
          ['PASSWORD', 14]
        ]
  ws.columns = cols.map(([header, width]) => ({ header, width, style: { numFmt: '@' } }))
  ws.addRow(
    kind === 'siswa'
      ? ['0101234567', 'AGENG FEBRIAN', 'IX.1']
      : ['0101234567', 'AGENG FEBRIAN', 'IX.1', '2', '10801923', '1', '1', 'smp2-10801923', 'ab12cd']
  )
  ws.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1554B3' } }
  ws.views = [{ state: 'frozen', ySplit: 1 }]
  // Semua sel bertipe teks agar NISN tidak kehilangan angka 0 di depan
  for (let r = 2; r <= 1000; r++) for (let c = 1; c <= cols.length; c++) ws.getCell(r, c).numFmt = '@'
  await wb.xlsx.writeFile(file)
}
