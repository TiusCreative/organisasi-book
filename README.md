# Organisasi Book

Organisasi Book adalah aplikasi akuntansi berbasis Next.js untuk organisasi, yayasan, dan perusahaan. Aplikasi ini mencakup:

- Login berbasis user yang dibuat admin
- Manajemen organisasi
- Transaksi dan jurnal otomatis
- Payroll dan PPh 21
- Pajak PPN, PPh 21, dan PPh 23
- Laporan keuangan
- Laporan pajak
- Laporan bank
- PWA dengan ikon `logo.png`

## Stack

- Next.js App Router
- Prisma + PostgreSQL
- Vercel untuk deployment

## Environment Variables

Salin `.env.example` menjadi `.env` untuk local, atau isi variable yang sama di Vercel untuk production.

```env
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"
AUTH_SECRET="ganti-dengan-random-secret-panjang"
ADMIN_NAME="Administrator"
ADMIN_EMAIL="admin@example.com"
ADMIN_PASSWORD="ganti-password-admin-awal"
```

Penjelasan:

- `DATABASE_URL`: koneksi PostgreSQL production atau local
- `AUTH_SECRET`: secret untuk session cookie login
- `ADMIN_NAME`: nama admin bootstrap pertama
- `ADMIN_EMAIL`: email admin bootstrap pertama
- `ADMIN_PASSWORD`: password admin bootstrap pertama

Catatan:

- `ADMIN_EMAIL` dan `ADMIN_PASSWORD` dipakai untuk membuat admin pertama saat tabel `User` masih kosong.
- Setelah admin pertama berhasil login dan membuat user lain, `ADMIN_PASSWORD` boleh dihapus atau diganti.
- `AUTH_SECRET` jangan diganti sembarangan setelah aplikasi live.

## Development Local

1. Install dependency:

```bash
npm install
```

2. Siapkan file `.env`.

3. Generate Prisma client:

```bash
npx prisma generate
```

4. Jalankan migration:

```bash
npx prisma migrate deploy
```

5. Jalankan aplikasi:

```bash
npm run dev
```

6. Buka:

```text
http://localhost:3000
```

## Deploy Ke Vercel

Bagian ini adalah panduan production yang bisa langsung diikuti.

### A. Persiapan

1. Pastikan repository sudah ter-push ke GitHub, GitLab, atau Bitbucket.
2. Siapkan database PostgreSQL production.
3. Pastikan file migration Prisma ada di folder `prisma/migrations`.
4. Pastikan env berikut sudah siap:

- `DATABASE_URL`
- `AUTH_SECRET`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `ADMIN_NAME`

### B. Deploy Pertama di Vercel

1. Login ke Vercel.
2. Klik `Add New Project`.
3. Pilih repository project ini.
4. Saat halaman konfigurasi project muncul, gunakan nilai berikut:

- Framework Preset: `Next.js`
- Install Command: `npm install`
- Build Command: `npm run vercel-build`
- Output Directory: kosongkan default
- Node.js Version: `20.x`

5. Tambahkan Environment Variables:

