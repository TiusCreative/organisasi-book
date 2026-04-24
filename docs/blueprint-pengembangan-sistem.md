# Blueprint Pengembangan Sistem Manajemen Operasional (Skala Multi-Tier)

Dokumen ini mendefinisikan arsitektur dan blueprint pengembangan untuk sistem manajemen bisnis (ERP Modular) yang dirancang untuk mendukung skalabilitas dari usaha skala kecil hingga perusahaan besar (enterprise).

> Status dokumen: **living blueprint**. Bagian “Implementasi Saat Ini” dan “Gap/Backlog” dipakai agar blueprint ini benar-benar “real” dan bisa dieksekusi di codebase.

## 1. Visi Arsitektur
Sistem menggunakan pendekatan **Modular Monolith** dengan basis data yang terisolasi per organisasi (multi-tenancy) untuk memastikan keamanan data, namun memiliki fleksibilitas untuk di-extract ke microservices di masa depan.

### Implementasi Saat Ini (di repo)
- **Modular Monolith:** kode domain dominan berada di `src/lib/*` dan `src/app/*`.
- **Multi-tenancy (logical isolation):** hampir semua tabel domain memakai `organizationId` (row-level isolation). Saat ini belum menggunakan “database per organisasi”, namun sudah mendukung isolasi data via kolom `organizationId` + akses berbasis organisasi.
- **Prisma + Postgres:** skema ada di `prisma/schema.prisma`.

## 2. Struktur Modul Utama

### A. Modul Pembelian (Procurement)
- **Supplier Management**: Database relasional supplier dengan sistem ranking.
- **Purchase Requisition (PR)**: Alur persetujuan internal.
- **Purchase Order (PO)**: Terintegrasi dengan stok (In-transit) dan akuntansi (Account Payable).
- **Good Received Note (GRN)**: Pencatatan masuk barang dengan validasi QA.

### B. Modul Penjualan (Sales)
- **Sales Order (SO)**: Manajemen pesanan, alokasi stok, dan reservasi.
- **Invoice & Tax**: Otomatisasi penagihan dan perhitungan PPN/PPh.
- **Retur Penjualan**: Alur pengembalian barang dan pemutihan piutang.

### C. Modul Sales / Marketing
- **CRM Lite**: Pencatatan interaksi customer.
- **Sales Targets**: Sistem manajemen KPI per individu atau tim (Dashboard progress).
- **Commission Engine**: Perhitungan bonus otomatis berdasarkan realisasi penjualan/pembayaran.

### D. Modul Inventori & Gudang
- **Warehouse Management**: Multi-location/multi-branch support.
- **Stock Movement**: Serial number tracking, batch/expiry control (FEFO/FIFO).
- **Stock Opname**: Audit stok berkala.

### E. Modul System & Administration
- **Role-Based Access Control (RBAC)**: Granular permissions.
- **Audit Trail**: Tracking perubahan data tingkat field (mandatory untuk compliance).
- **Global Dashboard**: Agregasi data untuk manajemen tingkat atas.

## 3. Strategi Skalabilitas (Small to Large)
| Fitur | Skala Kecil | Skala Besar (Enterprise) |
| :--- | :--- | :--- |
| **Database** | Shared Cloud Instance | Dedicated Cluster (Sharding) |
| **Integrasi** | Manual Export/Import | Webhooks & API Integration |
| **Lokasi** | Single Warehouse | Multi-Warehouse / Logistics Hub |
| **Workflow** | Direct | Approval Workflow/Multi-level |

## 4. Roadmap Pengembangan
1. **Fase 1 (Foundational)**: Penguatan relasi di `prisma/schema.prisma` dan penguncian period (Accounting Period Lock).
2. **Fase 2 (Operational)**: Implementasi Approval Workflow pada modul PO dan SO.
3. **Fase 3 (Intelligence)**: Pengembangan dashboard target penjualan dan otomatisasi komisi.
4. **Fase 4 (Scale)**: Optimasi read-model (CQRS) untuk reporting skala besar.

### Fase 1 — Realisasi di Codebase (per 2026-04-24)
- **Period Lock (tutup buku):**
  - Model: `prisma/schema.prisma` (`PeriodLock`).
  - API util: `src/lib/period-lock.ts` (termasuk `isPeriodLockedInTx` untuk dipakai dalam transaksi).
