import fs from 'node:fs'
import path from 'node:path'
import initSqlJs from 'sql.js'
import { paths } from './paths'

let SQL = null
let db = null

const SCHEMA = `
CREATE TABLE IF NOT EXISTS settings (key TEXT PRIMARY KEY, value TEXT);
CREATE TABLE IF NOT EXISTS students (
  nisn TEXT PRIMARY KEY,
  nama TEXT NOT NULL,
  kelas TEXT NOT NULL DEFAULT '',
  has_photo INTEGER NOT NULL DEFAULT 0,
  photo_ver INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS exams (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  nama TEXT NOT NULL,
  tahun TEXT NOT NULL DEFAULT '',
  template TEXT NOT NULL DEFAULT 'terang',
  created_at TEXT NOT NULL DEFAULT (datetime('now','localtime'))
);
CREATE TABLE IF NOT EXISTS participants (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  exam_id INTEGER NOT NULL REFERENCES exams(id) ON DELETE CASCADE,
  nisn TEXT NOT NULL REFERENCES students(nisn) ON DELETE CASCADE,
  no_urut TEXT NOT NULL DEFAULT '',
  nomor_peserta TEXT NOT NULL DEFAULT '',
  ruang TEXT NOT NULL DEFAULT '',
  sesi TEXT NOT NULL DEFAULT '',
  username TEXT NOT NULL DEFAULT '',
  password TEXT NOT NULL DEFAULT '',
  UNIQUE(exam_id, nisn)
);
`

// Migrasi skema berurutan. JANGAN ubah/hapus migrasi lama — tambahkan di akhir.
// PRAGMA user_version = jumlah migrasi yang sudah dijalankan.
const MIGRATIONS = [
  // v1: skema awal (database lama ber-user_version 0 sudah punya tabel ini → aman karena IF NOT EXISTS)
  (d) => d.exec(SCHEMA)
]
export const DB_VERSION = MIGRATIONS.length
const REQUIRED_TABLES = ['settings', 'students', 'exams', 'participants']

async function loadSql() {
  if (!SQL) {
    const wasmBinary = fs.readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'))
    SQL = await initSqlJs({ wasmBinary })
  }
  return SQL
}

const userVersion = (d) => d.exec('PRAGMA user_version')[0].values[0][0]

function migrate(d) {
  const v = userVersion(d)
  if (v > DB_VERSION) {
    throw new Error('Data ini dibuat oleh versi aplikasi yang lebih baru. Perbarui aplikasi Kartu Ujian terlebih dahulu.')
  }
  for (let i = v; i < DB_VERSION; i++) {
    d.exec('BEGIN')
    try {
      MIGRATIONS[i](d)
      d.exec(`PRAGMA user_version = ${i + 1}`)
      d.exec('COMMIT')
    } catch (e) {
      d.exec('ROLLBACK')
      throw new Error(`Migrasi database ke versi ${i + 1} gagal: ${e.message}`)
    }
  }
}

/**
 * Pastikan isi file adalah database Kartu yang bisa dipakai (untuk restore).
 * Melempar error yang ramah pengguna jika tidak valid.
 */
export async function checkDatabase(buffer) {
  const S = await loadSql()
  let d
  try {
    d = new S.Database(buffer)
    const v = userVersion(d) // gagal di sini jika bukan file SQLite
    if (v > DB_VERSION) throw new Error('Backup ini dibuat oleh versi aplikasi yang lebih baru. Perbarui aplikasi terlebih dahulu.')
    const tables = d.exec("SELECT name FROM sqlite_master WHERE type = 'table'")[0]?.values.flat() ?? []
    const missing = REQUIRED_TABLES.filter((t) => !tables.includes(t))
    if (missing.length) throw new Error('Database di backup tidak lengkap (tabel ' + missing.join(', ') + ' tidak ada)')
    const ok = d.exec('PRAGMA quick_check')[0]?.values[0][0]
    if (ok !== 'ok') throw new Error('Database di backup rusak')
  } catch (e) {
    if (/file is not a database|malformed/i.test(e.message)) throw new Error('File database di backup rusak atau bukan database Kartu')
    throw e
  } finally {
    d?.close()
  }
}

export async function openDb() {
  await loadSql()
  if (db) db.close()
  db = null
  const d = fs.existsSync(paths.db) ? new SQL.Database(fs.readFileSync(paths.db)) : new SQL.Database()
  try {
    d.exec('PRAGMA foreign_keys = ON;')
    migrate(d)
  } catch (e) {
    d.close()
    throw e
  }
  db = d
  save()
}

export const isOpen = () => db !== null

export function closeDb() {
  if (db) db.close()
  db = null
}

export function save() {
  if (!db) return
  const data = db.export()
  // export() resets pragmas on some sql.js versions
  db.exec('PRAGMA foreign_keys = ON;')
  const tmp = paths.db + '.tmp'
  fs.mkdirSync(path.dirname(paths.db), { recursive: true })
  fs.writeFileSync(tmp, Buffer.from(data))
  fs.renameSync(tmp, paths.db)
}

export function all(sql, params = []) {
  const stmt = db.prepare(sql)
  try {
    stmt.bind(params)
    const rows = []
    while (stmt.step()) rows.push(stmt.getAsObject())
    return rows
  } finally {
    stmt.free()
  }
}

export function get(sql, params = []) {
  return all(sql, params)[0] ?? null
}

export function run(sql, params = []) {
  db.run(sql, params)
  const changes = db.getRowsModified()
  return { lastId: get('SELECT last_insert_rowid() AS id').id, changes }
}

/** Run fn inside a transaction and persist once at the end. */
export function tx(fn) {
  db.exec('BEGIN')
  try {
    const result = fn()
    db.exec('COMMIT')
    save()
    return result
  } catch (e) {
    db.exec('ROLLBACK')
    throw e
  }
}
