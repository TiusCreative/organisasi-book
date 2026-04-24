# Blueprint UI Catalog & Design System

Dokumen ini menjadi panduan untuk membangun UI Catalog yang terpusat. Tujuannya adalah untuk standardisasi komponen, pola desain, dan pengalaman pengguna (UX) di seluruh modul aplikasi Organisasi Book, termasuk Penjualan, Gudang, Inventori, dan Akuntansi.

---

## 1. Tujuan & Scope

UI Catalog ini bertujuan untuk:

1.  **Menciptakan Konsistensi:** Memastikan semua tombol, form, tabel, dan elemen UI lainnya memiliki tampilan dan perilaku yang seragam di seluruh aplikasi.
2.  **Mempercepat Pengembangan:** Menyediakan kumpulan komponen siap pakai (reusable) sehingga tim developer tidak perlu membuat ulang elemen UI dari awal.
3.  **Menjadi Sumber Kebenaran Tunggal (Single Source of Truth):** Menjadi referensi utama bagi desainer dan developer terkait standar UI/UX.
4.  **Memudahkan Maintenance:** Perubahan desain atau fungsionalitas pada satu komponen akan otomatis teraplikasi di semua tempat komponen itu digunakan.

**Scope:**
Katalog ini akan mencakup semua elemen visual dan interaktif, mulai dari elemen dasar hingga template halaman penuh untuk modul:
- Sales & Marketing
- Warehouse & Inventory
- Procurement
- Accounting & Finance
- Human Resources (HR) & General Affairs (GA)
- System Administration

---

## 2. Prinsip Inti

1.  **Modular & Reusable:** Komponen dirancang untuk bisa digabungkan dan digunakan kembali di berbagai konteks tanpa perlu modifikasi.
2.  **Konsisten:** Mengikuti panduan desain yang sama untuk warna, tipografi, spasi, dan interaksi.
3.  **Aksesibel (Accessibility):** Komponen harus dapat diakses oleh semua pengguna, termasuk mereka yang menggunakan teknologi bantu (assistive technologies), dengan mengikuti standar WCAG.
4.  **Terpusat & Terdokumentasi:** Setiap komponen memiliki dokumentasi yang jelas tentang cara penggunaan, props yang tersedia, dan contoh kasus.
5.  **Technology-Aligned:** Dibangun dengan stack teknologi yang sama dengan aplikasi utama (React, Next.js, Tailwind CSS) untuk integrasi yang mulus.

---

## 3. Struktur Katalog UI

Katalog akan diorganisir secara hierarkis untuk memudahkan navigasi dan penemuan komponen.

### 3.1 Fondasi (Foundations)
Elemen dasar yang menjadi fondasi dari semua desain.
- **Colors:** Palet warna primer, sekunder, netral, dan warna status (success, error, warning, info).
- **Typography:** Jenis font, ukuran (h1, h2, p, small), ketebalan, dan line-height.
- **Spacing & Layout:** Sistem spasi (margin, padding), grid system, dan container-max-width.
- **Icons:** Pustaka ikon yang digunakan dan panduan penggunaannya.
- **Shadows & Borders:** Standar untuk `box-shadow`, `border-radius`, dan `border-width`.

### 3.2 Komponen Atomik (Atoms)
Blok bangunan terkecil yang tidak dapat dipecah lagi.
- `Button`: Varian (primary, secondary, danger), ukuran, dan state (disabled, loading).
- `Input`: Text, number, password, textarea, select, checkbox, radio button.
- `Label`
- `Badge` / `Tag`
- `Avatar`
- `Spinner` / `Loader`

### 3.3 Komponen Majemuk (Molecules/Compounds)
Kombinasi dari beberapa komponen atomik yang membentuk unit fungsional.
- `FormControl`: Kombinasi `Label`, `Input`, dan `ErrorMessage`.
- `Card`: Kontainer dengan `header`, `body`, dan `footer`.
- `Modal` / `Dialog`: Termasuk `header`, `content`, dan `actions`.
- `DataTable`: Tabel data dengan fitur sorting, filtering, dan pagination.
- `DatePicker` / `DateRangePicker`
- `Alert` / `Toast`
- `Tabs`

