# Panduan Rekaman Demo Zero Trust

## 1. Ringkasan

Tujuan video adalah memperlihatkan autentikasi, keputusan PEP/Policy Engine, validasi service, kepemilikan data, konteks device dan jam akses, audit, serta sinkronisasi transkrip. Target video **7 menit 30 detik**: sekitar 7 menit 20 detik narasi/langkah dan 10 detik transisi. Durasi akhir harus tetap 6–9 menit.

Urutan: pembuka dan arsitektur (0:40), autentikasi dan token (1:10), gateway sebagai PEP/Policy Engine (1:00), verifikasi service (0:50), kebijakan akses (1:20), audit (0:40), finalisasi/sinkronisasi (1:10), penutup (0:30).

### Timeline Rekaman

| Waktu | Visual utama | Bagian panduan |
|---|---|---|
| 00:00–00:40 | Arsitektur gateway dan shell UI | a |
| 00:40–01:45 | Login, token, device, refresh dan logout | b |
| 01:45–02:45 | Gateway relay token service dan sinkronisasi | d, g |
| 02:45–04:05 | Policy Engine, kepemilikan dan jam akses | c, e |
| 04:05–05:20 | Kelas dosen, edit draft, uji lintas kelas | e |
| 05:20–06:35 | Jalankan sembilan skenario di Simulasi Pelanggaran | e, f |
| 06:35–07:30 | Audit log, konfigurasi jam, akses tanpa token, penutup | f, h |

**Sumber konteks:** Spesifikasi tugas berasal dari instruksi pengguna. File `KONTEKS.md` sumber tidak ditemukan saat inventarisasi; ringkasan kebutuhan yang diberikan disimpan di `docs/KONTEKS.md`.

## 2. Persiapan Sebelum Rekam

- [ ] Buka PowerShell pada root repository.
- [ ] Reset data demo dengan `npm run seed`. Ini menghapus isi tabel demo lalu mengisi ulang enam akun dan enam nilai draft.
- [ ] Pastikan `.env` lokal sudah dibuat dari `.env.example`; jangan rekam nilainya atau secret-nya.
- [ ] Jalankan `npm run start:all`. Biarkan terminal berjalan; hentikan dengan Ctrl+C.
- [ ] Buka browser pada `http://localhost:3000/#/masuk`. Siapkan tab kedua untuk `http://localhost:3000/nilai` tanpa token sebagai pemeriksaan akhir.
- [ ] Buka VS Code dalam urutan tab: `gateway/index.js`, `gateway/auth.js`, `gateway/policy.js`, `service-nilai/index.js`, `service-transkrip/index.js`, `gateway/audit.js`, `db/schema.sql`, `db/seed.js`, `gateway/web/src/demo-data.ts`, `gateway/web/src/session.ts`, `gateway/web/src/pages/masuk.ts`, `gateway/web/src/pages/nilai.ts`, `gateway/web/src/pages/transkrip.ts`, `gateway/web/src/pages/kelas.ts`, `gateway/web/src/pages/simulasi.ts`.
- [ ] Buka DB Browser for SQLite pada `db/sistem-nilai.db` (atau lokasi yang ditentukan `DB_PATH`). Siapkan tabel `users`, `devices`, `kelas`, `nilai`, `transkrip`, `refresh_tokens`, dan `audit_log`.
- [ ] Atur ukuran teks/editor agar source dan tabel terbaca. Tutup pop-up yang tidak terkait dan matikan notifikasi desktop/VS Code selama perekaman.
- [ ] Saat merekam login, logout, dan refresh, crop atau redaksi area JSON panel respons. Panel memang menampilkan body mentah, yang dapat berisi access token atau refresh token (`gateway/web/src/api.ts:31-78`).
- [ ] Siapkan perintah `curl.exe` berikut di PowerShell. Perintah ini hanya mengirim request; jangan tampilkan access token atau refresh token di video.

```powershell
# Endpoint bisnis tanpa token: harus 401.
curl.exe -i "http://localhost:3000/nilai"

# Login dengan device tidak dikenal: harus 401.
curl.exe -i -X POST "http://localhost:3000/auth/login" `
  -H "Content-Type: application/json" `
  -H "X-Device-ID: SALAH-123" `
  --data-raw '{"username":"mhs1","password":"Mhs123!"}'

