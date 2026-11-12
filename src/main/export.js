import fs from 'node:fs'
import path from 'node:path'
import { BrowserWindow, ipcMain } from 'electron'
import JSZip from 'jszip'
import { getSettings, getExam, listParticipants } from './store'
import { paths } from './paths'
import { closeDb, openDb } from './db'

let loadRenderer = null // (win, hash) => Promise
export function setRendererLoader(fn) {
  loadRenderer = fn
}

/** Data for print/PNG windows. filter: { kelas?, ruang?, ids? } */
export function getPrintData({ examId, filter = {} }) {
  const exam = examId ? getExam(examId) : null
  let participants = examId ? listParticipants(examId) : []
  if (filter.kelas) participants = participants.filter((p) => p.kelas === filter.kelas)
  if (filter.ruang) participants = participants.filter((p) => p.ruang === filter.ruang)
  if (filter.ids?.length) {
    const set = new Set(filter.ids)
    participants = participants.filter((p) => set.has(p.id))
  }
  return { settings: getSettings(), exam, participants }
}

function waitFor(channel, win, timeoutMs) {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      ipcMain.removeListener(channel, handler)
      reject(new Error('Waktu render habis'))
    }, timeoutMs)
    function handler(event, payload) {
      if (event.sender !== win.webContents) return
      clearTimeout(timer)
      ipcMain.removeListener(channel, handler)
      if (payload?.error) reject(new Error(payload.error))
      else resolve(payload)
    }
    ipcMain.on(channel, handler)
  })
}

/** job: { examId, filter, side: 'front'|'back'|'calib' } */
export async function renderPdf(job, outFile) {
  const win = new BrowserWindow({ show: false, width: 800, height: 1100, webPreferences: rendererPrefs() })
  try {
    const ready = waitFor('print:ready', win, 10 * 60 * 1000)
    await loadRenderer(win, 'print?job=' + encodeURIComponent(JSON.stringify(job)))
    const { pages } = await ready
    const pdf = await win.webContents.printToPDF({
      printBackground: true,
      preferCSSPageSize: true,
      pageSize: 'A4',
      margins: { marginType: 'none' }
    })
    fs.writeFileSync(outFile, pdf)
    return { pages }
  } finally {
    win.destroy()
  }
}

/** Renders each card into a PNG and writes a ZIP. */
export async function renderPngZip(job, outFile, onProgress) {
  const SCALE = 2 // 950x680 design px -> 1900x1360 PNG (~500 dpi)
  const width = 950 * SCALE
  const height = 680 * SCALE
  const win = new BrowserWindow({
    show: false,
    width,
    height,
    useContentSize: true,
    webPreferences: { ...rendererPrefs(), offscreen: true }
  })
  try {
    win.setContentSize(width, height)
    const ready = waitFor('png:ready', win, 60 * 1000)
    await loadRenderer(win, 'png?job=' + encodeURIComponent(JSON.stringify({ ...job, scale: SCALE })))
    const { items } = await ready
    const zip = new JSZip()
    const used = new Set()
    for (let i = 0; i < items.length; i++) {
      for (const side of job.includeBack ? ['front', 'back'] : ['front']) {
        const shown = waitFor('png:shown', win, 60 * 1000)
        win.webContents.send('png:show', { index: i, side })
        await shown
        const img = await win.webContents.capturePage({ x: 0, y: 0, width, height })
        let base = fileSafe(`${items[i].nomor_peserta || items[i].nisn}_${items[i].nama}`)
        if (side === 'back') base += '_belakang'
        let name = base + '.png'
        for (let n = 2; used.has(name); n++) name = `${base}_${n}.png`
        used.add(name)
        zip.file(name, img.toPNG())
      }
      onProgress?.(i + 1, items.length)
    }
    fs.writeFileSync(outFile, await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' }))
    return { count: items.length }
  } finally {
    win.destroy()
  }
}

const fileSafe = (s) =>
  String(s)
    .replace(/[\\/:*?"<>|]+/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 120)

let prefsFactory = null
export function setRendererPrefs(fn) {
  prefsFactory = fn
}
const rendererPrefs = () => prefsFactory()

// ---------- backup / restore ----------
function addDir(zip, dir, prefix) {
  if (!fs.existsSync(dir)) return
  for (const f of fs.readdirSync(dir)) {
    const p = path.join(dir, f)
    if (fs.statSync(p).isFile()) zip.file(`${prefix}/${f}`, fs.readFileSync(p))
  }
}

export async function backup(outFile) {
  const zip = new JSZip()
  zip.file('kartu.db', fs.readFileSync(paths.db))
  addDir(zip, paths.photos, 'photos')
  addDir(zip, paths.originals, 'photos-orig')
  addDir(zip, paths.assets, 'assets')
  fs.writeFileSync(outFile, await zip.generateAsync({ type: 'nodebuffer', compression: 'STORE' }))
}

export async function restore(file) {
  const zip = await JSZip.loadAsync(fs.readFileSync(file))
  if (!zip.file('kartu.db')) throw new Error('File ini bukan backup Kartu (kartu.db tidak ditemukan)')
  const dirs = { photos: paths.photos, 'photos-orig': paths.originals, assets: paths.assets }
  // validasi dulu sebelum menghapus data lama
  const entries = Object.values(zip.files).filter((f) => !f.dir && f.name !== 'kartu.db')
  for (const f of entries) {
    const [dir, name, extra] = f.name.split('/')
    if (!dirs[dir] || !name || extra !== undefined || !/^[A-Za-z0-9_.-]+$/.test(name) || name.includes('..')) {
      throw new Error('Isi backup tidak valid: ' + f.name)
    }
  }
  closeDb()
  for (const d of Object.values(dirs)) {
    fs.rmSync(d, { recursive: true, force: true })
    fs.mkdirSync(d, { recursive: true })
  }
  fs.writeFileSync(paths.db, await zip.file('kartu.db').async('nodebuffer'))
  for (const f of entries) {
    const [dir, name] = f.name.split('/')
    fs.writeFileSync(path.join(dirs[dir], name), await f.async('nodebuffer'))
  }
  await openDb()
}
