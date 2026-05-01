Blueprint Lengkap Aplikasi POS (React + Supabase)
1. Arsitektur Sistem
Frontend: React (Vite/Next.js)
Backend: Supabase (PostgreSQL, Auth, Realtime)
Offline: IndexedDB (Dexie)
Printer: Bluetooth (Web Bluetooth / Capacitor)
State Management: Zustand / Redux Toolkit
2. Struktur Project React
src/
 ├── modules/
 │   ├── pos/
 │   ├── inventory/
 │   ├── accounting/
 │   ├── settings/
 ├── services/
 ├── store/
 ├── hooks/
 ├── components/
3. Database Schema
Schema: public
- tenants (id, name, owner_id)
- users (id, tenant_id)

Schema: pos
- pos_sales (id, tenant_id, invoice_number, total, payment_method, created_at)
- pos_sale_items (id, sale_id, product_id, qty, price)

Schema: inventory
- products (id, tenant_id, name, price, stock)
- stock_movements (id, product_id, qty, type)

Schema: accounting
- journal_entries (id, tenant_id, date, description)
- journal_lines (id, journal_id, account, debit, credit)
4. Multi Tenant
Gunakan tenant_id di semua tabel
Gunakan Row Level Security (RLS)
Setiap user hanya akses datanya sendiri
5. Flow Transaksi
1. Kasir input transaksi
2. Simpan ke pos_sales
3. Simpan item ke pos_sale_items
4. Trigger:
   - Update stok
   - Buat jurnal akuntansi
6. Contoh Trigger SQL
CREATE FUNCTION handle_pos_sale()
RETURNS trigger AS $$
BEGIN
  UPDATE inventory.products
  SET stock = stock - NEW.qty
  WHERE id = NEW.product_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
7. Bluetooth Printer
Tabel printers:
- id
- tenant_id
- name
- address
- type

Support:
- Multi printer
- ESC/POS command
8. Offline First
Gunakan IndexedDB
Simpan transaksi lokal saat offline
Sync saat online
9. Sync Engine
Ambil data belum sync
Kirim ke Supabase
Update status synced
