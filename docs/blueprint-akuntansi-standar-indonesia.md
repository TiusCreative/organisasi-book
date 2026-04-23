# Blueprint Sistem Akuntansi (Standar Indonesia)

Dokumen ini mendefinisikan arsitektur dan alur kerja sistem akuntansi yang terintegrasi dengan modul operasional aplikasi, sesuai dengan Standar Akuntansi Keuangan (SAK) Indonesia dan ketentuan perpajakan yang berlaku.

## 1. Struktur Chart of Accounts (CoA)
Menggunakan standar klasifikasi 5 digit:
- 1XXXX: Aset (Kas, Bank, Piutang, Persediaan, Aset Tetap)
- 2XXXX: Kewajiban (Utang Usaha, Utang Pajak, Kewajiban Jangka Pendek/Panjang)
- 3XXXX: Ekuitas (Modal, Laba Ditahan)
- 4XXXX: Pendapatan (Penjualan, Pendapatan Lain-lain)
- 5XXXX: Beban Pokok Pendapatan (HPP)
- 6XXXX: Beban Operasional (Gaji, Sewa, Listrik, Penyusutan, Pajak)

## 2. Siklus Akuntansi & Modul Terintegrasi
Setiap transaksi operasional memicu entri jurnal otomatis:
- **Penjualan**: `Piutang (D)` / `Pendapatan (K)`, `PPN Keluaran (K)`, `HPP (D)` / `Persediaan (K)`.
- **Pembelian**: `Persediaan/Aset (D)`, `PPN Masukan (D)` / `Utang Usaha (K)`.
- **Penggajian**: `Beban Gaji (D)` / `Kas/Bank (K)`, `Utang PPh 21 (K)`.

## 3. Integrasi Pajak Indonesia
- **PPN**: Otomatis menghitung 11% (atau tarif berlaku) dari nilai transaksi barang/jasa kena pajak.
- **PPh 23**: Pemotongan atas jasa (2% / 4%).
- **PPh 21**: Perhitungan pajak atas penghasilan karyawan.
- **PPh 25/29**: Laporan laba fiskal tahunan.

## 4. Pelaporan
- **Neraca**: Posisi keuangan perusahaan pada tanggal tertentu.
- **Laporan Laba Rugi**: Kinerja keuangan periode berjalan.
- **Laporan Arus Kas**: Metode tidak langsung/langsung.
- **Laporan Pajak**: Ringkasan PPN Masa (FP Masukan/Keluaran) dan Bukti Potong PPh.

## 5. Kepatuhan & Audit
- `Audit Trail`: Setiap perubahan jurnal harus mencatat User ID, Timestamp, dan alasan perubahan.
- `Period Lock`: Penguncian data setelah tutup buku bulanan untuk mencegah manipulasi retroaktif.

## 6. Mapping Modul ke Standar Akuntansi
| Modul Aplikasi | Komponen Akuntansi Terkait |
| :--- | :--- |
| `src/app/sales` | Pendapatan, Piutang, PPN Keluaran |
| `src/app/purchase` | Utang, Persediaan, PPN Masukan |
| `src/app/gaji` | Beban Gaji, PPh 21, Utang Gaji |
| `src/app/aset` | Aset Tetap, Beban Penyusutan, Akumulasi Penyusutan |
| `src/app/bank` | Kas/Bank, Rekonsiliasi, Jurnal Penyesuaian |
| `src/app/warehouse` | Persediaan, HPP (COGS) |
