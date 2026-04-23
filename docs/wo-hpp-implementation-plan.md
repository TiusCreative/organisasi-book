# Work Order HPP Implementation Plan

Dokumen ini adalah blueprint implementasi modul Work Order agar mendukung:

- HPP per unit dengan rumus:
  - `HPP per Unit = Total Cost / Qty Produk Jadi`
  - `Total Cost = Bahan Baku + Tenaga Kerja + Overhead + Biaya Mesin + Subkontrak - Nilai Sisa/Waste`
- Real-time cost
- Integrasi inventory
- Variance analysis (planned vs actual)
- Multi-level BOM (semi-finished goods)

## 1) Gap Saat Ini (Ringkas)

- WO saat ini baru menyimpan item manual (`description`, `qty`, `unitPrice`).
- Belum ada model BOM.
- Belum ada posting otomatis konsumsi bahan baku dan hasil produksi ke inventory dari WO.
- Belum ada tabel biaya aktual WO terstruktur (labor, overhead, machine, subcontract, waste).
- Belum ada kalkulasi dan penyimpanan planned vs actual cost per WO.

## 2) Target Arsitektur

### 2.1 Master Data

Tambahkan model:

- `BillOfMaterial`
  - `id`, `organizationId`, `productItemId`, `code`, `name`, `version`, `isActive`, `notes`, timestamps
- `BillOfMaterialLine`
  - `id`, `bomId`, `componentItemId`, `quantityPerUnit`, `uom`, `scrapPercent`, `sequence`

Catatan:
- `productItemId` mengarah ke `InventoryItem` tipe `FINISHED_GOOD` atau `SEMI_FINISHED`.
- `componentItemId` bisa `RAW_MATERIAL` atau `SEMI_FINISHED` (untuk multi-level BOM).

### 2.2 Work Order Eksekusi

Perluasan `WorkOrder`:

- `productItemId` (barang jadi yang diproduksi)
- `bomId` (BOM versi yang dipakai saat release WO)
- `plannedQty`
- `actualQty`
- `plannedMaterialCost`
- `plannedLaborCost`
- `plannedOverheadCost`
- `plannedMachineCost`
- `plannedSubcontractCost`
- `plannedWasteValue`
- `plannedTotalCost`
- `actualMaterialCost`
- `actualLaborCost`
- `actualOverheadCost`
- `actualMachineCost`
- `actualSubcontractCost`
- `actualWasteValue`
- `actualTotalCost`
- `hppPerUnit`
- `varianceAmount`
- `variancePercent`

Tambahkan `WorkOrderMaterialIssue`:

- untuk log pengeluaran bahan baku real-time per WO
- `workOrderId`, `itemId`, `plannedQty`, `issuedQty`, `unitCost`, `totalCost`, `movementId`, timestamps

Tambahkan `WorkOrderCostEntry`:

- biaya non-material aktual:
  - `costType` enum: `LABOR`, `OVERHEAD`, `MACHINE`, `SUBCONTRACT`, `WASTE`
  - `amount`, `reference`, `description`, `entryDate`

### 2.3 Integrasi Inventory

Saat `issue material`:
- buat `InventoryMovement` tipe `OUT` dengan `reference = WO code`
- update qty dan value item
- simpan snapshot cost ke `WorkOrderMaterialIssue`

Saat `receive finished goods`:
- buat `InventoryMovement` tipe `IN` untuk `productItemId`
- `unitCost = hppPerUnit`
- `totalCost = actualTotalCost`
- tambah qty barang jadi

## 3) Formula Perhitungan

### 3.1 Planned

- `plannedMaterialCost = SUM(komponenQtyPlan * unitCostSaatRelease)`
- `plannedTotalCost = plannedMaterialCost + plannedLaborCost + plannedOverheadCost + plannedMachineCost + plannedSubcontractCost - plannedWasteValue`

### 3.2 Actual

- `actualMaterialCost = SUM(issue aktual material)`
- `actualTotalCost = actualMaterialCost + actualLaborCost + actualOverheadCost + actualMachineCost + actualSubcontractCost - actualWasteValue`
- `hppPerUnit = actualQty > 0 ? actualTotalCost / actualQty : 0`

### 3.3 Variance

- `varianceAmount = actualTotalCost - plannedTotalCost`
- `variancePercent = plannedTotalCost > 0 ? (varianceAmount / plannedTotalCost) * 100 : 0`

## 4) Multi-Level BOM

Strategi:

- Simpan BOM recursive (komponen bisa `SEMI_FINISHED`).
- Sediakan fungsi explode BOM:
  - mode `single-level` untuk WO biasa
  - mode `multi-level` untuk MRP/planning
- Untuk produksi semi-finished:
  - wajib WO terpisah
  - hasil WO semi-finished menjadi stok input WO parent

## 5) Tahapan Implementasi

### Phase 1 (Fondasi, disarankan dikerjakan dulu)

1. Tambah schema BOM + relasi item produk/komponen.
2. Tambah field planned/actual summary di `WorkOrder`.
3. Tambah `WorkOrderMaterialIssue` dan `WorkOrderCostEntry`.
4. Tambah status WO yang lebih operasional:
   - `DRAFT`, `RELEASED`, `IN_PROGRESS`, `COMPLETED`, `CLOSED`, `CANCELLED`.
5. Hardening authorization:
   - semua update WO wajib validasi `organizationId`.

Deliverable Phase 1:
- Data model siap, belum full UI.

### Phase 2 (Transaksi Real-time Cost)

1. API action:
   - release WO dari BOM
   - issue material (OUT movement)
   - input biaya aktual non-material
   - complete WO (hitung HPP + receive FG IN movement)
2. Posting jurnal opsional (kalau akun COGM/WIP sudah disiapkan).

Deliverable Phase 2:
- HPP per unit sudah benar-benar dihitung dari biaya aktual.

### Phase 3 (UI/UX + Variance)

1. UI WO:
   - tab BOM snapshot
   - material issue
   - cost entry
   - costing summary (planned vs actual)
2. Dashboard variance:
   - per WO, per produk, per periode.

Deliverable Phase 3:
- Monitoring HPP dan variance end-to-end.

### Phase 4 (Multi-Level BOM Advanced)

1. BOM tree viewer dan validator circular dependency.
2. Recursive cost roll-up untuk simulasi planned cost.
3. Dukungan WO chain antar semi-finished -> finished goods.

Deliverable Phase 4:
- Multi-level BOM production flow stabil.

## 6) Acceptance Criteria

1. Saat WO selesai, stok FG bertambah dengan `unitCost = hppPerUnit`.
2. Semua issue bahan mengurangi stok dan membentuk `actualMaterialCost`.
3. HPP mengikuti formula final yang disepakati.
4. Report WO menampilkan planned vs actual + variance.
5. Multi-level BOM bisa dipakai minimal 2 level tanpa duplikasi cost.

## 7) Risiko & Mitigasi

- Risiko data cost berubah saat runtime:
  - mitigasi: simpan snapshot cost per issue, jangan hitung ulang dari harga master.
- Risiko stok negatif:
  - mitigasi: validasi sebelum issue.
- Risiko recursion BOM tak berujung:
  - mitigasi: cek circular dependency saat save BOM.
- Risiko mismatch nilai persediaan:
  - mitigasi: semua movement dan update inventory item dalam satu transaction.

