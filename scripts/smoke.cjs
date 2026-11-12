// Uji otomatis: isi data contoh lalu render PDF & PNG.
// Jalankan lewat `npm test` (atau manual: KARTU_SMOKE=$PWD/scripts/smoke.cjs KARTU_SMOKE_OUT=/tmp/kartu-out KARTU_SMOKE_IMG=contoh.png npx electron-vite preview -- --user-data-dir=/tmp/kartu-data)
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const ExcelJS = require('exceljs')

module.exports = async ({ nativeImage, store, excel, exporter, removeWhiteBackground, trimImage }) => {
  const out = process.env.KARTU_SMOKE_OUT
  fs.mkdirSync(out, { recursive: true })
  const src = nativeImage.createFromPath(process.env.KARTU_SMOKE_IMG)
  const crop = (x, y, width, height) => src.crop({ x, y, width, height })
  // KARTU_SMOKE_FROM=<userData aplikasi>: pakai pengaturan & logo/TTD/stempel asli sekolah.
  const from = process.env.KARTU_SMOKE_FROM
  if (from) {
    for (const key of ['logoKab', 'logoSekolah', 'ttd', 'stempel']) {
      const f = path.join(from, 'assets', key + '.png')
      if (fs.existsSync(f)) store.setAsset(key, fs.readFileSync(f))
    }
    const initSqlJs = require('sql.js')
    const SQL = await initSqlJs()
    const db = new SQL.Database(fs.readFileSync(path.join(from, 'kartu.db')))
    const res = db.exec("SELECT value FROM settings WHERE key = 'school'")
    if (res.length) {
      const { assets, ...saved } = JSON.parse(res[0].values[0][0])
      store.saveSettings(saved)
    }
    db.close()
  } else {
    store.setAsset('logoKab', crop(125, 117, 140, 165).toPNG())
    store.setAsset('logoSekolah', crop(1018, 100, 172, 186).toPNG())
    store.setAsset('ttd', removeWhiteBackground(crop(895, 525, 215, 125)).toPNG())
    if (process.env.KARTU_SMOKE_STAMP) {
      store.setAsset('stempel', trimImage(removeWhiteBackground(nativeImage.createFromPath(process.env.KARTU_SMOKE_STAMP).resize({ width: 1000 }))).toPNG())
    }
    // data contoh (bukan data sekolah sungguhan)
    store.saveSettings({
      pemerintah: 'PEMERINTAH KABUPATEN CONTOH',
      dinas: 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
      uptd: 'UPTD SATUAN PENDIDIKAN',
      namaSekolah: 'SMP NEGERI 1 CONTOH',
      wilayah: 'KABUPATEN CONTOH',
      alamat: 'Jl. Pendidikan No. 1, Kec. Contoh, Kab. Contoh',
      kepalaSekolah: 'NAMA KEPALA SEKOLAH, S.Pd., M.Pd.',
      nip: '198001012005011001'
    })
  }
  store.saveSettings({ tempatTanggal: store.getSettings().tempatTanggal || 'Kota Contoh, Mei 2026' })

  const photo = crop(566, 438, 244, 312)
  const names = [
    'NARUTI UZUKIMI',
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
    ws.addRow([101234560 + i, n, i < 5 ? 'IX.1' : 'IX.2', i + 1, String(10801922 + i), i < 4 ? '1' : '2', '1', `peserta-${10801922 + i}`, 'pw' + (1000 + i)])
  )
  ws.addRow(['', 'TANPA NISN', 'IX.1'])
  const xlsx = path.join(out, 'peserta.xlsx')
  await wb.xlsx.writeFile(xlsx)

  for (const template of ['terang', 'gelap', 'hijau', 'indigo', 'bank', 'bank_atm']) {
    const examId = store.saveExam({ nama: 'UJIAN SEKOLAH', tahun: '2025/2026', template })
    const r = await excel.importParticipants(examId, xlsx)
    console.log('import', template, JSON.stringify(r))
    assert.equal(r.added, names.length, 'semua peserta ber-NISN masuk')
    assert.deepEqual(r.errors.map((e) => e.message), ['NISN kosong'], 'baris tanpa NISN ditolak')
    if (template === 'terang') {
      for (const s of store.listStudents().slice(0, 8)) {
        const jpg = photo.resize({ width: 450, height: 600 }).toJPEG(88)
        store.savePhoto(s.nisn, jpg, jpg)
      }
    }
    for (const side of ['front', 'back']) {
      const t = Date.now()
      const file = path.join(out, `${template}-${side}.pdf`)
      const res = await exporter.renderPdf({ examId, side, filter: {} }, file)
      console.log('pdf', template, side, res, Date.now() - t, 'ms')
      assert.equal(res.pages, Math.ceil(names.length / (template === 'bank_atm' ? 10 : 8)), `${template} ${side}: jumlah halaman`)
      assert.equal(fs.readFileSync(file).subarray(0, 5).toString(), '%PDF-')
    }
    const ids = store.listParticipants(examId).slice(0, 2).map((p) => p.id)
    const res = await exporter.renderPngZip({ examId, side: 'front', filter: { ids }, includeBack: true }, path.join(out, `${template}-png.zip`))
    console.log('png', template, res)
    assert.equal(res.count, 2)
    const zip = await require('jszip').loadAsync(fs.readFileSync(path.join(out, `${template}-png.zip`)))
    const pngs = Object.keys(zip.files)
    assert.equal(pngs.length, 4, 'depan + belakang untuk 2 siswa')
    const img = nativeImage.createFromBuffer(await zip.file(pngs[0]).async('nodebuffer'))
    assert.deepEqual(img.getSize(), template === 'bank_atm' ? { width: 1712, height: 1080 } : { width: 1900, height: 1360 })
  }
  await exporter.renderPdf({ side: 'calib' }, path.join(out, 'kalibrasi.pdf'))
  console.log('SMOKE OK')
}
