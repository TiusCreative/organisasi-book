"use client"

import { useState } from "react"
import TransactionReportView from "./TransactionReportView"
import BankReportView from "./BankReportView"
import IncomeReportView from "./IncomeReportView"
import ExpenseReportView from "./ExpenseReportView"
import ProfitLossReportView from "./ProfitLossReportView"
import GeneralLedgerReportView from "./GeneralLedgerReportView"
import ReportActionButtons from "./ReportActionButtons"
import { buildReportWhatsappText } from "@/lib/report-whatsapp"

interface ReportViewerProps {
  reports: Record<string, { data: { title: string; description: string }; type: string }>
  orgName: string
  orgId: string
  orgAddressLines: string[]
  startDate: string
  endDate: string
}

export default function ReportViewer({
  reports,
  orgName,
  orgId,
  orgAddressLines,
  startDate,
  endDate,
}: ReportViewerProps) {
  const [activeTab, setActiveTab] = useState<string>('transactions')

  const tabs = [
    { id: 'transactions', label: 'Transaksi', icon: '📋' },
    { id: 'bank', label: 'Bank & Kas', icon: '🏦' },
    { id: 'income', label: 'Penerimaan', icon: '💰' },
    { id: 'expense', label: 'Pengeluaran', icon: '💸' },
    { id: 'profitLoss', label: 'Rugi/Laba', icon: '📊' },
    { id: 'generalLedger', label: 'Buku Besar', icon: '📖' }
  ]

  const pdfRouteMap: Record<string, string> = {
    transactions: "transactions",
    bank: "bank",
    income: "income",
    expense: "expense",
    profitLoss: "profit-loss",
    generalLedger: "general-ledger",
  }

  const reportData = reports[activeTab].data
  const pdfUrl = `/api/${orgId}/reports/${pdfRouteMap[activeTab]}/pdf?startDate=${startDate}&endDate=${endDate}`
  const whatsappText = buildReportWhatsappText(activeTab, reportData, {
    name: orgName,
    addressLines: orgAddressLines,
  }, `${new Date(startDate).toLocaleDateString("id-ID")} s.d. ${new Date(endDate).toLocaleDateString("id-ID")}`)

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="bg-white rounded-xl border border-slate-100 shadow-sm overflow-x-auto">
        <div className="flex overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-4 py-4 whitespace-nowrap font-bold text-sm transition-colors border-b-2 flex items-center gap-2 ${
                activeTab === tab.id
                  ? 'text-blue-600 border-b-blue-600 bg-blue-50'
                  : 'text-slate-600 border-b-transparent hover:bg-slate-50'
              }`}
            >
              <span>{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Report Content */}
      <div className="space-y-4">
        {/* Action Buttons */}
        <ReportActionButtons pdfUrl={pdfUrl} whatsappText={whatsappText} printTargetId="report-content" />

        {/* Report Display */}
        <div id="report-content" className="bg-white rounded-xl border border-slate-100 shadow-sm p-8">
          {activeTab === 'transactions' && <TransactionReportView report={reports.transactions.data} />}
          {activeTab === 'bank' && <BankReportView report={reports.bank.data} />}
          {activeTab === 'income' && <IncomeReportView report={reports.income.data} />}
          {activeTab === 'expense' && <ExpenseReportView report={reports.expense.data} />}
          {activeTab === 'profitLoss' && <ProfitLossReportView report={reports.profitLoss.data} />}
          {activeTab === 'generalLedger' && <GeneralLedgerReportView report={reports.generalLedger.data} />}
        </div>
      </div>
    </div>
  )
}