- `DATABASE_URL`
- `AUTH_SECRET`
- `ADMIN_NAME`
- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`

6. Klik `Deploy`.

### C. Setelah Deploy Berhasil

1. Buka domain Vercel Anda.
2. Akses `/login`.
3. Login memakai:

- email: nilai dari `ADMIN_EMAIL`
- password: nilai dari `ADMIN_PASSWORD`

4. Buka `/admin/users`.
5. Buat user operasional lain sesuai kebutuhan.
6. Buat organisasi pertama setelah login.
7. Lakukan pengujian dasar:

- login
- tambah user admin
- buat organisasi
- input transaksi
- cek halaman pajak
- cek laporan bank
- cek laporan keuangan

### D. Langkah Aman Setelah Go Live

1. Login sebagai admin bootstrap.
2. Buat admin permanen atau user operasional lain.
3. Ganti password admin bootstrap jika masih akan dipakai.
4. Jika admin bootstrap tidak dibutuhkan lagi:

- hapus `ADMIN_PASSWORD` dari Vercel, atau
- ganti dengan nilai acak baru

5. Jangan ubah `AUTH_SECRET` kecuali Anda siap memaksa semua user login ulang.

## Checklist Deploy Production

Gunakan checklist ini sebelum menyatakan aplikasi siap production:

- Repository sudah ter-push
- Database PostgreSQL production sudah aktif
- `DATABASE_URL` sudah benar
- `AUTH_SECRET` sudah diisi random string yang kuat
- `ADMIN_EMAIL` dan `ADMIN_PASSWORD` sudah diisi
- Build Command di Vercel sudah `npm run vercel-build`
- Deployment berhasil tanpa error
- Bisa login sebagai admin bootstrap
- Bisa membuka `/admin/users`
- Bisa membuat user baru
- Registrasi publik nonaktif
- User yang belum login diarahkan ke `/login`
- Organisasi hanya bisa dibuat setelah login
- Transaksi bisa dibuat
- Pajak otomatis tercatat
- Halaman laporan keuangan terbuka
- Halaman laporan pajak terbuka
- Halaman laporan bank terbuka

## Alur Aplikasi

### 1. Autentikasi

- User tidak bisa registrasi sendiri
- Admin membuat user dari halaman admin
- User login memakai email dan password
- Sistem membuat session cookie
- Route non-public diproteksi middleware

### 2. Bootstrap Awal

- Saat belum ada user sama sekali, aplikasi akan membuat admin pertama dari env
- Admin bootstrap login
- Admin membuat user lain

### 3. Organisasi

- Setelah login, user membuat organisasi
- Sistem menyimpan profil organisasi
- Sistem menyiapkan akun awal dasar

### 4. Master Data

User mengelola:

- daftar akun
- rekening bank
- karyawan
- aset
- investasi
- kategori akun

### 5. Transaksi

Saat transaksi dibuat:

- user memilih rekening bank dan akun lawan
- user mengisi nominal dan keterangan
- user bisa mengaktifkan PPN
- user bisa mengaktifkan PPh 23 untuk transaksi keluar
- sistem menghitung pajak otomatis
- sistem membuat jurnal debit/kredit
- sistem menyimpan catatan pajak

### 6. Payroll

Saat slip gaji dibuat:

- sistem menghitung bruto
- sistem menghitung BPJS
- sistem menghitung PPh 21
- sistem menghitung netto
- sistem menyimpan slip gaji
- sistem membuat catatan pajak PPh 21
- jurnal payroll bisa diposting otomatis

### 7. Laporan

#### Laporan Keuangan

Bersumber dari transaksi dan jurnal:

- neraca
- laba rugi / laporan aktivitas
- buku besar
- laporan transaksi

#### Laporan Pajak

Bersumber dari `TaxEntry`:

- PPh 21
- PPh 23
- PPN

#### Laporan Bank

Bersumber dari transaksi yang menyentuh akun bank:

- mutasi bank
- saldo rekening
- histori arus kas bank

## Diagram Alur Dokumentasi

Format berikut bisa langsung dipakai di dokumentasi internal:

```md
# Diagram Alur Aplikasi Organisasi Book

Login
-> user memasukkan email + password
-> sistem verifikasi ke database
-> session cookie dibuat
-> user masuk ke dashboard

Bootstrap Admin
-> env ADMIN_EMAIL + ADMIN_PASSWORD tersedia
-> jika user belum ada, sistem membuat admin pertama
-> admin login
-> admin membuat user lain

Organisasi
-> user login
-> user membuat organisasi
-> sistem menyimpan profil organisasi
-> sistem menyiapkan akun dasar

Transaksi
-> user input transaksi
-> pilih bank + akun lawan
-> opsional aktifkan PPN
-> opsional aktifkan PPh 23
-> sistem hitung pajak
-> sistem buat jurnal
-> sistem simpan tax entry

Payroll
-> user generate slip gaji
-> sistem hitung bruto, BPJS, PPh 21, netto
-> sistem simpan slip
-> sistem simpan tax entry PPh 21
-> sistem buat jurnal payroll

Laporan
-> transaksi + jurnal + tax entry + bank movement
-> laporan keuangan
-> laporan pajak
-> laporan bank
```

## Command Penting

Development:

```bash
npm run dev
```

Build production:

```bash
npm run build
```

Build untuk Vercel:

```bash
npm run vercel-build
```

Prisma generate:

```bash
npx prisma generate
```

Prisma migrate deploy:

```bash
npx prisma migrate deploy
```

## Catatan Operasional

- Project ini memakai middleware untuk memaksa login pada route internal.
- PWA aktif di production.
- Ikon PWA memakai `public/logo.png`.
- Jika login admin gagal di deploy pertama, cek dulu apakah `ADMIN_EMAIL` dan `ADMIN_PASSWORD` sudah benar di Vercel.

