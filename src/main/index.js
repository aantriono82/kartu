import path from 'node:path'
import fs from 'node:fs'
import { pathToFileURL } from 'node:url'
import { app, BrowserWindow, dialog, ipcMain, nativeImage, net, protocol, shell } from 'electron'
import * as db from './db'
import { openDb, save } from './db'
import { paths, ensureDirs, safeName } from './paths'
import * as store from './store'
import * as excel from './excel'
import * as photoSource from './photoSource'
import * as exporter from './export'
import { removeWhiteBackground, trimImage } from './image'

protocol.registerSchemesAsPrivileged([
  { scheme: 'kartu', privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true } }
])

let mainWindow = null

const rendererPrefs = () => ({
  preload: path.join(__dirname, '../preload/index.js'),
  contextIsolation: true,
  nodeIntegration: false,
  sandbox: true
})

function loadRenderer(win, hash = '') {
  if (process.env.ELECTRON_RENDERER_URL) return win.loadURL(process.env.ELECTRON_RENDERER_URL + '#/' + hash)
  return win.loadFile(path.join(__dirname, '../renderer/index.html'), { hash: '/' + hash })
}

exporter.setRendererLoader(loadRenderer)
exporter.setRendererPrefs(rendererPrefs)

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 1100,
    minHeight: 700,
    title: 'Kartu Peserta Ujian',
    autoHideMenuBar: true,
    webPreferences: rendererPrefs()
  })
  mainWindow.webContents.setWindowOpenHandler(() => ({ action: 'deny' }))
  loadRenderer(mainWindow)
}

