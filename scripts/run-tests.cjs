// Jalankan semua uji otomatis di dalam Electron: `npm test`.
// Di Linux tanpa layar (CI): `xvfb-run -a npm test`.
const { spawnSync } = require('node:child_process')
const fs = require('node:fs')
const os = require('node:os')
const path = require('node:path')
const zlib = require('node:zlib')

const root = path.join(__dirname, '..')
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'kartu-tests-'))

// Gambar contoh (PNG gradasi 1300×900) untuk logo/foto/TTD di smoke test
function writeTestImage(file, w = 1300, h = 900) {
  const crcTable = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (buf) => {
    let c = 0xffffffff
    for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type, data) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const td = Buffer.concat([Buffer.from(type), data])
    const c = Buffer.alloc(4)
    c.writeUInt32BE(crc(td))
    return Buffer.concat([len, td, c])
  }
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) {
    const o = y * (w * 3 + 1)
    for (let x = 0; x < w; x++) raw.set([(x * 7) % 256, (y * 3) % 256, 160], o + 1 + x * 3)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr.set([8, 2, 0, 0, 0], 8)
  fs.writeFileSync(
    file,
    Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
  )
}

const TESTS = [
  ['smoke.cjs', 'SMOKE OK'],
  ['backup-test.cjs', 'BACKUP TEST OK']
]

function sh(cmd, args, env = {}) {
  const r = spawnSync(cmd, args, { cwd: root, env: { ...process.env, ...env }, encoding: 'utf8', shell: process.platform === 'win32', timeout: 10 * 60 * 1000 })
  const out = (r.stdout || '') + (r.stderr || '')
  return { status: r.status, out }
}

// Electron ≥ 45 tidak mengunduh binari saat `npm ci`; electron-vite butuh binari yang sudah ada.
const electronDir = path.dirname(require.resolve('electron/package.json', { paths: [root] }))
if (!fs.existsSync(path.join(electronDir, 'path.txt'))) {
  console.log('Mengunduh binari Electron...')
  const r = spawnSync(process.execPath, [path.join(electronDir, 'install.js')], { cwd: root, stdio: 'inherit' })
  if (r.status !== 0) process.exit(1)
}

const build = sh('npx', ['electron-vite', 'build'])
if (build.status !== 0) {
  console.log(build.out)
  console.error('✗ build gagal')
  process.exit(1)
}

const img = path.join(tmp, 'contoh.png')
writeTestImage(img)
let failed = 0
for (const [script, marker] of TESTS) {
  const userData = path.join(tmp, 'data-' + script)
  const t = Date.now()
  const r = sh('npx', ['electron-vite', 'preview', '--skipBuild', '--', '--no-sandbox', '--user-data-dir=' + userData], {
    KARTU_SMOKE: path.join(__dirname, script),
    KARTU_SMOKE_OUT: path.join(tmp, 'out-' + script),
    KARTU_SMOKE_IMG: img
  })
  const ok = r.status === 0 && r.out.includes(marker) && !r.out.includes('SMOKE FAIL')
  console.log(r.out.trim().split('\n').filter((l) => !/^\s*$/.test(l)).map((l) => '  ' + l).join('\n'))
  console.log(`${ok ? '✓' : '✗'} ${script} (${((Date.now() - t) / 1000).toFixed(1)} dtk)\n`)
  if (!ok) failed++
}
fs.rmSync(tmp, { recursive: true, force: true })
if (failed) {
  console.error(`${failed} uji gagal`)
  process.exit(1)
}
console.log('Semua uji lulus')
