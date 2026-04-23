"use client"

import { useMemo, useState, useTransition } from "react"
import {
  addWorkOrderCostEntry,
  completeWorkOrder,
  createWorkOrder,
  generateWorkOrderChain,
  issueWorkOrderMaterial,
  previewBomExplosion,
  releaseWorkOrderFromBom,
  updateWorkOrderStatus,
} from "@/app/actions/work-order"
import { useRouter } from "next/navigation"

type WorkOrderCostType = "LABOR" | "OVERHEAD" | "MACHINE" | "SUBCONTRACT" | "WASTE"

interface WorkOrderItem {
  id: string
  itemId?: string | null
  description: string
  quantity: number
  unit?: string | null
  unitPrice: number
  totalPrice: number
}

interface WorkOrderMaterialIssue {
  id: string
  plannedQty: number
  issuedQty: number
  unitCost: number
  totalCost: number
  createdAt?: string | Date
  item?: { id: string; code: string; name: string; unit: string } | null
}

interface WorkOrderCostEntry {
  id: string
  costType: WorkOrderCostType
  amount: number
  reference?: string | null
  description?: string | null
  entryDate?: string | Date
}

interface WorkOrder {
  id: string
  code: string
  barcode?: string | null
  title: string
  description?: string | null
  status: string
  priority: string
  assignedTo?: string | null
  startDate?: string | Date | null
  dueDate?: string | Date | null
  createdAt: string | Date
  estimatedHours?: number | null
  plannedQty?: number
  actualQty?: number
  plannedMaterialCost?: number
  plannedLaborCost?: number
  plannedOverheadCost?: number
  plannedMachineCost?: number
  plannedSubcontractCost?: number
  plannedWasteValue?: number
  plannedTotalCost?: number
  actualMaterialCost?: number
  actualLaborCost?: number
  actualOverheadCost?: number
  actualMachineCost?: number
  actualSubcontractCost?: number
  actualWasteValue?: number
  actualTotalCost?: number
  hppPerUnit?: number
  varianceAmount?: number
  variancePercent?: number
  assignedUser?: { id: string; name: string } | null
  customer?: { id: string; name: string; code: string } | null
  productItem?: { id: string; code: string; name: string; unit: string } | null
  bom?: { id: string; code: string; name: string; version: number } | null
  items?: WorkOrderItem[]
  materialIssues?: WorkOrderMaterialIssue[]
  costEntries?: WorkOrderCostEntry[]
  chainChildren?: Array<{
    parentWorkOrderId: string
    childWorkOrderId: string
    componentItemId: string
    requiredQty: number
    generationLevel: number
    childCode: string
    childTitle: string
    childStatus: string
    childPlannedQty: number
    childActualQty: number
    componentCode: string | null
    componentName: string | null
  }>
}

interface User {
  id: string
  name: string
}

interface Customer {
  id: string
  name: string
  code: string
}

interface InventoryItem {
  id: string
  code: string
  name: string
  unit: string
  unitCost: number
  quantity: number
  itemType?: string | null
}

interface BomOption {
  id: string
  code: string
  name: string
  version: number
  productItemId: string
}

interface WorkOrderManagerProps {
  initialWorkOrders: WorkOrder[]
  users: User[]
  customers: Customer[]
  inventoryItems: InventoryItem[]
  boms: BomOption[]
  organizationId: string
}

interface BomExplosionLine {
  itemId: string
  code: string
  name: string
  unit: string
  itemType?: string | null
  depth: number
  quantity: number
  unitCost: number
  totalCost: number
  parentItemId?: string
}

interface BomExplosionPreview {
  rootBomId: string
  rootProductItemId: string
  plannedQty: number
  mode: "single-level" | "multi-level"
  lines: BomExplosionLine[]
  totalMaterialCost: number
}

const CURRENCY = new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", maximumFractionDigits: 0 })

function formatCurrency(value?: number | null) {
  return CURRENCY.format(value || 0)
}

function formatDate(value?: string | Date | null) {
  if (!value) return "-"
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return "-"
  return date.toLocaleDateString("id-ID")
}

function formatPercent(value?: number | null) {
  const safe = Number(value || 0)
  return `${safe.toFixed(2)}%`
}