- **Single Source of Truth untuk posting jurnal:**
  - Implementasi: `src/lib/accounting/journal.ts`.
  - Perilaku: validasi jurnal balance (double-entry), cek period lock sebelum posting, dan audit log saat posting.
- **Audit Trail:**
  - Model: `prisma/schema.prisma` (`AuditLog`).
  - Logger util: `src/lib/audit-logger.ts` (untuk audit event domain lain).
- **RBAC / Module-level permission:**
  - Labels + evaluator: `src/lib/permissions.ts`.
  - Guard halaman/action: `src/lib/auth.ts` (`requireModuleAccess`, `requireWritableModuleAccess`, dll).

### Gap & Backlog yang Masih Perlu (agar blueprint lengkap)
- **Approval Workflow (PR/PO/SO):** belum ada model/workflow generik (request/approve/reject + multi-level + SLA).
- **Procurement lebih lengkap:** PR, GRN + QA validation, integrasi “in-transit” ke inventori, dan AP (Vendor Bill).
- **Sales lebih lengkap:** SO→DO→Invoice, retur + pemutihan piutang, otomasi pajak.
- **Warehouse advanced:** serial/batch/expiry (FEFO/FIFO) + transfer antar gudang/branch terstandardisasi.
- **CQRS/read-model reporting:** sebagian reporting masih query langsung; perlu read-model/outbox untuk skala besar.

### Fase 2 — Status Implementasi (mulai 2026-04-24)
- **Approval Workflow (awal):** sudah ada tabel generic approval (`ApprovalRequest`, `ApprovalDecision`) via `src/lib/approval-workflow-schema.ts` dan helper `src/lib/approval-workflow.ts`.
- **Purchase Order approval:** flow dasar `DRAFT → PENDING_APPROVAL → APPROVED → SENT` di `src/app/actions/purchase-order.ts` + UI tombol di `src/components/arap/PurchaseOrderManager.tsx`.

## 5. Prinsip Pengembangan
- **Single Source of Truth**: Seluruh transaksi harus bermuara pada jurnal akuntansi (`src/lib/accounting/journal.ts`).
- **Security by Design**: Validasi akses di tiap layer API (`src/lib/permissions.ts`).
- **Performance**: Gunakan `server actions` untuk interaksi data dan `tanstack/react-query` untuk caching sisi client.

### Catatan implementasi performance (realistic)
- Repo sudah memakai pola `server actions` di `src/app/actions/*`.
- `@tanstack/react-query` belum terlihat di `package.json`. Jika caching client dibutuhkan, tambah dependency + standar wrapper query provider.

## 6. Rencana Eksekusi Step-by-Step (Next Action Plan)

Berdasarkan analisa codebase saat ini, **Fase 1** sudah terimplementasi dengan baik. Kita sekarang berada di eksekusi **Fase 2** yang saat ini baru selesai parsial (Approval PO). Berikut urutan eksekusinya:

### Step 1: Menyelesaikan Approval Workflow Penjualan (SO)
- **Target:** Membawa *Sales Order* ke siklus otorisasi yang sama dengan PO (`DRAFT` → `PENDING_APPROVAL` → `APPROVED`).
- **Action:** Menyiapkan API Actions di `src/app/actions/sales-order.ts` yang mengonsumsi modul otorisasi (`src/lib/auth.ts`) dan approval (`src/lib/approval-workflow.ts`).

### Step 2: Melengkapi Siklus Procurement & Gudang (GRN)
- **Target:** PO yang telah *APPROVED* harus dilanjutkan dengan penerimaan barang (*Good Received Note*).
- **Action:** Mengintegrasikan penerimaan barang ke tabel persediaan (`InventoryMovement` - IN) yang aman (`organizationId` terisolasi).

### Step 3: Melengkapi Siklus Penjualan (DO & Invoice)
- **Target:** SO yang telah *APPROVED* dilanjutkan dengan pengiriman (*Delivery Order*) dan penagihan (*Sales Invoice*).
- **Action:** Pemotongan stok otomatis (`InventoryMovement` - OUT) dan pembentukan jurnal otomatis dari Invoice Penjualan ke `src/lib/accounting/journal.ts`.

### Step 4: Eksekusi Fase 3 Lanjutan
- **Target:** Implementasi fitur Dashboard Intelligence, Sales Commission, dan fitur Warehouse Lanjut (Transfer & Opname).
