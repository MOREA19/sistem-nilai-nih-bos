# Sistem Nilai

Sistem nilai akademik demo dengan API Gateway sebagai Policy Enforcement Point (PEP), Policy Engine, dua service internal, dan database SQLite bersama. Antarmuka web disajikan gateway; seluruh endpoint data tetap melewati autentikasi dan kebijakan gateway.

## Setup

Gunakan Node.js 18 atau lebih baru. Pasang dependency dan buat ulang data demo:

```powershell
npm install
npm run seed
```

Database disimpan di `db/sistem-nilai.db` secara default. Ubah `DB_PATH` di `.env` bila diperlukan. Salin `.env.example` sebagai `.env` sebelum mengisi konfigurasi lokal.

## Frontend Demo

Source frontend ditulis dalam TypeScript di `gateway/web/src`. Untuk membangun manual, jalankan `npm run assets` lalu `npm run build:web`. Output ES module, ikon, dan font lokal berada di `gateway/public`; output tersebut disertakan di repository agar clone langsung dapat menyajikan UI. `npm run start:gateway` dan `npm run start:all` menjalankan asset/build hooks sebelum server dimulai.

Buka <http://localhost:3000/#/masuk> setelah sistem berjalan. Jalankan `npm run start:all` untuk gateway dan kedua service dalam satu proses; hentikan dengan Ctrl+C. Route UI: `#/masuk`, `#/nilai` (mahasiswa), `#/transkrip` (mahasiswa/admin), `#/kelas` (dosen), dan `#/simulasi` (semua role). Hash route menjaga endpoint data seperti `/nilai` tetap melewati PEP ketika URL endpoint dibuka langsung.

Output build dan aset dapat dibuat ulang dengan `npm run assets` dan `npm run build:web`. File output tetap disimpan di Git agar aplikasi langsung bekerja setelah clone; prestart akan memperbaruinya ketika server dimulai.

`npm run start:nilai` dan `npm run start:transkrip` tetap dapat dipakai untuk menjalankan service secara terpisah.

## Jam Akses

Jam ubah dan finalisasi nilai dikonfigurasi melalui `.env`. Ubah `JAM_MULAI` dan `JAM_SELESAI` sesuai rentang yang diinginkan; `.env.example` memakai `JAM_MULAI=7` dan `JAM_SELESAI=21`. Batas akhir bersifat eksklusif. Restart gateway setelah mengubah konfigurasi agar nilai baru dibaca.

## Akun Seed

| Username | Password | Role | Device ID |
|---|---|---|---|
| admin | `Admin123!` | admin | `DEV-ADMIN-01` |
| dosen1 | `Dosen123!` | dosen | `DEV-DOSEN1-01` |
| dosen2 | `Dosen123!` | dosen | `DEV-DOSEN2-01` |
| mhs1 | `Mhs123!` | mahasiswa | `DEV-MHS1-01` |
| mhs2 | `Mhs123!` | mahasiswa | `DEV-MHS2-01` |
| mhs3 | `Mhs123!` | mahasiswa | `DEV-MHS3-01` |

Password hanya ditulis untuk keperluan demonstrasi; nilai di database disimpan sebagai hash bcrypt.

## Struktur Folder

```text
gateway/          Gateway PEP, Policy Engine, audit, serta frontend TypeScript dan aset publik
service-nilai/    API internal untuk membaca, mengubah, dan memfinalisasi nilai
service-transkrip/ API internal untuk membaca dan menyinkronkan transkrip
db/               Skema, seed, dan koneksi SQLite bersama
scripts/          Penyalin aset frontend dan launcher seluruh service
postman/          Collection dan environment Postman hasil ekspor
docs/             Konteks kebutuhan dan panduan video demo
node_modules/     Dependency lokal hasil npm install
```

Folder `.postman/` berisi metadata workspace lokal Postman; folder ini di-ignore dan dipertahankan bila Postman membuatnya.

## Video Demo

Panduan rekaman 6–9 menit, checklist, akun, bukti HTTP/database, urutan waktu, dan pemetaan kebutuhan tersedia di [docs/DEMO.md](docs/DEMO.md). Ringkasan kebutuhan sistem ada di [docs/KONTEKS.md](docs/KONTEKS.md).