# Login mahasiswa dan simpan access token dalam variabel PowerShell.
$login = & curl.exe -sS -X POST "http://localhost:3000/auth/login" `
  -H "Content-Type: application/json" `
  -H "X-Device-ID: DEV-MHS1-01" `
  --data-raw '{"username":"mhs1","password":"Mhs123!"}' | ConvertFrom-Json
$token = $login.access_token

# Token rusak: harus 401.
curl.exe -i "http://localhost:3000/nilai" `
  -H "Authorization: Bearer token-rusak" `
  -H "X-Device-ID: DEV-MHS1-01"

# Transkrip mahasiswa lain: harus 403 dengan reason transkrip_bukan_milik_sendiri.
curl.exe -i "http://localhost:3000/transkrip/2026002" `
  -H "Authorization: Bearer $token" `
  -H "X-Device-ID: DEV-MHS1-01"

# Service langsung tanpa X-Gateway-Secret: harus 403.
curl.exe -i "http://localhost:3001/nilai"
curl.exe -i "http://localhost:3002/transkrip/2026001"
```

### Data Akun Seed

Data akun dan device berasal dari `db/seed.js:20-27`; pemetaan dosen ke kelas dari `db/seed.js:41-43`; data nilai awal dari `db/seed.js:45-52`.

| Username | Password | Role | Device ID | NIM | Kelas yang diampu |
|---|---|---|---|---|---|
| `admin` | `Admin123!` | admin | `DEV-ADMIN-01` | — | — |
| `dosen1` | `Dosen123!` | dosen | `DEV-DOSEN1-01` | — | `IF101` — Keamanan Informasi |
| `dosen2` | `Dosen123!` | dosen | `DEV-DOSEN2-01` | — | `IF202` — Basis Data |
| `mhs1` | `Mhs123!` | mahasiswa | `DEV-MHS1-01` | `2026001` | — |
| `mhs2` | `Mhs123!` | mahasiswa | `DEV-MHS2-01` | `2026002` | — |
| `mhs3` | `Mhs123!` | mahasiswa | `DEV-MHS3-01` | `2026003` | — |

| Kelas | Nama kelas | Status setelah `npm run seed` | Aman untuk demo finalisasi setelah reset |
|---|---|---|---|
| `IF101` | Keamanan Informasi | Semua nilai `draft`; belum final | Ya |
| `IF202` | Basis Data | Semua nilai `draft`; belum final | Ya |

`db/seed.js` memasukkan setiap nilai dengan status `draft` (`db/seed.js:45-52`). Tidak ada kelas yang sudah final setelah seed. ID nilai tidak dicantumkan sebagai angka karena dibuat otomatis dari kolom `nilai.id` yang `AUTOINCREMENT` (`db/schema.sql:23-29`): **TIDAK DITEMUKAN: ID nilai statis di seed.js**. Ambil ID dari tabel `nilai` di UI/DB Browser setelah reset; skenario Simulasi Pelanggaran mengambil ID sendiri dari respons API.

## 3. Skrip Demo

### a. Pembuka dan Arsitektur — 0:40

**File dan baris:** `gateway/index.js:10-20`, `gateway/index.js:80-147`, `db/database.js:6-15`, `db/schema.sql:3-56`.

**Narasi:** “Sistem ini memakai gateway di port 3000 sebagai satu-satunya pintu masuk request bisnis. Gateway memeriksa token, perangkat, dan kebijakan sebelum meneruskan request ke Service Nilai atau Service Transkrip. Kedua service memakai database SQLite yang sama.”

- [ ] Tampilkan struktur folder dan kode gateway yang menyajikan `public` untuk shell/aset serta mendaftarkan auth sebelum middleware PEP.
- [ ] Tunjukkan pemilihan service tujuan. Buka `http://localhost:3000/#/masuk`; sebut port internal 3001 dan 3002 dari `.env.example:8-10`.

**Hasil yang diharapkan:** halaman Masuk tampil. `gateway/index.js:14-20` memasang static middleware sebelum endpoint bisnis; URL `/nilai` tetap masuk ke middleware bisnis dan tidak menjadi file static.

**DB Browser:**

- [ ] Buka `users` (kolom `id`, `username`, `password_hash`, `role`, `nim`), `kelas` (`id`, `nama`, `dosen_id`), dan `nilai` (`id`, `kelas_id`, `nim`, `nilai`, `status`). Definisi kolom ada di `db/schema.sql:3-29`.

