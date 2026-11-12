import QRCode from 'qrcode'

const cache = new Map()

/** Returns { size, path } for an SVG QR code (one path, crisp when printed). */
export function qrPath(text) {
  if (cache.has(text)) return cache.get(text)
  const qr = QRCode.create(text, { errorCorrectionLevel: 'M' })
  const n = qr.modules.size
  const data = qr.modules.data
  let d = ''
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      if (data[y * n + x]) {
        // gabungkan modul gelap yang berurutan dalam satu baris
        let w = 1
        while (x + w < n && data[y * n + x + w]) w++
        d += `M${x} ${y}h${w}v1h-${w}z`
        x += w - 1
      }
    }
  }
  const r = { size: n, path: d }
  if (cache.size > 2000) cache.clear()
  cache.set(text, r)
  return r
}
