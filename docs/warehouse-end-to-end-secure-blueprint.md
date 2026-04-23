# Warehouse End-to-End Secure Blueprint

Dokumen ini menjadi arah implementasi modul warehouse & inventory agar:

- Aman (secure-by-design, audit-ready, tenant-safe)
- Siap skala kecil, menengah, hingga besar
- Mendukung multi gudang, multi lokasi rak/bin, multi jenis barang
- Terintegrasi penuh dengan Work Order (WO), pembelian, penjualan, dan akuntansi

---

## 1) Tujuan & Scope

Blueprint ini mencakup:

1. Arsitektur data warehouse + inventory
2. Kontrol keamanan end-to-end
3. Pola transaksi stok yang konsisten
4. Integrasi costing dan jurnal akuntansi
5. Strategi scaling (small/medium/enterprise)
6. Tahapan implementasi bertahap (roadmap)

---

## 2) Prinsip Inti

1. Immutable Ledger
- Semua mutasi stok wajib lewat `InventoryMovement`/ledger.
- Tidak boleh update qty stok secara langsung tanpa movement.

2. Tenant Isolation Ketat
- Semua query/read/write wajib mem-filter `organizationId`.
- Tidak boleh ada akses silang antar organisasi.

3. Idempotent Transaction
- Setiap posting movement wajib pakai `idempotencyKey` agar tidak dobel posting.

4. Authorization by Scope
- Hak akses tidak hanya role, tapi juga scope gudang/lokasi.

5. Auditability Penuh
- Semua perubahan penting harus traceable: actor, waktu, alasan, before/after.

---

## 3) Domain Model Target

### 3.1 Master Item

- `ItemMaster` (SKU per organisasi)
- `ItemType` (`RAW_MATERIAL`, `SEMI_FINISHED`, `FINISHED_GOOD`, `CONSUMABLE`, dll)
- `Category`
- `UOM` + `UOMConversion`
- Opsional: `ItemVariant`

### 3.2 Struktur Lokasi Warehouse

- `Warehouse`
- `Zone`
- `Aisle`
- `Rack`
- `Bin` (slot terkecil, scan-able)

Catatan:
- Field lokasi flat (`shelf`, `row`, `level`, `bin`) bisa dipertahankan sementara.
- Jangka menengah disarankan migrasi ke entitas lokasi terstruktur.

### 3.3 Persediaan

- `StockLedger` (movement immutable)
- `StockBalance` (materialized balance per item+warehouse+bin)
- `CostLayer` (FIFO/Batch bila dipakai)
- `LotBatch` + expiry (FEFO/FIFO)
- `SerialNumber` (untuk barang serial tracked)

### 3.4 Operasional Warehouse

- `InboundReceipt` (PO/retur masuk)
- `PutawayTask`
- `PickTask`
- `TransferOrder` (antar gudang/antar bin)
- `Reservation/Allocation` (SO/WO)
- `CycleCount` & `StockOpname`

---

## 4) Security Blueprint (Wajib)

### 4.1 Access Control

- RBAC: `viewer`, `operator`, `supervisor`, `manager`, `auditor`, `admin`
- Scope ACL: warehouse-level dan optional location-level
- Approval matrix untuk transaksi sensitif:
  - stock adjustment besar
  - backdate transaction
  - write-off / scrap

#### 4.1.1 Petugas Gudang (Operator)

“Petugas gudang” direpresentasikan sebagai `User` (umumnya role `operator`/`supervisor`) yang:

- Memiliki akses modul warehouse untuk `organizationId` terkait.
- Memiliki scope gudang/lokasi (ACL) sesuai penugasan.
- Menjadi actor untuk aktivitas operasional (scan/complete task).

Penempatan pada domain operasional:

- `PickTask.assignedTo` / `PutawayTask.assignedTo` menyimpan petugas yang mengambil/menjalankan task.
- Event scan/audit menyimpan `scannedBy` (actor) untuk jejak audit.

### 4.2 Data Access Guard

Semua update/delete/find-first sensitif wajib:

- Memastikan user di organisasi aktif yang benar
- Menyertakan `organizationId` di `where`
- Menolak operasi bila record bukan milik organisasi aktif

### 4.3 Idempotency

Untuk endpoint movement:

- Client kirim `idempotencyKey`
- Simpan key + hash payload + status
- Retry request yang sama tidak membuat posting baru

### 4.4 Concurrency & Integrity

- Proses mutasi stok di satu transaksi DB
- Lock record stok saat update kuantitas
- Validasi anti stok negatif sebelum `OUT` (kecuali role/flow override khusus)

### 4.5 Audit Trail

Simpan:

- actor (`userId`)
- timestamp
- IP + user-agent
- reason/reference
- before/after untuk field kritis

---

## 5) Costing & Accounting Blueprint

### 5.1 Valuation Method