### b. Autentikasi dan Token (4.1) — 1:10

**File dan baris:** `gateway/auth.js:7-8`, `gateway/auth.js:22-40`, `gateway/auth.js:51-95`, `gateway/auth.js:97-163`, `gateway/auth.js:165-192`; UI `gateway/web/src/session.ts:35-64`, `gateway/web/src/session.ts:58-103`, `gateway/web/src/pages/masuk.ts:4-49`.

**Narasi:** “Access token berlaku sepuluh menit dan membawa subject serta role. Refresh token berlaku satu hari; yang disimpan ke database adalah hash SHA-256. Logout menandai refresh token sudah dicabut. Token service berlaku lima menit dan hanya diterbitkan untuk kredensial service yang valid.”

- [ ] Di Masuk klik “Isi” pada akun `mhs1`, lalu klik “Masuk”. Perangkat otomatis menjadi `DEV-MHS1-01`; perlihatkan role `MAHASISWA` dan hitung mundur.
- [ ] Klik “Keluar”; UI mengirim logout dengan refresh token.

**Hasil yang diharapkan:** login valid `200`; logout valid `200` dengan body `{"message":"Logout berhasil"}`. Login dengan `SALAH-123` menghasilkan `401` dan `{"error":"Kredensial atau device tidak valid"}`. Refresh setelah logout menghasilkan `401` dan `{"error":"Refresh token tidak valid"}`. Untuk respons login/refresh tersebut, alasan spesifik dicatat di audit, bukan sebagai field `reason` pada body.

**DB Browser:**

- [ ] Di `refresh_tokens`, tampilkan kolom `user_id`, `token_hash`, `expires_at`, `revoked`. Setelah logout, baris token terkait mempunyai `revoked = 1`; database tidak menyimpan refresh token mentah.
- [ ] Di `audit_log`, tampilkan baris login/logout.

### c. Gateway sebagai PEP dan Policy Engine (4.2, 4.3) — 1:00

**File dan baris:** PEP `gateway/index.js:80-147`; kebijakan `gateway/policy.js:15-75`; request frontend `gateway/web/src/api.ts:31-78`; route browser `gateway/web/src/main.ts:49-82`.

**Narasi:** “Untuk setiap endpoint data, gateway memverifikasi bearer token, mencocokkan X-Device-ID dengan akun di database, lalu memanggil Policy Engine. Policy Engine membaca ulang role, NIM, kepemilikan nilai, dan dosen pengampu dari database. Kebijakan menolak secara default.”

- [ ] Sebelum login, buka tab `http://localhost:3000/nilai` atau jalankan `curl.exe -i "http://localhost:3000/nilai"`.

**Hasil yang diharapkan:** `401`, body `{"error":"Bearer access token diperlukan"}`. Audit request ini mempunyai alasan `access_token_tidak_diberikan`. Token rusak menghasilkan `401`, body `{"error":"Access token tidak valid atau kedaluwarsa"}`.

**DB Browser:**

- [ ] Buka `audit_log`, kolom `waktu`, `subjek`, `endpoint`, `device`, `hasil`, `alasan` (`db/schema.sql:48-56`). Perlihatkan baris deny untuk request tanpa token.

### d. Verifikasi Ulang di Service dan Gateway Secret (4.1) — 0:50

**File dan baris:** `service-nilai/index.js:10-28`, `service-transkrip/index.js:10-28`, penerusan header `gateway/index.js:123-133`, relay sinkronisasi `gateway/index.js:51-62`.

**Narasi:** “Service tidak mempercayai gateway secret sebagai pengganti autentikasi. Setiap service mensyaratkan X-Gateway-Secret sekaligus memverifikasi ulang tanda tangan dan masa berlaku JWT. Jadi request langsung tanpa secret tetap ditolak.”

- [ ] Jalankan dua perintah service langsung yang disiapkan: GET `http://localhost:3001/nilai` dan GET `http://localhost:3002/transkrip/2026001`, tanpa header rahasia.

**Hasil yang diharapkan:** keduanya `403`, body `{"error":"Request harus berasal dari gateway"}`. Jangan tampilkan secret dari `.env`.

**DB Browser:**

- [ ] Perlihatkan bahwa `audit_log` tidak mencatat request yang ditolak langsung di service, karena audit berada di gateway. Tunjukkan kembali data audit gateway.

