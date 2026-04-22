"use client"

import { useState } from "react"
import ReconciliationTab from "./ReconciliationTab"
import PettyCashTab from "./PettyCashTab"
import BankModal from "../forms/BankModal"

interface BankManagementProps {
  banks: any[]
  activeBanks: any[]
  inactiveBanks: any[]
  pettyCashAccounts: any[]
  reconciliations: any[]
  organizationId: string
}

export default function BankManagement({
  banks,
  activeBanks,
  inactiveBanks,
  pettyCashAccounts,
  reconciliations,
  organizationId
}: BankManagementProps) {
  const [activeTab, setActiveTab] = useState("accounts")

  return (
    <div>
      <div className="flex gap-2 mb-4">
        <button
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "accounts"
              ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
          }`}
          onClick={() => setActiveTab("accounts")}
        >
          Rekening Bank
        </button>
        <button
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "reconciliation"
              ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
          }`}
          onClick={() => setActiveTab("reconciliation")}
        >
          Rekonsiliasi Bank
        </button>
        <button
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "petty-cash"
              ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
          }`}
          onClick={() => setActiveTab("petty-cash")}
        >
          Kas Kecil
        </button>
      </div>

      {activeTab === "accounts" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h2 className="text-lg font-semibold">Rekening Bank</h2>
              <p className="text-sm text-slate-500">Kelola rekening bank perusahaan</p>
            </div>
            <BankModal orgId={organizationId} />
          </div>

          {banks.length === 0 ? (
            <div className="text-center py-12 bg-slate-50 rounded-lg">
              <p className="text-slate-500">Belum ada rekening bank. Klik "Tambah Rekening" untuk menambahkan.</p>
            </div>
          ) : (
            <div className="grid gap-3">
              {banks.map((bank) => (
                <div key={bank.id} className="bg-white border rounded-lg p-4 flex justify-between items-center">
                  <div>
                    <p className="font-semibold text-slate-800">{bank.bankName}</p>
                    <p className="text-sm text-slate-500">{bank.accountNumber} - {bank.accountName}</p>
                    <p className="text-sm font-medium text-slate-700">Saldo: {bank.balance?.toLocaleString('id-ID', { style: 'currency', currency: 'IDR' })}</p>
                  </div>
                  <span className={`px-2 py-1 rounded text-xs font-medium ${bank.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-slate-100 text-slate-600'}`}>
                    {bank.status === 'ACTIVE' ? 'Aktif' : 'Nonaktif'}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "reconciliation" && (
        <ReconciliationTab 
          bankAccounts={activeBanks}
          reconciliations={reconciliations}
          organizationId={organizationId}
        />
      )}

      {activeTab === "petty-cash" && (
        <PettyCashTab 
          pettyCashAccounts={pettyCashAccounts}
          organizationId={organizationId}
        />
      )}
    </div>
  )
}
