"use client"

import { Printer, Share2, FileDown } from "lucide-react"
import { 
  printTransaction, 
  downloadTransactionPDF, 
  shareToWhatsApp
} from "../lib/transaction-utils"
import EditTransactionModal from "./forms/EditTransactionModal"
import DeleteTransactionButton from "./DeleteTransactionButton"

interface TransactionActionsProps {
  transaction: {
    id: string
    organizationId: string
    reference?: string | null
    description: string
    date: Date
    lines: { debit: number; credit: number; accountId: string }[]
  }
  accounts?: { id: string; name: string }[]
  bankAccounts?: { accountId: string }[]
}

export default function TransactionActions({ transaction, accounts = [], bankAccounts = [] }: TransactionActionsProps) {
  const totalAmount = Math.max(
    transaction.lines.reduce((sum: number, l: { debit: number }) => sum + l.debit, 0),
    transaction.lines.reduce((sum: number, l: { credit: number }) => sum + l.credit, 0)
  )

  const handlePrint = () => {
    printTransaction(transaction.id)
  }

  const handleDownloadPDF = async () => {
    await downloadTransactionPDF(transaction.id)
  }

  const handleWhatsApp = () => {
    shareToWhatsApp(transaction.organizationId, transaction.reference || transaction.id, transaction.description, totalAmount)
  }

  return (
    <div className="flex gap-2 mt-3 flex-wrap">
      <button 
        onClick={handlePrint}
        title="Cetak Nota" 
        className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg border border-slate-100 transition-colors active:scale-95"
      >
        <Printer size={18} />
      </button>
      <button 
        onClick={handleDownloadPDF}
        title="Simpan PDF" 
        className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg border border-slate-100 transition-colors active:scale-95"
      >
        <FileDown size={18} />
      </button>
      <button 
        onClick={handleWhatsApp}
        title="WhatsApp" 
        className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg border border-slate-100 transition-colors active:scale-95"
      >
        <Share2 size={18} />
      </button>
      {accounts.length > 0 && <EditTransactionModal transaction={transaction} accounts={accounts} bankAccounts={bankAccounts} />}
      <DeleteTransactionButton transactionId={transaction.id} />
    </div>
  )
}