### e. Demo Kebijakan Akses: Kepemilikan, Device, Jam (4.2, 4.3) — 1:20

**File dan baris:** kepemilikan dan jam `gateway/policy.js:3-75`; pemeriksaan device gateway `gateway/index.js:104-118`; nilai `service-nilai/index.js:34-68`, `service-nilai/index.js:70-95`; transkrip `service-transkrip/index.js:34-57`; halaman `gateway/web/src/pages/nilai.ts:6-32`, `gateway/web/src/pages/transkrip.ts:7-48`; skenario dan form manual `gateway/web/src/pages/simulasi.ts:35-149`, `gateway/web/src/pages/simulasi.ts:151-354`.

**Narasi:** “Mahasiswa hanya melihat data miliknya. Dosen hanya melihat kelas yang diampu, dan hanya boleh mengubah nilai draft dalam jam akses. Admin dapat membaca transkrip mahasiswa. Device diperiksa untuk setiap pengguna.”

**Langkah web:**

- [ ] Masuk sebagai `mhs1` / `Mhs123!` / `DEV-MHS1-01`. Di Nilai, pastikan tabel menampilkan hanya NIM `2026001`.
- [ ] Buka Transkrip Saya. Halaman otomatis meminta NIM sesi (`2026001`), tanpa input NIM. Sebelum finalisasi statusnya `200`; data dapat kosong karena tabel `transkrip` baru diisi saat finalisasi/sinkronisasi.
- [ ] Pada Simulasi Pelanggaran, pilih percobaan manual `GET /nilai`, pilih perangkat `SALAH-123`, lalu kirim. Harapannya `403`, pesan `Device tidak terdaftar untuk user ini`; audit menyimpan alasan `device_tidak_terdaftar`. Device sesi tetap `DEV-MHS1-01`.
- [ ] Pada Simulasi Pelanggaran, jalankan “Mahasiswa lihat transkrip mahasiswa lain”. Harapannya `403`, body mempunyai `reason: transkrip_bukan_milik_sendiri`.
- [ ] Jalankan “Dosen ubah nilai kelas yang tidak diampu”. Skrip memakai `dosen2` untuk membaca nilai `IF202`, lalu mencoba PUT memakai `dosen1`; harapannya `403`, `reason: nilai_tidak_ada_atau_kelas_bukan_ajaran_dosen`.

**Hasil yang diharapkan:** penolakan kebijakan PEP mengembalikan `403` dengan `reason`; login device tidak terdaftar adalah `401` tanpa field `reason` di body, dengan alasan detail ada di audit. Edit/finalisasi di luar jam menghasilkan `403`, `reason: di_luar_jam_akses`. Admin dapat membaca transkrip NIM mana pun dengan status `200`.

**DB Browser:**

- [ ] Tampilkan `devices` (`user_id`, `device_id`), `users` (`role`, `nim`), `kelas` (`id`, `dosen_id`), `nilai` (`kelas_id`, `nim`, `status`), dan `transkrip` (`nim`, `kelas_id`, `nilai`). Tabel perangkat/kelas/nilai/transkrip didefinisikan di `db/schema.sql:11-37`.

### f. Audit Log (4.4) — 0:40

**File dan baris:** `gateway/audit.js:3-11`, `gateway/auth.js:10-20`, `gateway/index.js:22-26`, `gateway/index.js:109-117`, `gateway/index.js:134-163`, `db/schema.sql:48-56`.

**Narasi:** “Gateway mencatat keputusan allow dan deny beserta waktu UTC, subjek, endpoint, device, hasil, dan alasan. Contohnya adalah penolakan device dan akses transkrip milik mahasiswa lain.”

- [ ] Di Simulasi Pelanggaran jalankan “Request tanpa token”, lalu “Mahasiswa lihat transkrip mahasiswa lain”.

**Hasil yang diharapkan:** baris audit untuk kedua request mempunyai `hasil = deny`; endpoint dan alasan sesuai keputusan. Beberapa respons autentikasi hanya menampilkan pesan umum, sementara alasan detail berada di audit.

**DB Browser:**

- [ ] Refresh `audit_log`; tampilkan kolom `waktu`, `subjek`, `endpoint`, `device`, `hasil`, `alasan`.
- [ ] Pada `refresh_tokens`, tunjukkan hash dan status cabut saja, bukan token mentah.

