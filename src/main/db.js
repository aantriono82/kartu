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

export async function openDb() {
  if (!SQL) {
    const wasmBinary = fs.readFileSync(require.resolve('sql.js/dist/sql-wasm.wasm'))
    SQL = await initSqlJs({ wasmBinary })
  }
  if (db) db.close()
  db = fs.existsSync(paths.db) ? new SQL.Database(fs.readFileSync(paths.db)) : new SQL.Database()
  db.exec('PRAGMA foreign_keys = ON;')
  db.exec(SCHEMA)
  save()
}

export function closeDb() {
  if (db) db.close()
  db = null
}

export function save() {
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
