"use client"

import { useState } from "react"
import { ArrowRight, Box, CheckCircle, PackageSearch, MapPin } from "lucide-react"

type TaskType = "PICKING" | "PUTAWAY"

type MockTask = {
  id: string
  reference: string
  item: string
  quantity: number
  unit: string
  binLocation: string
  status: "PENDING" | "DONE"
}

// MOCK DATA - Ganti dengan data props asli dari DB Anda
const mockPickTasks: MockTask[] = [
  { id: "PT-1001", reference: "SO-2024-055", item: "Laptop Asus ROG", quantity: 2, unit: "pcs", binLocation: "A-01/R-02/B-15", status: "PENDING" },
  { id: "PT-1002", reference: "DO-2024-112", item: "Mouse Wireless Logistics", quantity: 15, unit: "pcs", binLocation: "Z-02/A-05/B-01", status: "PENDING" },
]

const mockPutawayTasks: MockTask[] = [
  { id: "PW-2001", reference: "GRN-PO-099", item: "Kabel HDMI 2M", quantity: 50, unit: "pcs", binLocation: "Staging Area -> Z-01/R-01/B-05", status: "PENDING" },
]

export default function WarehouseTaskBoard() {
  const [activeTab, setActiveTab] = useState<TaskType>("PICKING")

  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
      {/* Header Tabs */}
      <div className="flex border-b border-slate-200 bg-slate-50">
        <button
          onClick={() => setActiveTab("PICKING")}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === "PICKING" 
              ? "bg-white text-blue-700 border-b-2 border-blue-600" 
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
          }`}
        >
          <PackageSearch size={18} />
          Tugas Ambil (Picking)
          <span className="bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs">{mockPickTasks.length}</span>
        </button>
        <button
          onClick={() => setActiveTab("PUTAWAY")}
          className={`flex-1 py-4 text-sm font-bold flex items-center justify-center gap-2 transition-colors ${
            activeTab === "PUTAWAY" 
              ? "bg-white text-emerald-700 border-b-2 border-emerald-600" 
              : "text-slate-500 hover:text-slate-700 hover:bg-slate-100"
          }`}
        >
          <Box size={18} />
          Tugas Simpan (Putaway)
          <span className="bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full text-xs">{mockPutawayTasks.length}</span>
        </button>
      </div>

      {/* Content Area */}
      <div className="p-0">
        <table className="w-full text-left text-sm">
          <thead className="bg-white text-slate-500 border-b border-slate-100">
            <tr>
              <th className="px-6 py-3 font-medium">Referensi Task</th>
              <th className="px-6 py-3 font-medium">Barang & Qty</th>
              <th className="px-6 py-3 font-medium">Lokasi (Rak/Bin)</th>
              <th className="px-6 py-3 font-medium text-right">Aksi Cepat</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {activeTab === "PICKING" && mockPickTasks.map((task) => (
              <tr key={task.id} className="hover:bg-slate-50 group transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-800">{task.id}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <ArrowRight size={12} /> Ref: {task.reference}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-slate-700">{task.item}</div>
                  <div className="text-blue-600 font-bold mt-1 text-xs bg-blue-50 w-fit px-2 py-0.5 rounded">
                    Ambil: {task.quantity} {task.unit}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-md w-fit font-mono text-xs">
                    <MapPin size={14} className="text-slate-400" />
                    {task.binLocation}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-sm">
                    <CheckCircle size={14} />
                    Selesaikan
                  </button>
                </td>
              </tr>
            ))}
            
            {activeTab === "PUTAWAY" && mockPutawayTasks.map((task) => (
              <tr key={task.id} className="hover:bg-slate-50 group transition-colors">
                <td className="px-6 py-4">
                  <div className="font-bold text-slate-800">{task.id}</div>
                  <div className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                    <ArrowRight size={12} /> Ref: {task.reference}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="font-semibold text-slate-700">{task.item}</div>
                  <div className="text-emerald-600 font-bold mt-1 text-xs bg-emerald-50 w-fit px-2 py-0.5 rounded">
                    Simpan: {task.quantity} {task.unit}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-1.5 text-slate-600 bg-slate-100 px-2.5 py-1.5 rounded-md w-fit font-mono text-xs">
                    <MapPin size={14} className="text-amber-500" />
                    {task.binLocation}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 rounded-lg font-bold text-xs inline-flex items-center gap-1.5 transition-all shadow-sm">
                    <CheckCircle size={14} />
                    Simpan di Rak
                  </button>
                </td>
              </tr>
            ))}

            {/* Empty State */}
            {((activeTab === "PICKING" && mockPickTasks.length === 0) || 
              (activeTab === "PUTAWAY" && mockPutawayTasks.length === 0)) && (
              <tr>
                <td colSpan={4} className="px-6 py-12 text-center text-slate-400">
                  Tidak ada tugas {activeTab.toLowerCase()} yang tertunda saat ini. Semua sudah selesai!
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}