- `AVERAGE`: default small/medium
- `FIFO`: medium/enterprise dengan layer
- `STANDARD`: opsional untuk perusahaan tertentu
- `LIFO`: opsional (jika kebijakan perusahaan mengizinkan)

Catatan implementasi (saat ini):

- `InventoryItem.valuationMethod` menentukan cara `unitCost/totalValue` dihitung saat `IN/OUT/ADJUSTMENT`.
- Snapshot biaya transaksi disimpan di `InventoryMovement.unitCost` dan `InventoryMovement.totalCost`.
- Untuk `STANDARD`, `unitCost` item diperlakukan sebagai biaya standar (fixed), dan dipakai untuk valuasi stok.

### 5.2 Rule Costing

1. `IN` movement:
- Pembelian: pakai biaya pembelian
- Hasil WO: pakai `hppPerUnit` dari WO complete

2. `OUT` movement:
- Ambil cost sesuai method valuation
- Simpan snapshot `unitCost` & `totalCost` di movement

### 5.3 Jurnal Akuntansi (opsional bertahap)

- Issue material WO: Dr WIP / Cr Inventory
- Complete WO: Dr FG / Cr WIP
- Stock adjustment: akun selisih persediaan

---

## 6) Integrasi Work Order

Flow standar:

1. Release WO dari BOM
2. Issue material (`OUT`) -> stok berkurang + actual material cost naik
3. Input biaya non-material (labor/overhead/machine/subcontract/waste)
4. Complete WO -> receive FG (`IN`) dengan `unitCost = hppPerUnit`

Untuk multi-level BOM:

- Gunakan WO chain (semi-finished -> finished)
- Hindari duplikasi cost antar level
- Child WO menjadi input biaya material parent WO

---

## 7) Skalabilitas Per Tier

### 7.1 Small

- 1-3 gudang
- average costing
- stock opname periodik
- barcode basic

### 7.2 Medium

- multi gudang + transfer workflow
- location/bin control
- reservation/allocation
- dashboard variance dan replenishment

### 7.3 Enterprise

- event-driven posting pipeline
- CQRS read model untuk laporan berat
- partitioning ledger per periode
- advanced picking (wave/batch), FEFO, mobile scanner app

---

## 8) KPI Operasional

1. Inventory accuracy (%)
2. Stockout rate
3. Pick accuracy
4. Putaway lead time
5. Inventory turnover
6. WO cost variance
7. Failed posting rate & retry latency

---

## 9) Gap Analisa Cepat (Codebase Saat Ini)

Prioritas hardening awal:

1. Query update/delete warehouse belum selalu scoped by `organizationId`.
2. Beberapa flow inventory movement belum ketat validasi item ownership + anti negative stock.
3. Belum ada `idempotencyKey` untuk movement API.
4. Lokasi rak/bin masih field datar, belum model hierarki lokasi penuh.

---

## 10) Roadmap Implementasi

### Phase 0 - Security Hardening (Immediate)

1. Wajibkan `organizationId` di semua write query
2. Tambah anti negative stock guard yang konsisten
3. Tambah idempotency key di movement API
4. Audit trail standar untuk mutation penting

Deliverable:
- Integritas data naik signifikan, aman untuk operasional harian.

### Phase 1 - Ledger Discipline

1. Refactor semua update stok agar melalui ledger service tunggal
2. Pisahkan balance materialized vs source-of-truth ledger
3. Approval flow untuk adjustment sensitif

Deliverable:
- Satu jalur resmi mutasi stok, lebih mudah diaudit.

### Phase 2 - Multi Location Advance

1. Tambah model `Zone/Aisle/Rack/Bin`
2. Putaway/picking task berbasis lokasi
3. Transfer antar bin/gudang lebih terstruktur

Deliverable:
- Operasional multi gudang/rak/bin siap skala menengah.

### Phase 3 - Costing & Accounting Deep Integration

1. Valuation method: AVERAGE/FIFO/LIFO + STANDARD (opsional) + cost layer
2. Posting jurnal otomatis (inventory/WIP/COGM + variance untuk stock adjustment)
3. Rekonsiliasi inventory vs GL

Deliverable:
- Kontrol nilai persediaan dan cost produksi lebih akurat.

### Phase 4 - Enterprise Scale

1. Event-driven movement pipeline
2. Transactional outbox + retry/DLQ + replay tooling
3. CQRS reporting model + rebuild read model terkontrol
4. Ledger partitioning/archiving (per periode) + indexing strategy
5. SLA monitoring + alerting + load test + disaster recovery drill

Deliverable:
- Sistem siap beban besar dan audit enterprise.

### Phase 5 - Operational Excellence & Compliance

1. Compliance pack:
   - export audit trail (per periode/actor/module)
   - retention policy + akses auditor read-only
