# Blueprint Modul HR & GA (Standar Indonesia)

Dokumen ini mendefinisikan arsitektur sistem HR dan GA yang terintegrasi dengan sistem akuntansi dan perpajakan untuk skala perusahaan besar.

## 1. Modul HR (Human Resources)
Fokus pada manajemen siklus hidup karyawan dan penggajian.

### A. Fitur Utama
- **Database Karyawan**: Data lengkap (KTP, status pernikahan, NPWP, posisi).
- **Payroll**: Perhitungan gaji otomatis, tunjangan, potongan (BPJS Kesehatan/Ketenagakerjaan).
- **Time & Attendance**: Integrasi absensi untuk perhitungan lembur.
- **Tax Calculation (PPh 21)**: Perhitungan pajak karyawan bulanan (PPH 21) otomatis.

### B. Integrasi Akuntansi
- **Jurnal Gaji**: Otomatis generate jurnal:
    - `Beban Gaji` (D)
    - `Utang Gaji` (K)
    - `Utang PPh 21` (K)
    - `Utang BPJS` (K)

## 2. Modul GA (General Affairs)
Fokus pada pengelolaan aset fasilitas dan operasional kantor.

### A. Fitur Utama
- **Manajemen Aset (Fixed Assets)**: Pencatatan aset, lokasi, penanggung jawab, dan jadwal pemeliharaan.
- **Inventory Kantor**: Pengelolaan ATK dan kebutuhan operasional kantor.
- **Facility Management**: Jadwal maintenance kendaraan, gedung, dan fasilitas lainnya.
- **Procurement GA**: Pengadaan kebutuhan kantor (pengadaan rutin/insidental).

### B. Integrasi Akuntansi
- **Penyusutan**: Jurnal otomatis setiap bulan untuk penyusutan aset.
- **Pencatatan Biaya**: Jurnal pembebanan biaya pemeliharaan/perbaikan.

## 3. Konektivitas HR-GA-Akuntansi
Sistem dirancang agar:
1. **Data HR** (jumlah karyawan) berdampak pada **Budget Gaji** di Akuntansi.
2. **Data Aset GA** (penambahan/pengurangan) memicu update **Nilai Buku** dan **Jurnal Penyusutan** di Akuntansi.
3. **Pajak** (PPh 21 dari HR dan PPh 23 dari GA) terakumulasi di **Dashboard Pajak** Akuntansi untuk pelaporan masa/tahunan.
