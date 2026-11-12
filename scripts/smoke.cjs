// Uji otomatis: isi data contoh lalu render PDF & PNG.
// Jalankan: KARTU_SMOKE=$PWD/scripts/smoke.cjs KARTU_SMOKE_OUT=/tmp/kartu-out KARTU_SMOKE_IMG=contoh.png npx electron-vite preview -- --user-data-dir=/tmp/kartu-data
const fs = require('node:fs')
const path = require('node:path')
const ExcelJS = require('exceljs')

module.exports = async ({ nativeImage, store, excel, exporter, removeWhiteBackground }) => {
  const out = process.env.KARTU_SMOKE_OUT
  fs.mkdirSync(out, { recursive: true })
  const src = nativeImage.createFromPath(process.env.KARTU_SMOKE_IMG)
  const crop = (x, y, width, height) => src.crop({ x, y, width, height })
  store.setAsset('logoKab', crop(125, 117, 140, 165).toPNG())
  store.setAsset('logoSekolah', crop(1018, 100, 172, 186).toPNG())
  store.setAsset('ttd', removeWhiteBackground(crop(895, 525, 215, 125)).toPNG())
  store.saveSettings({ nip: '197107202019970 2 002'.replace(/\s/g, '').slice(0, 18) })

  const photo = crop(566, 438, 244, 312)
  const names = [
    'AGENG FEBRIAN',
    'MUHAMMAD RIZKY ADITYA PRATAMA SAPUTRA WIJAYA',
    'SITI NURHALIZA',
    'DIMAS ANGGARA',
    'PUTRI AYU LESTARI',
    'RAHMAT HIDAYATULLAH',
    'NABILA AZZAHRA',
    'FAJAR NUGROHO',
    'ANISA RAHMAWATI'
  ]
  const wb = new ExcelJS.Workbook()
  const ws = wb.addWorksheet('P')
  ws.addRow(['NISN', 'NAMA', 'KELAS', 'NO URUT', 'NOMOR PESERTA', 'RUANG', 'SESI', 'USERNAME', 'PASSWORD'])
  names.forEach((n, i) =>
    ws.addRow([101234560 + i, n, i < 5 ? 'IX.1' : 'IX.2', i + 1, String(10801922 + i), i < 4 ? '1' : '2', '1', `smp1-${10801922 + i}`, 'pw' + (1000 + i)])
  )
  ws.addRow(['', 'TANPA NISN', 'IX.1'])
  const xlsx = path.join(out, 'peserta.xlsx')
  await wb.xlsx.writeFile(xlsx)

  for (const template of ['terang', 'gelap']) {
    const examId = store.saveExam({ nama: 'UJIAN SEKOLAH', tahun: '2025/2026', template })
    const r = await excel.importParticipants(examId, xlsx)
    console.log('import', template, JSON.stringify(r))
    if (template === 'terang') {
      for (const s of store.listStudents().slice(0, 8)) {
        const jpg = photo.resize({ width: 450, height: 600 }).toJPEG(88)
        store.savePhoto(s.nisn, jpg, jpg)
      }
    }
    for (const side of ['front', 'back']) {
      const t = Date.now()
      const res = await exporter.renderPdf({ examId, side, filter: {} }, path.join(out, `${template}-${side}.pdf`))
      console.log('pdf', template, side, res, Date.now() - t, 'ms')
    }
    const ids = store.listParticipants(examId).slice(0, 2).map((p) => p.id)
    const res = await exporter.renderPngZip({ examId, side: 'front', filter: { ids }, includeBack: true }, path.join(out, `${template}-png.zip`))
    console.log('png', template, res)
  }
  await exporter.renderPdf({ side: 'calib' }, path.join(out, 'kalibrasi.pdf'))
  console.log('SMOKE OK')
}