### g. Finalisasi dan Panggilan Antar-Service Lewat Gateway — 1:10

**File dan baris:** keputusan finalisasi `gateway/policy.js:52-61`; transaksi nilai dan panggilan token/sinkronisasi `service-nilai/index.js:97-175`; pemeriksaan token service gateway `gateway/index.js:29-78`; pemeriksaan/penyimpanan sinkronisasi `service-transkrip/index.js:59-99`; tombol UI `gateway/web/src/pages/kelas.ts:13-161`.

**Narasi:** “Dosen pengampu memfinalisasi kelas dalam jam akses. Service Nilai mengubah status draft menjadi final, meminta token service ke gateway, lalu mengirim sinkronisasi melalui gateway ke Service Transkrip. Browser tidak memanggil port 3002 langsung.”

- [ ] Setelah reset seed, masuk sebagai `dosen1` / `Dosen123!` / `DEV-DOSEN1-01`.
- [ ] Buka Kelas Saya, pilih tab `IF101 · Keamanan Informasi`, pastikan ada baris draft, lalu klik “Finalisasi Kelas” dan konfirmasi.

**Hasil yang diharapkan:** dalam jam yang diizinkan, respons `200` berisi pesan `Nilai kelas difinalisasi dan transkrip disinkronkan`, jumlah baris, serta hasil sinkronisasi `Transkrip berhasil disinkronkan`. Setelah itu nilai IF101 berstatus `final` dan tabel `transkrip` berisi data final. Jika jam ditutup, hasilnya `403`, `reason: di_luar_jam_akses`.

**DB Browser:**

- [ ] Refresh `nilai` dan filter `kelas_id = IF101`; tunjukkan `status = final`.
- [ ] Buka `transkrip` dan tunjukkan `nim`, `kelas_id`, `nilai`.
- [ ] Pada Simulasi Pelanggaran, jalankan “Dosen ubah nilai yang sudah final”; harapannya `403`, `reason: nilai_sudah_final`. Skenario itu dapat mem-finalisasi IF101 sebagai prasyarat bila belum ada nilai final.

- [ ] Masuk sebagai `admin` / `Admin123!` / `DEV-ADMIN-01`. Pada Transkrip Mahasiswa pilih `mhs1 · 2026001` dari daftar. Harapannya status `200` dan baris kelas IF101 tampak.

### h. Ringkasan dan Penutup — 0:30

**File dan baris:** middleware PEP `gateway/index.js:80-147`, default deny `gateway/index.js:159-168`, route UI `gateway/web/src/main.ts:49-82`.

**Narasi:** “Demo ini menunjukkan token, device, role dan kepemilikan data diperiksa di gateway, service memverifikasi token kembali, dan keputusan gateway bisa ditelusuri di audit. Jam akses dan request langsung ke port service juga diuji.”

- [ ] Buka tab kedua `http://localhost:3000/nilai` tanpa token.

**Hasil yang diharapkan:** `401`, body `{"error":"Bearer access token diperlukan"}`. Tutup dengan Simulasi Pelanggaran yang menampilkan hasil LULUS/GAGAL.

**DB Browser:**

- [ ] Tutup tanpa menyimpan perubahan manual; seed dan request aplikasi tersimpan oleh aplikasi.

## 4. Pemetaan Kebutuhan ke Bukti

