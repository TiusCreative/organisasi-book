"use client"

import { useMemo, useState, useTransition } from "react"
import { Button } from "@/components/ui/Button"
import { Input } from "@/components/ui/Input"
import { Select } from "@/components/ui/Select"
import { Modal } from "@/components/ui/Modal"
import { DataTable, ColumnDef } from "@/components/ui/DataTable"
import { Badge } from "@/components/ui/Badge"
import { Alert } from "@/components/ui/Alert"
import BarcodeScannerModal from "@/components/ui/BarcodeScannerModal"
import {
  completeStockOpname,
  createInventoryItem,
  createInventoryMovement,
  createStockOpname,
  getInventoryItems,
  getInventoryMovements,
  getStockOpnames,
} from "@/app/actions/inventory"
import { createWarehouse, getWarehouses } from "@/app/actions/work-order"
import { Box, Boxes, ClipboardCheck, FileDown, Printer, Send, Warehouse } from "lucide-react"

type InventoryManagerProps = {
  initialItems: InventoryItemRow[]
  warehouses: WarehouseRow[]
  stockOpnames: StockOpnameRow[]
  movements: InventoryMovementRow[]
  organizationId: string
}

type WarehouseRow = {
  id: string
  code: string
  name: string
  location?: string | null
  type: string
  manager?: { id: string; name: string } | null
}

type InventoryItemRow = {
  id: string
  warehouseId: string
  code: string
  barcode?: string | null
  name: string
  unit: string
  quantity: number
  minStock: number
  unitCost: number
  totalValue: number
  warehouse?: { code: string; name: string } | null
}

type StockOpnameItemRow = {
  id: string
  difference: number
}

type StockOpnameRow = {
  id: string
  code: string
  opnameDate: string | Date
  status: string
  warehouse?: { code: string; name: string } | null
  items?: StockOpnameItemRow[]
}

type InventoryMovementRow = {
  id: string
  createdAt: string | Date
  movementType: string
  quantity: number
  reference?: string | null
  item?: { code: string; name: string; barcode?: string | null; unit: string } | null
}

function formatCurrency(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount || 0)
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("id-ID")
}

