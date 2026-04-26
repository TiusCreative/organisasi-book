import React from "react"
import { Loader2 } from "lucide-react"

export interface ColumnDef<T> {
  header: React.ReactNode
  cell: (row: T) => React.ReactNode
  className?: string
}

export interface DataTableProps<T> {
  columns: ColumnDef<T>[]
  data: T[]
  isLoading?: boolean
  emptyState?: React.ReactNode
}

export function DataTable<T>({ columns, data, isLoading, emptyState }: DataTableProps<T>) {
  if (isLoading) {
    return (
      <div className="flex justify-center p-8">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    )
  }

  if (data.length === 0 && emptyState) return <>{emptyState}</>

  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-left text-sm whitespace-nowrap">
        <thead className="bg-slate-50 text-slate-600 border-b border-slate-200">
          <tr>{columns.map((col, idx) => <th key={idx} className={`p-4 font-semibold ${col.className || ""}`}>{col.header}</th>)}</tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {data.map((row, rowIdx) => (
            <tr key={rowIdx} className="hover:bg-slate-50 transition-colors">{columns.map((col, colIdx) => <td key={colIdx} className={`p-4 ${col.className || ""}`}>{col.cell(row)}</td>)}</tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}