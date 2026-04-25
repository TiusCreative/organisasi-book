"use client"

import { useRef } from "react"
import { useReactToPrint } from "react-to-print"
import { Printer } from "lucide-react"

type PurchaseOrderPrintProps = {
  po: any
}

export default function PurchaseOrderPrintLayout({ po }: PurchaseOrderPrintProps) {
  const componentRef = useRef<HTMLDivElement>(null)
  
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `PO-${po?.poNumber || 'Document'}`,
  })

  if (!po) return null

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat("id-ID", {
      style: "currency",
      currency: "IDR",
      minimumFractionDigits: 0
    }).format(amount || 0)
  }

  return (
    <div>
      <button
        onClick={() => handlePrint()}
        className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900 transition-colors"
      >
        <Printer size={16} /> Cetak PO (A4)
      </button>

      <div className="hidden">
        <div 
          ref={componentRef} 
          className="bg-white text-slate-900 p-10 print:block" 
          style={{ width: '210mm', minHeight: '297mm', margin: '0 auto' }}
        >
          <div className="flex justify-between items-start border-b-2 border-slate-800 pb-6 mb-8">
            <div>
              <h1 className="text-4xl font-black text-slate-800 tracking-tight">PURCHASE ORDER</h1>
              <p className="text-slate-500 mt-2 font-medium">#{po.poNumber}</p>
            </div>
            <div className="text-right">
              <h2 className="font-bold text-xl text-slate-800">Organisasi Book</h2>
              <p className="text-sm text-slate-600 mt-1 leading-relaxed">
                Kawasan Bisnis Sudirman Lt. 12<br/>
                Jakarta Selatan, Indonesia 12190<br/>
                Email: procurement@organisasibook.com
              </p>
            </div>
          </div>

          <div className="flex justify-between mb-8">
            <div>
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Supplier:</p>
              <p className="font-bold text-lg text-slate-800">{po.supplier?.name}</p>
              <p className="text-sm text-slate-600 max-w-xs leading-relaxed">{po.supplier?.address || "Alamat tidak tersedia"}</p>
            </div>
            <div className="text-right space-y-2">
              <p className="text-sm"><span className="font-bold text-slate-500 mr-2">Tanggal PO:</span> <span className="font-medium">{new Date(po.orderDate).toLocaleDateString("id-ID")}</span></p>
              <p className="text-sm"><span className="font-bold text-slate-500 mr-2">Expected Date:</span> <span className="font-medium">{po.expectedDate ? new Date(po.expectedDate).toLocaleDateString("id-ID") : "-"}</span></p>
              <p className="text-sm"><span className="font-bold text-slate-500 mr-2">Status:</span> <span className="font-medium">{po.status}</span></p>
            </div>
          </div>

          <table className="w-full text-left border-collapse mb-8">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-300">
                <th className="py-3 px-4 font-bold text-slate-700 text-sm">Deskripsi Barang</th>
                <th className="py-3 px-4 font-bold text-slate-700 text-sm text-center">Qty</th>
                <th className="py-3 px-4 font-bold text-slate-700 text-sm text-right">Harga Satuan</th>
                <th className="py-3 px-4 font-bold text-slate-700 text-sm text-right">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {(po.items || []).map((item: any, idx: number) => (
                <tr key={item.id || idx}>
                  <td className="py-4 px-4 text-sm text-slate-800">{item.description}</td>
                  <td className="py-4 px-4 text-sm text-center font-medium">{item.quantity}</td>
                  <td className="py-4 px-4 text-sm text-right">{formatCurrency(item.unitPrice)}</td>
                  <td className="py-4 px-4 text-sm text-right font-medium">{formatCurrency(item.total || (item.quantity * item.unitPrice))}</td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="flex justify-end">
            <div className="w-1/2 space-y-3 bg-slate-50 p-6 rounded-lg">
              <div className="flex justify-between text-sm"><span className="font-bold text-slate-500">Subtotal:</span> <span className="font-medium">{formatCurrency(po.subtotal || 0)}</span></div>
              <div className="flex justify-between text-sm"><span className="font-bold text-slate-500">Pajak (PPN):</span> <span className="font-medium">{formatCurrency(po.taxAmount || 0)}</span></div>
              <div className="flex justify-between border-t-2 border-slate-300 pt-3 text-lg">
                <span className="font-black text-slate-800">Grand Total:</span>
                <span className="font-black text-blue-700">{formatCurrency(po.totalAmount || 0)}</span>
              </div>
            </div>
          </div>

          {po.notes && (
            <div className="mt-8 p-4 bg-slate-50 rounded-lg">
              <p className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">Catatan:</p>
              <p className="text-sm text-slate-600">{po.notes}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