### 3.4 Template Halaman (Page Templates)
Layout standar untuk tipe halaman yang umum, berfungsi sebagai blueprint untuk halaman baru.
- **List Page:** Template untuk menampilkan daftar data (e.g., daftar invoice, daftar produk). Termasuk area filter, tombol "Tambah Baru", dan `DataTable`.
- **Form Page:** Template untuk membuat atau mengedit data (e.g., form PO baru, form entri jurnal). Termasuk `header` halaman, `form controls`, dan tombol `submit/cancel`.
- **Detail Page:** Template untuk menampilkan detail satu record (e.g., detail SO, detail karyawan). Biasanya terdiri dari beberapa `Card` atau section.
- **Dashboard Page:** Template untuk halaman dashboard dengan kumpulan widget, chart, dan statistik.

---

## 4. Pola UI Spesifik per Modul

Contoh pola UI yang akan distandarisasi untuk setiap modul utama.

### 4.1 Penjualan & Faktur (Sales & Invoice)
- **Form Sales Order:** Input customer, daftar item penjualan (dengan autocomplete), perhitungan subtotal, diskon, PPN, dan total.
- **Template Invoice:** Layout standar untuk tampilan cetak/PDF faktur.
- **Dashboard Penjualan:** Widget untuk KPI (Target vs Actual), sales pipeline, dan top performing products.
- **Tabel Daftar Pelanggan:** Dengan ringkasan total transaksi dan status piutang.

### 4.2 Gudang & Inventori (Warehouse & Inventory)
- **Form Perpindahan Stok:** Pilihan gudang/lokasi asal dan tujuan, pemilihan item, dan input kuantitas.
- **Kartu Stok (Stock Card):** Tampilan histori pergerakan stok untuk satu item.
- **UI Stock Opname:** Tampilan seperti spreadsheet untuk input hasil hitung fisik, dengan perbandingan `system vs actual`.
- **Label Barcode/QR Code:** Template untuk mencetak label yang akan ditempel pada item atau rak.

### 4.3 Pembelian (Procurement)
- **Form Purchase Order:** Mirip dengan SO, namun dengan input supplier dan termin pembayaran.
- **UI Approval Workflow:** Tampilan untuk `supervisor/manager` menyetujui atau menolak PR/PO.

### 4.4 Akuntansi
- **Form Jurnal Manual:** Input tanggal, deskripsi, dan baris-baris akun debit/kredit yang seimbang.
- **Tampilan Chart of Accounts (CoA):** Struktur pohon (tree view) untuk menampilkan hierarki akun.
- **Layout Laporan Keuangan:** Template standar untuk Neraca, Laba Rugi, dan Arus Kas.

---

## 5. Teknologi & Implementasi

- **Framework:** React dengan Next.js.
- **Styling:** Tailwind CSS.
- **UI Catalog Tool:** Storybook akan digunakan untuk mengembangkan, mendokumentasikan, dan menguji komponen secara terisolasi.
- **Lokasi Kode:**
    - Komponen UI akan ditempatkan di `src/components/ui/`.
    - Storybook stories akan ditempatkan di `src/stories/` atau berdampingan dengan komponennya (`*.stories.tsx`).
- **Proses Kontribusi:**
    1. Buat branch baru untuk komponen baru atau perubahan.
    2. Kembangkan komponen dan story-nya di Storybook.
    3. Pastikan semua varian dan state terdokumentasi.
    4. Buat Pull Request untuk di-review.

---

## 6. Roadmap Pengembangan

### Fase 1: Fondasi & Setup (Q3)
1.  Setup dan konfigurasi Storybook dalam proyek.
2.  Definisikan dan implementasikan *design tokens* (Foundations) di Tailwind config.
3.  Buat dan dokumentasikan semua Komponen Atomik (Button, Input, Badge, dll).

### Fase 2: Komponen Majemuk (Q3)
1.  Kembangkan komponen majemuk inti: `DataTable`, `Modal`, `Card`, `FormControl`.
2.  Pastikan komponen ini responsif dan aksesibel.
3.  Mulai refactor UI yang ada untuk menggunakan komponen dari katalog.

### Fase 3: Template Halaman & Pola Modul (Q4)
1.  Buat `Page Templates` untuk halaman List, Form, dan Detail.
2.  Implementasikan pola UI spesifik untuk modul prioritas (Sales & Inventory).
3.  Buat panduan migrasi untuk developer agar mengadopsi template baru.

### Fase 4: Adopsi Penuh & Tata Kelola (Q1 Next Year)
1.  Semua UI baru wajib menggunakan komponen dari UI Catalog.
2.  Refactor UI lama secara bertahap.
3.  Bentuk tim kecil (UI/UX Guild) untuk mengelola dan menyetujui perubahan pada design system.
4.  Lakukan audit rutin untuk memastikan konsistensi di seluruh aplikasi.