2. Security hardening lanjutan:
   - MFA untuk role sensitif + session hardening
   - secret/key rotation SOP + backup encryption
3. Rekonsiliasi otomatis:
   - ledger vs balance (harian)
   - inventory vs GL (mingguan/bulanan)
   - alert anomaly (stok negatif, lonjakan adjustment, backdate)
4. WMS automation:
   - mobile scanner (barcode/QR) untuk putaway/pick/cycle count
   - wave/batch picking + replenishment

Deliverable:
- Operasional stabil jangka panjang, audit/compliance siap, dan proses gudang makin otomatis.

#### 5.x Automation (Praktis)

Job yang disarankan dijalankan terjadwal (cron) dari environment ops:

- Daily ops summary (reconcile/anomalies/inventory-vs-GL):
  - `npm run ops:daily`
  - Env ops: `OPS_ORG_ID` (optional), `OPS_SINCE_DAYS`, `OPS_RECONCILE_THRESHOLD`, `OPS_ADJ_QTY_THRESHOLD`, `OPS_ADJ_COST_THRESHOLD`
- Retention outbox (default aman = dry-run):
  - `npm run ops:outbox:purge`
  - Env ops: `DRY_RUN=true|false`, `OUTBOX_SENT_DAYS`, `OUTBOX_DEAD_DAYS`, `OPS_ORG_ID` (optional)
- Retention audit trail (default aman = dry-run):
  - `npm run ops:audit:purge`
  - Env ops: `DRY_RUN=true|false`, `AUDIT_RETENTION_DAYS`, `OPS_ORG_ID` (optional), `ALLOW_ALL_ORGS=true` (untuk global)

### Phase 6 - Optimization & Ecosystem Integrations

1. WMS advanced workflow:
   - packing + label/manifest + staging shipment
   - pick path optimization (slotting/routing sederhana)
2. Integrasi eksternal:
   - courier/TMS (resi, tracking, shipping cost)
   - EDI/basic integration untuk PO/SO (opsional)
3. Enterprise identity & policy:
   - SSO (SAML/OIDC) + SCIM provisioning (opsional)
   - separation of duties (SoD) policy untuk transaksi sensitif
4. Analytics at scale:
   - export ke data warehouse/lake untuk BI
   - anomaly detection lebih advanced (opsional)

Deliverable:
- Ekosistem logistik end-to-end lebih matang, optimisasi picking/packing meningkat, dan integrasi enterprise siap.

---

## 11) Runbook Operasional Minimum

Untuk memastikan fitur WO + inventory berjalan:

```bash
npx prisma generate
npx prisma migrate deploy
npm run dev
curl -X POST http://localhost:3000/api/migrate
```

Opsional (ops endpoints, butuh `OPS_SECRET` di env):

```bash
curl -H "x-ops-secret: $OPS_SECRET" -X GET http://localhost:3000/api/ops/outbox
curl -H "x-ops-secret: $OPS_SECRET" -X POST "http://localhost:3000/api/ops/outbox?batchSize=200"
curl -H "x-ops-secret: $OPS_SECRET" -X POST http://localhost:3000/api/ops/read-model/warehouse/rebuild
curl -H "x-ops-secret: $OPS_SECRET" -X POST http://localhost:3000/api/ops/warehouse/reconcile -d '{"organizationId":"ORG_ID","threshold":0}'
curl -H "x-ops-secret: $OPS_SECRET" -X POST http://localhost:3000/api/ops/accounting/reconcile/inventory-gl -d '{"organizationId":"ORG_ID"}'
curl -H "x-ops-secret: $OPS_SECRET" -X POST http://localhost:3000/api/ops/warehouse/anomalies -d '{"organizationId":"ORG_ID","sinceDays":30}'
curl -H "x-ops-secret: $OPS_SECRET" -X POST http://localhost:3000/api/ops/audit/export -d '{"organizationId":"ORG_ID","limit":5000,"format":"json"}'
curl -H "x-ops-secret: $OPS_SECRET" -X POST http://localhost:3000/api/ops/outbox/purge -d '{"dryRun":true,"sentDays":30,"deadDays":180}'
curl -H "x-ops-secret: $OPS_SECRET" -X POST http://localhost:3000/api/ops/daily -d '{"organizationId":"ORG_ID","publishOutbox":true,"outboxBatchSize":50}'
```

---

## 12) Acceptance Criteria Blueprint

1. Semua mutasi stok bisa ditelusuri ke movement dan actor.
2. Tidak ada data lintas organisasi yang bisa terbaca/terubah.
3. Retry request tidak menimbulkan double posting.
4. Multi gudang + multi lokasi bisa dijalankan tanpa kehilangan traceability.
5. Nilai inventory konsisten dengan costing method dan jurnal (saat accounting integration aktif).
6. Read model/reporting bisa dibangun ulang tanpa mengubah source-of-truth ledger.
