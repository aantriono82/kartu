// Uji backup / restore / migrasi / backup otomatis / pengaturan rusak.
// Jalankan lewat `npm test`.
const fs = require('node:fs')
const path = require('node:path')
const assert = require('node:assert/strict')
const JSZip = require('jszip')

module.exports = async ({ app, db, store, exporter, paths }) => {
  const tmp = fs.mkdtempSync(path.join(app.getPath('temp'), 'kartu-test-'))
  const count = () => store.listStudents().length
  const expectFail = async (file, re) => {
    const before = count()
    await assert.rejects(() => exporter.restore(file), re)
    assert.equal(count(), before, 'data lama harus tetap utuh')
  }
  const zipWith = async (name, dbBuf, extra = {}) => {
    const z = new JSZip()
    if (dbBuf) z.file('kartu.db', dbBuf)
    for (const [k, v] of Object.entries(extra)) z.file(k, v)
    const f = path.join(tmp, name)
    fs.writeFileSync(f, await z.generateAsync({ type: 'nodebuffer' }))
    return f
  }

  // migrasi: user_version = versi terbaru
  const initSqlJs = require('sql.js')
  const SQL = await initSqlJs()
  const ver = (buf) => new SQL.Database(buf).exec('PRAGMA user_version')[0].values[0][0]
  assert.equal(ver(fs.readFileSync(paths.db)), db.DB_VERSION)
  console.log('ok migrasi: user_version =', db.DB_VERSION)

  // backup → ubah → restore
  store.upsertStudent({ nisn: '0000000001', nama: 'SATU', kelas: 'IX.1' })
  store.upsertStudent({ nisn: '0000000002', nama: 'DUA', kelas: 'IX.1' })
  fs.writeFileSync(path.join(paths.photos, '0000000001.jpg'), 'foto')
  const good = path.join(tmp, 'good.zip')
  await exporter.backup(good)
  store.upsertStudent({ nisn: '0000000003', nama: 'TIGA', kelas: 'IX.2' })
  fs.rmSync(path.join(paths.photos, '0000000001.jpg'))
  assert.equal(count(), 3)
  await exporter.restore(good)
  assert.equal(count(), 2)
  assert.ok(fs.existsSync(path.join(paths.photos, '0000000001.jpg')), 'foto ikut dikembalikan')
  assert.ok(fs.existsSync(path.join(paths.root, exporter.SAFETY_BACKUP)))
  store.upsertStudent({ nisn: '0000000004', nama: 'EMPAT', kelas: 'IX.2' }) // db tetap bisa ditulis
  assert.equal(count(), 3)
  console.log('ok backup/restore')

  // file rusak → ditolak, data lama utuh
  const notZip = path.join(tmp, 'bukan.zip')
  fs.writeFileSync(notZip, 'bukan zip')
  await expectFail(notZip, /bukan ZIP/)
  await expectFail(await zipWith('nodb.zip', null, { 'photos/a.jpg': 'x' }), /kartu.db tidak ditemukan/)
  await expectFail(await zipWith('garbage.zip', Buffer.from('ini bukan database sqlite sama sekali'.repeat(50))), /rusak|bukan database/)
  const empty = new SQL.Database()
  await expectFail(await zipWith('empty.zip', Buffer.from(empty.export())), /tidak lengkap/)
  const newer = new SQL.Database(fs.readFileSync(paths.db))
  newer.exec(`PRAGMA user_version = ${db.DB_VERSION + 1}`)
  await expectFail(await zipWith('newer.zip', Buffer.from(newer.export())), /lebih baru/)
  await expectFail(await zipWith('evil.zip', fs.readFileSync(paths.db), { 'photos/../../x.jpg': 'x' }), /tidak valid/)
  console.log('ok restore file rusak ditolak')

  // database lama tanpa user_version (versi aplikasi ≤ 1.0.3) tetap bisa direstore & dimigrasi
  const legacy = new SQL.Database(fs.readFileSync(paths.db))
  legacy.exec('PRAGMA user_version = 0')
  await exporter.restore(await zipWith('legacy.zip', Buffer.from(legacy.export())))
  assert.equal(ver(fs.readFileSync(paths.db)), db.DB_VERSION)
  assert.equal(count(), 3)
  console.log('ok restore backup lama (user_version 0)')

  // backup otomatis: satu per hari, simpan 7 terakhir
  const dir = exporter.autoBackupDir()
  fs.mkdirSync(dir, { recursive: true })
  for (let d = 1; d <= 9; d++) fs.writeFileSync(path.join(dir, `otomatis-2020-01-0${d}.zip`), 'lama')
  fs.writeFileSync(path.join(dir, 'catatan-pengguna.txt'), 'jangan dihapus')
  const f = await exporter.autoBackup()
  assert.equal(path.basename(f), `otomatis-${exporter.localDate()}.zip`)
  const mtime = fs.statSync(f).mtimeMs
  await exporter.autoBackup() // hari yang sama → tidak dibuat ulang
  assert.equal(fs.statSync(f).mtimeMs, mtime)
  const left = fs.readdirSync(dir).filter((x) => x.startsWith('otomatis-')).sort()
  assert.equal(left.length, exporter.AUTO_BACKUP_KEEP)
  assert.equal(left.at(-1), path.basename(f))
  assert.ok(fs.existsSync(path.join(dir, 'catatan-pengguna.txt')))
  await exporter.restore(f) // backup otomatis bisa direstore
  assert.equal(count(), 3)
  console.log('ok backup otomatis')

  // pengaturan rusak → pakai bawaan, aset yang filenya ada tetap tampil
  fs.writeFileSync(path.join(paths.assets, 'logoSekolah.png'), 'png')
  for (const bad of ['{rusak', '[]', 'null']) {
    db.run("INSERT INTO settings(key, value) VALUES('school', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [bad])
    const s = store.getSettings()
    assert.equal(s.namaSekolah, store.DEFAULT_SETTINGS.namaSekolah)
    assert.equal(s.assets.logoSekolah, 1)
    assert.equal(s.assets.ttd, 0)
  }
  store.saveSettings({ namaSekolah: { x: 1 }, tataTertib: null, nip: 197610, offsetX: 'abc' }) // tipe salah
  const t = store.getSettings()
  assert.equal(t.namaSekolah, store.DEFAULT_SETTINGS.namaSekolah)
  assert.equal(t.tataTertib, store.DEFAULT_SETTINGS.tataTertib)
  assert.equal(t.nip, '197610')
  assert.equal(t.offsetX, 0)
  store.saveSettings({ nip: '1' }) // bisa disimpan lagi
  assert.equal(store.getSettings().nip, '1')
  console.log('ok pengaturan rusak')

  fs.rmSync(tmp, { recursive: true, force: true })
  console.log('BACKUP TEST OK')
}