| Kebutuhan tugas | File dan baris | Langkah demo dan bukti |
|---|---|---|
| 4.1 Login memeriksa kredensial dan device | `gateway/auth.js:51-95` | Bagian b: login seed berhasil; login device `SALAH-123` mendapat 401. |
| 4.1 Access token berisi subject/role dan berlaku 10 menit | `gateway/auth.js:7-8`, `gateway/auth.js:22-29` | Bagian b: tunjukkan konstanta dan hitung mundur header. |
| 4.1 Refresh berlaku 1 hari, tersimpan hash, logout mencabut | `gateway/auth.js:7-8`, `gateway/auth.js:31-40`, `gateway/auth.js:97-163`; `db/schema.sql:40-46` | Bagian b: DB Browser menunjukkan `token_hash`, `expires_at`, `revoked`; refresh sesudah logout ditolak. |
| 4.1 Token service 5 menit dari client ID/secret | `gateway/auth.js:165-192` | Bagian b/g: tunjukkan penerbitan token saat finalisasi tanpa membuka secret. |
| 4.1 Service meminta gateway secret dan verifikasi JWT ulang | `service-nilai/index.js:10-28`, `service-transkrip/index.js:10-28` | Bagian d: request langsung ke port 3001/3002 tanpa secret mendapat 403. |
| 4.1 Token user ditolak pada endpoint sinkronisasi | `gateway/index.js:29-49`, `service-transkrip/index.js:59-62` | Bagian e/Simulasi Pelanggaran: token dosen mendapat 403; alasan gateway `hanya_service_nilai_diizinkan`. |
| 4.2 GET nilai untuk mahasiswa dan dosen | `gateway/policy.js:23-35`, `service-nilai/index.js:34-68` | Bagian e: mahasiswa hanya melihat nilainya; dosen hanya kelas yang diampu. |
| 4.2 PUT nilai: dosen pengampu, draft, jam akses | `gateway/policy.js:37-49`, `service-nilai/index.js:70-95`, `gateway/web/src/pages/simulasi.ts:76-95` | Bagian e: PUT lintas kelas ditolak; ubah nilai draft melalui Kelas Saya dalam jam akses. |
| 4.2 Finalisasi dan sinkronisasi transkrip | `gateway/policy.js:52-61`, `service-nilai/index.js:97-175`, `service-transkrip/index.js:59-99` | Bagian g: finalisasi IF101, respons sinkronisasi sukses, status DB menjadi final. |
| 4.2 Transkrip milik sendiri dan admin | `gateway/policy.js:63-70`, `service-transkrip/index.js:34-57`, `gateway/web/src/pages/simulasi.ts:56-74` | Bagian e: mhs1 meminta NIM 2026002 mendapat 403; admin meminta NIM 2026001 mendapat 200. |
| 4.2 Kepemilikan dibaca ulang dari DB | `gateway/policy.js:15-20`, `gateway/policy.js:30-35`, `gateway/policy.js:63-69` | Bagian c/e: tunjukkan query akun/kelas dan penolakan lintas pemilik. |
| 4.3 Device terikat ke user | `gateway/index.js:104-112`, `gateway/auth.js:73-79`, `gateway/web/src/pages/simulasi.ts:207-247` | Bagian b/e: login device salah ditolak; percobaan manual memilih device asing tanpa mengubah device sesi. |
| 4.3 Jam akses 07.00–21.00, diatur lewat `.env` | `gateway/policy.js:3-13`, `gateway/policy.js:48-60`, `.env.example:5-6` | Bagian e dan prosedur bagian 5: denial menunjukkan `di_luar_jam_akses`; batas akhir eksklusif. |
| 4.4 Audit setiap keputusan gateway | `gateway/audit.js:3-9`, `gateway/index.js:22-26`, `gateway/index.js:109-117`, `gateway/index.js:134-163`, `db/schema.sql:48-56` | Bagian f: refresh `audit_log` dan perlihatkan waktu, subjek, endpoint, device, hasil, alasan. |

## 5. Prosedur Demo Jam Akses

Policy Engine membaca konfigurasi ketika proses gateway dimulai. Untuk menghasilkan penolakan deterministik tanpa bergantung pada jam komputer, ubah `.env` sementara menjadi:

```dotenv
JAM_MULAI=21
JAM_SELESAI=21
```

Kondisi `mulai >= selesai` membuat `dalamJamAkses()` selalu false (`gateway/policy.js:4-12`).

- [ ] Pastikan nilai IF101 masih `draft` dan catat ID nilai aktual dari tabel `nilai` di DB Browser. ID ini dinamis, bukan angka tetap seed.
- [ ] Hentikan `npm run start:all` dengan Ctrl+C, ubah dua nilai jam di `.env`, lalu jalankan lagi `npm run start:all` agar gateway membaca konfigurasi baru.
- [ ] Login sebagai `dosen1` / `Dosen123!` / `DEV-DOSEN1-01`, lalu coba “Simpan nilai” memakai ID nilai draft yang dicatat.
- [ ] Hasil yang diharapkan: `403`, body `{"error":"Akses ditolak","reason":"di_luar_jam_akses"}`. Audit mencatat deny dengan alasan `di_luar_jam_akses`.
- [ ] Untuk memulihkan, hentikan semua proses, kembalikan `.env` ke `JAM_MULAI=7` dan `JAM_SELESAI=21` sesuai `.env.example:5-6`, kemudian jalankan kembali `npm run start:all`.
- [ ] Jangan finalisasi kelas selama jam ditutup. Jika request edit ditolak, nilai draft tetap aman.

