export default function TransactionReportView({ report }: { report: any }) {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-6">
        <h2 className="text-2xl font-bold text-slate-800">{report.title}</h2>
        <p className="text-slate-500 text-sm">{report.description}</p>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-4 py-3 text-left font-bold text-slate-700">No Ref</th>
              <th className="px-4 py-3 text-left font-bold text-slate-700">Tanggal</th>
              <th className="px-4 py-3 text-left font-bold text-slate-700">Keterangan</th>
              <th className="px-4 py-3 text-right font-bold text-slate-700">Masuk</th>
              <th className="px-4 py-3 text-right font-bold text-slate-700">Keluar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {report.data.map((trx: any, idx: number) => {
              const bankLine = trx.reportBankLine
              const income = bankLine?.debit > 0 ? bankLine : null
              const expense = bankLine?.credit > 0 ? bankLine : null
              
              return (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-4 py-3 font-mono text-blue-600">{trx.reference}</td>
                  <td className="px-4 py-3 text-slate-600">{new Date(trx.date).toLocaleDateString('id-ID')}</td>
                  <td className="px-4 py-3 text-slate-700 font-medium">{trx.description}</td>
                  <td className="px-4 py-3 text-right text-emerald-600 font-bold">{income ? `Rp ${income.debit.toLocaleString('id-ID')}` : '-'}</td>
                  <td className="px-4 py-3 text-right text-rose-600 font-bold">{expense ? `Rp ${expense.credit.toLocaleString('id-ID')}` : '-'}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {report.totals && (
        <div className="grid grid-cols-3 gap-4 pt-4 border-t border-slate-200">
          <div className="bg-emerald-50 p-4 rounded-lg">
            <p className="text-sm text-slate-600 font-bold">Total Penerimaan</p>
            <p className="text-xl font-bold text-emerald-600">Rp {report.totals.income.toLocaleString('id-ID')}</p>
          </div>
          <div className="bg-rose-50 p-4 rounded-lg">
            <p className="text-sm text-slate-600 font-bold">Total Pengeluaran</p>
            <p className="text-xl font-bold text-rose-600">Rp {report.totals.expense.toLocaleString('id-ID')}</p>
          </div>
          <div className={`p-4 rounded-lg ${report.totals.net >= 0 ? 'bg-blue-50' : 'bg-orange-50'}`}>
            <p className="text-sm text-slate-600 font-bold">Saldo Bersih</p>
            <p className={`text-xl font-bold ${report.totals.net >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
              Rp {report.totals.net.toLocaleString('id-ID')}
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
