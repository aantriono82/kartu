import path from 'node:path'
import fs from 'node:fs'
import { app } from 'electron'

const root = () => app.getPath('userData')

export const paths = {
  get root() { return root() },
  get db() { return path.join(root(), 'kartu.db') },
  get photos() { return path.join(root(), 'photos') },
  get originals() { return path.join(root(), 'photos-orig') },
  get assets() { return path.join(root(), 'assets') }
}

export function ensureDirs() {
  for (const d of [paths.photos, paths.originals, paths.assets]) fs.mkdirSync(d, { recursive: true })
}

/** Only allow simple identifiers in file names (prevents path traversal). */
export function safeName(s) {
  const v = String(s ?? '').trim()
  if (!/^[A-Za-z0-9_.-]+$/.test(v) || v.includes('..')) throw new Error('Nama file tidak valid: ' + v)
  return v
}
