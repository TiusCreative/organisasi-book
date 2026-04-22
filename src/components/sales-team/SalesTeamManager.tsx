"use client"

import { useState } from "react"
import { addSalesPermission, removeSalesPermission } from "@/app/actions/sales-team"
import { User, Plus, X, TrendingUp, DollarSign, Check, X as XIcon } from "lucide-react"

export default function SalesTeamManager({ salesTeam, allUsers, organizationId }: any) {
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [selectedUserId, setSelectedUserId] = useState("")

  const handleAddSalesPerson = async () => {
    if (!selectedUserId) return
    await addSalesPermission(selectedUserId)
    setIsModalOpen(false)
    setSelectedUserId("")
    window.location.reload()
  }

  const handleRemoveSalesPerson = async (userId: string) => {
    if (confirm("Yakin ingin menghapus izin sales dari user ini?")) {
      await removeSalesPermission(userId)
      window.location.reload()
    }
  }

  const calculateTotalSales = (salesOrders: any[]) => {
    return salesOrders.reduce((sum, order) => sum + (order.totalAmount || 0), 0)
  }

  const calculateTotalCommission = (commissions: any[]) => {
    return commissions.reduce((sum, comm) => sum + (comm.totalCommission || 0), 0)
  }

  const nonSalesUsers = allUsers.filter((user: any) => 
    !salesTeam.find((member: any) => member.id === user.id) &&
    !(user.permissions as string[]).includes("sales")
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-800">Sales Team Management</h1>
          <p className="text-slate-500">Kelola tim sales/marketing dan performa mereka</p>
        </div>
        <button
          onClick={() => setIsModalOpen(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-blue-700 transition"
        >
          <Plus size={20} /> Tambah Sales Person
        </button>
      </div>

      {salesTeam.length === 0 ? (
        <div className="text-center py-12 bg-slate-50 rounded-lg">
          <User size={48} className="mx-auto text-slate-300 mb-4" />
          <p className="text-slate-500">Belum ada anggota sales team. Klik "Tambah Sales Person" untuk menambahkan.</p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {salesTeam.map((member: any) => (
            <div key={member.id} className="bg-white border rounded-lg p-5 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <h3 className="font-semibold text-lg text-slate-800">{member.name}</h3>
                  <p className="text-sm text-slate-500">{member.email}</p>
                  <span className="text-xs text-slate-400 mt-1 block">Role: {member.role}</span>
                </div>
                <button
                  onClick={() => handleRemoveSalesPerson(member.id)}
                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                  title="Hapus dari Sales Team"
                >
                  <XIcon size={18} />
                </button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <TrendingUp size={16} className="text-blue-600" />
                    <span className="text-sm text-slate-600">Total Penjualan</span>
                  </div>
                  <span className="font-semibold text-blue-700">
                    Rp {calculateTotalSales(member.salesOrdersAssigned).toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="flex items-center justify-between p-3 bg-green-50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <DollarSign size={16} className="text-green-600" />
                    <span className="text-sm text-slate-600">Total Komisi</span>
                  </div>
                  <span className="font-semibold text-green-700">
                    Rp {calculateTotalCommission(member.commissionsReceived).toLocaleString('id-ID')}
                  </span>
                </div>

                <div className="grid grid-cols-2 gap-2 text-sm">
                  <div className="p-2 bg-slate-50 rounded-lg text-center">
                    <div className="font-semibold text-slate-800">{member.salesOrdersAssigned.length}</div>
                    <div className="text-slate-500">Order</div>
                  </div>
                  <div className="p-2 bg-slate-50 rounded-lg text-center">
                    <div className="font-semibold text-slate-800">{member.commissionsReceived.length}</div>
                    <div className="text-slate-500">Komisi</div>
                  </div>
                </div>

                {member.salesOrdersAssigned.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-xs font-medium text-slate-600 mb-2">Order Terakhir:</p>
                    <div className="space-y-1">
                      {member.salesOrdersAssigned.slice(0, 3).map((order: any) => (
                        <div key={order.id} className="flex justify-between text-xs text-slate-500">
                          <span>{order.code}</span>
                          <span className={`px-1.5 py-0.5 rounded ${
                            order.status === 'COMPLETED' ? 'bg-green-100 text-green-700' :
                            order.status === 'PENDING' ? 'bg-yellow-100 text-yellow-700' :
                            'bg-slate-100 text-slate-600'
                          }`}>
                            {order.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {member.commissionsReceived.length > 0 && (
                  <div className="border-t pt-3">
                    <p className="text-xs font-medium text-slate-600 mb-2">Komisi Terakhir:</p>
                    <div className="space-y-1">
                      {member.commissionsReceived.slice(0, 3).map((comm: any) => (
                        <div key={comm.id} className="flex justify-between text-xs text-slate-500">
                          <span>Rp {comm.totalCommission.toLocaleString('id-ID')}</span>
                          <span className={`px-1.5 py-0.5 rounded ${
                            comm.status === 'PAID' ? 'bg-green-100 text-green-700' :
                            comm.status === 'APPROVED' ? 'bg-blue-100 text-blue-700' :
                            'bg-yellow-100 text-yellow-700'
                          }`}>
                            {comm.status}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50 flex-shrink-0">
              <h3 className="font-bold text-slate-800 text-xl">Tambah Sales Person</h3>
              <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X size={24} />
              </button>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
              <div className="space-y-3">
                <label className="block text-sm font-medium text-slate-700 mb-2">Pilih User:</label>
                {nonSalesUsers.length === 0 ? (
                  <p className="text-sm text-slate-500">Semua user sudah memiliki izin sales.</p>
                ) : (
                  <div className="space-y-2">
                    {nonSalesUsers.map((user: any) => (
                      <div
                        key={user.id}
                        onClick={() => setSelectedUserId(user.id)}
                        className={`p-3 border rounded-lg cursor-pointer transition ${
                          selectedUserId === user.id
                            ? 'border-blue-500 bg-blue-50'
                            : 'border-slate-200 hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div>
                            <p className="font-medium text-slate-800">{user.name}</p>
                            <p className="text-sm text-slate-500">{user.email}</p>
                          </div>
                          {selectedUserId === user.id && (
                            <Check size={20} className="text-blue-600" />
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <button
                onClick={handleAddSalesPerson}
                disabled={!selectedUserId || nonSalesUsers.length === 0}
                className="w-full bg-blue-600 text-white py-4 rounded-xl font-bold hover:bg-blue-700 transition-all mt-6 disabled:bg-slate-300 disabled:cursor-not-allowed"
              >
                Tambah ke Sales Team
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