## 6. Hasil yang Diharapkan

| Request/skenario | HTTP | Body atau alasan yang diharapkan |
|---|---:|---|
| GET `/nilai` tanpa token | 401 | `Bearer access token diperlukan`; alasan audit `access_token_tidak_diberikan`. |
| Login mhs1 dengan `SALAH-123` | 401 | `Kredensial atau device tidak valid`; alasan audit `device_tidak_terdaftar`. |
| GET nilai dengan token rusak | 401 | `Access token tidak valid atau kedaluwarsa`. |
| Mahasiswa meminta transkrip mahasiswa lain | 403 | `reason: transkrip_bukan_milik_sendiri`. |
| Admin membaca transkrip mahasiswa | 200 | `nim` dan `data`; sebelum finalisasi `data` dapat kosong. |
| Dosen mengubah nilai kelas dosen lain | 403 | `reason: nilai_tidak_ada_atau_kelas_bukan_ajaran_dosen`. |
| Dosen mengubah nilai final | 403 | `reason: nilai_sudah_final` dari PEP. |
| Dosen mengubah/finalisasi di luar jam | 403 | `reason: di_luar_jam_akses`. |
| Token dosen POST `/transkrip/sinkron` | 403 | `Hanya token Service Nilai yang diizinkan`; alasan audit `hanya_service_nilai_diizinkan`. |
| Refresh setelah logout | 401 | `Refresh token tidak valid`; DB menunjukkan token dicabut. |
| Service langsung tanpa X-Gateway-Secret | 403 | `Request harus berasal dari gateway`. |
| Finalisasi IF101 dalam jam | 200 | `Nilai kelas difinalisasi dan transkrip disinkronkan`, lalu status DB final dan transkrip tersinkron. |

Respons autentikasi seperti login/device dan refresh/logout tidak selalu menyertakan properti `reason`; kolom alasan di tabel ini menyebut pesan HTTP dan/atau alasan audit sesuai implementasi.

## 7. Risiko dan Pemulihan

- [ ] Jika access token kedaluwarsa (10 menit), masuk kembali dengan akun seed dan device terkait.
- [ ] Jika kelas atau nilai sudah final, jalankan `npm run seed` untuk memulihkan database demo. Perintah ini menghapus data demo saat ini.
- [ ] Jika port bentrok, hentikan proses lama yang memakai port 3000, 3001, atau 3002. `.env.example` memetakan port tersebut pada baris 8-10; jangan mengubah port saat rekaman kecuali seluruh konfigurasi gateway/service diselaraskan.
- [ ] Jika satu langkah gagal, hentikan rekaman, catat respons/status, pulihkan keadaan dengan `npm run seed` bila perlu, lalu ulangi dari login. Jangan menyunting tabel langsung saat rekaman berjalan.
- [ ] Jika penolakan jam tidak sesuai, periksa `.env`, pastikan nilainya `21` dan `21`, lalu restart seluruh proses agar gateway membaca konfigurasi baru.
- [ ] Hindari merekam token, refresh token, isi `.env`, atau secret service. Bila token tampil di panel respons setelah login, jangan tampilkan nilai token dalam rekaman.

## 8. Checklist Pengumpulan

- [ ] Pastikan `.env` dan file database `*.db` tidak masuk commit; `.gitignore` mengabaikan keduanya.
- [ ] Pastikan `README.md` menjelaskan setup, perintah build frontend, URL, halaman, dan akun seed.
- [ ] Dari clone baru, jalankan `npm install`, siapkan `.env`, lalu `npm run build:web` dan `npm run assets`; keduanya harus selesai tanpa error.
- [ ] Jalankan `npm run seed` hanya pada database demo yang aman direset, lalu verifikasi `npm run start:all` membuka aplikasi pada port yang dikonfigurasi.
- [ ] Push repository ke GitHub setelah memeriksa file yang akan di-commit; jangan push `.env` atau database.
- [ ] Rekam video dengan durasi akhir 6–9 menit dan cek audionya sebelum dikumpulkan.
- [ ] Sertakan video demo dan repository pada tempat pengumpulan tugas.