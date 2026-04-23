"use client"

import { useMemo, useState, useTransition } from "react"
import {
  assignInventoryItemBin,
  createWarehouseAisle,
  createWarehouseBin,
  createWarehouseInventoryItem,
  createWarehouseInventoryMovement,
  createWarehouseRack,
  createWarehouseStockOpname,
  createWarehouseZone,
  createTransferOrderAndPost,
  deleteWarehouseLocation,
  getWarehouseAccountingReconciliation,
  getWarehouseModuleBootstrap,
  getWarehouseLocations,
  getWarehouseReportData,
  type WarehouseReportFilters,
  upsertWarehouseAccountingConfig,
} from "@/app/actions/warehouse-module"
import {
  completePickTask,
  createLotBatch,
  inboundToStagingAndCreatePutaway,
  createPickWaveAndTasks,
  createPutawayTask,
  completePutawayTask,
  getStockBalances,
  listPickTasks,
  listPickWaves,
  suggestFefoLotForItem,
} from "@/app/actions/warehouse-enterprise"
import type { PickTaskRow, PickWaveRow } from "@/app/actions/warehouse-enterprise"
import { createWarehouse, deleteWarehouse, updateWarehouse } from "@/app/actions/warehouse"
import { FileDown, Filter, MapPin, Package, Plus, Printer, RefreshCw, Send, Trash2, Warehouse } from "lucide-react"

type WarehouseRow = {
  id: string
  code: string
  name: string
  location?: string | null
  type: string
  status: string
  manager?: { id: string; name: string; email: string } | null
}

type UserRow = { id: string; name: string; email: string; role: string }

type AccountRow = { id: string; code: string; name: string; type: string; isHeader: boolean }

type InventoryItemRow = {
  id: string
  code: string
  barcode?: string | null
  name: string
  category?: string | null
  unit: string
  quantity: number
  unitCost: number
  totalValue: number
  shelf?: string | null
  row?: string | null
  level?: string | null
  bin?: string | null
  warehouse?: { id: string; code: string; name: string } | null
}

type MovementRow = {
  id: string
  movementType: string
  quantity: number
  unitCost?: number | null
  totalCost?: number | null
  reference?: string | null
  description?: string | null
  createdAt: string | Date
  item?: {
    id: string
    code: string
    barcode?: string | null
    name: string
    unit: string
    warehouse?: { id: string; code: string; name: string } | null
  } | null
}

type StockOpnameRow = {
  id: string
  code: string
  opnameDate: string | Date
  status: string
  notes?: string | null
  warehouse?: { id: string; code: string; name: string } | null
  items?: Array<{
    id: string
    systemQuantity: number
    physicalQuantity: number
    difference: number
    unitCost?: number | null
    totalDifference?: number | null
    item?: { id: string; code: string; name: string; unit: string } | null
  }>
}

type LocationRows = {
  zones: any[]
  aisles: any[]
  racks: any[]
  bins: any[]
}

type TransferOrderRow = {
  id: string
  code: string
  status: string
  fromWarehouseId: string
  toWarehouseId: string
  notes?: string | null
  createdBy?: string | null
  approvedBy?: string | null
  approvedAt?: string | Date | null
  movementOutId?: string | null
  movementInId?: string | null
  createdAt: string | Date
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 }).format(
    Number(value || 0),
  )
}

function formatDate(value: string | Date) {
  const date = typeof value === "string" ? new Date(value) : value
  return date.toLocaleString("id-ID")
}

function formatISODate(value: Date) {
  return value.toISOString().slice(0, 10)
}

