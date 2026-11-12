// Daftar template & ukuran kartu. Dipakai proses utama (ekspor PNG, simpan ujian) dan renderer (cetak, pratinjau).
// 1 px desain = 0,1 mm.

export const TEMPLATE_IDS = ['terang', 'gelap', 'hijau', 'indigo', 'bank', 'bank_atm']

/** Ukuran kartu (mm) + susunan di A4 potret. maxGap: jarak antarkartu terbesar agar margin halaman ≥ ±5 mm. */
const STANDARD = { w: 95, h: 68, cols: 2, rows: 4, maxGap: 5 }
const ATM = { w: 85.6, h: 54, cols: 2, rows: 5, maxGap: 4 } // ISO/IEC 7810 ID-1

export function cardSpec(template) {
  return template === 'bank_atm' ? ATM : STANDARD
}

/** Ukuran desain (px) = mm × 10. */
export function designSize(template) {
  const s = cardSpec(template)
  return { w: Math.round(s.w * 10), h: Math.round(s.h * 10) }
}

export const BANK_COLORS = [
  ['navy', 'Biru Navy'],
  ['hitam', 'Hitam'],
  ['marun', 'Merah Marun'],
  ['platinum', 'Platinum (terang, hemat tinta)']
]
