export const PHOTO_W = 450
export const PHOTO_H = 600
const ORIG_MAX = 1400

async function toBytes(canvas, quality) {
  const blob = await canvas.convertToBlob({ type: 'image/jpeg', quality })
  return new Uint8Array(await blob.arrayBuffer())
}

function whiteCanvas(w, h) {
  const c = new OffscreenCanvas(w, h)
  const ctx = c.getContext('2d')
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, w, h)
  ctx.imageSmoothingQuality = 'high'
  return [c, ctx]
}

/** Centered 3:4 crop, biased upward so heads are not cut off. */
export function autoCrop(w, h) {
  const ratio = PHOTO_W / PHOTO_H
  if (w / h > ratio) {
    const cw = Math.round(h * ratio)
    return { x: Math.round((w - cw) / 2), y: 0, width: cw, height: h }
  }
  const ch = Math.round(w / ratio)
  return { x: 0, y: Math.round((h - ch) * 0.3), width: w, height: ch }
}

/**
 * bytes: raw image file. Returns { orig, crop } JPEG bytes.
 * EXIF orientation is applied by createImageBitmap.
 * keepOriginal=false when re-cropping an already stored original.
 */
export async function processPhoto(bytes, { crop = null, keepOriginal = true, rotate = 0 } = {}) {
  let bmp = await createImageBitmap(new Blob([bytes]))
  let [oc, octx] = (() => {
    const s = Math.min(1, ORIG_MAX / Math.max(bmp.width, bmp.height))
    const w = Math.round(bmp.width * s)
    const h = Math.round(bmp.height * s)
    const rotated = rotate % 180 !== 0
    const [c, ctx] = whiteCanvas(rotated ? h : w, rotated ? w : h)
    ctx.translate(c.width / 2, c.height / 2)
    ctx.rotate((rotate * Math.PI) / 180)
    ctx.drawImage(bmp, -w / 2, -h / 2, w, h)
    return [c, ctx]
  })()
  bmp.close()
  void octx
  const r = crop || autoCrop(oc.width, oc.height)
  const [cc, cctx] = whiteCanvas(PHOTO_W, PHOTO_H)
  cctx.drawImage(oc, r.x, r.y, r.width, r.height, 0, 0, PHOTO_W, PHOTO_H)
  return {
    orig: keepOriginal || rotate ? await toBytes(oc, 0.9) : null,
    crop: await toBytes(cc, 0.88)
  }
}
