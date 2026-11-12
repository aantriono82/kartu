import { nativeImage } from 'electron'

/**
 * Scan tanda tangan/stempel biasanya JPG berlatar putih. Jadikan piksel putih transparan
 * (bertahap, agar tepi tinta tetap halus). Gambar yang sudah transparan dibiarkan.
 */
export function removeWhiteBackground(img) {
  const { width, height } = img.getSize()
  const px = Buffer.from(img.toBitmap()) // BGRA/RGBA, alpha di byte ke-4
  for (let i = 3; i < px.length; i += 4) if (px[i] < 250) return img
  const HI = 235 // >= ini: transparan penuh
  const LO = 170 // <= ini: tinta penuh
  for (let i = 0; i < px.length; i += 4) {
    const light = Math.min(px[i], px[i + 1], px[i + 2])
    let a = 255
    if (light >= HI) a = 0
    else if (light > LO) a = Math.round((255 * (HI - light)) / (HI - LO))
    if (a < 255) {
      // bitmap Skia memakai alpha premultiplied
      px[i] = Math.round((px[i] * a) / 255)
      px[i + 1] = Math.round((px[i + 1] * a) / 255)
      px[i + 2] = Math.round((px[i + 2] * a) / 255)
      px[i + 3] = a
    }
  }
  return nativeImage.createFromBitmap(px, { width, height })
}

/**
 * Potong ruang kosong (transparan atau putih) di sekeliling gambar,
 * supaya ukuran di kartu ditentukan oleh isi gambar, bukan oleh margin file.
 */
export function trimImage(img) {
  const { width, height } = img.getSize()
  const px = img.toBitmap()
  const isEmpty = (i) => px[i + 3] < 24 || (px[i + 3] > 250 && Math.min(px[i], px[i + 1], px[i + 2]) >= 245)
  let top = height
  let bottom = -1
  let left = width
  let right = -1
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (isEmpty((y * width + x) * 4)) continue
      if (y < top) top = y
      if (y > bottom) bottom = y
      if (x < left) left = x
      if (x > right) right = x
    }
  }
  if (bottom < 0) return img // gambar kosong
  const pad = Math.round(Math.max(right - left, bottom - top) * 0.02)
  const x = Math.max(0, left - pad)
  const y = Math.max(0, top - pad)
  const rect = { x, y, width: Math.min(width, right + pad + 1) - x, height: Math.min(height, bottom + pad + 1) - y }
  if (rect.width === width && rect.height === height) return img
  return img.crop(rect)
}