export default function WorkOrderManager({
  initialWorkOrders,
  users,
  customers,
  inventoryItems,
  boms,
  organizationId,
}: WorkOrderManagerProps) {
  const [activeTab, setActiveTab] = useState<"operasional" | "laporan">("operasional")
  const [isCreateOpen, setIsCreateOpen] = useState(false)
  const [error, setError] = useState("")
  const [isPending, startTransition] = useTransition()

  const [formData, setFormData] = useState({
    code: "",
    barcode: "",
    title: "",
    description: "",
    customerId: "",
    priority: "MEDIUM",
    assignedTo: "",
    startDate: "",
    dueDate: "",
    estimatedHours: "",
    productItemId: "",
    plannedQty: "",
    items: [] as { description: string; quantity: string; unit: string; unitPrice: string; itemId: string }[],
  })

  const [releaseBomByWo, setReleaseBomByWo] = useState<Record<string, string>>({})
  const [releaseQtyByWo, setReleaseQtyByWo] = useState<Record<string, string>>({})
  const [issueItemByWo, setIssueItemByWo] = useState<Record<string, string>>({})
  const [issueQtyByWo, setIssueQtyByWo] = useState<Record<string, string>>({})
  const [costTypeByWo, setCostTypeByWo] = useState<Record<string, WorkOrderCostType>>({})
  const [costAmountByWo, setCostAmountByWo] = useState<Record<string, string>>({})
  const [costReferenceByWo, setCostReferenceByWo] = useState<Record<string, string>>({})
  const [costDescriptionByWo, setCostDescriptionByWo] = useState<Record<string, string>>({})
  const [completeQtyByWo, setCompleteQtyByWo] = useState<Record<string, string>>({})
  const [expandedWorkOrderId, setExpandedWorkOrderId] = useState<string | null>(null)
  const [bomPreviewByWo, setBomPreviewByWo] = useState<Record<string, BomExplosionPreview | null>>({})
  const [chainMessageByWo, setChainMessageByWo] = useState<Record<string, string>>({})

  const [reportSearch, setReportSearch] = useState("")
  const [reportStatus, setReportStatus] = useState("ALL")
  const [reportAssignedTo, setReportAssignedTo] = useState("ALL")
  const [reportCustomerId, setReportCustomerId] = useState("ALL")
  const [reportDateFrom, setReportDateFrom] = useState("")
  const [reportDateTo, setReportDateTo] = useState("")

  const router = useRouter()

  const workOrders = initialWorkOrders

  const activeProductionItems = useMemo(
    () => inventoryItems.filter((item) => ["FINISHED_GOOD", "SEMI_FINISHED"].includes(item.itemType || "")),
    [inventoryItems],
  )

  const filteredReportRows = useMemo(() => {
    return workOrders.filter((wo) => {
      const q = reportSearch.trim().toLowerCase()
      const woDate = new Date(wo.createdAt)
      const fromDate = reportDateFrom ? new Date(`${reportDateFrom}T00:00:00`) : null
      const toDate = reportDateTo ? new Date(`${reportDateTo}T23:59:59`) : null

      if (q) {
        const haystack = `${wo.code} ${wo.title} ${wo.description || ""} ${wo.customer?.name || ""} ${wo.assignedUser?.name || ""}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }

      if (reportStatus !== "ALL" && wo.status !== reportStatus) return false
      if (reportAssignedTo !== "ALL" && (wo.assignedUser?.id || "") !== reportAssignedTo) return false
      if (reportCustomerId !== "ALL" && (wo.customer?.id || "") !== reportCustomerId) return false
      if (fromDate && woDate < fromDate) return false
      if (toDate && woDate > toDate) return false

      return true
    })
  }, [workOrders, reportSearch, reportStatus, reportAssignedTo, reportCustomerId, reportDateFrom, reportDateTo])

  const reportSummary = useMemo(() => {
    const totalPlanned = filteredReportRows.reduce((sum, row) => sum + (row.plannedTotalCost || 0), 0)
    const totalActual = filteredReportRows.reduce((sum, row) => sum + (row.actualTotalCost || 0), 0)
    const totalVariance = filteredReportRows.reduce((sum, row) => sum + (row.varianceAmount || 0), 0)
    return {
      totalPlanned,
      totalActual,
      totalVariance,
      totalCount: filteredReportRows.length,
    }
  }, [filteredReportRows])

  const reportByProduct = useMemo(() => {
    const grouped = new Map<string, { key: string; label: string; woCount: number; planned: number; actual: number; variance: number }>()
    for (const wo of filteredReportRows) {
      const key = wo.productItem?.id || "UNASSIGNED"
      const label = wo.productItem ? `${wo.productItem.code} - ${wo.productItem.name}` : "Tanpa Product Item"
      const current = grouped.get(key) || { key, label, woCount: 0, planned: 0, actual: 0, variance: 0 }
      current.woCount += 1
      current.planned += wo.plannedTotalCost || 0
      current.actual += wo.actualTotalCost || 0
      current.variance += wo.varianceAmount || 0
      grouped.set(key, current)
    }

    return Array.from(grouped.values()).sort((a, b) => b.actual - a.actual)
  }, [filteredReportRows])

  const reportByMonth = useMemo(() => {
    const grouped = new Map<string, { month: string; woCount: number; planned: number; actual: number; variance: number }>()
    for (const wo of filteredReportRows) {
      const date = new Date(wo.createdAt)
      if (Number.isNaN(date.getTime())) continue
      const month = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`
      const current = grouped.get(month) || { month, woCount: 0, planned: 0, actual: 0, variance: 0 }
      current.woCount += 1
      current.planned += wo.plannedTotalCost || 0
      current.actual += wo.actualTotalCost || 0
      current.variance += wo.varianceAmount || 0
      grouped.set(month, current)
    }

    return Array.from(grouped.values()).sort((a, b) => a.month.localeCompare(b.month))
  }, [filteredReportRows])

  const handleCreateSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError("")

    startTransition(async () => {
      try {
        await createWorkOrder({
          organizationId,
          code: formData.code,
          barcode: formData.barcode || undefined,
          title: formData.title,
          description: formData.description || undefined,
          customerId: formData.customerId || undefined,
          priority: formData.priority,
          assignedTo: formData.assignedTo || undefined,
          productItemId: formData.productItemId || undefined,
          plannedQty: formData.plannedQty ? Number(formData.plannedQty) : undefined,
          startDate: formData.startDate ? new Date(formData.startDate) : undefined,
          dueDate: formData.dueDate ? new Date(formData.dueDate) : undefined,
          estimatedHours: formData.estimatedHours ? Number(formData.estimatedHours) : undefined,
          items: formData.items.map((i) => ({
            itemId: i.itemId || undefined,
            description: i.description,
            quantity: Number(i.quantity),
            unit: i.unit,
            unitPrice: Number(i.unitPrice),
          })),
        })

        setIsCreateOpen(false)
        setFormData({
          code: "",
          barcode: "",
          title: "",
          description: "",
          customerId: "",
          priority: "MEDIUM",
          assignedTo: "",
          startDate: "",
          dueDate: "",
          estimatedHours: "",
          productItemId: "",
          plannedQty: "",
          items: [],
        })
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal membuat work order.")
      }
    })
  }

  const handleStatusChange = (id: string, status: string) => {
    setError("")
    startTransition(async () => {
      try {
        await updateWorkOrderStatus(id, status)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal update status.")
      }
    })
  }

  const handleRelease = (workOrderId: string) => {
    const bomId = releaseBomByWo[workOrderId]
    const plannedQty = Number(releaseQtyByWo[workOrderId] || 0)
    if (!bomId) {
      setError("Pilih BOM sebelum release WO.")
      return
    }
    if (plannedQty <= 0) {
      setError("Planned qty harus > 0.")
      return
    }

    setError("")
    startTransition(async () => {
      try {
        await releaseWorkOrderFromBom(workOrderId, bomId, plannedQty)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal release WO.")
      }
    })
  }

  const handleIssueMaterial = (workOrderId: string) => {
    const itemId = issueItemByWo[workOrderId]
    const qty = Number(issueQtyByWo[workOrderId] || 0)
    if (!itemId) {
      setError("Pilih item material untuk issue.")
      return
    }
    if (qty <= 0) {
      setError("Qty issue harus > 0.")
      return
    }

    setError("")
    startTransition(async () => {
      try {
        await issueWorkOrderMaterial({ workOrderId, itemId, issuedQty: qty })
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal issue material.")
      }
    })
  }

  const handleAddCost = (workOrderId: string) => {
    const costType = costTypeByWo[workOrderId] || "LABOR"
    const amount = Number(costAmountByWo[workOrderId] || 0)
    const reference = (costReferenceByWo[workOrderId] || "").trim()
    const description = (costDescriptionByWo[workOrderId] || "").trim()
    if (amount <= 0) {
      setError("Amount biaya harus > 0.")
      return
    }

    setError("")
    startTransition(async () => {
      try {
        await addWorkOrderCostEntry({
          workOrderId,
          costType,
          amount,
          reference: reference || undefined,
          description: description || undefined,
        })
        setCostAmountByWo((current) => ({ ...current, [workOrderId]: "" }))
        setCostReferenceByWo((current) => ({ ...current, [workOrderId]: "" }))
        setCostDescriptionByWo((current) => ({ ...current, [workOrderId]: "" }))
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal menambah biaya aktual.")
      }
    })
  }

  const handleComplete = (workOrderId: string) => {
    const qty = Number(completeQtyByWo[workOrderId] || 0)
    if (qty <= 0) {
      setError("Actual qty harus > 0.")
      return
    }

    setError("")
    startTransition(async () => {
      try {
        await completeWorkOrder(workOrderId, qty)
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal complete WO.")
      }
    })
  }

  const handlePreviewBom = (workOrderId: string, mode: "single-level" | "multi-level") => {
    const bomId = releaseBomByWo[workOrderId]
    const plannedQty = Number(releaseQtyByWo[workOrderId] || 0)
    if (!bomId) {
      setError("Pilih BOM sebelum preview tree.")
      return
    }
    if (plannedQty <= 0) {
      setError("Planned qty harus > 0 untuk preview.")
      return
    }

    setError("")
    startTransition(async () => {
      try {
        const preview = await previewBomExplosion({ bomId, plannedQty, mode, maxDepth: 12 })
        setBomPreviewByWo((current) => ({ ...current, [workOrderId]: preview }))
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal preview BOM.")
      }
    })
  }

  const handleGenerateChain = (wo: WorkOrder) => {
    const bomId = releaseBomByWo[wo.id] || wo.bom?.id
    const plannedQty = Number(releaseQtyByWo[wo.id] || wo.plannedQty || 0)
    if (!bomId) {
      setError("Pilih BOM atau release BOM terlebih dahulu sebelum generate chain.")
      return
    }
    if (plannedQty <= 0) {
      setError("Planned qty harus > 0 sebelum generate chain.")
      return
    }

    setError("")
    setChainMessageByWo((current) => ({ ...current, [wo.id]: "" }))
    startTransition(async () => {
      try {
        const result = await generateWorkOrderChain({ workOrderId: wo.id, bomId, plannedQty, maxLevels: 6 })
        setChainMessageByWo((current) => ({
          ...current,
          [wo.id]: `Recursive chain selesai. Created: ${result.created}, Reused: ${result.reused || 0}, Skipped: ${result.skipped}.`,
        }))
        router.refresh()
      } catch (err) {
        setError(err instanceof Error ? err.message : "Gagal generate WO chain.")
      }
    })
  }

  const handleAddItem = () => {
    setFormData((current) => ({
      ...current,
      items: [...current.items, { description: "", quantity: "1", unit: "pcs", unitPrice: "0", itemId: "" }],
    }))
  }

  const handleItemChange = (index: number, field: "description" | "quantity" | "unit" | "unitPrice" | "itemId", value: string) => {
    setFormData((current) => {
      const next = [...current.items]
      next[index] = { ...next[index], [field]: value }
      if (field === "itemId") {
        const item = inventoryItems.find((row) => row.id === value)
        if (item) {
          next[index].description = `${item.code} - ${item.name}`
          next[index].unit = item.unit
          next[index].unitPrice = String(item.unitCost || 0)
        }
      }
      return { ...current, items: next }
    })
  }

  const handleRemoveItem = (index: number) => {
    setFormData((current) => ({ ...current, items: current.items.filter((_, i) => i !== index) }))
  }

  const buildReportHtml = () => {
    const rows = filteredReportRows
      .map(
        (wo) => `
          <tr>
            <td>${wo.code}</td>
            <td>${wo.title}</td>
            <td>${wo.status}</td>
            <td>${wo.customer?.name || "-"}</td>
            <td>${wo.assignedUser?.name || "-"}</td>
            <td style="text-align:right;">${formatCurrency(wo.plannedTotalCost)}</td>
            <td style="text-align:right;">${formatCurrency(wo.actualTotalCost)}</td>
            <td style="text-align:right;">${formatCurrency(wo.hppPerUnit)}</td>
            <td style="text-align:right;">${formatCurrency(wo.varianceAmount)}</td>
            <td style="text-align:right;">${formatPercent(wo.variancePercent)}</td>
          </tr>
        `,
      )
      .join("")

    return `
      <html>
        <head>
          <title>Laporan Work Order</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 24px; }
            h1 { margin-bottom: 8px; }
            .meta { color: #64748b; margin-bottom: 12px; }
            table { width: 100%; border-collapse: collapse; }
            th, td { border: 1px solid #cbd5e1; padding: 8px; font-size: 12px; }
            th { background: #f1f5f9; text-align: left; }
            .summary { margin: 16px 0; font-size: 13px; }
          </style>
        </head>
        <body>
          <h1>Laporan Work Order</h1>
          <div class="meta">Generated: ${new Date().toLocaleString("id-ID")}</div>
          <div class="summary">
            Total WO: <b>${reportSummary.totalCount}</b> |
            Planned: <b>${formatCurrency(reportSummary.totalPlanned)}</b> |
            Actual: <b>${formatCurrency(reportSummary.totalActual)}</b> |
            Variance: <b>${formatCurrency(reportSummary.totalVariance)}</b>
          </div>
          <table>
            <thead>
              <tr>
                <th>Kode</th>
                <th>Judul</th>
                <th>Status</th>
                <th>Customer</th>
                <th>Assigned</th>
                <th>Planned Cost</th>
                <th>Actual Cost</th>
                <th>HPP/Unit</th>
                <th>Variance</th>
                <th>Variance %</th>
              </tr>
            </thead>
            <tbody>${rows}</tbody>
          </table>
        </body>
      </html>
    `
  }

  const printReport = () => {
    const win = window.open("", "_blank")
    if (!win) return
    win.document.write(buildReportHtml())
    win.document.close()
    win.print()
  }

  const shareReportWhatsApp = () => {
    const summary = `Laporan WO\nTotal WO: ${reportSummary.totalCount}\nPlanned: ${formatCurrency(reportSummary.totalPlanned)}\nActual: ${formatCurrency(reportSummary.totalActual)}\nVariance: ${formatCurrency(reportSummary.totalVariance)}`
    window.open(`https://wa.me/?text=${encodeURIComponent(summary)}`, "_blank")
  }

  const exportReportPdf = () => {
    // Browser print dialog allows Save as PDF.
    printReport()
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">Work Order</h2>
          <p className="text-sm text-slate-500">Operasional produksi + costing + laporan</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setActiveTab("operasional")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "operasional" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            Operasional
          </button>
          <button
            onClick={() => setActiveTab("laporan")}
            className={`rounded-lg px-4 py-2 text-sm font-semibold ${activeTab === "laporan" ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700"}`}
          >
            Laporan
          </button>
          {activeTab === "operasional" && (
            <button
              onClick={() => setIsCreateOpen(true)}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
            >
              + Buat WO
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      {activeTab === "operasional" && (
        <div className="grid gap-4">
          {workOrders.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-6 text-center text-slate-500">Belum ada work order</div>
          ) : (
            workOrders.map((wo) => {
              const materialOptions = (wo.items || []).filter((row) => row.itemId)
              const selectedBom = releaseBomByWo[wo.id] || ""
              const isExpanded = expandedWorkOrderId === wo.id

              return (
                <div key={wo.id} className="rounded-xl border border-slate-200 bg-white p-4">
                  <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="font-semibold">{wo.code}</h3>
                        <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-medium text-slate-700">{wo.priority}</span>
                      </div>
                      <p className="font-medium">{wo.title}</p>
                      <p className="text-sm text-slate-500">{wo.description || "-"}</p>
                    </div>
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">{wo.status}</span>
                  </div>

                  <div className="mb-4 grid grid-cols-2 gap-2 text-sm md:grid-cols-4">
                    <div><span className="text-slate-500">Assigned:</span><p className="font-medium">{wo.assignedUser?.name || "-"}</p></div>
                    <div><span className="text-slate-500">Customer:</span><p className="font-medium">{wo.customer?.name || "-"}</p></div>
                    <div><span className="text-slate-500">Produk Jadi:</span><p className="font-medium">{wo.productItem ? `${wo.productItem.code} - ${wo.productItem.name}` : "-"}</p></div>
                    <div><span className="text-slate-500">BOM:</span><p className="font-medium">{wo.bom ? `${wo.bom.code} v${wo.bom.version}` : "-"}</p></div>
                    <div><span className="text-slate-500">Planned:</span><p className="font-medium">{formatCurrency(wo.plannedTotalCost)}</p></div>
                    <div><span className="text-slate-500">Actual:</span><p className="font-medium">{formatCurrency(wo.actualTotalCost)}</p></div>
                    <div><span className="text-slate-500">HPP/Unit:</span><p className="font-medium">{formatCurrency(wo.hppPerUnit)}</p></div>
                    <div><span className="text-slate-500">Variance:</span><p className="font-medium">{formatCurrency(wo.varianceAmount)}</p></div>
                    <div><span className="text-slate-500">Planned Qty:</span><p className="font-medium">{wo.plannedQty || 0}</p></div>
                    <div><span className="text-slate-500">Actual Qty:</span><p className="font-medium">{wo.actualQty || 0}</p></div>
                    <div><span className="text-slate-500">Variance %:</span><p className="font-medium">{formatPercent(wo.variancePercent)}</p></div>
                    <div><span className="text-slate-500">Dibuat:</span><p className="font-medium">{formatDate(wo.createdAt)}</p></div>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-2">
                    <select
                      value={wo.status}
                      onChange={(e) => handleStatusChange(wo.id, e.target.value)}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="DRAFT">DRAFT</option>
                      <option value="RELEASED">RELEASED</option>
                      <option value="IN_PROGRESS">IN PROGRESS</option>
                      <option value="COMPLETED">COMPLETED</option>
                      <option value="CLOSED">CLOSED</option>
                      <option value="CANCELLED">CANCELLED</option>
                      <option value="PENDING">PENDING (LEGACY)</option>
                    </select>

                    <select
                      value={selectedBom}
                      onChange={(e) => setReleaseBomByWo((current) => ({ ...current, [wo.id]: e.target.value }))}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Pilih BOM</option>
                      {boms.map((bom) => (
                        <option key={bom.id} value={bom.id}>{bom.code} v{bom.version} - {bom.name}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Planned Qty"
                      value={releaseQtyByWo[wo.id] || ""}
                      onChange={(e) => setReleaseQtyByWo((current) => ({ ...current, [wo.id]: e.target.value }))}
                      className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button
                      disabled={isPending}
                      onClick={() => handleRelease(wo.id)}
                      className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
                    >
                      Release BOM
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => handlePreviewBom(wo.id, "single-level")}
                      className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm font-semibold text-blue-700 hover:bg-blue-100 disabled:opacity-60"
                    >
                      Preview Single-Level
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => handlePreviewBom(wo.id, "multi-level")}
                      className="rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 hover:bg-indigo-100 disabled:opacity-60"
                    >
                      Preview Multi-Level
                    </button>
                    <button
                      disabled={isPending}
                      onClick={() => handleGenerateChain(wo)}
                      className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700 hover:bg-emerald-100 disabled:opacity-60"
                    >
                      Generate Recursive Chain
                    </button>
                  </div>

                  {chainMessageByWo[wo.id] && (
                    <div className="mb-3 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                      {chainMessageByWo[wo.id]}
                    </div>
                  )}

                  {bomPreviewByWo[wo.id] && (
                    <div className="mb-4 rounded-lg border border-indigo-200 bg-indigo-50/50 p-3">
                      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-indigo-800">
                          BOM Tree Preview ({bomPreviewByWo[wo.id]?.mode})
                        </p>
                        <p className="text-sm text-indigo-700">
                          Simulasi Material Cost: {formatCurrency(bomPreviewByWo[wo.id]?.totalMaterialCost)}
                        </p>
                      </div>
                      <div className="overflow-x-auto rounded-lg border border-indigo-100 bg-white">
                        <table className="w-full text-sm">
                          <thead className="bg-indigo-50 text-left text-indigo-700">
                            <tr>
                              <th className="px-3 py-2">Komponen</th>
                              <th className="px-3 py-2 text-right">Depth</th>
                              <th className="px-3 py-2 text-right">Qty</th>
                              <th className="px-3 py-2">Unit</th>
                              <th className="px-3 py-2 text-right">Unit Cost</th>
                              <th className="px-3 py-2 text-right">Total</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-indigo-50">
                            {(bomPreviewByWo[wo.id]?.lines || []).map((line, index) => (
                              <tr key={`${line.itemId}-${line.depth}-${index}`}>
                                <td className="px-3 py-2">
                                  <span style={{ paddingLeft: `${(line.depth - 1) * 16}px` }}>
                                    {line.depth > 1 ? "↳ " : ""}
                                    {line.code} - {line.name}
                                  </span>
                                  {line.itemType === "SEMI_FINISHED" && (
                                    <span className="ml-2 rounded bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                                      Semi-Finished
                                    </span>
                                  )}
                                </td>
                                <td className="px-3 py-2 text-right">{line.depth}</td>
                                <td className="px-3 py-2 text-right">{line.quantity.toFixed(4)}</td>
                                <td className="px-3 py-2">{line.unit}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(line.unitCost)}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(line.totalCost)}</td>
                              </tr>
                            ))}
                            {(bomPreviewByWo[wo.id]?.lines || []).length === 0 && (
                              <tr>
                                <td colSpan={6} className="px-3 py-3 text-center text-slate-500">Tidak ada komponen BOM.</td>
                              </tr>
                            )}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}

                  <div className="mb-3 flex flex-wrap gap-2">
                    <select
                      value={issueItemByWo[wo.id] || ""}
                      onChange={(e) => setIssueItemByWo((current) => ({ ...current, [wo.id]: e.target.value }))}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="">Pilih Material</option>
                      {materialOptions.map((row) => (
                        <option key={row.id} value={row.itemId || ""}>{row.description}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Issue Qty"
                      value={issueQtyByWo[wo.id] || ""}
                      onChange={(e) => setIssueQtyByWo((current) => ({ ...current, [wo.id]: e.target.value }))}
                      className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button
                      disabled={isPending}
                      onClick={() => handleIssueMaterial(wo.id)}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
                    >
                      Issue Material
                    </button>
                  </div>

                  <div className="mb-3 flex flex-wrap gap-2">
                    <select
                      value={costTypeByWo[wo.id] || "LABOR"}
                      onChange={(e) => setCostTypeByWo((current) => ({ ...current, [wo.id]: e.target.value as WorkOrderCostType }))}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    >
                      <option value="LABOR">LABOR</option>
                      <option value="OVERHEAD">OVERHEAD</option>
                      <option value="MACHINE">MACHINE</option>
                      <option value="SUBCONTRACT">SUBCONTRACT</option>
                      <option value="WASTE">WASTE</option>
                    </select>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="Amount"
                      value={costAmountByWo[wo.id] || ""}
                      onChange={(e) => setCostAmountByWo((current) => ({ ...current, [wo.id]: e.target.value }))}
                      className="w-36 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Reference (opsional)"
                      value={costReferenceByWo[wo.id] || ""}
                      onChange={(e) => setCostReferenceByWo((current) => ({ ...current, [wo.id]: e.target.value }))}
                      className="w-44 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <input
                      type="text"
                      placeholder="Deskripsi biaya (opsional)"
                      value={costDescriptionByWo[wo.id] || ""}
                      onChange={(e) => setCostDescriptionByWo((current) => ({ ...current, [wo.id]: e.target.value }))}
                      className="w-52 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button
                      disabled={isPending}
                      onClick={() => handleAddCost(wo.id)}
                      className="rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white hover:bg-amber-700 disabled:opacity-60"
                    >
                      Tambah Biaya Aktual
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      placeholder="Actual Qty"
                      value={completeQtyByWo[wo.id] || ""}
                      onChange={(e) => setCompleteQtyByWo((current) => ({ ...current, [wo.id]: e.target.value }))}
                      className="w-32 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    />
                    <button
                      disabled={isPending}
                      onClick={() => handleComplete(wo.id)}
                      className="rounded-lg bg-violet-600 px-3 py-2 text-sm font-semibold text-white hover:bg-violet-700 disabled:opacity-60"
                    >
                      Complete WO
                    </button>
                    <button
                      onClick={() => setExpandedWorkOrderId((current) => (current === wo.id ? null : wo.id))}
                      className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      {isExpanded ? "Sembunyikan Detail" : "Lihat Detail Costing"}
                    </button>
                  </div>

                  {isExpanded && (
                    <div className="space-y-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <div>
                        <h4 className="mb-2 text-sm font-semibold text-slate-700">WO Chain (Semi-Finished)</h4>
                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left text-slate-600">
                              <tr>
                                <th className="px-3 py-2">Level</th>
                                <th className="px-3 py-2">Komponen</th>
                                <th className="px-3 py-2">Child WO</th>
                                <th className="px-3 py-2">Status</th>
                                <th className="px-3 py-2 text-right">Required Qty</th>
                                <th className="px-3 py-2 text-right">Planned Qty</th>
                                <th className="px-3 py-2 text-right">Actual Qty</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(wo.chainChildren || []).map((child) => (
                                <tr key={`${child.childWorkOrderId}-${child.componentItemId}`}>
                                  <td className="px-3 py-2">{child.generationLevel}</td>
                                  <td className="px-3 py-2">{child.componentCode ? `${child.componentCode} - ${child.componentName || ""}` : child.componentItemId}</td>
                                  <td className="px-3 py-2">
                                    <span className="font-medium">{child.childCode}</span>
                                    <div className="text-xs text-slate-500">{child.childTitle}</div>
                                  </td>
                                  <td className="px-3 py-2">{child.childStatus}</td>
                                  <td className="px-3 py-2 text-right">{Number(child.requiredQty || 0).toFixed(4)}</td>
                                  <td className="px-3 py-2 text-right">{Number(child.childPlannedQty || 0).toFixed(4)}</td>
                                  <td className="px-3 py-2 text-right">{Number(child.childActualQty || 0).toFixed(4)}</td>
                                </tr>
                              ))}
                              {(wo.chainChildren || []).length === 0 && (
                                <tr>
                                  <td colSpan={7} className="px-3 py-4 text-center text-slate-500">Belum ada child WO chain untuk WO ini.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div>
                        <h4 className="mb-2 text-sm font-semibold text-slate-700">Costing Summary (Planned vs Actual)</h4>
                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left text-slate-600">
                              <tr>
                                <th className="px-3 py-2">Komponen</th>
                                <th className="px-3 py-2 text-right">Planned</th>
                                <th className="px-3 py-2 text-right">Actual</th>
                                <th className="px-3 py-2 text-right">Selisih</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {[
                                { label: "Material", planned: wo.plannedMaterialCost || 0, actual: wo.actualMaterialCost || 0 },
                                { label: "Labor", planned: wo.plannedLaborCost || 0, actual: wo.actualLaborCost || 0 },
                                { label: "Overhead", planned: wo.plannedOverheadCost || 0, actual: wo.actualOverheadCost || 0 },
                                { label: "Machine", planned: wo.plannedMachineCost || 0, actual: wo.actualMachineCost || 0 },
                                { label: "Subcontract", planned: wo.plannedSubcontractCost || 0, actual: wo.actualSubcontractCost || 0 },
                                { label: "Waste (-)", planned: wo.plannedWasteValue || 0, actual: wo.actualWasteValue || 0 },
                              ].map((row) => (
                                <tr key={row.label}>
                                  <td className="px-3 py-2">{row.label}</td>
                                  <td className="px-3 py-2 text-right">{formatCurrency(row.planned)}</td>
                                  <td className="px-3 py-2 text-right">{formatCurrency(row.actual)}</td>
                                  <td className="px-3 py-2 text-right">{formatCurrency(row.actual - row.planned)}</td>
                                </tr>
                              ))}
                              <tr className="bg-slate-50 font-semibold">
                                <td className="px-3 py-2">Total</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(wo.plannedTotalCost)}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency(wo.actualTotalCost)}</td>
                                <td className="px-3 py-2 text-right">{formatCurrency((wo.actualTotalCost || 0) - (wo.plannedTotalCost || 0))}</td>
                              </tr>
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div>
                        <h4 className="mb-2 text-sm font-semibold text-slate-700">BOM Snapshot</h4>
                        <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50 text-left text-slate-600">
                              <tr>
                                <th className="px-3 py-2">Item</th>
                                <th className="px-3 py-2 text-right">Qty Plan</th>
                                <th className="px-3 py-2">Unit</th>
                                <th className="px-3 py-2 text-right">Unit Cost</th>
                                <th className="px-3 py-2 text-right">Total</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {(wo.items || []).map((item) => (
                                <tr key={item.id}>
                                  <td className="px-3 py-2">{item.description}</td>
                                  <td className="px-3 py-2 text-right">{item.quantity}</td>
                                  <td className="px-3 py-2">{item.unit || "-"}</td>
                                  <td className="px-3 py-2 text-right">{formatCurrency(item.unitPrice)}</td>
                                  <td className="px-3 py-2 text-right">{formatCurrency(item.totalPrice)}</td>
                                </tr>
                              ))}
                              {(wo.items || []).length === 0 && (
                                <tr>
                                  <td colSpan={5} className="px-3 py-4 text-center text-slate-500">Belum ada snapshot BOM/item material.</td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>

                      <div className="grid gap-4 lg:grid-cols-2">
                        <div>
                          <h4 className="mb-2 text-sm font-semibold text-slate-700">Material Issue Log</h4>
                          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50 text-left text-slate-600">
                                <tr>
                                  <th className="px-3 py-2">Tanggal</th>
                                  <th className="px-3 py-2">Item</th>
                                  <th className="px-3 py-2 text-right">Qty</th>
                                  <th className="px-3 py-2 text-right">Total Cost</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(wo.materialIssues || []).map((issue) => (
                                  <tr key={issue.id}>
                                    <td className="px-3 py-2">{formatDate(issue.createdAt)}</td>
                                    <td className="px-3 py-2">{issue.item ? `${issue.item.code} - ${issue.item.name}` : "-"}</td>
                                    <td className="px-3 py-2 text-right">{issue.issuedQty}</td>
                                    <td className="px-3 py-2 text-right">{formatCurrency(issue.totalCost)}</td>
                                  </tr>
                                ))}
                                {(wo.materialIssues || []).length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="px-3 py-4 text-center text-slate-500">Belum ada issue material.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>

                        <div>
                          <h4 className="mb-2 text-sm font-semibold text-slate-700">Cost Entry Log</h4>
                          <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
                            <table className="w-full text-sm">
                              <thead className="bg-slate-50 text-left text-slate-600">
                                <tr>
                                  <th className="px-3 py-2">Tanggal</th>
                                  <th className="px-3 py-2">Type</th>
                                  <th className="px-3 py-2">Reference</th>
                                  <th className="px-3 py-2 text-right">Amount</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100">
                                {(wo.costEntries || []).map((entry) => (
                                  <tr key={entry.id}>
                                    <td className="px-3 py-2">{formatDate(entry.entryDate)}</td>
                                    <td className="px-3 py-2">{entry.costType}</td>
                                    <td className="px-3 py-2">{entry.reference || "-"}</td>
                                    <td className="px-3 py-2 text-right">{formatCurrency(entry.amount)}</td>
                                  </tr>
                                ))}
                                {(wo.costEntries || []).length === 0 && (
                                  <tr>
                                    <td colSpan={4} className="px-3 py-4 text-center text-slate-500">Belum ada cost entry.</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {activeTab === "laporan" && (
        <div className="space-y-4">
          <div className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 md:grid-cols-3 lg:grid-cols-6">
            <input
              value={reportSearch}
              onChange={(e) => setReportSearch(e.target.value)}
              placeholder="Cari kode/judul/customer"
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            />
            <select value={reportStatus} onChange={(e) => setReportStatus(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="ALL">Semua Status</option>
              {["DRAFT", "RELEASED", "IN_PROGRESS", "COMPLETED", "CLOSED", "CANCELLED", "PENDING"].map((status) => (
                <option key={status} value={status}>{status}</option>
              ))}
            </select>
            <select value={reportAssignedTo} onChange={(e) => setReportAssignedTo(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="ALL">Semua Assigned</option>
              {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
            </select>
            <select value={reportCustomerId} onChange={(e) => setReportCustomerId(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
              <option value="ALL">Semua Customer</option>
              {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.name}</option>)}
            </select>
            <input type="date" value={reportDateFrom} onChange={(e) => setReportDateFrom(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
            <input type="date" value={reportDateTo} onChange={(e) => setReportDateTo(e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          </div>

          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Total WO</p><p className="text-lg font-bold">{reportSummary.totalCount}</p></div>
            <div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Planned Cost</p><p className="text-lg font-bold">{formatCurrency(reportSummary.totalPlanned)}</p></div>
            <div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Actual Cost</p><p className="text-lg font-bold">{formatCurrency(reportSummary.totalActual)}</p></div>
            <div className="rounded-lg border border-slate-200 bg-white p-3"><p className="text-xs text-slate-500">Variance</p><p className="text-lg font-bold">{formatCurrency(reportSummary.totalVariance)}</p></div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-700">Variance per Produk</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Produk</th>
                    <th className="px-4 py-3 text-right">WO</th>
                    <th className="px-4 py-3 text-right">Actual</th>
                    <th className="px-4 py-3 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportByProduct.map((row) => (
                    <tr key={row.key}>
                      <td className="px-4 py-3">{row.label}</td>
                      <td className="px-4 py-3 text-right">{row.woCount}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(row.actual)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(row.variance)}</td>
                    </tr>
                  ))}
                  {reportByProduct.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">Tidak ada data produk.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-4 py-3">
                <h3 className="text-sm font-semibold text-slate-700">Variance per Periode</h3>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-slate-600">
                  <tr>
                    <th className="px-4 py-3">Periode</th>
                    <th className="px-4 py-3 text-right">WO</th>
                    <th className="px-4 py-3 text-right">Actual</th>
                    <th className="px-4 py-3 text-right">Variance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {reportByMonth.map((row) => (
                    <tr key={row.month}>
                      <td className="px-4 py-3">{row.month}</td>
                      <td className="px-4 py-3 text-right">{row.woCount}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(row.actual)}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(row.variance)}</td>
                    </tr>
                  ))}
                  {reportByMonth.length === 0 && (
                    <tr>
                      <td colSpan={4} className="px-4 py-8 text-center text-slate-500">Tidak ada data periode.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button onClick={printReport} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Cetak</button>
            <button onClick={shareReportWhatsApp} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">Share WhatsApp</button>
            <button onClick={exportReportPdf} className="rounded-lg bg-rose-600 px-3 py-2 text-sm font-semibold text-white">PDF</button>
          </div>

          <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-left text-slate-600">
                <tr>
                  <th className="px-4 py-3">Kode</th>
                  <th className="px-4 py-3">Judul</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Customer</th>
                  <th className="px-4 py-3">Assigned</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3 text-right">Planned</th>
                  <th className="px-4 py-3 text-right">Actual</th>
                  <th className="px-4 py-3 text-right">HPP/Unit</th>
                  <th className="px-4 py-3 text-right">Variance</th>
                  <th className="px-4 py-3 text-right">Variance %</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredReportRows.map((wo) => (
                  <tr key={wo.id}>
                    <td className="px-4 py-3 font-medium">{wo.code}</td>
                    <td className="px-4 py-3">{wo.title}</td>
                    <td className="px-4 py-3">{wo.status}</td>
                    <td className="px-4 py-3">{wo.customer?.name || "-"}</td>
                    <td className="px-4 py-3">{wo.assignedUser?.name || "-"}</td>
                    <td className="px-4 py-3">{formatDate(wo.createdAt)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(wo.plannedTotalCost)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(wo.actualTotalCost)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(wo.hppPerUnit)}</td>
                    <td className="px-4 py-3 text-right">{formatCurrency(wo.varianceAmount)}</td>
                    <td className="px-4 py-3 text-right">{formatPercent(wo.variancePercent)}</td>
                  </tr>
                ))}
                {filteredReportRows.length === 0 && (
                  <tr>
                    <td colSpan={11} className="px-4 py-8 text-center text-slate-500">Tidak ada data sesuai filter.</td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {isCreateOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-xl bg-white p-6">
            <h3 className="mb-4 text-lg font-semibold">Buat Work Order Baru</h3>
            <form onSubmit={handleCreateSubmit} className="space-y-4">
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input placeholder="Kode WO" value={formData.code} onChange={(e) => setFormData((c) => ({ ...c, code: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" required />
                <input placeholder="Barcode (opsional)" value={formData.barcode} onChange={(e) => setFormData((c) => ({ ...c, barcode: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" />
              </div>

              <input placeholder="Judul WO" value={formData.title} onChange={(e) => setFormData((c) => ({ ...c, title: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" required />
              <textarea placeholder="Deskripsi" value={formData.description} onChange={(e) => setFormData((c) => ({ ...c, description: e.target.value }))} className="w-full rounded-lg border border-slate-300 px-3 py-2" rows={3} />

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <select value={formData.customerId} onChange={(e) => setFormData((c) => ({ ...c, customerId: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2">
                  <option value="">Pilih Customer</option>
                  {customers.map((customer) => <option key={customer.id} value={customer.id}>{customer.code} - {customer.name}</option>)}
                </select>
                <select value={formData.assignedTo} onChange={(e) => setFormData((c) => ({ ...c, assignedTo: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2">
                  <option value="">Pilih Assigned User</option>
                  {users.map((user) => <option key={user.id} value={user.id}>{user.name}</option>)}
                </select>
                <select value={formData.priority} onChange={(e) => setFormData((c) => ({ ...c, priority: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2">
                  <option value="LOW">LOW</option>
                  <option value="MEDIUM">MEDIUM</option>
                  <option value="HIGH">HIGH</option>
                  <option value="URGENT">URGENT</option>
                </select>
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                <select value={formData.productItemId} onChange={(e) => setFormData((c) => ({ ...c, productItemId: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2">
                  <option value="">Produk Jadi (Opsional)</option>
                  {activeProductionItems.map((item) => <option key={item.id} value={item.id}>{item.code} - {item.name}</option>)}
                </select>
                <input type="number" min="0" step="0.01" placeholder="Planned Qty" value={formData.plannedQty} onChange={(e) => setFormData((c) => ({ ...c, plannedQty: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" />
                <input type="number" min="0" step="0.5" placeholder="Estimated Hours" value={formData.estimatedHours} onChange={(e) => setFormData((c) => ({ ...c, estimatedHours: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" />
              </div>

              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <input type="date" value={formData.startDate} onChange={(e) => setFormData((c) => ({ ...c, startDate: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" />
                <input type="date" value={formData.dueDate} onChange={(e) => setFormData((c) => ({ ...c, dueDate: e.target.value }))} className="rounded-lg border border-slate-300 px-3 py-2" />
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <label className="text-sm font-medium">Item Manual</label>
                  <button type="button" onClick={handleAddItem} className="text-sm font-semibold text-blue-600">+ Tambah Item</button>
                </div>
                {formData.items.map((item, index) => (
                  <div key={`${index}-${item.itemId}`} className="mb-2 grid grid-cols-1 gap-2 md:grid-cols-6">
                    <select value={item.itemId} onChange={(e) => handleItemChange(index, "itemId", e.target.value)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2">
                      <option value="">Pilih item inventory (opsional)</option>
                      {inventoryItems.map((inv) => <option key={inv.id} value={inv.id}>{inv.code} - {inv.name}</option>)}
                    </select>
                    <input value={item.description} onChange={(e) => handleItemChange(index, "description", e.target.value)} placeholder="Deskripsi" className="rounded-lg border border-slate-300 px-3 py-2 text-sm md:col-span-2" required />
                    <input type="number" value={item.quantity} onChange={(e) => handleItemChange(index, "quantity", e.target.value)} placeholder="Qty" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" required />
                    <div className="flex gap-2">
                      <input type="number" value={item.unitPrice} onChange={(e) => handleItemChange(index, "unitPrice", e.target.value)} placeholder="Harga" className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" />
                      <button type="button" onClick={() => handleRemoveItem(index)} className="rounded-lg bg-rose-100 px-3 py-2 text-sm text-rose-700">X</button>
                    </div>
                  </div>
                ))}
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setIsCreateOpen(false)} className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">Batal</button>
                <button disabled={isPending} type="submit" className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60">{isPending ? "Menyimpan..." : "Simpan WO"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
