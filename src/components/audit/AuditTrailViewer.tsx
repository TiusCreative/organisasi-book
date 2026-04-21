"use client"

import { useState, useEffect } from "react"
import { Search, Filter, Download, ChevronDown, ChevronUp } from "lucide-react"
import { getAuditLogsAction, exportAuditLogsAsCSVAction } from "../../app/actions/audit"

interface AuditLog {
  id: string
  timestamp: Date
  action: string
  entity: string
  entityId: string
  userId?: string
  userName?: string
  userEmail?: string
  status: string
  changes?: string
  errorMessage?: string
}

export default function AuditTrailViewer() {
  const [logs, setLogs] = useState<AuditLog[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState({
    action: "",
    entity: "",
    search: "",
  })
  const [expandedLog, setExpandedLog] = useState<string | null>(null)

  useEffect(() => {
    loadLogs()
  }, [filter])

  const loadLogs = async () => {
    setLoading(true)
    const result = await getAuditLogsAction({
      action: filter.action || undefined,
      entity: filter.entity || undefined,
      limit: 100,
    })
    if (result.logs) {
      setLogs(result.logs as AuditLog[])
    }
    setLoading(false)
  }

  const handleExport = async () => {
    const csv = await exportAuditLogsAsCSVAction({})
    const blob = new Blob([csv], { type: "text/csv" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = `audit-trail-${new Date().toISOString().split("T")[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const filteredLogs = logs.filter((log) => {
    if (filter.search) {
      const searchLower = filter.search.toLowerCase()
      return (
        log.entity.toLowerCase().includes(searchLower) ||
        log.entityId.toLowerCase().includes(searchLower) ||
        log.userName?.toLowerCase().includes(searchLower) ||
        log.userEmail?.toLowerCase().includes(searchLower)
      )
    }
    return true
  })

  const actionColors: Record<string, string> = {
    CREATE: "bg-green-100 text-green-800",
    UPDATE: "bg-blue-100 text-blue-800",
    DELETE: "bg-red-100 text-red-800",
    READ: "bg-slate-100 text-slate-800",
    EXPORT: "bg-purple-100 text-purple-800",
  }

  const statusColors: Record<string, string> = {
    SUCCESS: "text-green-600",
    FAILED: "text-red-600",
  }

  return (
    <div className="p-4 sm:p-6 space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="flex-1 relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Cari entity, user, atau ID..."
            value={filter.search}
            onChange={(e) => setFilter({ ...filter, search: e.target.value })}
            className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-sm"
          />
        </div>
        <select
          value={filter.action}
          onChange={(e) => setFilter({ ...filter, action: e.target.value })}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
        >
          <option value="">Semua Action</option>
          <option value="CREATE">Create</option>
          <option value="UPDATE">Update</option>
          <option value="DELETE">Delete</option>
          <option value="READ">Read</option>
          <option value="EXPORT">Export</option>
        </select>
        <select
          value={filter.entity}
          onChange={(e) => setFilter({ ...filter, entity: e.target.value })}
          className="rounded-lg border border-slate-300 px-4 py-2 text-sm"
        >
          <option value="">Semua Entity</option>
          <option value="Transaction">Transaction</option>
          <option value="Employee">Employee</option>
          <option value="PeriodLock">PeriodLock</option>
          <option value="Organization">Organization</option>
        </select>
        <button
          onClick={handleExport}
          className="flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-100"
        >
          <Download size={16} />
          Export CSV
        </button>
      </div>

      {/* Logs Table */}
      {loading ? (
        <div className="py-12 text-center text-slate-500">Loading...</div>
      ) : filteredLogs.length === 0 ? (
        <div className="rounded-xl border border-slate-200 bg-slate-50 p-8 text-center text-slate-500">
          <Filter size={40} className="mx-auto mb-2 opacity-50" />
          <p>Tidak ada audit log ditemukan</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filteredLogs.map((log) => (
            <div
              key={log.id}
              className="rounded-lg border border-slate-200 bg-white hover:border-slate-300 transition-colors"
            >
              <div
                className="flex items-center justify-between p-4 cursor-pointer"
                onClick={() => setExpandedLog(expandedLog === log.id ? null : log.id)}
              >
                <div className="flex items-center gap-4">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-bold uppercase ${
                      actionColors[log.action] || "bg-slate-100 text-slate-800"
                    }`}
                  >
                    {log.action}
                  </span>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-slate-800">{log.entity}</span>
                      <span className="text-xs text-slate-500">ID: {log.entityId.slice(0, 8)}...</span>
                    </div>
                    <div className="text-sm text-slate-600">
                      {log.userName || log.userId} • {new Date(log.timestamp).toLocaleString("id-ID")}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-4">
                  <span className={`text-sm font-medium ${statusColors[log.status] || "text-slate-600"}`}>
                    {log.status}
                  </span>
                  {expandedLog === log.id ? (
                    <ChevronUp size={20} className="text-slate-400" />
                  ) : (
                    <ChevronDown size={20} className="text-slate-400" />
                  )}
                </div>
              </div>
              {expandedLog === log.id && (
                <div className="border-t border-slate-200 p-4 bg-slate-50 space-y-2">
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase">User:</span>
                    <span className="ml-2 text-sm text-slate-700">
                      {log.userName} ({log.userEmail})
                    </span>
                  </div>
                  <div>
                    <span className="text-xs font-bold text-slate-500 uppercase">Timestamp:</span>
                    <span className="ml-2 text-sm text-slate-700">
                      {new Date(log.timestamp).toLocaleString("id-ID")}
                    </span>
                  </div>
                  {log.changes && (
                    <div>
                      <span className="text-xs font-bold text-slate-500 uppercase">Changes:</span>
                      <pre className="mt-1 rounded bg-white border border-slate-200 p-2 text-xs overflow-x-auto">
                        {JSON.stringify(JSON.parse(log.changes), null, 2)}
                      </pre>
                    </div>
                  )}
                  {log.errorMessage && (
                    <div>
                      <span className="text-xs font-bold text-red-500 uppercase">Error:</span>
                      <span className="ml-2 text-sm text-red-700">{log.errorMessage}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
