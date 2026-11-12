# Kartu Ujian

Aplikasi desktop offline untuk membuat kartu peserta ujian sekolah (PDF A4 8 kartu/lembar — 10 untuk ukuran ATM — + PNG per siswa). Template: Terang, Gelap, Hijau Resmi, Indigo, dan Kartu Bank (95 × 68 mm atau ukuran ATM 85,6 × 54 mm).
Spesifikasi lengkap: [SPEC.md](SPEC.md).

## Pengembangan

```bash
npm install
npm run dev          # jalankan dengan hot reload
npm run build        # build ke folder out/
```

## Membuat installer

```bash
npm run dist:linux   # dist/KartuUjian-<versi>.AppImage + dist/KartuUjian-<versi>-amd64.deb
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

## Memasang di Linux Mint / Ubuntu

Unduh `KartuUjian-<versi>-amd64.deb` dari Releases, klik dua kali → **Install Package**
(atau `sudo apt install ./KartuUjian-<versi>-amd64.deb`). Aplikasi muncul di Menu → Kantor → **Kartu Ujian**.
Update: pasang .deb versi baru dengan cara yang sama. Hapus: `sudo apt remove kartu-ujian` (data di
`~/.config/Kartu Ujian` tidak ikut terhapus).

## Uji otomatis (pengembangan)

```bash
npm test             # di Linux tanpa layar: xvfb-run -a npm test
```
Menjalankan smoke test (import Excel, PDF/PNG 6 template) dan uji backup/restore di dalam Electron.
Juga dijalankan GitHub Actions di setiap push; installer hanya dibuat jika lulus.

Smoke test manual dengan data sekolah asli:
```bash
npm run build
KARTU_SMOKE=$PWD/scripts/smoke.cjs KARTU_SMOKE_OUT=/tmp/kartu-out KARTU_SMOKE_IMG=/path/contoh-kartu.png \
  npx electron . --user-data-dir=/tmp/kartu-data
```
Mengisi data contoh lalu menghasilkan PDF/PNG ke `KARTU_SMOKE_OUT`. Tambahkan
`KARTU_SMOKE_FROM="$HOME/.config/Kartu Ujian"` agar memakai pengaturan, logo, TTD, dan stempel sekolah yang asli.

## Rilis versi baru

1. Naikkan `version` di `package.json` (mis. `1.0.1`), commit.
2. `git tag v1.0.1 && git push origin main --tags`
3. GitHub Actions membangun installer dan membuat Release **Kartu Ujian v1.0.1** berisi `.exe`, `.deb`, dan `.AppImage`.
