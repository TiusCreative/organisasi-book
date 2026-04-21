export default function BankReportView({ report }: { report: any }) {
  return (
    <div className="space-y-6">
      <div className="border-b border-slate-200 pb-6">
        <h2 className="text-2xl font-bold text-slate-800">{report.title}</h2>
        <p className="text-slate-500 text-sm">{report.description}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {report.data.map((bank: any, idx: number) => (
          <div key={idx} className="bg-slate-50 border border-slate-200 rounded-lg p-4">
            <h3 className="font-bold text-slate-800 mb-3">{bank.bankName}</h3>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-600">Nomor Rekening</span>
                <span className="font-mono font-bold text-slate-700">{bank.accountNumber}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-600">Atas Nama</span>
                <span className="font-bold text-slate-700">{bank.accountName}</span>
              </div>
              <div className="flex justify-between border-t border-slate-200 pt-2">
                <span className="text-slate-600 font-bold">Saldo</span>
                <span className="font-bold text-emerald-600">Rp {(bank.balance || 0).toLocaleString('id-ID')}</span>
              </div>
              {bank.lastReconciled && (
                <div className="flex justify-between">
                  <span className="text-slate-600 text-xs">Terakhir Rekonsiliasi</span>
                  <span className="text-xs text-slate-500">{new Date(bank.lastReconciled).toLocaleDateString('id-ID')}</span>
                </div>
              )}
            </div>
          </div>
        ))}
      </div>

      {report.totals && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-slate-600 font-bold mb-1">Total Saldo Bank & Kas</p>
          <p className="text-2xl font-bold text-blue-600">Rp {report.totals.totalBalance.toLocaleString('id-ID')}</p>
        </div>
      )}
    </div>
  )
}
