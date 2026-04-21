export default function ExpenseReportView({ report }: { report: any }) {
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
              <th className="px-4 py-3 text-left font-bold text-slate-700">Tanggal</th>
              <th className="px-4 py-3 text-left font-bold text-slate-700">Keterangan</th>
              <th className="px-4 py-3 text-left font-bold text-slate-700">Kategori</th>
              <th className="px-4 py-3 text-right font-bold text-slate-700">Jumlah</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {report.data.map((trx: any, idx: number) => {
              const expenseLine = trx.reportBankLine
              const categoryLine = trx.reportCategoryLine
              
              return (
                <tr key={idx} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-slate-600">{new Date(trx.date).toLocaleDateString('id-ID')}</td>
                  <td className="px-4 py-3 text-slate-700 font-medium">{trx.description}</td>
                  <td className="px-4 py-3 text-slate-600">{categoryLine?.account.name || '-'}</td>
                  <td className="px-4 py-3 text-right text-rose-600 font-bold">Rp {(expenseLine?.credit || 0).toLocaleString('id-ID')}</td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {report.totals && (
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
          <p className="text-sm text-slate-600 font-bold mb-1">Total Pengeluaran</p>
          <p className="text-2xl font-bold text-rose-600">Rp {report.totals.totalExpense.toLocaleString('id-ID')}</p>
        </div>
      )}
    </div>
  )
}
