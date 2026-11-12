// Pemeriksaan data peserta sebelum cetak.

export const DUP_FIELDS = [
  ['nomor_peserta', 'Nomor peserta'],
  ['username', 'Username']
]

const norm = (v) => String(v ?? '').trim().toUpperCase()

/**
 * Cari nilai ganda (tidak peka huruf besar/kecil, kosong diabaikan).
 * Hasil: { groups: [{ field, label, value, people }], ids: Set<id>, fieldsById: Map<id, Set<field>> }
 */
export function findDuplicates(participants) {
  const groups = []
  const fieldsById = new Map()
  for (const [field, label] of DUP_FIELDS) {
    const byValue = new Map()
    for (const p of participants) {
      const k = norm(p[field])
      if (!k) continue
      if (!byValue.has(k)) byValue.set(k, [])
      byValue.get(k).push(p)
    }
    for (const people of byValue.values()) {
      if (people.length < 2) continue
      groups.push({ field, label, value: String(people[0][field]).trim(), people })
      for (const p of people) {
        if (!fieldsById.has(p.id)) fieldsById.set(p.id, new Set())
        fieldsById.get(p.id).add(field)
      }
    }
  }
  return { groups, ids: new Set(fieldsById.keys()), fieldsById }
}

/** Ringkasan satu baris, mis. "2 nomor peserta ganda, 1 username ganda". */
export function duplicateSummary(groups) {
  return DUP_FIELDS.map(([field, label]) => [label, groups.filter((g) => g.field === field).length])
    .filter(([, n]) => n)
    .map(([label, n]) => `${n} ${label.toLowerCase()} ganda`)
    .join(', ')
}
