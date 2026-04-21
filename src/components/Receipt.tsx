"use client"

import { forwardRef } from "react"
import { terbilang } from "../lib/terbilang"

export const Receipt = forwardRef<HTMLDivElement, { trx: any, org: any }>(({ trx, org }, ref) => {
  if (!trx) return null;

  const totalDebit = trx.lines.reduce((sum: number, line: any) => sum + line.debit, 0)
  const totalCredit = trx.lines.reduce((sum: number, line: any) => sum + line.credit, 0)
  const amount = Math.max(totalDebit, totalCredit)

  return (
    <div ref={ref} className="receipt-print p-10 bg-white text-slate-800 font-serif">
      {/* Header Nota */}
      <div className="border-b-4 border-slate-900 pb-6 mb-8 flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-black uppercase tracking-tighter">{org?.name}</h1>
          <p className="text-sm text-slate-500 italic">Bukti Transaksi Resmi</p>
        </div>
        <div className="text-right">
          <p className="font-bold">NOMOR NOTA</p>
          <p className="text-xl font-mono">{trx.reference}</p>
        </div>
      </div>

      {/* Konten Utama */}
      <div className="space-y-6">
        <div className="flex justify-between border-b border-slate-100 pb-4">
          <span className="text-slate-400 uppercase text-xs font-bold">Tanggal</span>
          <span className="font-bold">{new Date(trx.date).toLocaleDateString('id-ID', { dateStyle: 'long' })}</span>
        </div>

        <div className="flex justify-between border-b border-slate-100 pb-4">
          <span className="text-slate-400 uppercase text-xs font-bold">Keterangan</span>
          <span className="font-bold text-lg">{trx.description}</span>
        </div>

        <div className="bg-slate-50 p-6 rounded-xl flex justify-between items-center">
          <span className="text-slate-500 uppercase font-bold">Total Pembayaran</span>
          <span className="text-3xl font-black">Rp {amount?.toLocaleString('id-ID')}</span>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-5">
          <p className="text-xs font-bold uppercase tracking-widest text-slate-400">Terbilang</p>
          <p className="mt-2 text-lg font-bold leading-relaxed">{terbilang(amount || 0)}</p>
        </div>

        <div className="rounded-xl border border-slate-200 overflow-hidden">
          <div className="grid grid-cols-[1.5fr,1fr,1fr] bg-slate-900 px-4 py-3 text-xs font-bold uppercase tracking-widest text-white">
            <span>Akun</span>
            <span className="text-right">Debit</span>
            <span className="text-right">Kredit</span>
          </div>
          {trx.lines.map((line: any) => (
            <div key={line.id} className="grid grid-cols-[1.5fr,1fr,1fr] px-4 py-3 text-sm border-t border-slate-100">
              <span>{line.account?.code} - {line.account?.name}</span>
              <span className="text-right font-mono">{line.debit > 0 ? `Rp ${line.debit.toLocaleString('id-ID')}` : '-'}</span>
              <span className="text-right font-mono">{line.credit > 0 ? `Rp ${line.credit.toLocaleString('id-ID')}` : '-'}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer & Tanda Tangan */}
      <div className="mt-20 grid grid-cols-2 gap-20 text-center print:mt-12">
        <div>
          <p className="text-xs text-slate-400 mb-16 uppercase font-bold tracking-widest">Penerima</p>
          <div className="border-b border-slate-300 w-40 mx-auto"></div>
        </div>
        <div>
          <p className="text-xs text-slate-400 mb-16 uppercase font-bold tracking-widest">Bendahara</p>
          <div className="border-b border-slate-300 w-40 mx-auto"></div>
          <p className="text-[10px] mt-2 text-slate-400 italic">Dicetak secara digital via OrgBook</p>
        </div>
      </div>
    </div>
  )
})

Receipt.displayName = "Receipt"
