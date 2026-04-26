import { prisma } from "@/lib/prisma"
import { requireModuleAccess } from "@/lib/auth"
import Link from "next/link"
import { ArrowLeft, FileText, Calendar, DollarSign } from "lucide-react"

export default async function TransactionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { organization } = await requireModuleAccess("transactions")
  const { id } = await params

  const transaction = await prisma.transaction.findFirst({
    where: { 
      id,
      organizationId: organization.id 
    },
    include: {
      lines: {
        include: {
          account: true
        }
      }
    }
  })

  if (!transaction) {
    return (
      <div className="max-w-6xl mx-auto px-4 py-10">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-slate-800 mb-4">Transaksi Tidak Ditemukan</h1>
          <Link href="/transaksi" className="text-blue-600 hover:text-blue-700">
            Kembali ke Daftar Transaksi
          </Link>
        </div>
      </div>
    )
  }

  const totalDebit = transaction.lines.reduce((sum, line) => sum + Number(line.debit), 0)
  const totalCredit = transaction.lines.reduce((sum, line) => sum + Number(line.credit), 0)

  return (
    <div className="max-w-6xl mx-auto px-4 py-10">
      <div className="mb-6">
        <Link href="/transaksi" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} />
          <span>Kembali ke Daftar Transaksi</span>
        </Link>
      </div>

      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="p-6 border-b border-slate-200 bg-slate-50">
          <h1 className="text-2xl font-bold text-slate-800">{transaction.description}</h1>
          <div className="flex items-center gap-4 mt-2 text-sm text-slate-600">
            <div className="flex items-center gap-1">
              <Calendar size={16} />
              <span>{new Date(transaction.date).toLocaleDateString('id-ID', {
                weekday: 'long',
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}</span>
            </div>
            <div className="flex items-center gap-1">
              <FileText size={16} />
              <span>ID: {transaction.id}</span>
            </div>
          </div>
        </div>

        <div className="p-6">
          <h2 className="text-lg font-bold text-slate-800 mb-4">Detail Jurnal</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="text-left py-3 px-4 font-medium text-slate-600">Akun</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Debit</th>
                  <th className="text-right py-3 px-4 font-medium text-slate-600">Kredit</th>
                </tr>
              </thead>
              <tbody>
                {transaction.lines.map((line) => (
                  <tr key={line.id} className="border-b border-slate-100">
                    <td className="py-3 px-4">
                      <div className="font-medium text-slate-800">{line.account?.name || 'Unknown'}</div>
                      <div className="text-sm text-slate-500">{line.account?.code || ''}</div>
                    </td>
                    <td className="py-3 px-4 text-right">
                      {line.debit > 0 ? (
                        <span className="text-emerald-600 font-medium">
                          Rp {Number(line.debit).toLocaleString('id-ID')}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      {line.credit > 0 ? (
                        <span className="text-rose-600 font-medium">
                          Rp {Number(line.credit).toLocaleString('id-ID')}
                        </span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-300 bg-slate-50">
                  <td className="py-3 px-4 font-bold text-slate-800">Total</td>
                  <td className="py-3 px-4 text-right font-bold text-emerald-600">
                    Rp {totalDebit.toLocaleString('id-ID')}
                  </td>
                  <td className="py-3 px-4 text-right font-bold text-rose-600">
                    Rp {totalCredit.toLocaleString('id-ID')}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
