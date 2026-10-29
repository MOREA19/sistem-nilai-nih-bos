# Sistem Nilai

Tahap ini menyiapkan struktur proyek, skema SQLite, dan data seed. File gateway serta service masih berupa placeholder.

## Setup

Gunakan Node.js 18 atau lebih baru. Pasang dependency dan buat ulang data demo:

```powershell
npm install
npm run seed
```

Database disimpan di `db/sistem-nilai.db` secara default. Ubah `DB_PATH` di `.env` bila diperlukan. Salin `.env.example` sebagai `.env` sebelum mengisi konfigurasi lokal.

Script `start:gateway`, `start:nilai`, dan `start:transkrip` disediakan sebagai placeholder tahap berikutnya.

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
