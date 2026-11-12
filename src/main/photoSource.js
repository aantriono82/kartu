import fs from 'node:fs'
import path from 'node:path'
import JSZip from 'jszip'

const IMAGE_EXT = /\.(jpe?g|png|webp|bmp|gif)$/i
let session = null // { id, read(key) }

function keyFromName(name) {
  return path.basename(name).replace(IMAGE_EXT, '').trim().replace(/\s+/g, '')
}

function walk(dir, out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name)
    if (e.isDirectory()) walk(p, out)
    else if (IMAGE_EXT.test(e.name)) out.push(p)
  }
  return out
}

/** Opens a folder or ZIP and lists image entries keyed by file name (expected = NISN). */
export async function openSource(kind, target) {
  const id = Date.now()
  let entries
  if (kind === 'zip') {
    const zip = await JSZip.loadAsync(fs.readFileSync(target))
    const files = Object.values(zip.files).filter((f) => !f.dir && IMAGE_EXT.test(f.name) && !f.name.startsWith('__MACOSX'))
    entries = files.map((f) => ({ key: f.name, name: path.basename(f.name), nisn: keyFromName(f.name) }))
    session = { id, read: (key) => zip.file(key).async('uint8array') }
  } else {
    const files = walk(target)
    entries = files.map((f) => ({ key: f, name: path.basename(f), nisn: keyFromName(f) }))
    const allowed = new Set(files)
    session = {
      id,
      read: async (key) => {
        if (!allowed.has(key)) throw new Error('File tidak ada di folder yang dipilih')
        return new Uint8Array(fs.readFileSync(key))
      }
    }
  }
  return { sessionId: id, entries }
}

export async function readEntry(sessionId, key) {
  if (!session || session.id !== sessionId) throw new Error('Sesi import foto sudah berakhir')
  return session.read(key)
}

export function closeSource() {
  session = null
}