// kartu://photo/<nisn>, kartu://asset/<key>
function registerProtocol() {
  protocol.handle('kartu', async (req) => {
    try {
      const url = new URL(req.url)
      const name = safeName(decodeURIComponent(url.pathname.replace(/^\//, '')))
      let file
      if (url.hostname === 'photo') file = path.join(paths.photos, name + '.jpg')
      else if (url.hostname === 'asset') file = store.assetPath(name)
      else return new Response('not found', { status: 404 })
      if (!fs.existsSync(file)) return new Response('not found', { status: 404 })
      return net.fetch(pathToFileURL(file).toString())
    } catch {
      return new Response('bad request', { status: 400 })
    }
  })
}

// ---------- dialogs ----------
const win = (e) => BrowserWindow.fromWebContents(e.sender) || mainWindow
async function pickOpen(e, options) {
  const r = await dialog.showOpenDialog(win(e), options)
  return r.canceled ? null : r.filePaths[0]
}
async function pickSave(e, defaultName, filters) {
  const r = await dialog.showSaveDialog(win(e), {
    defaultPath: path.join(app.getPath('documents'), defaultName),
    filters
  })
  return r.canceled ? null : r.filePath
}
const XLSX = [{ name: 'Excel', extensions: ['xlsx'] }]

function handle(channel, fn) {
  ipcMain.handle(channel, async (e, ...args) => {
    try {
      return { ok: true, data: await fn(e, ...args) }
    } catch (err) {
      console.error(channel, err)
      return { ok: false, error: err.message || String(err) }
    }
  })
}

function registerIpc() {
  // settings
  handle('settings:get', () => store.getSettings())
  handle('settings:save', (e, patch) => store.saveSettings(patch))
  handle('settings:pickAsset', async (e, key) => {
    const file = await pickOpen(e, { filters: [{ name: 'Gambar', extensions: ['png', 'jpg', 'jpeg'] }] })
    if (!file) return null
    let img = nativeImage.createFromPath(file)
    if (img.isEmpty()) throw new Error('Gambar tidak bisa dibaca')
    const { width, height } = img.getSize()
    const max = 1000
    if (Math.max(width, height) > max) {
      img = width >= height ? img.resize({ width: max, quality: 'best' }) : img.resize({ height: max, quality: 'best' })
    }
    if (key === 'ttd' || key === 'stempel') img = removeWhiteBackground(img)
    img = trimImage(img)
    return store.setAsset(key, img.toPNG())
  })
  handle('settings:clearAsset', (e, key) => store.setAsset(key, null))

  // students
  handle('students:list', () => store.listStudents())
  handle('students:save', (e, oldNisn, data) => (oldNisn ? store.updateStudent(oldNisn, data) : store.upsertStudent(data)))
  handle('students:delete', (e, nisns) => store.deleteStudents(nisns))
  handle('students:import', async (e) => {
    const file = await pickOpen(e, { filters: XLSX })
    return file ? excel.importStudents(file) : null
  })
  handle('template:download', async (e, kind) => {
    const file = await pickSave(e, kind === 'siswa' ? 'Template Siswa.xlsx' : 'Template Peserta.xlsx', XLSX)
    if (!file) return null
    await excel.writeTemplate(kind, file)
    shell.showItemInFolder(file)
    return file
  })

  // photos
  handle('photos:openSource', async (e, kind) => {
    const target =
      kind === 'zip'
        ? await pickOpen(e, { filters: [{ name: 'ZIP', extensions: ['zip'] }] })
        : await pickOpen(e, { properties: ['openDirectory'] })
    return target ? photoSource.openSource(kind, target) : null
  })
  handle('photos:readEntry', (e, sessionId, key) => photoSource.readEntry(sessionId, key))
  handle('photos:closeSource', () => photoSource.closeSource())
  handle('photos:pickSingle', async (e) => {
    const file = await pickOpen(e, { filters: [{ name: 'Gambar', extensions: ['jpg', 'jpeg', 'png', 'webp'] }] })
    return file ? new Uint8Array(fs.readFileSync(file)) : null
  })
  handle('photos:save', (e, nisn, orig, crop) => store.savePhoto(nisn, orig, crop))
  handle('photos:delete', (e, nisn) => store.deletePhoto(nisn))
  handle('photos:readOriginal', (e, nisn) => {
    const b = store.readOriginal(nisn)
    return b ? new Uint8Array(b) : null
  })

  // exams
  handle('exams:list', () => store.listExams())
  handle('exams:save', (e, exam) => store.saveExam(exam))
  handle('exams:delete', (e, id) => store.deleteExam(id))
  handle('participants:list', (e, examId) => store.listParticipants(examId))
  handle('participants:save', (e, examId, p) => store.upsertParticipant(examId, p))
  handle('participants:delete', (e, ids) => store.deleteParticipants(ids))
  handle('participants:clear', (e, examId) => store.clearParticipants(examId))
  handle('participants:import', async (e, examId) => {
    const file = await pickOpen(e, { filters: XLSX })
    return file ? excel.importParticipants(examId, file) : null
  })

  // print / export
  handle('print:data', (e, job) => exporter.getPrintData(job))
  handle('export:pdf', async (e, job, defaultName) => {
    const file = await pickSave(e, defaultName, [{ name: 'PDF', extensions: ['pdf'] }])
    if (!file) return null
    const r = await exporter.renderPdf(job, file)
    shell.showItemInFolder(file)
    return { file, ...r }
  })
  handle('export:png', async (e, job, defaultName) => {
    const file = await pickSave(e, defaultName, [{ name: 'ZIP', extensions: ['zip'] }])
    if (!file) return null
    const r = await exporter.renderPngZip(job, file, (done, total) => e.sender.send('export:progress', { done, total }))
    shell.showItemInFolder(file)
    return { file, ...r }
  })

  // backup
  handle('backup:create', async (e) => {
    const stamp = exporter.localDate()
    const file = await pickSave(e, `Backup Kartu ${stamp}.zip`, [{ name: 'ZIP', extensions: ['zip'] }])
    if (!file) return null
    await exporter.backup(file)
    shell.showItemInFolder(file)
    return file
  })
  handle('backup:restore', async (e) => {
    const file = await pickOpen(e, { filters: [{ name: 'ZIP', extensions: ['zip'] }] })
    if (!file) return null
    // restore() menyimpan data saat ini ke sebelum-restore.zip & mengembalikannya jika gagal
    await exporter.restore(file)
    return file
  })
  handle('app:dataDir', () => paths.root)
  handle('app:openDataDir', () => shell.openPath(paths.root))
  handle('app:openAutoBackupDir', () => {
    fs.mkdirSync(exporter.autoBackupDir(), { recursive: true })
    return shell.openPath(exporter.autoBackupDir())
  })
}

function focusMainWindow() {
  if (!mainWindow || mainWindow.isDestroyed()) return
  if (mainWindow.isMinimized()) mainWindow.restore()
  mainWindow.show()
  mainWindow.focus()
}

async function startup() {
  ensureDirs()
  try {
    await openDb()
  } catch (e) {
    console.error('openDb', e)
    dialog.showErrorBox(
      'Kartu Ujian — data tidak bisa dibuka',
      `${e.message}\n\nFolder data: ${paths.root}\nBackup otomatis ada di subfolder "backup-otomatis".`
    )
    app.quit()
    return
  }
  registerProtocol()
  registerIpc()
  createWindow()
  // Hook pengujian otomatis (hanya saat pengembangan): KARTU_SMOKE=/path/script.cjs
  if (process.env.KARTU_SMOKE && !app.isPackaged) {
    require(process.env.KARTU_SMOKE)({ app, nativeImage, db, store, excel, exporter, paths, removeWhiteBackground, trimImage })
      .catch((e) => console.error('SMOKE FAIL', e))
      .finally(() => app.quit())
    return
  }
  // Backup harian otomatis, setelah jendela tampil agar tidak memperlambat pembukaan
  setTimeout(() => exporter.autoBackup().catch((e) => console.error('autoBackup', e)), 3000)
}

// Hanya satu jendela aplikasi: dua proses yang menulis kartu.db yang sama akan saling menimpa data.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', focusMainWindow)
  app.whenReady().then(startup)
  app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
}

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('before-quit', () => {
  try {
    save()
  } catch (e) {
    console.error('save on quit', e)
  }
})