export default function WarehouseModule(props: {
  organizationId: string
  organizationName: string
  warehouses: WarehouseRow[]
  users: UserRow[]
  accounts: AccountRow[]
  accountingConfig: any | null
  initialItems: InventoryItemRow[]
  initialMovements: MovementRow[]
  initialStockOpnames: StockOpnameRow[]
  initialTransferOrders: TransferOrderRow[]
  initialLocations: LocationRows
}) {
  const [activeTab, setActiveTab] = useState<"master" | "input" | "report" | "enterprise">("report")
  const [isPending, startTransition] = useTransition()

  const [warehouses, setWarehouses] = useState(props.warehouses)
  const [locations, setLocations] = useState<LocationRows>(props.initialLocations)

  const [items, setItems] = useState(props.initialItems)
  const [movements, setMovements] = useState(props.initialMovements)
  const [stockOpnames, setStockOpnames] = useState(props.initialStockOpnames)
  const [transferOrders, setTransferOrders] = useState(props.initialTransferOrders)
  const [recon, setRecon] = useState<any | null>(null)

  const [pickWaves, setPickWaves] = useState<PickWaveRow[]>([])
  const [pickTasks, setPickTasks] = useState<PickTaskRow[]>([])
  const [selectedWaveId, setSelectedWaveId] = useState<string>("")
  const [enterpriseWarehouseId, setEnterpriseWarehouseId] = useState<string>("")
  const [pickWaveForm, setPickWaveForm] = useState({
    orderReference: "",
    itemId: "",
    quantity: 1,
    fromBin: "",
    lotBatchCode: "",
    notes: "",
  })
  const [pickCompleteForm, setPickCompleteForm] = useState<Record<string, { scannedItem: string; scannedBin: string; scannedLot: string }>>({})
  const [putawayForm, setPutawayForm] = useState({
    warehouseId: "",
    inboundReference: "",
    itemId: "",
    quantity: 1,
    stagingBin: "",
    targetBin: "",
    unitCost: "",
    lotCode: "",
    lotExpiryDate: "",
  })
  const [putawayCompleteForm, setPutawayCompleteForm] = useState({ taskId: "", scannedTargetBin: "" })
  const [lotForm, setLotForm] = useState({ itemId: "", code: "", expiryDate: "" })
  const [binBalances, setBinBalances] = useState<
    Array<{
      id: string
      itemId: string
      itemCode: string
      itemName: string
      binCode: string | null
      lotCode: string | null
      quantity: number
      updatedAt: string
    }>
  >([])

  const [error, setError] = useState("")
  const [message, setMessage] = useState("")

  const [filters, setFilters] = useState<WarehouseReportFilters>(() => {
    const today = new Date()
    const start = new Date(today)
    start.setDate(start.getDate() - 30)
    return {
      warehouseId: "",
      q: "",
      movementType: "",
      startDate: formatISODate(start),
      endDate: formatISODate(today),
      opnameStatus: "",
    }
  })

  const summary = useMemo(() => {
    const totalSku = items.length
    const totalValue = items.reduce((sum, row) => sum + Number(row.totalValue || 0), 0)
    const lowStock = items.filter((row) => Number(row.quantity || 0) <= 0).length
    const totalWarehouses = new Set(items.map((row) => row.warehouse?.id).filter(Boolean)).size
    return { totalSku, totalValue, lowStock, totalWarehouses }
  }, [items])

  const itemsById = useMemo(() => {
    const map = new Map<string, InventoryItemRow>()
    for (const row of items) map.set(row.id, row)
    return map
  }, [items])

  const refreshReports = () => {
    startTransition(async () => {
      try {
        setError("")
        setMessage("")
        const data = await getWarehouseReportData(filters)
        setItems(data.items as any)
        setMovements(data.movements as any)
        setStockOpnames(data.stockOpnames as any)
        setTransferOrders((data as any).transferOrders || [])
        const r = await getWarehouseAccountingReconciliation(filters)
        setRecon(r as any)
        setMessage("Laporan berhasil diperbarui.")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat laporan")
      }
    })
  }

  const refreshLocations = (warehouseId?: string) => {
    startTransition(async () => {
      try {
        setError("")
        setMessage("")
        const next = await getWarehouseLocations({ warehouseId })
        setLocations(next as any)
        setMessage("Master lokasi berhasil diperbarui.")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat master lokasi")
      }
    })
  }

  const refreshPickWaves = (warehouseId?: string) => {
    startTransition(async () => {
      try {
        setError("")
        setMessage("")
        const waves = await listPickWaves({ warehouseId: warehouseId || undefined })
        setPickWaves(waves)
        setMessage("Pick waves berhasil dimuat.")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat pick waves")
      }
    })
  }

  const refreshPickTasks = (input?: { waveId?: string; warehouseId?: string; status?: string }) => {
    startTransition(async () => {
      try {
        setError("")
        setMessage("")
        const tasks = await listPickTasks(input || {})
        setPickTasks(tasks)
        setMessage("Pick tasks berhasil dimuat.")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat pick tasks")
      }
    })
  }

  const refreshBinBalances = (warehouseId?: string) => {
    startTransition(async () => {
      try {
        setError("")
        setMessage("")
        if (!warehouseId) throw new Error("Pilih warehouse untuk lihat bin stock.")
        const rows = await getStockBalances({ warehouseId })
        setBinBalances(rows)
        setMessage("Bin stock berhasil dimuat.")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memuat bin stock")
      }
    })
  }

  const buildWhatsappText = () => {
    const topItems = items
      .slice()
      .sort((a, b) => Number(b.totalValue || 0) - Number(a.totalValue || 0))
      .slice(0, 12)
      .map(
        (row) =>
          `- ${row.code} ${row.name} | ${row.quantity} ${row.unit} | ${formatCurrency(row.totalValue)} | WH: ${
            row.warehouse?.code || "-"
          } | Loc: ${(row.shelf || "-") + "/" + (row.row || "-") + "/" + (row.level || "-") + "/" + (row.bin || "-")}`,
      )
      .join("\n")

    const latestMoves = movements
      .slice(0, 10)
      .map(
        (m) =>
          `- ${formatDate(m.createdAt)} | ${m.movementType} | ${m.item?.code || "-"} ${m.item?.name || "-"} | ${
            m.quantity
          } ${m.item?.unit || ""} | Ref: ${m.reference || "-"}`,
      )
      .join("\n")

    const latestTransfers = transferOrders
      .slice(0, 8)
      .map((t) => `- ${formatDate(t.createdAt)} | ${t.code} | ${t.status} | ${t.fromWarehouseId} -> ${t.toWarehouseId}`)
      .join("\n")

    return [
      "*LAPORAN WAREHOUSE*",
      "",
      `Organisasi: ${props.organizationName}`,
      `Filter WH: ${filters.warehouseId || "ALL"}`,
      `Periode: ${filters.startDate || "-"} s/d ${filters.endDate || "-"}`,
      `Query: ${filters.q || "-"}`,
      `Movement: ${filters.movementType || "ALL"}`,
      `Opname: ${filters.opnameStatus || "ALL"}`,
      "",
      `Total SKU: ${summary.totalSku}`,
      `Total Gudang: ${summary.totalWarehouses}`,
      `Nilai Stok: ${formatCurrency(summary.totalValue)}`,
      `Stok Kosong (<=0): ${summary.lowStock}`,
      "",
      "*Top Item (nilai)*",
      topItems || "-",
      "",
      "*Mutasi Terakhir*",
      latestMoves || "-",
      "",
      "*Transfer Order Terakhir*",
      latestTransfers || "-",
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
          <title>Laporan Warehouse</title>
          <style>
            body { font-family: Arial, sans-serif; margin: 24px; color: #0f172a; }
            h1,h2 { margin: 0 0 8px 0; }
            .meta { color: #334155; font-size: 12px; margin-bottom: 16px; }
            table { border-collapse: collapse; width: 100%; margin-top: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; vertical-align: top; }
            th { background: #e2e8f0; text-align: left; }
          </style>
        </head>
        <body>
          <h1>Laporan Warehouse</h1>
          <div class="meta">
            Organisasi: ${props.organizationName}<br/>
            Periode: ${filters.startDate || "-"} s/d ${filters.endDate || "-"}<br/>
            Warehouse: ${filters.warehouseId || "ALL"}<br/>
            Query: ${filters.q || "-"}<br/>
            Movement: ${filters.movementType || "ALL"} | Opname: ${filters.opnameStatus || "ALL"}<br/>
            Total SKU: ${summary.totalSku} | Total Gudang: ${summary.totalWarehouses} | Nilai Stok: ${formatCurrency(
              summary.totalValue,
            )} | Stok Kosong (<=0): ${summary.lowStock}
          </div>

          <h2>Stok</h2>
          <table>
            <thead>
              <tr><th>Kode</th><th>Nama</th><th>Qty</th><th>Gudang</th><th>Lokasi</th><th>Nilai</th></tr>
            </thead>
            <tbody>
              ${items
                .slice(0, 1200)
                .map((row) => {
                  const loc = [row.shelf, row.row, row.level, row.bin].map((v) => v || "-").join("/")
                  return `<tr><td>${row.code}</td><td>${row.name}</td><td>${row.quantity} ${
                    row.unit
                  }</td><td>${row.warehouse?.code || "-"}</td><td>${loc}</td><td>${formatCurrency(
                    row.totalValue,
                  )}</td></tr>`
                })
                .join("")}
            </tbody>
          </table>

          <h2 style="margin-top:20px">Mutasi</h2>
          <table>
            <thead>
              <tr><th>Tanggal</th><th>Tipe</th><th>Item</th><th>Qty</th><th>Gudang</th><th>Ref</th></tr>
            </thead>
            <tbody>
              ${movements
                .slice(0, 800)
                .map((m) => {
                  return `<tr><td>${formatDate(m.createdAt)}</td><td>${m.movementType}</td><td>${
                    (m.item?.code || "-") + " " + (m.item?.name || "-")
                  }</td><td>${m.quantity} ${m.item?.unit || ""}</td><td>${m.item?.warehouse?.code || "-"}</td><td>${
                    m.reference || "-"
                  }</td></tr>`
                })
                .join("")}
            </tbody>
          </table>

          <h2 style="margin-top:20px">Transfer Order</h2>
          <table>
            <thead>
              <tr><th>Tanggal</th><th>Kode</th><th>Status</th><th>Dari</th><th>Ke</th><th>Notes</th></tr>
            </thead>
            <tbody>
              ${transferOrders
                .slice(0, 300)
                .map((t) => {
                  return `<tr><td>${formatDate(t.createdAt)}</td><td>${t.code}</td><td>${t.status}</td><td>${
                    t.fromWarehouseId
                  }</td><td>${t.toWarehouseId}</td><td>${t.notes || "-"}</td></tr>`
                })
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

  // Forms state (master + input)
  const [masterWarehouseId, setMasterWarehouseId] = useState<string>(warehouses[0]?.id || "")
  const [zoneForm, setZoneForm] = useState({ code: "", name: "", notes: "" })
  const [aisleForm, setAisleForm] = useState({ zoneId: "", code: "", name: "", notes: "" })
  const [rackForm, setRackForm] = useState({ aisleId: "", code: "", name: "", notes: "" })
  const [binForm, setBinForm] = useState({ rackId: "", code: "", name: "", barcode: "", notes: "" })

  const [assignForm, setAssignForm] = useState({ itemId: "", zoneCode: "", aisleCode: "", rackCode: "", binCode: "" })

  const [moveForm, setMoveForm] = useState({
    warehouseId: warehouses[0]?.id || "",
    itemId: "",
    movementType: "IN" as "IN" | "OUT" | "ADJUSTMENT",
    quantity: 1,
    unitCost: 0,
    reference: `MANUAL-${formatISODate(new Date())}`,
    description: "",
  })

  const [itemForm, setItemForm] = useState({
    warehouseId: warehouses[0]?.id || "",
    code: "",
    barcode: "",
    name: "",
    description: "",
    category: "",
    unit: "pcs",
    quantity: 0,
    unitCost: 0,
    minStock: 0,
    maxStock: 0,
  })

  const [opnameForm, setOpnameForm] = useState({
    warehouseId: warehouses[0]?.id || "",
    code: `SO-${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, "0")}`,
    opnameDate: formatISODate(new Date()),
    itemId: "",
    physicalQty: 0,
  })

  const [transferForm, setTransferForm] = useState({
    fromWarehouseId: warehouses[0]?.id || "",
    toWarehouseId: warehouses[1]?.id || warehouses[0]?.id || "",
    fromItemId: "",
    quantity: 1,
    notes: "",
  })

  const locationsByWarehouse = useMemo(() => {
    const wh = masterWarehouseId || undefined
    const zones = locations.zones.filter((z: any) => !wh || z.warehouseId === wh)
    const aisles = locations.aisles.filter((a: any) => !wh || a.warehouseId === wh)
    const racks = locations.racks.filter((r: any) => !wh || r.warehouseId === wh)
    const bins = locations.bins.filter((b: any) => !wh || b.warehouseId === wh)
    return { zones, aisles, racks, bins }
  }, [locations, masterWarehouseId])

  const [whModalOpen, setWhModalOpen] = useState(false)
  const [whEditing, setWhEditing] = useState<WarehouseRow | null>(null)
  const [whForm, setWhForm] = useState({
    name: "",
    location: "",
    type: "MAIN",
    managerId: "",
    status: "ACTIVE",
    notes: "",
  })

  const [accForm, setAccForm] = useState(() => ({
    inventoryAccountId: props.accountingConfig?.inventoryAccountId || "",
    wipAccountId: props.accountingConfig?.wipAccountId || "",
    finishedGoodsAccountId: props.accountingConfig?.finishedGoodsAccountId || "",
    inventoryVarianceAccountId: props.accountingConfig?.inventoryVarianceAccountId || "",
    cogsAccountId: props.accountingConfig?.cogsAccountId || "",
  }))

  const saveAccountingConfig = () => {
    startTransition(async () => {
      try {
        setError("")
        await upsertWarehouseAccountingConfig({
          inventoryAccountId: accForm.inventoryAccountId || null,
          wipAccountId: accForm.wipAccountId || null,
          finishedGoodsAccountId: accForm.finishedGoodsAccountId || null,
          inventoryVarianceAccountId: accForm.inventoryVarianceAccountId || null,
          cogsAccountId: accForm.cogsAccountId || null,
        })
        const boot = await getWarehouseModuleBootstrap()
        setMessage("Konfigurasi akun inventory tersimpan.")
        setAccForm({
          inventoryAccountId: (boot as any).accountingConfig?.inventoryAccountId || "",
          wipAccountId: (boot as any).accountingConfig?.wipAccountId || "",
          finishedGoodsAccountId: (boot as any).accountingConfig?.finishedGoodsAccountId || "",
          inventoryVarianceAccountId: (boot as any).accountingConfig?.inventoryVarianceAccountId || "",
          cogsAccountId: (boot as any).accountingConfig?.cogsAccountId || "",
        })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menyimpan konfigurasi akun")
      }
    })
  }

  const openCreateWarehouse = () => {
    setWhEditing(null)
    setWhForm({ name: "", location: "", type: "MAIN", managerId: "", status: "ACTIVE", notes: "" })
    setWhModalOpen(true)
  }

  const openEditWarehouse = (row: WarehouseRow) => {
    setWhEditing(row)
    setWhForm({
      name: row.name,
      location: row.location || "",
      type: row.type,
      managerId: row.manager?.id || "",
      status: row.status,
      notes: "",
    })
    setWhModalOpen(true)
  }

  const saveWarehouse = () => {
    startTransition(async () => {
      try {
        setError("")
        setMessage("")
        const fd = new FormData()
        fd.append("name", whForm.name)
        fd.append("location", whForm.location)
        fd.append("type", whForm.type)
        fd.append("managerId", whForm.managerId)
        fd.append("status", whForm.status)
        fd.append("notes", whForm.notes)

        if (whEditing) {
          fd.append("id", whEditing.id)
          await updateWarehouse(fd)
        } else {
          await createWarehouse(fd)
        }

        const boot = await getWarehouseModuleBootstrap()
        setWarehouses(boot.warehouses as any)
        if (!masterWarehouseId && boot.warehouses[0]?.id) {
          setMasterWarehouseId(boot.warehouses[0].id)
        }
        setWhModalOpen(false)
        setWhEditing(null)
        setMessage("Gudang berhasil disimpan.")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menyimpan gudang")
      }
    })
  }

  const removeWarehouse = (id: string) => {
    if (!confirm("Yakin ingin menghapus gudang ini?")) return
    startTransition(async () => {
      try {
        setError("")
        setMessage("")
        await deleteWarehouse(id)
        const boot = await getWarehouseModuleBootstrap()
        setWarehouses(boot.warehouses as any)
        const nextActive = boot.warehouses[0]?.id || ""
        if (masterWarehouseId === id) {
          setMasterWarehouseId(nextActive)
          refreshLocations(nextActive || undefined)
        }
        setMessage("Gudang berhasil dihapus.")
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menghapus gudang")
      }
    })
  }

  const submitZone = () => {
    startTransition(async () => {
      try {
        setError("")
        await createWarehouseZone({ warehouseId: masterWarehouseId, code: zoneForm.code, name: zoneForm.name, notes: zoneForm.notes })
        setZoneForm({ code: "", name: "", notes: "" })
        await refreshLocations(masterWarehouseId)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal membuat zone")
      }
    })
  }

  const submitAisle = () => {
    startTransition(async () => {
      try {
        setError("")
        await createWarehouseAisle({
          warehouseId: masterWarehouseId,
          zoneId: aisleForm.zoneId || null,
          code: aisleForm.code,
          name: aisleForm.name,
          notes: aisleForm.notes,
        })
        setAisleForm({ zoneId: "", code: "", name: "", notes: "" })
        await refreshLocations(masterWarehouseId)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal membuat aisle")
      }
    })
  }

  const submitRack = () => {
    startTransition(async () => {
      try {
        setError("")
        await createWarehouseRack({
          warehouseId: masterWarehouseId,
          aisleId: rackForm.aisleId || null,
          code: rackForm.code,
          name: rackForm.name,
          notes: rackForm.notes,
        })
        setRackForm({ aisleId: "", code: "", name: "", notes: "" })
        await refreshLocations(masterWarehouseId)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal membuat rack")
      }
    })
  }

  const submitBin = () => {
    startTransition(async () => {
      try {
        setError("")
        await createWarehouseBin({
          warehouseId: masterWarehouseId,
          rackId: binForm.rackId || null,
          code: binForm.code,
          name: binForm.name,
          barcode: binForm.barcode,
          notes: binForm.notes,
        })
        setBinForm({ rackId: "", code: "", name: "", barcode: "", notes: "" })
        await refreshLocations(masterWarehouseId)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal membuat bin")
      }
    })
  }

  const removeLocation = (table: "WarehouseZone" | "WarehouseAisle" | "WarehouseRack" | "WarehouseBin", id: string) => {
    if (!confirm("Yakin ingin menghapus data lokasi ini?")) return
    startTransition(async () => {
      try {
        setError("")
        await deleteWarehouseLocation({ table, id })
        await refreshLocations(masterWarehouseId)
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menghapus lokasi")
      }
    })
  }

  const submitAssign = () => {
    startTransition(async () => {
      try {
        setError("")
        await assignInventoryItemBin({
          itemId: assignForm.itemId,
          warehouseId: masterWarehouseId,
          zoneCode: assignForm.zoneCode,
          aisleCode: assignForm.aisleCode,
          rackCode: assignForm.rackCode,
          binCode: assignForm.binCode,
        })
        setAssignForm({ itemId: "", zoneCode: "", aisleCode: "", rackCode: "", binCode: "" })
        setMessage("Lokasi item berhasil di-assign.")
        await refreshReports()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal assign lokasi")
      }
    })
  }

  const submitMove = () => {
    startTransition(async () => {
      try {
        setError("")
        if (!moveForm.itemId) throw new Error("Item wajib dipilih.")
        await createWarehouseInventoryMovement({
          organizationId: props.organizationId,
          itemId: moveForm.itemId,
          movementType: moveForm.movementType,
          quantity: Number(moveForm.quantity || 0),
          unitCost: Number(moveForm.unitCost || 0) || undefined,
          reference: moveForm.reference || undefined,
          description: moveForm.description || undefined,
          idempotencyKey: crypto.randomUUID(),
        })
        setMessage("Mutasi stok berhasil diposting.")
        await refreshReports()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal posting mutasi")
      }
    })
  }

  const submitTransfer = () => {
    startTransition(async () => {
      try {
        setError("")
        if (!transferForm.fromItemId) throw new Error("Item asal wajib dipilih.")
        await createTransferOrderAndPost({
          fromWarehouseId: transferForm.fromWarehouseId,
          toWarehouseId: transferForm.toWarehouseId,
          fromItemId: transferForm.fromItemId,
          quantity: Number(transferForm.quantity || 0),
          notes: transferForm.notes || undefined,
        })
        setMessage("Transfer berhasil diposting.")
        setTransferForm({
          fromWarehouseId: warehouses[0]?.id || "",
          toWarehouseId: warehouses[1]?.id || warehouses[0]?.id || "",
          fromItemId: "",
          quantity: 1,
          notes: "",
        })
        await refreshReports()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal memproses transfer")
      }
    })
  }

  const submitNewItem = () => {
    startTransition(async () => {
      try {
        setError("")
        await createWarehouseInventoryItem({
          organizationId: props.organizationId,
          warehouseId: itemForm.warehouseId,
          code: itemForm.code,
          barcode: itemForm.barcode || undefined,
          name: itemForm.name,
          description: itemForm.description || undefined,
          category: itemForm.category || undefined,
          unit: itemForm.unit,
          quantity: Number(itemForm.quantity || 0),
          minStock: Number(itemForm.minStock || 0),
          maxStock: itemForm.maxStock ? Number(itemForm.maxStock) : undefined,
          unitCost: Number(itemForm.unitCost || 0),
        })
        setItemForm({
          warehouseId: warehouses[0]?.id || "",
          code: "",
          barcode: "",
          name: "",
          description: "",
          category: "",
          unit: "pcs",
          quantity: 0,
          unitCost: 0,
          minStock: 0,
          maxStock: 0,
        })
        setMessage("Item inventory berhasil dibuat.")
        await refreshReports()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal membuat item inventory")
      }
    })
  }

  const submitOpname = () => {
    startTransition(async () => {
      try {
        setError("")
        if (!opnameForm.warehouseId) throw new Error("Warehouse wajib dipilih.")
        if (!opnameForm.itemId) throw new Error("Item wajib dipilih.")

        const target = items.find((row) => row.id === opnameForm.itemId)
        if (!target) throw new Error("Item tidak ditemukan di state report (refresh dulu).")

        await createWarehouseStockOpname({
          organizationId: props.organizationId,
          warehouseId: opnameForm.warehouseId,
          code: opnameForm.code,
          opnameDate: new Date(opnameForm.opnameDate),
          items: [
            {
              itemId: opnameForm.itemId,
              systemQuantity: target.quantity,
              physicalQuantity: Number(opnameForm.physicalQty || 0),
              unitCost: target.unitCost,
            },
          ],
        })

        setMessage("Stock opname berhasil dibuat. Lanjutkan approval via tab Laporan Opname (atau modul Inventory).")
        await refreshReports()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal membuat stock opname")
      }
    })
  }

  const submitCreatePickWave = () => {
    startTransition(async () => {
      try {
        setError("")
        setMessage("")

        if (!enterpriseWarehouseId) throw new Error("Pilih warehouse (Enterprise) terlebih dulu.")
        if (!pickWaveForm.itemId) throw new Error("Pilih item untuk pick task.")
        if (Number(pickWaveForm.quantity || 0) <= 0) throw new Error("Qty pick harus > 0")

        const suggested = pickWaveForm.lotBatchCode
          ? null
          : await suggestFefoLotForItem({ itemId: pickWaveForm.itemId })

        const result = await createPickWaveAndTasks({
          warehouseId: enterpriseWarehouseId,
          notes: pickWaveForm.notes || undefined,
          tasks: [
            {
              orderReference: pickWaveForm.orderReference || undefined,
              itemId: pickWaveForm.itemId,
              quantity: Number(pickWaveForm.quantity || 0),
              fromBin: pickWaveForm.fromBin || undefined,
              lotBatchCode: pickWaveForm.lotBatchCode || (suggested?.code ?? undefined),
            },
          ],
        })

        setSelectedWaveId(result.waveId || "")
        setMessage(`Wave dibuat: ${result.waveCode || "-"}`)
        refreshPickWaves(enterpriseWarehouseId)
        if (result.waveId) {
          refreshPickTasks({ waveId: result.waveId })
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal membuat pick wave")
      }
    })
  }

  const submitCompletePickTask = (taskId: string) => {
    startTransition(async () => {
      try {
        setError("")
        setMessage("")
        const task = pickTasks.find((row) => row.id === taskId)
        const fallbackItem = task?.itemId ? itemsById.get(task.itemId) : undefined
        const form = pickCompleteForm[taskId] || {
          scannedItem: fallbackItem?.barcode || fallbackItem?.code || "",
          scannedBin: "",
          scannedLot: "",
        }
        if (!form.scannedItem) throw new Error("Isi scan item dulu.")
        const result = await completePickTask({
          taskId,
          scannedItem: form.scannedItem,
          scannedBin: form.scannedBin || undefined,
          scannedLot: form.scannedLot || undefined,
        })
        setMessage(`Pick task selesai. Movement: ${result.movementId || "-"}`)
        refreshPickTasks({ waveId: selectedWaveId || undefined })
        refreshReports()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menyelesaikan pick task")
      }
    })
  }

  const submitInboundToStagingAndCreatePutaway = () => {
    startTransition(async () => {
      try {
        setError("")
        setMessage("")
        if (!putawayForm.warehouseId) throw new Error("Pilih warehouse untuk putaway.")
        if (!putawayForm.itemId) throw new Error("Pilih item untuk putaway.")
        if (Number(putawayForm.quantity || 0) <= 0) throw new Error("Qty putaway harus > 0")

        if (!putawayForm.stagingBin) throw new Error("Isi staging bin (code/barcode).")

        const res = await inboundToStagingAndCreatePutaway({
          warehouseId: putawayForm.warehouseId,
          itemId: putawayForm.itemId,
          quantity: Number(putawayForm.quantity || 0),
          unitCost: putawayForm.unitCost ? Number(putawayForm.unitCost) : undefined,
          inboundReference: putawayForm.inboundReference || undefined,
          stagingBin: putawayForm.stagingBin,
          targetBin: putawayForm.targetBin || undefined,
          lotCode: putawayForm.lotCode || undefined,
          lotExpiryDate: putawayForm.lotExpiryDate || undefined,
        })
        setMessage(`Inbound OK. Movement: ${res.movementId || "-"} | PutawayTask: ${res.putawayTaskId || "-"}`)
        refreshBinBalances(putawayForm.warehouseId)
        refreshReports()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal membuat putaway task")
      }
    })
  }

  const submitCompletePutawayTaskById = (taskId: string, scannedTargetBin: string) => {
    startTransition(async () => {
      try {
        setError("")
        setMessage("")
        await completePutawayTask({ taskId, scannedTargetBin })
        setMessage("Putaway task selesai (bin primary item diperbarui).")
        refreshReports()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menyelesaikan putaway task")
      }
    })
  }

  const submitCreateLotBatch = () => {
    startTransition(async () => {
      try {
        setError("")
        setMessage("")
        if (!lotForm.itemId) throw new Error("Pilih item untuk lot batch.")
        if (!lotForm.code.trim()) throw new Error("Kode lot wajib diisi.")

        const res = await createLotBatch({
          itemId: lotForm.itemId,
          code: lotForm.code,
          expiryDate: lotForm.expiryDate || undefined,
        })
        setMessage(`Lot batch tersimpan: ${res.id || "-"}`)
        setLotForm({ itemId: lotForm.itemId, code: "", expiryDate: "" })
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menyimpan lot batch")
      }
    })
  }

  return (
    <div className="space-y-4" id="warehouse-module-print">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Warehouse</h1>
          <p className="text-sm text-slate-500">Organisasi aktif: {props.organizationName}</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={refreshReports}
            className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900 disabled:opacity-60"
            disabled={isPending}
          >
            <RefreshCw size={16} /> Refresh
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
          <div className="text-sm text-blue-700">Total SKU</div>
          <div className="text-2xl font-bold text-blue-900">{summary.totalSku}</div>
        </div>
        <div className="rounded-xl border border-indigo-200 bg-indigo-50 p-4">
          <div className="text-sm text-indigo-700">Gudang Aktif</div>
          <div className="text-2xl font-bold text-indigo-900">{warehouses.filter((w) => w.status === "ACTIVE").length}</div>
        </div>
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
          <div className="text-sm text-amber-700">Stok Kosong</div>
          <div className="text-2xl font-bold text-amber-900">{summary.lowStock}</div>
        </div>
        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
          <div className="text-sm text-emerald-700">Nilai Stok</div>
          <div className="text-2xl font-bold text-emerald-900">{formatCurrency(summary.totalValue)}</div>
        </div>
      </div>

      <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-white p-3">
        <button
          onClick={() => setActiveTab("report")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "report" ? "bg-blue-600 text-white" : "bg-slate-100"}`}
        >
          <Package size={16} className="inline mr-1" /> Laporan
        </button>
        <button
          onClick={() => setActiveTab("input")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "input" ? "bg-indigo-600 text-white" : "bg-slate-100"}`}
        >
          <Plus size={16} className="inline mr-1" /> Input
        </button>
        <button
          onClick={() => setActiveTab("master")}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "master" ? "bg-slate-800 text-white" : "bg-slate-100"}`}
        >
          <Warehouse size={16} className="inline mr-1" /> Master Lokasi
        </button>
        <button
          onClick={() => {
            setActiveTab("enterprise")
            refreshPickWaves(enterpriseWarehouseId || undefined)
          }}
          className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "enterprise" ? "bg-emerald-700 text-white" : "bg-slate-100"}`}
        >
          <MapPin size={16} className="inline mr-1" /> Enterprise
        </button>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">{message}</div>}

      {activeTab === "report" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="font-bold text-slate-800 mb-2">Rekonsiliasi Inventory vs GL</div>
            <div className="text-sm text-slate-600">
              {!recon ? (
                <span>Belum dihitung. Klik Apply atau Refresh.</span>
              ) : recon.enabled === false ? (
                <span>Belum ada konfigurasi akun Inventory (set di tab Master Lokasi).</span>
              ) : (
                <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-bold text-slate-500">Inventory Value</div>
                    <div className="font-bold text-slate-800">{formatCurrency(recon.inventoryValue)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-bold text-slate-500">GL Balance</div>
                    <div className="font-bold text-slate-800">{formatCurrency(recon.glBalance)}</div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-bold text-slate-500">Difference</div>
                    <div className={`font-bold ${Math.abs(Number(recon.difference || 0)) < 1 ? "text-emerald-700" : "text-rose-700"}`}>
                      {formatCurrency(recon.difference)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-200 p-3">
                    <div className="text-xs font-bold text-slate-500">Account</div>
                    <div className="font-bold text-slate-800">{recon.inventoryAccountId}</div>
                  </div>
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="flex-1 min-w-[180px]">
                <div className="text-xs font-bold text-slate-600 mb-1">Warehouse</div>
                <select
                  value={filters.warehouseId || ""}
                  onChange={(e) => setFilters({ ...filters, warehouseId: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">ALL</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.code} - {wh.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex-1 min-w-[160px]">
                <div className="text-xs font-bold text-slate-600 mb-1">Periode</div>
                <div className="flex gap-2">
                  <input
                    type="date"
                    value={filters.startDate || ""}
                    onChange={(e) => setFilters({ ...filters, startDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    type="date"
                    value={filters.endDate || ""}
                    onChange={(e) => setFilters({ ...filters, endDate: e.target.value })}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex-1 min-w-[180px]">
                <div className="text-xs font-bold text-slate-600 mb-1">Query</div>
                <input
                  value={filters.q || ""}
                  onChange={(e) => setFilters({ ...filters, q: e.target.value })}
                  placeholder="kode/nama/barcode/kategori"
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <div className="min-w-[160px]">
                <div className="text-xs font-bold text-slate-600 mb-1">Movement</div>
                <select
                  value={filters.movementType || ""}
                  onChange={(e) => setFilters({ ...filters, movementType: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">ALL</option>
                  <option value="IN">IN</option>
                  <option value="OUT">OUT</option>
                  <option value="ADJUSTMENT">ADJUSTMENT</option>
                  <option value="TRANSFER">TRANSFER</option>
                </select>
              </div>
              <div className="min-w-[160px]">
                <div className="text-xs font-bold text-slate-600 mb-1">Opname</div>
                <select
                  value={filters.opnameStatus || ""}
                  onChange={(e) => setFilters({ ...filters, opnameStatus: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">ALL</option>
                  <option value="DRAFT">DRAFT</option>
                  <option value="PENDING_APPROVAL">PENDING_APPROVAL</option>
                  <option value="APPROVED">APPROVED</option>
                  <option value="COMPLETED">COMPLETED</option>
                  <option value="CANCELLED">CANCELLED</option>
                </select>
              </div>
              <button
                onClick={refreshReports}
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                disabled={isPending}
              >
                <Filter size={16} /> Apply
              </button>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={shareWhatsapp}
              className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-bold text-white hover:bg-green-700"
            >
              <Send size={16} /> Share WA
            </button>
            <button
              onClick={printReport}
              className="inline-flex items-center gap-2 rounded-lg bg-slate-700 px-4 py-2 text-sm font-bold text-white hover:bg-slate-800"
            >
              <Printer size={16} /> Cetak
            </button>
            <button
              onClick={downloadPdf}
              className="inline-flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-sm font-bold text-white hover:bg-rose-700"
            >
              <FileDown size={16} /> PDF
            </button>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-4 font-bold text-slate-800">Stok (Filtered)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-bold">Kode</th>
                    <th className="px-4 py-3 font-bold">Nama</th>
                    <th className="px-4 py-3 font-bold">Qty</th>
                    <th className="px-4 py-3 font-bold">Gudang</th>
                    <th className="px-4 py-3 font-bold">Lokasi</th>
                    <th className="px-4 py-3 font-bold">Nilai</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {items.slice(0, 500).map((row) => {
                    const loc = [row.shelf, row.row, row.level, row.bin].map((v) => v || "-").join("/")
                    return (
                      <tr key={row.id}>
                        <td className="px-4 py-3 font-semibold text-slate-800">{row.code}</td>
                        <td className="px-4 py-3">{row.name}</td>
                        <td className="px-4 py-3">{row.quantity} {row.unit}</td>
                        <td className="px-4 py-3">{row.warehouse?.code || "-"}</td>
                        <td className="px-4 py-3">{loc}</td>
                        <td className="px-4 py-3">{formatCurrency(row.totalValue)}</td>
                      </tr>
                    )
                  })}
                  {items.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Tidak ada data stok untuk filter ini.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-4 font-bold text-slate-800">Mutasi (Filtered)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-bold">Tanggal</th>
                    <th className="px-4 py-3 font-bold">Tipe</th>
                    <th className="px-4 py-3 font-bold">Item</th>
                    <th className="px-4 py-3 font-bold">Qty</th>
                    <th className="px-4 py-3 font-bold">Gudang</th>
                    <th className="px-4 py-3 font-bold">Ref</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {movements.map((m) => (
                    <tr key={m.id}>
                      <td className="px-4 py-3">{formatDate(m.createdAt)}</td>
                      <td className="px-4 py-3 font-semibold">{m.movementType}</td>
                      <td className="px-4 py-3">{m.item?.code} - {m.item?.name}</td>
                      <td className="px-4 py-3">{m.quantity} {m.item?.unit}</td>
                      <td className="px-4 py-3">{m.item?.warehouse?.code || "-"}</td>
                      <td className="px-4 py-3">{m.reference || "-"}</td>
                    </tr>
                  ))}
                  {movements.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Tidak ada mutasi untuk filter ini.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-4 font-bold text-slate-800">Stock Opname (Filtered)</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-bold">Kode</th>
                    <th className="px-4 py-3 font-bold">Gudang</th>
                    <th className="px-4 py-3 font-bold">Tanggal</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Selisih</th>
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
                        {row.items?.reduce((sum, it) => sum + Number(it.difference || 0), 0) || 0}
                      </td>
                    </tr>
                  ))}
                  {stockOpnames.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-4 py-8 text-center text-slate-500">Tidak ada stock opname untuk filter ini.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
            <div className="border-b border-slate-100 p-4 font-bold text-slate-800">Transfer Order</div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3 font-bold">Tanggal</th>
                    <th className="px-4 py-3 font-bold">Kode</th>
                    <th className="px-4 py-3 font-bold">Status</th>
                    <th className="px-4 py-3 font-bold">Dari</th>
                    <th className="px-4 py-3 font-bold">Ke</th>
                    <th className="px-4 py-3 font-bold">Notes</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transferOrders.map((t) => (
                    <tr key={t.id}>
                      <td className="px-4 py-3">{formatDate(t.createdAt)}</td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{t.code}</td>
                      <td className="px-4 py-3">{t.status}</td>
                      <td className="px-4 py-3">{t.fromWarehouseId}</td>
                      <td className="px-4 py-3">{t.toWarehouseId}</td>
                      <td className="px-4 py-3">{t.notes || "-"}</td>
                    </tr>
                  ))}
                  {transferOrders.length === 0 && (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-slate-500">Belum ada transfer order.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === "input" && (
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="font-bold text-slate-800">Buat Item Inventory</div>
            <div className="grid grid-cols-1 gap-2">
              <select
                value={itemForm.warehouseId}
                onChange={(e) => setItemForm({ ...itemForm, warehouseId: e.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.code} - {wh.name}
                  </option>
                ))}
              </select>
              <input value={itemForm.code} onChange={(e) => setItemForm({ ...itemForm, code: e.target.value })} placeholder="Kode (SKU)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input value={itemForm.name} onChange={(e) => setItemForm({ ...itemForm, name: e.target.value })} placeholder="Nama" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input value={itemForm.barcode} onChange={(e) => setItemForm({ ...itemForm, barcode: e.target.value })} placeholder="Barcode (opsional)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input value={itemForm.category} onChange={(e) => setItemForm({ ...itemForm, category: e.target.value })} placeholder="Kategori (opsional)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <div className="grid grid-cols-2 gap-2">
                <input value={itemForm.unit} onChange={(e) => setItemForm({ ...itemForm, unit: e.target.value })} placeholder="Unit" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <input type="number" value={itemForm.minStock} onChange={(e) => setItemForm({ ...itemForm, minStock: Number(e.target.value) })} placeholder="Min stock" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input type="number" value={itemForm.quantity} onChange={(e) => setItemForm({ ...itemForm, quantity: Number(e.target.value) })} placeholder="Qty awal" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <input type="number" value={itemForm.unitCost} onChange={(e) => setItemForm({ ...itemForm, unitCost: Number(e.target.value) })} placeholder="Unit cost" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <button onClick={submitNewItem} disabled={isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
                Simpan Item
              </button>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="font-bold text-slate-800">Posting Mutasi Stok</div>
            <div className="text-xs text-slate-500">
              Catatan: `ADJUSTMENT` hanya untuk MANAGER/ADMIN.
            </div>
            <div className="grid grid-cols-1 gap-2">
              <select
                value={moveForm.warehouseId}
                onChange={(e) => setMoveForm({ ...moveForm, warehouseId: e.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.code} - {wh.name}
                  </option>
                ))}
              </select>
              <select
                value={moveForm.itemId}
                onChange={(e) => setMoveForm({ ...moveForm, itemId: e.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">Pilih Item</option>
                {items.filter((it) => it.warehouse?.id === moveForm.warehouseId).slice(0, 1000).map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.code} - {it.name}
                  </option>
                ))}
              </select>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={moveForm.movementType}
                  onChange={(e) => setMoveForm({ ...moveForm, movementType: e.target.value as any })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="IN">IN</option>
                  <option value="OUT">OUT</option>
                  <option value="ADJUSTMENT">ADJUSTMENT (set qty)</option>
                </select>
                <input
                  type="number"
                  value={moveForm.quantity}
                  onChange={(e) => setMoveForm({ ...moveForm, quantity: Number(e.target.value) })}
                  placeholder="Qty"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
              </div>
              <input
                type="number"
                value={moveForm.unitCost}
                onChange={(e) => setMoveForm({ ...moveForm, unitCost: Number(e.target.value) })}
                placeholder="Unit cost (opsional)"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input value={moveForm.reference} onChange={(e) => setMoveForm({ ...moveForm, reference: e.target.value })} placeholder="Reference" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <input value={moveForm.description} onChange={(e) => setMoveForm({ ...moveForm, description: e.target.value })} placeholder="Description (opsional)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              <button onClick={submitMove} disabled={isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">
                Post Movement
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="font-bold text-slate-800">Transfer Antar Gudang</div>
              <div className="grid grid-cols-1 gap-2">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={transferForm.fromWarehouseId}
                    onChange={(e) => setTransferForm({ ...transferForm, fromWarehouseId: e.target.value, fromItemId: "" })}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        Dari: {wh.code}
                      </option>
                    ))}
                  </select>
                  <select
                    value={transferForm.toWarehouseId}
                    onChange={(e) => setTransferForm({ ...transferForm, toWarehouseId: e.target.value })}
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  >
                    {warehouses.map((wh) => (
                      <option key={wh.id} value={wh.id}>
                        Ke: {wh.code}
                      </option>
                    ))}
                  </select>
                </div>
                <select
                  value={transferForm.fromItemId}
                  onChange={(e) => setTransferForm({ ...transferForm, fromItemId: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Pilih Item Asal</option>
                  {items
                    .filter((it) => it.warehouse?.id === transferForm.fromWarehouseId)
                    .slice(0, 1200)
                    .map((it) => (
                      <option key={it.id} value={it.id}>
                        {it.code} - {it.name} (stok {it.quantity})
                      </option>
                    ))}
                </select>
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="number"
                    value={transferForm.quantity}
                    onChange={(e) => setTransferForm({ ...transferForm, quantity: Number(e.target.value) })}
                    placeholder="Qty transfer"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                  <input
                    value={transferForm.notes}
                    onChange={(e) => setTransferForm({ ...transferForm, notes: e.target.value })}
                    placeholder="Notes (opsional)"
                    className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                  />
                </div>
                <button
                  onClick={submitTransfer}
                  disabled={isPending}
                  className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60"
                >
                  Post Transfer
                </button>
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="font-bold text-slate-800">Buat Stock Opname (1 item)</div>
              <div className="grid grid-cols-1 gap-2">
                <select
                  value={opnameForm.warehouseId}
                  onChange={(e) => setOpnameForm({ ...opnameForm, warehouseId: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.code} - {wh.name}
                    </option>
                  ))}
                </select>
                <input value={opnameForm.code} onChange={(e) => setOpnameForm({ ...opnameForm, code: e.target.value })} placeholder="Kode opname" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <input type="date" value={opnameForm.opnameDate} onChange={(e) => setOpnameForm({ ...opnameForm, opnameDate: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <select
                  value={opnameForm.itemId}
                  onChange={(e) => setOpnameForm({ ...opnameForm, itemId: e.target.value })}
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Pilih Item</option>
                  {items.filter((it) => it.warehouse?.id === opnameForm.warehouseId).slice(0, 1000).map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.code} - {it.name}
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  value={opnameForm.physicalQty}
                  onChange={(e) => setOpnameForm({ ...opnameForm, physicalQty: Number(e.target.value) })}
                  placeholder="Qty fisik"
                  className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                />
                <button onClick={submitOpname} disabled={isPending} className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60">
                  Buat Opname
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === "master" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="font-bold text-slate-800">Konfigurasi Akun Inventory (Phase 3)</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
              <select value={accForm.inventoryAccountId} onChange={(e) => setAccForm({ ...accForm, inventoryAccountId: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">Inventory Account (optional)</option>
                {props.accounts.filter((a) => !a.isHeader).map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
              <select value={accForm.wipAccountId} onChange={(e) => setAccForm({ ...accForm, wipAccountId: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">WIP Account (optional)</option>
                {props.accounts.filter((a) => !a.isHeader).map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
              <select value={accForm.finishedGoodsAccountId} onChange={(e) => setAccForm({ ...accForm, finishedGoodsAccountId: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">Finished Goods Account (optional)</option>
                {props.accounts.filter((a) => !a.isHeader).map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
              <select value={accForm.inventoryVarianceAccountId} onChange={(e) => setAccForm({ ...accForm, inventoryVarianceAccountId: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">Inventory Variance Account (optional)</option>
                {props.accounts.filter((a) => !a.isHeader).map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
              <select value={accForm.cogsAccountId} onChange={(e) => setAccForm({ ...accForm, cogsAccountId: e.target.value })} className="rounded-lg border border-slate-200 px-3 py-2 text-sm">
                <option value="">COGS Account (optional)</option>
                {props.accounts.filter((a) => !a.isHeader).map((a) => (
                  <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                ))}
              </select>
              <button onClick={saveAccountingConfig} disabled={isPending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">
                Simpan Konfigurasi
              </button>
            </div>
            <div className="text-xs text-slate-500">
              Setelah config diisi, WO Issue akan posting Dr WIP / Cr Inventory, WO Complete akan posting Dr FG / Cr WIP.
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-bold text-slate-800">Master Gudang</div>
              <button onClick={openCreateWarehouse} className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700">
                <Plus size={16} /> Tambah Gudang
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
              {warehouses.map((wh) => (
                <div key={wh.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-bold text-slate-800">{wh.code} - {wh.name}</div>
                      <div className="text-xs text-slate-500">{wh.type} | {wh.status}</div>
                      <div className="mt-2 text-sm text-slate-600">{wh.location || "-"}</div>
                      <div className="text-xs text-slate-500">Manager: {wh.manager?.name || "-"}</div>
                    </div>
                    <div className="flex gap-2">
                      <button onClick={() => openEditWarehouse(wh)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">
                        Edit
                      </button>
                      <button onClick={() => removeWarehouse(wh.id)} className="rounded-lg bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100">
                        Hapus
                      </button>
                    </div>
                  </div>
                </div>
              ))}
              {warehouses.length === 0 && (
                <div className="rounded-xl border border-slate-200 bg-white p-6 text-sm text-slate-500">
                  Belum ada gudang.
                </div>
              )}
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1">
                <div className="text-xs font-bold text-slate-600 mb-1">Warehouse</div>
                <select
                  value={masterWarehouseId}
                  onChange={(e) => {
                    setMasterWarehouseId(e.target.value)
                    refreshLocations(e.target.value)
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.code} - {wh.name}
                    </option>
                  ))}
                </select>
              </div>
              <button
                onClick={() => refreshLocations(masterWarehouseId)}
                className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900 disabled:opacity-60"
                disabled={isPending}
              >
                <RefreshCw size={16} /> Refresh Lokasi
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="font-bold text-slate-800 flex items-center gap-2"><MapPin size={16} /> Buat Zone</div>
              <div className="grid grid-cols-1 gap-2">
                <input value={zoneForm.code} onChange={(e) => setZoneForm({ ...zoneForm, code: e.target.value })} placeholder="Code (Z-01)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <input value={zoneForm.name} onChange={(e) => setZoneForm({ ...zoneForm, name: e.target.value })} placeholder="Name" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <input value={zoneForm.notes} onChange={(e) => setZoneForm({ ...zoneForm, notes: e.target.value })} placeholder="Notes (opsional)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                <button onClick={submitZone} disabled={isPending} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900 disabled:opacity-60">
                  Simpan Zone
                </button>
              </div>
              <div className="text-xs font-bold text-slate-600">Daftar Zone</div>
              <div className="space-y-2">
                {locationsByWarehouse.zones.map((z: any) => (
                  <div key={z.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <div className="font-semibold">{z.code} - {z.name}</div>
                    <button onClick={() => removeLocation("WarehouseZone", z.id)} className="text-rose-600 hover:text-rose-700">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {locationsByWarehouse.zones.length === 0 && <div className="text-sm text-slate-500">Belum ada zone.</div>}
              </div>
            </div>

            <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
              <div className="font-bold text-slate-800">Buat Aisle / Rack / Bin</div>
              <div className="grid grid-cols-1 gap-3">
                <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <div className="text-xs font-bold text-slate-600">Aisle</div>
                  <select value={aisleForm.zoneId} onChange={(e) => setAisleForm({ ...aisleForm, zoneId: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <option value="">(Opsional) Zone</option>
                    {locationsByWarehouse.zones.map((z: any) => (
                      <option key={z.id} value={z.id}>{z.code} - {z.name}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={aisleForm.code} onChange={(e) => setAisleForm({ ...aisleForm, code: e.target.value })} placeholder="Code (A-01)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <input value={aisleForm.name} onChange={(e) => setAisleForm({ ...aisleForm, name: e.target.value })} placeholder="Name" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  </div>
                  <button onClick={submitAisle} disabled={isPending} className="rounded-lg bg-indigo-600 px-4 py-2 text-sm font-bold text-white hover:bg-indigo-700 disabled:opacity-60">Simpan Aisle</button>
                </div>

                <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <div className="text-xs font-bold text-slate-600">Rack</div>
                  <select value={rackForm.aisleId} onChange={(e) => setRackForm({ ...rackForm, aisleId: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <option value="">(Opsional) Aisle</option>
                    {locationsByWarehouse.aisles.map((a: any) => (
                      <option key={a.id} value={a.id}>{a.code} - {a.name}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={rackForm.code} onChange={(e) => setRackForm({ ...rackForm, code: e.target.value })} placeholder="Code (R-01)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <input value={rackForm.name} onChange={(e) => setRackForm({ ...rackForm, name: e.target.value })} placeholder="Name" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  </div>
                  <button onClick={submitRack} disabled={isPending} className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900 disabled:opacity-60">Simpan Rack</button>
                </div>

                <div className="rounded-lg border border-slate-200 p-3 space-y-2">
                  <div className="text-xs font-bold text-slate-600">Bin</div>
                  <select value={binForm.rackId} onChange={(e) => setBinForm({ ...binForm, rackId: e.target.value })} className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <option value="">(Opsional) Rack</option>
                    {locationsByWarehouse.racks.map((r: any) => (
                      <option key={r.id} value={r.id}>{r.code} - {r.name}</option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={binForm.code} onChange={(e) => setBinForm({ ...binForm, code: e.target.value })} placeholder="Code (B-01)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <input value={binForm.name} onChange={(e) => setBinForm({ ...binForm, name: e.target.value })} placeholder="Name" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input value={binForm.barcode} onChange={(e) => setBinForm({ ...binForm, barcode: e.target.value })} placeholder="Barcode (opsional)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <input value={binForm.notes} onChange={(e) => setBinForm({ ...binForm, notes: e.target.value })} placeholder="Notes (opsional)" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                  </div>
                  <button onClick={submitBin} disabled={isPending} className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-700 disabled:opacity-60">Simpan Bin</button>
                </div>
              </div>

              <div className="text-xs font-bold text-slate-600">Daftar Aisle/Rack/Bin</div>
              <div className="space-y-2">
                {locationsByWarehouse.aisles.slice(0, 8).map((a: any) => (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <div className="font-semibold">Aisle {a.code} - {a.name}</div>
                    <button onClick={() => removeLocation("WarehouseAisle", a.id)} className="text-rose-600 hover:text-rose-700">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {locationsByWarehouse.racks.slice(0, 8).map((r: any) => (
                  <div key={r.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <div className="font-semibold">Rack {r.code} - {r.name}</div>
                    <button onClick={() => removeLocation("WarehouseRack", r.id)} className="text-rose-600 hover:text-rose-700">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {locationsByWarehouse.bins.slice(0, 8).map((b: any) => (
                  <div key={b.id} className="flex items-center justify-between rounded-lg border border-slate-200 px-3 py-2 text-sm">
                    <div className="font-semibold">Bin {b.code} - {b.name}</div>
                    <button onClick={() => removeLocation("WarehouseBin", b.id)} className="text-rose-600 hover:text-rose-700">
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
                {(locationsByWarehouse.aisles.length + locationsByWarehouse.racks.length + locationsByWarehouse.bins.length) === 0 && (
                  <div className="text-sm text-slate-500">Belum ada aisle/rack/bin.</div>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="font-bold text-slate-800">Assign Lokasi ke Item (flat fields)</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
              <div className="md:col-span-2">
                <div className="text-xs font-bold text-slate-600 mb-1">Item</div>
                <select
                  value={assignForm.itemId}
                  onChange={(e) => setAssignForm({ ...assignForm, itemId: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Pilih Item</option>
                  {items.filter((it) => it.warehouse?.id === masterWarehouseId).slice(0, 1200).map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.code} - {it.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-600 mb-1">Zone</div>
                <input value={assignForm.zoneCode} onChange={(e) => setAssignForm({ ...assignForm, zoneCode: e.target.value })} placeholder="Z-01" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-600 mb-1">Aisle</div>
                <input value={assignForm.aisleCode} onChange={(e) => setAssignForm({ ...assignForm, aisleCode: e.target.value })} placeholder="A-01" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-600 mb-1">Rack</div>
                <input value={assignForm.rackCode} onChange={(e) => setAssignForm({ ...assignForm, rackCode: e.target.value })} placeholder="R-01" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
              <div>
                <div className="text-xs font-bold text-slate-600 mb-1">Bin</div>
                <input value={assignForm.binCode} onChange={(e) => setAssignForm({ ...assignForm, binCode: e.target.value })} placeholder="B-01" className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm" />
              </div>
            </div>
            <button onClick={submitAssign} disabled={isPending} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60">
              Assign Lokasi
            </button>
          </div>
        </div>
      )}

      {activeTab === "enterprise" && (
        <div className="space-y-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="font-bold text-slate-800">Enterprise WMS (Phase 2)</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
              <div>
                <div className="text-xs font-bold text-slate-600 mb-1">Warehouse</div>
                <select
                  value={enterpriseWarehouseId}
                  onChange={(e) => {
                    setEnterpriseWarehouseId(e.target.value)
                    refreshPickWaves(e.target.value)
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">Pilih Warehouse</option>
                  {warehouses.map((wh) => (
                    <option key={wh.id} value={wh.id}>
                      {wh.code} - {wh.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <button
                  onClick={() => refreshPickWaves(enterpriseWarehouseId || undefined)}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900 disabled:opacity-60"
                >
                  <RefreshCw size={16} /> Refresh Waves
                </button>
                <button
                  onClick={() => refreshPickTasks({ waveId: selectedWaveId || undefined, warehouseId: enterpriseWarehouseId || undefined })}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-4 py-2 text-sm font-bold text-slate-700 hover:bg-slate-200 disabled:opacity-60"
                >
                  <RefreshCw size={16} /> Refresh Tasks
                </button>
                <button
                  onClick={() => refreshBinBalances(enterpriseWarehouseId || undefined)}
                  disabled={isPending}
                  className="inline-flex items-center gap-2 rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60"
                >
                  <RefreshCw size={16} /> Bin Stock
                </button>
              </div>
              <div>
                <div className="text-xs font-bold text-slate-600 mb-1">Wave Terpilih</div>
                <select
                  value={selectedWaveId}
                  onChange={(e) => {
                    setSelectedWaveId(e.target.value)
                    if (e.target.value) refreshPickTasks({ waveId: e.target.value })
                  }}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="">(Belum pilih)</option>
                  {pickWaves.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.code} ({w.status})
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="font-bold text-slate-800">Bin Stock (non-zero)</div>
            <div className="overflow-auto">
              <table className="min-w-[860px] w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-2 pr-3">Item</th>
                    <th className="py-2 pr-3">Bin</th>
                    <th className="py-2 pr-3">Lot</th>
                    <th className="py-2 pr-3">Qty</th>
                    <th className="py-2 pr-3">Updated</th>
                  </tr>
                </thead>
                <tbody>
                  {binBalances.map((r) => (
                    <tr key={r.id} className="border-t border-slate-100">
                      <td className="py-2 pr-3">
                        <div className="font-semibold text-slate-800">{r.itemCode} - {r.itemName}</div>
                        <div className="text-xs text-slate-500">{r.itemId}</div>
                      </td>
                      <td className="py-2 pr-3">{r.binCode || "-"}</td>
                      <td className="py-2 pr-3">{r.lotCode || "-"}</td>
                      <td className="py-2 pr-3 font-semibold">{Number(r.quantity || 0)}</td>
                      <td className="py-2 pr-3 text-xs text-slate-500">{r.updatedAt || "-"}</td>
                    </tr>
                  ))}
                  {binBalances.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-4 text-slate-500">
                        Belum ada bin stock non-zero. Klik tombol “Bin Stock”.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="font-bold text-slate-800">Lot Batch (Expiry/FEFO)</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
              <select
                value={lotForm.itemId}
                onChange={(e) => setLotForm({ ...lotForm, itemId: e.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-3"
              >
                <option value="">Pilih Item</option>
                {items
                  .filter((it) => !enterpriseWarehouseId || it.warehouse?.id === enterpriseWarehouseId)
                  .slice(0, 1200)
                  .map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.code} - {it.name}
                    </option>
                  ))}
              </select>
              <input
                value={lotForm.code}
                onChange={(e) => setLotForm({ ...lotForm, code: e.target.value })}
                placeholder="Kode Lot (LOT-001)"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={lotForm.expiryDate}
                onChange={(e) => setLotForm({ ...lotForm, expiryDate: e.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                onClick={submitCreateLotBatch}
                disabled={isPending}
                className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900 disabled:opacity-60"
              >
                Simpan Lot
              </button>
            </div>
            <div className="text-xs text-slate-500">
              Lot dipakai untuk scan evidence dan FEFO suggestion saat buat pick wave.
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="font-bold text-slate-800">Buat Pick Wave (1 task cepat)</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
              <input
                value={pickWaveForm.orderReference}
                onChange={(e) => setPickWaveForm({ ...pickWaveForm, orderReference: e.target.value })}
                placeholder="Order ref (SO/DO)"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
              />
              <select
                value={pickWaveForm.itemId}
                onChange={(e) => setPickWaveForm({ ...pickWaveForm, itemId: e.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
              >
                <option value="">Pilih Item (warehouse)</option>
                {items
                  .filter((it) => !enterpriseWarehouseId || it.warehouse?.id === enterpriseWarehouseId)
                  .slice(0, 1200)
                  .map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.code} - {it.name} (stok {it.quantity})
                    </option>
                  ))}
              </select>
              <input
                type="number"
                value={pickWaveForm.quantity}
                onChange={(e) => setPickWaveForm({ ...pickWaveForm, quantity: Number(e.target.value) })}
                placeholder="Qty"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={pickWaveForm.fromBin}
                onChange={(e) => setPickWaveForm({ ...pickWaveForm, fromBin: e.target.value })}
                placeholder="From bin (code/barcode)"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={pickWaveForm.lotBatchCode}
                onChange={(e) => setPickWaveForm({ ...pickWaveForm, lotBatchCode: e.target.value })}
                placeholder="Lot (opsional)"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={pickWaveForm.notes}
                onChange={(e) => setPickWaveForm({ ...pickWaveForm, notes: e.target.value })}
                placeholder="Notes (opsional)"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
              />
              <button
                onClick={submitCreatePickWave}
                disabled={isPending}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60 md:col-span-2"
              >
                Buat Wave
              </button>
            </div>
            <div className="text-xs text-slate-500">
              Tips: kalau lot kosong, sistem akan mencoba FEFO (lot expiry terdekat) untuk item tersebut.
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="font-bold text-slate-800">Pick Tasks</div>
            <div className="overflow-auto">
              <table className="min-w-[920px] w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-slate-500">
                    <th className="py-2 pr-3">Status</th>
                    <th className="py-2 pr-3">Item</th>
                    <th className="py-2 pr-3">Qty</th>
                    <th className="py-2 pr-3">FromBinId</th>
                    <th className="py-2 pr-3">Scan Item</th>
                    <th className="py-2 pr-3">Scan Bin</th>
                    <th className="py-2 pr-3">Scan Lot</th>
                    <th className="py-2 pr-3">Aksi</th>
                  </tr>
                </thead>
                <tbody>
                  {pickTasks.map((t) => {
                    const item = itemsById.get(t.itemId)
                    const current = pickCompleteForm[t.id] || { scannedItem: item?.barcode || item?.code || "", scannedBin: "", scannedLot: "" }
                    return (
                      <tr key={t.id} className="border-t border-slate-100">
                        <td className="py-2 pr-3 font-semibold">{t.status}</td>
                        <td className="py-2 pr-3">
                          <div className="font-semibold text-slate-800">{item ? `${item.code} - ${item.name}` : t.itemId}</div>
                          <div className="text-xs text-slate-500">{t.orderReference || "-"}</div>
                        </td>
                        <td className="py-2 pr-3">{t.quantity}</td>
                        <td className="py-2 pr-3 text-xs text-slate-500">{t.fromBinId || "-"}</td>
                        <td className="py-2 pr-3">
                          <input
                            value={current.scannedItem}
                            onChange={(e) =>
                              setPickCompleteForm({
                                ...pickCompleteForm,
                                [t.id]: { ...current, scannedItem: e.target.value },
                              })
                            }
                            className="w-[170px] rounded-lg border border-slate-200 px-2 py-1 text-sm"
                            placeholder="barcode/item code"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            value={current.scannedBin}
                            onChange={(e) =>
                              setPickCompleteForm({
                                ...pickCompleteForm,
                                [t.id]: { ...current, scannedBin: e.target.value },
                              })
                            }
                            className="w-[140px] rounded-lg border border-slate-200 px-2 py-1 text-sm"
                            placeholder="bin code/barcode"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <input
                            value={current.scannedLot}
                            onChange={(e) =>
                              setPickCompleteForm({
                                ...pickCompleteForm,
                                [t.id]: { ...current, scannedLot: e.target.value },
                              })
                            }
                            className="w-[120px] rounded-lg border border-slate-200 px-2 py-1 text-sm"
                            placeholder="lot (opsional)"
                          />
                        </td>
                        <td className="py-2 pr-3">
                          <button
                            onClick={() => submitCompletePickTask(t.id)}
                            disabled={isPending || t.status === "DONE" || t.status === "CANCELLED"}
                            className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-bold text-white hover:bg-blue-700 disabled:opacity-60"
                          >
                            Complete + Post OUT
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                  {pickTasks.length === 0 && (
                    <tr>
                      <td colSpan={8} className="py-4 text-slate-500">
                        Belum ada pick task. Buat wave atau refresh.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
            <div className="font-bold text-slate-800">Inbound → Staging + Putaway Task</div>
            <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
              <select
                value={putawayForm.warehouseId}
                onChange={(e) => setPutawayForm({ ...putawayForm, warehouseId: e.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
              >
                <option value="">Pilih Warehouse</option>
                {warehouses.map((wh) => (
                  <option key={wh.id} value={wh.id}>
                    {wh.code} - {wh.name}
                  </option>
                ))}
              </select>
              <input
                value={putawayForm.inboundReference}
                onChange={(e) => setPutawayForm({ ...putawayForm, inboundReference: e.target.value })}
                placeholder="Inbound ref (opsional)"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <select
                value={putawayForm.itemId}
                onChange={(e) => setPutawayForm({ ...putawayForm, itemId: e.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
              >
                <option value="">Pilih Item (warehouse)</option>
                {items.filter((it) => !putawayForm.warehouseId || it.warehouse?.id === putawayForm.warehouseId).slice(0, 1200).map((it) => (
                  <option key={it.id} value={it.id}>
                    {it.code} - {it.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={putawayForm.quantity}
                onChange={(e) => setPutawayForm({ ...putawayForm, quantity: Number(e.target.value) })}
                placeholder="Qty"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={putawayForm.unitCost}
                onChange={(e) => setPutawayForm({ ...putawayForm, unitCost: e.target.value })}
                placeholder="Unit cost (opsional)"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                onClick={submitInboundToStagingAndCreatePutaway}
                disabled={isPending}
                className="rounded-lg bg-amber-600 px-4 py-2 text-sm font-bold text-white hover:bg-amber-700 disabled:opacity-60 md:col-span-2"
              >
                Post IN + Buat Task
              </button>
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
              <input
                value={putawayForm.stagingBin}
                onChange={(e) => setPutawayForm({ ...putawayForm, stagingBin: e.target.value })}
                placeholder="Staging bin (code/barcode) *"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
              />
              <input
                value={putawayForm.targetBin}
                onChange={(e) => setPutawayForm({ ...putawayForm, targetBin: e.target.value })}
                placeholder="Target bin (opsional)"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
              />
              <input
                value={putawayForm.lotCode}
                onChange={(e) => setPutawayForm({ ...putawayForm, lotCode: e.target.value })}
                placeholder="Lot code (opsional)"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                type="date"
                value={putawayForm.lotExpiryDate}
                onChange={(e) => setPutawayForm({ ...putawayForm, lotExpiryDate: e.target.value })}
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-2 md:grid-cols-6">
              <input
                value={putawayCompleteForm.taskId}
                onChange={(e) => setPutawayCompleteForm({ ...putawayCompleteForm, taskId: e.target.value })}
                placeholder="Task ID"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
              />
              <input
                value={putawayCompleteForm.scannedTargetBin}
                onChange={(e) => setPutawayCompleteForm({ ...putawayCompleteForm, scannedTargetBin: e.target.value })}
                placeholder="Scan target bin"
                className="rounded-lg border border-slate-200 px-3 py-2 text-sm md:col-span-2"
              />
              <button
                onClick={() => submitCompletePutawayTaskById(putawayCompleteForm.taskId, putawayCompleteForm.scannedTargetBin)}
                disabled={isPending || !putawayCompleteForm.taskId || !putawayCompleteForm.scannedTargetBin}
                className="rounded-lg bg-emerald-700 px-4 py-2 text-sm font-bold text-white hover:bg-emerald-800 disabled:opacity-60 md:col-span-2"
              >
                Complete Putaway
              </button>
            </div>
          </div>
        </div>
      )}

      {whModalOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 p-5">
              <div className="font-bold text-slate-800">{whEditing ? "Edit Gudang" : "Tambah Gudang"}</div>
              <button onClick={() => setWhModalOpen(false)} className="rounded-lg bg-slate-100 px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200">
                Tutup
              </button>
            </div>
            <div className="p-5 space-y-3">
              <input
                value={whForm.name}
                onChange={(e) => setWhForm({ ...whForm, name: e.target.value })}
                placeholder="Nama gudang"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <input
                value={whForm.location}
                onChange={(e) => setWhForm({ ...whForm, location: e.target.value })}
                placeholder="Lokasi (opsional)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={whForm.type}
                  onChange={(e) => setWhForm({ ...whForm, type: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="MAIN">MAIN</option>
                  <option value="BRANCH">BRANCH</option>
                  <option value="TRANSIT">TRANSIT</option>
                </select>
                <select
                  value={whForm.status}
                  onChange={(e) => setWhForm({ ...whForm, status: e.target.value })}
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
                >
                  <option value="ACTIVE">ACTIVE</option>
                  <option value="INACTIVE">INACTIVE</option>
                </select>
              </div>
              <select
                value={whForm.managerId}
                onChange={(e) => setWhForm({ ...whForm, managerId: e.target.value })}
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              >
                <option value="">(Opsional) Manager</option>
                {props.users.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name} ({u.role})
                  </option>
                ))}
              </select>
              <input
                value={whForm.notes}
                onChange={(e) => setWhForm({ ...whForm, notes: e.target.value })}
                placeholder="Catatan (opsional)"
                className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm"
              />
              <button
                onClick={saveWarehouse}
                disabled={isPending || !whForm.name.trim()}
                className="w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                Simpan
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
