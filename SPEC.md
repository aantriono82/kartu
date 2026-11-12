# Spesifikasi Aplikasi Kartu Peserta Ujian

## Platform
- Aplikasi desktop offline: Electron + React (Vite, JavaScript) + SQLite (sql.js / WASM, tanpa modul native).
- Target: Windows 10/11 (installer `.exe` NSIS) dan Linux (AppImage + .deb).
- Satu instalasi = satu sekolah. Pengguna: TU (satu orang, tanpa login).

## Pengaturan sekolah (semua bisa diedit)
- Kop: Pemerintah (mis. "PEMERINTAH KABUPATEN LAMPUNG TENGAH"), Dinas, UPTD, Nama Sekolah, Wilayah (mis. "KABUPATEN LAMPUNG TENGAH", dipakai template gelap), Alamat.
- Logo kabupaten, logo sekolah, tanda tangan, stempel (PNG transparan).
- Kepala sekolah + NIP (diformat otomatis `XXXXXXXX XXXXXX X XXX`).
- Tata tertib ujian (teks, untuk kartu belakang).
- Kalibrasi cetak bolak-balik: offset X/Y (mm) halaman belakang.

## Data
- **Master Siswa**: NISN (kunci), nama, kelas, foto.
  - Import Excel. Foto via folder/ZIP, nama file = `NISN.jpg/png`, dicocokkan otomatis.
  - Foto: crop tengah otomatis rasio 3:4, dikompres (±450×600), bisa crop ulang manual.
  - Tanpa foto → placeholder.
- **Ujian**: nama ujian, tahun pelajaran, template (Terang/Gelap).
  - Peserta di-import dari Excel: NISN, (Nama, Kelas — opsional, untuk membuat/memperbarui master siswa), No Urut, Nomor Peserta, Ruang, Sesi, Username, Password.
  - Ujian berikutnya cukup import peserta baru; foto & data siswa dipakai ulang.
- Template Excel bisa diunduh dari aplikasi.
- Backup / restore seluruh data (ZIP).

## Kartu
- Ukuran 95 × 68 mm (rasio ±1,4 sesuai desain).
- 2 template: **Terang** & **Gelap**, keduanya dengan QR.
- **Depan**: kop + 2 logo, judul "KARTU TANDA PESERTA {UJIAN} T.P {TAHUN}", No Urut, Nomor Peserta, Nama, Kelas, Ruang, Sesi, foto, Kepala Sekolah + TTD + stempel + NIP, QR.
- **Belakang**: tata tertib, Username, Password.
- QR berisi teks data siswa (nomor peserta, NISN, nama, kelas, sekolah, ujian).
- Teks panjang (nama dll.) mengecil otomatis agar muat.

## Output
- **PDF A4**, 8 kartu/halaman (2×4), dengan garis potong.
  - Depan & belakang diekspor terpisah. Belakang dicerminkan (balik sisi panjang) + offset kalibrasi.
  - Halaman tes kalibrasi.
- **PNG per siswa** dalam satu ZIP, nama file `NoPeserta_Nama.png`.
- Filter cetak: semua / per kelas / per ruang. Urutan: kelas → ruang → no urut.

## Di luar cakupan v1
- Login/multi-user, sinkronisasi online, verifikasi QR online, multi-sekolah dalam satu instalasi.
