// Render build/icon.svg → build/icon.png (1024×1024, transparan) untuk electron-builder.
// Jalankan: npx electron scripts/make-icon.cjs
const fs = require('node:fs')
const path = require('node:path')
const { app, BrowserWindow } = require('electron')

const SIZE = 1024
const dir = path.join(__dirname, '..', 'build')

app.whenReady().then(async () => {
  const svg = fs.readFileSync(path.join(dir, 'icon.svg'), 'utf8')
  const win = new BrowserWindow({
    show: false,
    width: SIZE,
    height: SIZE,
    useContentSize: true,
    transparent: true,
    frame: false,
    webPreferences: { offscreen: true }
  })
  win.webContents.setFrameRate(1)
  const html = `<html><body style="margin:0;background:transparent;overflow:hidden">${svg}</body></html>`
  await win.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html))
  await new Promise((r) => setTimeout(r, 500))
  let img = await win.webContents.capturePage({ x: 0, y: 0, width: SIZE, height: SIZE })
  if (img.getSize().width !== SIZE) img = img.resize({ width: SIZE, height: SIZE, quality: 'best' })
  fs.writeFileSync(path.join(dir, 'icon.png'), img.toPNG())
  console.log('build/icon.png', img.getSize())
  app.quit()
})
