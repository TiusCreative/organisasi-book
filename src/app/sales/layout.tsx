export default function SalesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-emerald-200 bg-gradient-to-r from-emerald-50 via-teal-50 to-cyan-50 px-5 py-4">
        <h1 className="text-2xl font-bold tracking-tight text-emerald-900">Sales / Marketing Workspace</h1>
        <p className="mt-1 text-sm text-emerald-800">
          Alur terintegrasi Sales Order, Delivery Order, Invoice, Komisi Sales, dan laporan.
        </p>
      </div>
      {children}
    </div>
  )
}
