// Screenshot halaman utama aplikasi (pengembangan).
const fs = require('node:fs')
const path = require('node:path')
const { BrowserWindow } = require('electron')
const wait = (ms) => new Promise((r) => setTimeout(r, ms))

module.exports = async () => {
  const out = process.env.KARTU_SMOKE_OUT
  await wait(2500)
  const win = BrowserWindow.getAllWindows()[0]
  win.setSize(1400, 900)
  const pages = [['Ujian & Cetak', 'ui-exams'], ['Data Siswa', 'ui-students'], ['Pengaturan Sekolah', 'ui-settings']]
  for (const [label, name] of pages) {
    await win.webContents.executeJavaScript(
      `[...document.querySelectorAll('.nav')].find(b => b.textContent.includes(${JSON.stringify(label)})).click()`
    )
    await wait(1500)
    fs.writeFileSync(path.join(out, name + '.png'), (await win.webContents.capturePage()).toPNG())
  }
  console.log('SHOT OK')
}