export default function InventoryManager({ initialItems, warehouses: initialWarehouses, stockOpnames: initialStockOpnames, movements: initialMovements, organizationId }: InventoryManagerProps) {
  const [activeTab, setActiveTab] = useState<"items" | "warehouses" | "opname" | "report">("items")
  const [items, setItems] = useState(initialItems)
  const [warehouses, setWarehouses] = useState(initialWarehouses)
  const [stockOpnames, setStockOpnames] = useState(initialStockOpnames)
  const [movements, setMovements] = useState(initialMovements)
  const [message, setMessage] = useState("")
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const [showItemModal, setShowItemModal] = useState(false)
  const [showWarehouseModal, setShowWarehouseModal] = useState(false)
  const [showOpnameModal, setShowOpnameModal] = useState(false)
  const [scannerOpen, setScannerOpen] = useState(false)
  const [scannerMode, setScannerMode] = useState<"item_barcode" | "opname_item">("item_barcode")
  const [opnameScanValue, setOpnameScanValue] = useState("")

  const [itemForm, setItemForm] = useState({
    warehouseId: "",
    code: "",
    barcode: "",
    name: "",
    category: "",
    itemType: "GENERAL",
    unit: "pcs",
    secondaryUnit: "",
    conversionRate: 1,
    shelf: "",
    row: "",
    level: "",
    bin: "",
    valuationMethod: "AVERAGE",
    quantity: 0,
    minStock: 0,
    maxStock: 0,
    reorderPoint: 0,
    safetyStock: 0,
    unitCost: 0,
  })

  const [warehouseForm, setWarehouseForm] = useState({
    code: "",
    name: "",
    location: "",
    type: "MAIN",
  })

  const [opnameForm, setOpnameForm] = useState({
    warehouseId: "",
    code: `SO-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}-${Date.now().toString().slice(-4)}`,
    itemId: "",
    physicalQty: 0,
  })

  const summary = useMemo(() => {
    const totalSku = items.length
    const totalStockValue = items.reduce((sum, row) => sum + row.totalValue, 0)
    const lowStockCount = items.filter((row) => row.quantity <= row.minStock).length
    const totalWarehouses = warehouses.length

    return { totalSku, totalStockValue, lowStockCount, totalWarehouses }
  }, [items, warehouses])

  const openScanner = (mode: "item_barcode" | "opname_item") => {
    setScannerMode(mode)
    setScannerOpen(true)
  }

  const selectOpnameItemByCode = (rawValue: string) => {
    const value = String(rawValue || "").trim()
    if (!value) return

    setOpnameScanValue(value)
    const normalized = value.toLowerCase()
    const scoped = items.filter((row) => !opnameForm.warehouseId || row.warehouseId === opnameForm.warehouseId)
    const matched =
      scoped.find((row) => (row.barcode || "").trim().toLowerCase() === normalized) ??
      scoped.find((row) => row.code.trim().toLowerCase() === normalized)

    if (!matched) {
      setError(`Item dengan barcode/SKU "${value}" tidak ditemukan di gudang terpilih.`)
      return
    }

    setError("")
    setOpnameForm((prev) => ({
      ...prev,
      warehouseId: prev.warehouseId || matched.warehouseId,
      itemId: matched.id,
    }))
  }

  const handleDetectedCode = (rawValue: string) => {
    const value = String(rawValue || "").trim()
    if (!value) return

    if (scannerMode === "item_barcode") {
      setItemForm((prev) => ({ ...prev, barcode: value }))
      return
    }

    selectOpnameItemByCode(value)
  }

  const refreshAll = async () => {
    const [nextItems, nextWarehouses, nextStockOpnames, nextMovements] = await Promise.all([
      getInventoryItems(organizationId),
      getWarehouses(organizationId),
      getStockOpnames(organizationId),
      getInventoryMovements(organizationId),
    ])

    setItems(nextItems)
    setWarehouses(nextWarehouses)
    setStockOpnames(nextStockOpnames)
    setMovements(nextMovements)
  }

  const submitCreateItem = () => {
    startTransition(async () => {
      try {
        setError("")
        await createInventoryItem({
          organizationId,
          warehouseId: itemForm.warehouseId,
          code: itemForm.code,
          barcode: itemForm.barcode || undefined,
          name: itemForm.name,
          category: itemForm.category || undefined,
          unit: itemForm.unit,
          quantity: Number(itemForm.quantity),
          minStock: Number(itemForm.minStock),
          unitCost: Number(itemForm.unitCost),
        })

        await refreshAll()
        setShowItemModal(false)
        setMessage("Barang berhasil ditambahkan ke gudang.")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menambah barang")
      }
    })
  }

  const submitCreateWarehouse = () => {
    startTransition(async () => {
      try {
        setError("")
        await createWarehouse({
          organizationId,
          code: warehouseForm.code,
          name: warehouseForm.name,
          location: warehouseForm.location || undefined,
          type: warehouseForm.type,
        })

        await refreshAll()
        setShowWarehouseModal(false)
        setMessage("Gudang baru berhasil ditambahkan.")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menambah gudang")
      }
    })
  }

  const submitStockOpname = () => {
    const selectedItem = items.find((row) => row.id === opnameForm.itemId)
    if (!selectedItem) {
      setError("Pilih item untuk stock opname.")
      return
    }

    startTransition(async () => {
      try {
        setError("")
        await createStockOpname({
          organizationId,
          warehouseId: opnameForm.warehouseId,
          code: opnameForm.code,
          opnameDate: new Date(),
          items: [
            {
              itemId: selectedItem.id,
              systemQuantity: selectedItem.quantity,
              physicalQuantity: Number(opnameForm.physicalQty),
              unitCost: selectedItem.unitCost,
            },
          ],
        })

        await refreshAll()
        setShowOpnameModal(false)
        setMessage("Stock opname berhasil dibuat.")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal membuat stock opname")
      }
    })
  }

  const applyStockOpname = (id: string) => {
    startTransition(async () => {
      try {
        setError("")
        const result = await completeStockOpname(id)
        await refreshAll()
        if (result?.pendingApproval) {
          setMessage("Stock opname menunggu approval MANAGER/ADMIN.")
        } else {
          setMessage("Stock opname selesai. Stok sistem sudah disesuaikan.")
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menyelesaikan stock opname")
      }
    })
  }

  const adjustStockQuick = (itemId: string, movementType: "IN" | "OUT", qty: number) => {
    startTransition(async () => {
      try {
        setError("")
        const target = items.find((row) => row.id === itemId)
        if (!target) return

        await createInventoryMovement({
          organizationId,
          itemId,
          movementType,
          quantity: qty,
          unitCost: target.unitCost,
          reference: `MANUAL-${new Date().toISOString().slice(0, 10)}`,
          description: movementType === "IN" ? "Penambahan stok manual" : "Pengurangan stok manual",
        })

        await refreshAll()
        setMessage(`Mutasi stok ${movementType} berhasil diproses.`)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memproses mutasi stok")
      }
    })
  }

  const buildWhatsappText = () => {
    const topItems = items
      .slice()
      .sort((a, b) => b.totalValue - a.totalValue)
      .slice(0, 12)
      .map((row) => `- ${row.code} ${row.name} | ${row.quantity} ${row.unit} | ${formatCurrency(row.totalValue)} | Barcode: ${row.barcode || "-"}`)
      .join("\n")

    return [
      "*LAPORAN GUDANG / INVENTORY*",
      "",
      `Total Gudang: ${summary.totalWarehouses}`,
      `Total SKU: ${summary.totalSku}`,
      `Nilai Stok: ${formatCurrency(summary.totalStockValue)}`,
      `Low Stock: ${summary.lowStockCount}`,
      "",
      "Top Item:",
      topItems,
    ].join("\n")
  }

  const shareWhatsapp = () => {
    window.open(`https://wa.me/?text=${encodeURIComponent(buildWhatsappText())}`, "_blank", "noopener,noreferrer")
  }

  const printReport = () => {
    window.print()
  }

  const downloadPdf = () => {
    const printWindow = window.open("", "_blank", "width=1024,height=768")
    if (!printWindow) return

    const html = `
      <html>
        <head>
          <title>Laporan Gudang</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
            table { border-collapse: collapse; width: 100%; margin-top: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; }
            th { background: #e2e8f0; text-align: left; }
          </style>
        </head>
        <body>
          <h1>Laporan Gudang / Inventory</h1>
          <p>Total Gudang: ${summary.totalWarehouses} | Total SKU: ${summary.totalSku} | Nilai Stok: ${formatCurrency(summary.totalStockValue)}</p>
          <table>
            <thead>
              <tr><th>Kode</th><th>Barcode</th><th>Nama</th><th>Qty</th><th>Gudang</th><th>Nilai</th></tr>
            </thead>
            <tbody>
              ${items
                .map(
                  (row) =>
                    `<tr><td>${row.code}</td><td>${row.barcode || "-"}</td><td>${row.name}</td><td>${row.quantity} ${row.unit}</td><td>${row.warehouse?.code || "-"}</td><td>${formatCurrency(row.totalValue)}</td></tr>`
                )
                .join("")}
            </tbody>
          </table>
          <script>window.print()</script>
        </body>
      </html>
    `

    printWindow.document.open()
    printWindow.document.write(html)
    printWindow.document.close()
  }

  return (
    <div className="space-y-4" id="inventory-report-print">
      <BarcodeScannerModal
        open={scannerOpen}
        title="Scan Barcode / QR"
        description={scannerMode === "opname_item" ? "Scan barcode/SKU untuk memilih item stock opname." : "Scan untuk mengisi barcode item."}
        onClose={() => setScannerOpen(false)}
        onDetected={handleDetectedCode}
      />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-sm text-blue-700">Total SKU</div>
          <div className="text-2xl font-bold text-blue-900">{summary.totalSku}</div>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="text-sm text-indigo-700">Multi Warehouse</div>
          <div className="text-2xl font-bold text-indigo-900">{summary.totalWarehouses}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm text-amber-700">Low Stock</div>
          <div className="text-2xl font-bold text-amber-900">{summary.lowStockCount}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-sm text-emerald-700">Nilai Stok</div>
          <div className="text-2xl font-bold text-emerald-900">{formatCurrency(summary.totalStockValue)}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <button onClick={() => setActiveTab("items")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "items" ? "bg-blue-600 text-white" : "bg-slate-100"}`}>
          <Box size={16} className="inline mr-1" /> Barang
        </button>
        <button onClick={() => setActiveTab("warehouses")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "warehouses" ? "bg-blue-600 text-white" : "bg-slate-100"}`}>
          <Warehouse size={16} className="inline mr-1" /> Gudang
        </button>
        <button onClick={() => setActiveTab("opname")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "opname" ? "bg-blue-600 text-white" : "bg-slate-100"}`}>
          <ClipboardCheck size={16} className="inline mr-1" /> Stock Opname
        </button>
        <button onClick={() => setActiveTab("report")} className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "report" ? "bg-blue-600 text-white" : "bg-slate-100"}`}>
          <Boxes size={16} className="inline mr-1" /> Laporan
        </button>
        <Button variant={activeTab === "items" ? "primary" : "ghost"} onClick={() => setActiveTab("items")}>
          <Box size={16} className="inline mr-2" /> Barang
        </Button>
        <Button variant={activeTab === "warehouses" ? "primary" : "ghost"} onClick={() => setActiveTab("warehouses")}>
          <Warehouse size={16} className="inline mr-2" /> Gudang
        </Button>
        <Button variant={activeTab === "opname" ? "primary" : "ghost"} onClick={() => setActiveTab("opname")}>
          <ClipboardCheck size={16} className="inline mr-2" /> Stock Opname
        </Button>
        <Button variant={activeTab === "report" ? "primary" : "ghost"} onClick={() => setActiveTab("report")}>
          <Boxes size={16} className="inline mr-2" /> Laporan
        </Button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}
      <div className="space-y-2">
        {error && <Alert variant="error" onClose={() => setError("")}>{error}</Alert>}
        {message && <Alert variant="success" onClose={() => setMessage("")}>{message}</Alert>}
      </div>

      {activeTab === "items" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowItemModal(true)} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">+ Tambah Barang</button>
            <Button variant="primary" onClick={() => setShowItemModal(true)}>+ Tambah Barang</Button>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-bold">Kode</th>
                    <th className="px-4 py-3 font-bold">Barcode</th>
                    <th className="px-4 py-3 font-bold">Nama</th>
                    <th className="px-4 py-3 font-bold">Jenis</th>
                    <th className="px-4 py-3 font-bold">Lokasi</th>
                    <th className="px-4 py-3 font-bold">Stok</th>
                    <th className="px-4 py-3 font-bold">Gudang</th>
                    <th className="px-4 py-3 font-bold">Nilai</th>
                    <th className="px-4 py-3 font-bold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{row.code}</td>
                      <td className="px-4 py-3">{row.barcode || "-"}</td>
                      <td className="px-4 py-3">{row.name}</td>
                      <td className="px-4 py-3">{row.quantity} {row.unit}</td>
                      <td className="px-4 py-3">{row.warehouse?.code} - {row.warehouse?.name}</td>
                      <td className="px-4 py-3">{formatCurrency(row.totalValue)}</td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          <button onClick={() => adjustStockQuick(row.id, "IN", 1)} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">+1</button>
                          <button onClick={() => adjustStockQuick(row.id, "OUT", 1)} className="rounded bg-rose-600 px-2 py-1 text-xs font-semibold text-white">-1</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          <DataTable
            columns={[
              { header: "Kode", cell: (row) => <span className="font-semibold text-slate-800">{row.code}</span> },
              { header: "Barcode", cell: (row) => row.barcode || "-" },
              { header: "Nama", cell: (row) => row.name },
              { header: "Stok", cell: (row) => `${row.quantity} ${row.unit}` },
              { header: "Gudang", cell: (row) => `${row.warehouse?.code} - ${row.warehouse?.name}` },
              { header: "Nilai", cell: (row) => formatCurrency(row.totalValue) },
              {
                header: "Aksi",
                cell: (row) => (
                  <div className="flex gap-2">
                    <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => adjustStockQuick(row.id, "IN", 1)}>+1</Button>
                    <Button size="sm" variant="danger" onClick={() => adjustStockQuick(row.id, "OUT", 1)}>-1</Button>
                  </div>
                )
              }
            ]}
            data={items}
            emptyState={<div className="p-8 text-center text-slate-500">Belum ada barang.</div>}
          />
        </div>
      )}

      {activeTab === "warehouses" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowWarehouseModal(true)} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700">+ Tambah Gudang</button>
            <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={() => setShowWarehouseModal(true)}>+ Tambah Gudang</Button>
          </div>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {warehouses.map((wh) => (
              <div key={wh.id} className="rounded-xl border border-slate-200 bg-white p-4">
                <div className="font-bold text-slate-800">{wh.code} - {wh.name}</div>
                <div className="mt-1 text-sm text-slate-600">{wh.type} | {wh.location || "-"}</div>
                <div className="text-xs text-slate-500">Manager: {wh.manager?.name || "-"}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {activeTab === "opname" && (
        <div className="space-y-3">
          <div className="flex justify-end">
            <button onClick={() => setShowOpnameModal(true)} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700">+ Buat Stock Opname</button>
            <Button className="bg-amber-600 text-white hover:bg-amber-700" onClick={() => setShowOpnameModal(true)}>+ Buat Stock Opname</Button>
          </div>
          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-bold">Kode</th>
                    <th className="px-4 py-3 font-bold">Gudang</th>
                    <th className="px-4 py-3 font-bold">Tanggal</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Selisih</th>
                    <th className="px-4 py-3 font-bold">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {stockOpnames.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3 font-semibold text-slate-800">{row.code}</td>
                      <td className="px-4 py-3">{row.warehouse?.code} - {row.warehouse?.name}</td>
                      <td className="px-4 py-3">{formatDate(row.opnameDate)}</td>
                      <td className="px-4 py-3">{row.status}</td>
                      <td className="px-4 py-3">
                        {row.items?.reduce((sum: number, item) => sum + (item.difference || 0), 0) || 0}
                      </td>
                      <td className="px-4 py-3">
                        {row.status !== "COMPLETED" && (
                          <button onClick={() => applyStockOpname(row.id)} className="rounded bg-emerald-600 px-2 py-1 text-xs font-semibold text-white">Selesaikan</button>
                        )}
                      </td>
                    </tr>
                  ))}
                  {stockOpnames.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Belum ada stock opname.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
          <DataTable
            columns={[
              { header: "Kode", cell: (row) => <span className="font-semibold text-slate-800">{row.code}</span> },
              { header: "Gudang", cell: (row) => `${row.warehouse?.code} - ${row.warehouse?.name}` },
              { header: "Tanggal", cell: (row) => formatDate(row.opnameDate) },
              { header: "Status", cell: (row) => <Badge variant={row.status === "COMPLETED" ? "success" : "warning"}>{row.status}</Badge> },
              { header: "Selisih", cell: (row) => row.items?.reduce((sum: number, item) => sum + (item.difference || 0), 0) || 0 },
              { header: "Aksi", cell: (row) => row.status !== "COMPLETED" ? <Button size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700" onClick={() => applyStockOpname(row.id)}>Selesaikan</Button> : "-" }
            ]}
            data={stockOpnames}
            emptyState={<div className="p-8 text-center text-slate-500">Belum ada stock opname.</div>}
          />
        </div>
      )}

      {activeTab === "report" && (
        <div className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <button onClick={shareWhatsapp} className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700"><Send size={16} /> WhatsApp</button>
            <button onClick={printReport} className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"><Printer size={16} /> Cetak</button>
            <button onClick={downloadPdf} className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700"><FileDown size={16} /> PDF</button>
            <Button className="bg-green-600 text-white hover:bg-green-700" onClick={shareWhatsapp}><Send size={16} className="mr-2" /> WhatsApp</Button>
            <Button className="bg-slate-700 text-white hover:bg-slate-800" onClick={printReport}><Printer size={16} className="mr-2" /> Cetak</Button>
            <Button className="bg-rose-600 text-white hover:bg-rose-700" onClick={downloadPdf}><FileDown size={16} className="mr-2" /> PDF</Button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="p-4 border-b border-slate-100 font-bold text-slate-800">Mutasi Stok Terakhir</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-bold">Tanggal</th>
                    <th className="px-4 py-3 font-bold">Item</th>
                    <th className="px-4 py-3 font-bold">Barcode</th>
                    <th className="px-4 py-3 font-bold">Tipe</th>
                    <th className="px-4 py-3 font-bold">Qty</th>
                    <th className="px-4 py-3 font-bold">Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((row) => (
                    <tr key={row.id}>
                      <td className="px-4 py-3">{formatDate(row.createdAt)}</td>
                      <td className="px-4 py-3">{row.item?.code} - {row.item?.name}</td>
                      <td className="px-4 py-3">{row.item?.barcode || "-"}</td>
                      <td className="px-4 py-3">{row.movementType}</td>
                      <td className="px-4 py-3">{row.quantity} {row.item?.unit}</td>
                      <td className="px-4 py-3">{row.reference || "-"}</td>
                    </tr>
                  ))}
                  {movements.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Belum ada mutasi stok.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            <DataTable
              columns={[
                { header: "Tanggal", cell: (row) => formatDate(row.createdAt) },
                { header: "Item", cell: (row) => `${row.item?.code} - ${row.item?.name}` },
                { header: "Barcode", cell: (row) => row.item?.barcode || "-" },
                { header: "Tipe", cell: (row) => <Badge variant="default">{row.movementType}</Badge> },
                { header: "Qty", cell: (row) => `${row.quantity} ${row.item?.unit}` },
                { header: "Ref", cell: (row) => row.reference || "-" },
              ]}
              data={movements}
              emptyState={<div className="p-8 text-center text-slate-500">Belum ada mutasi stok.</div>}
            />
          </div>
        </div>
      )}

      <Modal isOpen={showItemModal} onClose={() => setShowItemModal(false)} title="Tambah Barang + Barcode + Lokasi Rak" maxWidth="3xl">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Select value={itemForm.warehouseId} onChange={(e) => setItemForm({ ...itemForm, warehouseId: e.target.value })}>
            <option value="">Pilih Gudang</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>{wh.code} - {wh.name}</option>
            ))}
          </Select>
          <Input value={itemForm.code} onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })} placeholder="SKU / Kode Barang" />
          <div className="flex gap-2">
            <Input value={itemForm.barcode} onChange={(e) => setItemForm({ ...itemForm, barcode: e.target.value })} placeholder="Barcode" />
            <Button variant="outline" type="button" onClick={() => openScanner("item_barcode")}>Scan</Button>
          </div>
          <Input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="Nama Barang" />
          <Input value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} placeholder="Kategori" />
          <Select value={itemForm.itemType} onChange={(e) => setItemForm({ ...itemForm, itemType: e.target.value })}>
            <option value="GENERAL">Umum</option>
            <option value="COIL">Coil</option>
            <option value="RAW_MATERIAL">Bahan Baku</option>
            <option value="FINISHED_GOOD">Barang Jadi</option>
            <option value="SEMI_FINISHED">Setengah Jadi</option>
          </Select>
          <Input value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} placeholder="Satuan (pcs, kg, dll)" />
          <Input value={itemForm.secondaryUnit} onChange={(e) => setItemForm({ ...itemForm, secondaryUnit: e.target.value })} placeholder="Satuan Sekunder (dus, koli, dll)" />
          <Input type="number" value={itemForm.conversionRate} onChange={(e) => setItemForm({ ...itemForm, conversionRate: Number(e.target.value) })} placeholder="Konversi (1 dus = X pcs)" />
          <Select value={itemForm.valuationMethod} onChange={(e) => setItemForm({ ...itemForm, valuationMethod: e.target.value })}>
            <option value="AVERAGE">Rata-rata (Average)</option>
            <option value="FIFO">FIFO</option>
            <option value="LIFO">LIFO</option>
            <option value="STANDARD">Standar (Standard Cost)</option>
          </Select>
          <Input value={itemForm.shelf} onChange={(e) => setItemForm({ ...itemForm, shelf: e.target.value })} placeholder="Rak (A, B, C)" />
          <Input value={itemForm.row} onChange={(e) => setItemForm({ ...itemForm, row: e.target.value })} placeholder="Baris (1, 2, 3)" />
          <Input value={itemForm.level} onChange={(e) => setItemForm({ ...itemForm, level: e.target.value })} placeholder="Tingkat (1, 2, 3)" />
          <Input value={itemForm.bin} onChange={(e) => setItemForm({ ...itemForm, bin: e.target.value })} placeholder="Bin/Kompartemen" />
          <Input type="number" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: Number(e.target.value) })} placeholder="Qty Awal" />
          <Input type="number" value={itemForm.minStock} onChange={(e) => setItemForm({ ...itemForm, minStock: Number(e.target.value) })} placeholder="Min Stock" />
          <Input type="number" value={itemForm.maxStock} onChange={(e) => setItemForm({ ...itemForm, maxStock: Number(e.target.value) })} placeholder="Max Stock" />
          <Input type="number" value={itemForm.reorderPoint} onChange={(e) => setItemForm({ ...itemForm, reorderPoint: Number(e.target.value) })} placeholder="Reorder Point" />
          <Input type="number" value={itemForm.safetyStock} onChange={(e) => setItemForm({ ...itemForm, safetyStock: Number(e.target.value) })} placeholder="Safety Stock" />
          <Input type="number" value={itemForm.unitCost} onChange={(e) => setItemForm({ ...itemForm, unitCost: Number(e.target.value) })} placeholder="Harga Modal" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowItemModal(false)}>Batal</Button>
          <Button variant="primary" onClick={submitCreateItem} isLoading={isPending}>Simpan</Button>
        </div>
      </Modal>

      <Modal isOpen={showWarehouseModal} onClose={() => setShowWarehouseModal(false)} title="Tambah Gudang / Cabang" maxWidth="xl">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
          <Input value={warehouseForm.code} onChange={(e) => setWarehouseForm({ ...warehouseForm, code: e.target.value })} placeholder="Kode Gudang" />
          <Input value={warehouseForm.name} onChange={(e) => setWarehouseForm({ ...warehouseForm, name: e.target.value })} placeholder="Nama Gudang" />
          <Input value={warehouseForm.location} onChange={(e) => setWarehouseForm({ ...warehouseForm, location: e.target.value })} placeholder="Lokasi" />
          <Select value={warehouseForm.type} onChange={(e) => setWarehouseForm({ ...warehouseForm, type: e.target.value })}>
            <option value="MAIN">MAIN</option>
            <option value="BRANCH">BRANCH</option>
            <option value="TRANSIT">TRANSIT</option>
          </Select>
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowWarehouseModal(false)}>Batal</Button>
          <Button className="bg-indigo-600 text-white hover:bg-indigo-700" onClick={submitCreateWarehouse} isLoading={isPending}>Simpan</Button>
        </div>
      </Modal>

      <Modal isOpen={showOpnameModal} onClose={() => setShowOpnameModal(false)} title="Stock Opname" maxWidth="xl">
        <div className="grid grid-cols-1 gap-3">
          <Select value={opnameForm.warehouseId} onChange={(e) => setOpnameForm({ ...opnameForm, warehouseId: e.target.value })}>
            <option value="">Pilih Gudang</option>
            {warehouses.map((wh) => (
              <option key={wh.id} value={wh.id}>{wh.code} - {wh.name}</option>
            ))}
          </Select>
          <Input value={opnameForm.code} onChange={(e) => setOpnameForm({ ...opnameForm, code: e.target.value })} placeholder="Kode SO" />
          <div className="flex gap-2">
            <Input
              value={opnameScanValue}
              onChange={(e) => setOpnameScanValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") selectOpnameItemByCode(opnameScanValue)
              }}
              placeholder="Scan/Input barcode atau SKU"
            />
            <Button variant="outline" type="button" onClick={() => selectOpnameItemByCode(opnameScanValue)}>Cari</Button>
            <Button variant="primary" type="button" onClick={() => openScanner("opname_item")}>Scan</Button>
          </div>
          <Select value={opnameForm.itemId} onChange={(e) => setOpnameForm({ ...opnameForm, itemId: e.target.value })}>
            <option value="">Pilih Barang</option>
            {items.filter((row) => !opnameForm.warehouseId || row.warehouseId === opnameForm.warehouseId).map((row) => (
              <option key={row.id} value={row.id}>{row.code} | {row.name} | Sistem: {row.quantity}</option>
            ))}
          </Select>
          <Input type="number" value={opnameForm.physicalQty} onChange={(e) => setOpnameForm({ ...opnameForm, physicalQty: Number(e.target.value) })} placeholder="Qty Fisik" />
        </div>
        <div className="mt-5 flex justify-end gap-2">
          <Button variant="outline" onClick={() => setShowOpnameModal(false)}>Batal</Button>
          <Button className="bg-amber-600 text-white hover:bg-amber-700 border-none" onClick={submitStockOpname} isLoading={isPending}>Simpan Opname</Button>
        </div>
      </Modal>
    </div>
  )
}
