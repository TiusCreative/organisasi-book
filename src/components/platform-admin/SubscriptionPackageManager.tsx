import { prisma } from "@/lib/prisma"
import {
  createSubscriptionPackage,
  deleteSubscriptionPackage,
  updateSubscriptionPackage,
} from "@/app/actions/platform-admin"
import { ensureDefaultSubscriptionPackages } from "@/lib/subscription-packages"

function formatDuration(durationMonths: number | null) {
  if (durationMonths === null) return "Unlimited"
  if (durationMonths === 12) return "12 bulan"
  return `${durationMonths} bulan`
}

export default async function SubscriptionPackageManager() {
  try {
    await ensureDefaultSubscriptionPackages()
  } catch (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        {error instanceof Error ? error.message : "Gagal memuat paket berlangganan."}
      </div>
    )
  }

  let packages: Awaited<ReturnType<typeof prisma.subscriptionPackage.findMany>> = []
  try {
    packages = await prisma.subscriptionPackage.findMany({
      orderBy: [{ isActive: "desc" }, { durationMonths: "asc" }, { createdAt: "asc" }],
    })
  } catch (error) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        {error instanceof Error ? error.message : "Gagal memuat paket berlangganan."}
      </div>
    )
  }

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6">
      <div className="mb-5">
        <h2 className="text-lg font-bold text-slate-800">Paket Berlangganan</h2>
        <p className="mt-1 text-sm text-slate-500">Kelola paket (nama, harga, durasi) yang muncul di halaman Berlangganan dan Platform Admin.</p>
      </div>

      <form action={createSubscriptionPackage} className="grid gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 sm:grid-cols-6">
        <input
          name="code"
          placeholder="KODE (mis: ANNUAL)"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-1"
          required
        />
        <input
          name="name"
          placeholder="Nama paket"
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
          required
        />
        <input
          name="durationMonths"
          placeholder="Durasi (bulan)"
          type="number"
          min={1}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-1"
        />
        <input
          name="amountIdr"
          placeholder="Harga (IDR)"
          type="number"
          min={0}
          className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-1"
        />
        <div className="flex items-center justify-between gap-2 sm:col-span-1">
          <label className="flex items-center gap-2 text-sm text-slate-600">
            <input type="checkbox" name="isActive" defaultChecked className="size-4" />
            Aktif
          </label>
          <button className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-bold text-white hover:bg-slate-800">
            Add
          </button>
        </div>
      </form>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-600">
            <tr>
              <th className="px-4 py-3 font-bold">Kode</th>
              <th className="px-4 py-3 font-bold">Nama</th>
              <th className="px-4 py-3 font-bold">Durasi</th>
              <th className="px-4 py-3 font-bold text-right">Harga</th>
              <th className="px-4 py-3 font-bold">Aktif</th>
              <th className="px-4 py-3 font-bold text-right">Aksi</th>
            </tr>
          </thead>
          <tbody>
            {packages.length === 0 ? (
              <tr className="border-t border-slate-100">
                <td colSpan={6} className="px-4 py-4 text-slate-500">
                  Belum ada paket.
                </td>
              </tr>
            ) : (
              packages.map((pkg) => (
                <tr key={pkg.id} className="border-t border-slate-100 align-top">
                  <td className="px-4 py-4 font-mono text-xs text-slate-700">{pkg.code}</td>
                  <td className="px-4 py-4">
                    <form action={updateSubscriptionPackage} className="grid gap-2 sm:grid-cols-2">
                      <input type="hidden" name="id" value={pkg.id} />
                      <input
                        name="name"
                        defaultValue={pkg.name}
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm sm:col-span-2"
                        required
                      />
                      <input
                        name="durationMonths"
                        type="number"
                        min={1}
                        defaultValue={pkg.durationMonths ?? ""}
                        placeholder="Durasi (bulan)"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                      <input
                        name="amountIdr"
                        type="number"
                        min={0}
                        defaultValue={pkg.amountIdr ?? ""}
                        placeholder="Harga (IDR)"
                        className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
                      />
                      <label className="flex items-center gap-2 text-xs text-slate-600 sm:col-span-2">
                        <input type="checkbox" name="isActive" defaultChecked={pkg.isActive} className="size-4" />
                        Aktif
                      </label>
                      <div className="flex justify-end gap-2 sm:col-span-2">
                        <button className="rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50">
                          Simpan
                        </button>
                      </div>
                    </form>
                  </td>
                  <td className="px-4 py-4 text-slate-600">{formatDuration(pkg.durationMonths)}</td>
                  <td className="px-4 py-4 text-right font-mono text-slate-700">
                    {pkg.amountIdr ? `Rp ${Number(pkg.amountIdr).toLocaleString("id-ID")}` : "-"}
                  </td>
                  <td className="px-4 py-4">
                    <span className={`inline-flex rounded-full px-2 py-1 text-xs font-bold ${pkg.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600"}`}>
                      {pkg.isActive ? "ACTIVE" : "OFF"}
                    </span>
                  </td>
                  <td className="px-4 py-4 text-right">
                    <form action={deleteSubscriptionPackage}>
                      <input type="hidden" name="id" value={pkg.id} />
                      <button className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-100">
                        Delete
                      </button>
                    </form>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
