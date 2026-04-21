export default function ProfitLossReportView({ report }: { report: any }) {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-6">
        <h2 className="text-2xl font-bold text-slate-800">{report.title}</h2>
        <p className="text-slate-500 text-sm">{report.description}</p>
      </div>

      <div className="max-w-md space-y-4">
        {/* Pendapatan */}
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-4">
          <p className="text-sm text-slate-600 font-bold mb-1">Pendapatan</p>
          <p className="text-2xl font-bold text-emerald-600">Rp {report.totals.income.toLocaleString('id-ID')}</p>
        </div>

        {/* Biaya/Pengeluaran */}
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-4">
          <p className="text-sm text-slate-600 font-bold mb-1">Biaya/Pengeluaran</p>
          <p className="text-2xl font-bold text-rose-600">Rp {report.totals.expense.toLocaleString('id-ID')}</p>
        </div>

        {/* Laba Bersih */}
        <div className={`border rounded-lg p-4 ${report.totals.netIncome >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'}`}>
          <p className="text-sm text-slate-600 font-bold mb-1">Laba Bersih</p>
          <p className={`text-2xl font-bold ${report.totals.netIncome >= 0 ? 'text-blue-600' : 'text-orange-600'}`}>
            Rp {report.totals.netIncome.toLocaleString('id-ID')}
          </p>
        </div>
      </div>

      {/* Persentase */}
      {report.totals.income > 0 && (
        <div className="bg-slate-50 rounded-lg p-4">
          <p className="text-sm text-slate-600 font-bold mb-3">Analisis</p>
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-600">Rasio Beban Operasional</span>
              <span className="font-bold text-slate-700">{((report.totals.expense / report.totals.income) * 100).toFixed(2)}%</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-600">Margin Laba</span>
              <span className="font-bold text-slate-700">{((report.totals.netIncome / report.totals.income) * 100).toFixed(2)}%</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
