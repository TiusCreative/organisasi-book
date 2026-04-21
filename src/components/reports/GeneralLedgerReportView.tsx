export default function GeneralLedgerReportView({ report }: { report: any }) {
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
              <th className="px-4 py-3 text-left font-bold text-slate-700">Kode</th>
              <th className="px-4 py-3 text-left font-bold text-slate-700">Nama Akun</th>
              <th className="px-4 py-3 text-left font-bold text-slate-700">Tipe</th>
              <th className="px-4 py-3 text-right font-bold text-slate-700">Debit</th>
              <th className="px-4 py-3 text-right font-bold text-slate-700">Kredit</th>
              <th className="px-4 py-3 text-right font-bold text-slate-700">Saldo</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {report.data.map((item: any, idx: number) => (
              <tr key={idx} className="hover:bg-slate-50">
                <td className="px-4 py-3 font-mono text-blue-600 font-bold">{item.code}</td>
                <td className="px-4 py-3 text-slate-700">{item.name}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md uppercase font-bold">
                    {item.type}
                  </span>
                </td>
                <td className="px-4 py-3 text-right text-emerald-600 font-bold">{item.debit > 0 ? `Rp ${item.debit.toLocaleString('id-ID')}` : '-'}</td>
                <td className="px-4 py-3 text-right text-rose-600 font-bold">{item.credit > 0 ? `Rp ${item.credit.toLocaleString('id-ID')}` : '-'}</td>
                <td className={`px-4 py-3 text-right font-bold ${item.balance >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
                  Rp {item.balance.toLocaleString('id-ID')}
                </td>
              </tr>
            ))}
          </tbody>
          {report.totals && (
            <tfoot>
              <tr className="border-t-2 border-slate-200 bg-slate-50 font-bold">
                <td colSpan={3} className="px-4 py-3 text-slate-700">TOTAL</td>
                <td className="px-4 py-3 text-right text-emerald-600">Rp {report.totals.totalDebit.toLocaleString('id-ID')}</td>
                <td className="px-4 py-3 text-right text-rose-600">Rp {report.totals.totalCredit.toLocaleString('id-ID')}</td>
                <td className="px-4 py-3 text-right text-blue-600">Rp {(report.totals.totalDebit - report.totals.totalCredit).toLocaleString('id-ID')}</td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
