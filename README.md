# Kartu Ujian

Aplikasi desktop offline untuk membuat kartu peserta ujian sekolah (PDF A4 8 kartu/lembar + PNG per siswa).
Spesifikasi lengkap: [SPEC.md](SPEC.md).

## Pengembangan

```bash
npm install
npm run dev          # jalankan dengan hot reload
npm run build        # build ke folder out/
```

## Membuat installer

```bash
npm run dist:linux   # dist/KartuUjian-<versi>.AppImage
npm run dist:win     # dist/KartuUjian-Setup-<versi>.exe  (di Linux butuh wine: sudo apt install wine)
```

Tanpa wine: push ke GitHub lalu jalankan workflow **Build installer** (Actions → Run workflow);
installer `.exe` dibangun di Windows dan bisa diunduh dari artifact.

## Alur pemakaian

1. **Pengaturan Sekolah** — isi kop, kepala sekolah, NIP; unggah logo kabupaten, logo sekolah,
   tanda tangan, stempel (scan JPG berlatar putih otomatis dibuat transparan).
2. **Data Siswa** — import Excel (NISN, NAMA, KELAS), lalu import foto dari folder/ZIP
   (nama file = NISN). Perbaiki potongan foto per siswa lewat tombol kamera.
3. **Ujian & Cetak** — buat ujian, import Excel peserta (unduh templatenya dari aplikasi),
   pilih template, lalu ekspor:
   - **PDF Depan** → cetak → balik tumpukan kertas pada sisi panjang → **PDF Belakang**.
   - Jika depan/belakang meleset, cetak **Halaman Kalibrasi** lalu atur offset di Pengaturan.
   - **PNG per siswa (ZIP)** untuk dibagikan lewat WhatsApp.
4. **Backup & Restore** — backup rutin; file backup juga dipakai untuk pindah komputer.

Data tersimpan di folder data aplikasi (lihat menu Backup & Restore → Folder data).

## Uji otomatis (pengembangan)

```bash
npm run build
KARTU_SMOKE=$PWD/scripts/smoke.cjs KARTU_SMOKE_OUT=/tmp/kartu-out KARTU_SMOKE_IMG=/path/contoh-kartu.png \
  npx electron . --user-data-dir=/tmp/kartu-data
```
Mengisi data contoh lalu menghasilkan PDF/PNG ke `KARTU_SMOKE_OUT`.

## Rilis versi baru

1. Naikkan `version` di `package.json` (mis. `1.0.1`), commit.
2. `git tag v1.0.1 && git push origin main --tags`
3. GitHub Actions membangun installer dan membuat Release **Kartu Ujian v1.0.1** berisi `.exe` dan `.AppImage`.
