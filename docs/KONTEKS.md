# Konteks Tugas: Sistem Nilai Zero Trust

## Arsitektur

- API Gateway berjalan pada port 3000 dan menjadi satu-satunya pintu masuk request bisnis. Gateway bertindak sebagai Policy Enforcement Point (PEP) dan memuat Policy Engine.
- Service Nilai berjalan pada port 3001 dan Service Transkrip pada port 3002. Keduanya menggunakan database SQLite bersama.
- Request browser untuk data akademik melewati gateway. Service tidak boleh dianggap sebagai pintu masuk publik.
- Audit keputusan akses dicatat oleh gateway.

## Peran

- **Mahasiswa:** melihat nilai dan transkrip miliknya sendiri.
- **Dosen:** melihat, mengubah, dan memfinalisasi nilai hanya pada kelas yang diampu.
- **Admin:** melihat transkrip seluruh mahasiswa.

## 4.1 Autentikasi dan Token

- Login menggunakan `POST /auth/login`; kredensial harus benar dan `X-Device-ID` harus terdaftar untuk akun tersebut.
- Access token adalah JWT dengan masa berlaku 10 menit dan minimal memuat `sub` serta `role`. Client mengirimkannya melalui `Authorization: Bearer <token>`.
- Refresh token berlaku satu hari. Database menyimpan hash token, bukan token mentah. Logout mencabut refresh token agar tidak dapat dipakai kembali.
- Token service diterbitkan melalui `POST /auth/service` setelah client ID dan secret valid. Token berlaku lima menit dan memiliki role `service`.
- Gateway menambahkan `X-Gateway-Secret` saat meneruskan request ke service. Service tetap memverifikasi tanda tangan dan masa berlaku JWT; gateway secret saja tidak cukup.

## 4.2 Kebijakan Akses (Tabel 3)

| Endpoint | Peran yang diizinkan | Kondisi |
|---|---|---|
| `POST /auth/login` | Semua | Kredensial valid dan device terdaftar untuk user. |
| `POST /auth/refresh` | Semua pemegang refresh token | Refresh token valid, belum kedaluwarsa, dan belum dicabut. |
| `POST /auth/logout` | Semua pemegang refresh token | Refresh token dikenal dan belum dicabut; logout mencabut token. |
| `POST /auth/service` | Service Nilai | Client ID dan secret service valid. |
| `GET /nilai` | Mahasiswa, dosen | Mahasiswa melihat nilai sendiri; dosen hanya kelas yang diampu. |
| `PUT /nilai/:id` | Dosen | Nilai berada pada kelas yang diampu, masih draft, dan request berada dalam jam akses. |
| `POST /kelas/:id/finalisasi` | Dosen | Kelas diampu dosen, request berada dalam jam akses; nilai difinalisasi lalu transkrip disinkronkan. |
| `GET /transkrip/:nim` | Mahasiswa, admin | Mahasiswa hanya NIM sendiri; admin dapat melihat semua mahasiswa. |
| `POST /transkrip/sinkron` | Service Nilai | Hanya token service dengan identitas Service Nilai; token user ditolak. |

Kepemilikan data dan pengampu kelas diperiksa Policy Engine dengan membaca database. Keputusan akses tidak hanya bergantung pada claim token. Semua route yang tidak diizinkan ditolak secara default.

## 4.3 Verifikasi Konteks

- Setiap request bisnis harus membawa `X-Device-ID` yang terdaftar untuk user pemilik access token.
- Perubahan dan finalisasi nilai dibatasi pada jam akses `JAM_MULAI` sampai sebelum `JAM_SELESAI`.
- Contoh konfigurasi `.env.example`: `JAM_MULAI=7` dan `JAM_SELESAI=21`. Batas akhir bersifat eksklusif, sehingga intervalnya 07.00 sampai sebelum 21.00 waktu lokal server.

## 4.4 Audit Log

Gateway mencatat keputusan akses dengan waktu, subjek, endpoint, device, hasil (`allow` atau `deny`), dan alasan. Audit mencakup keputusan autentikasi dan request yang diperiksa PEP. Request yang ditolak langsung oleh service tidak menjadi keputusan audit gateway.

## Antarmuka Demo

Frontend TypeScript disajikan oleh gateway untuk login dan mencoba alur peran, endpoint, serta skenario kebijakan. Penyembunyian menu atau kontrol hanya kenyamanan antarmuka; otorisasi tetap ditentukan gateway dan Policy Engine. Perubahan data uji dapat memerlukan reset seed.

## Luaran

- Repository project dan README dengan cara menjalankan sistem, akun seed, serta device ID.
- Video demo berdurasi 6–9 menit yang menunjukkan kode dan bukti pengujian kebutuhan pada bagian 4.1 sampai 4.4.
