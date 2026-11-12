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
