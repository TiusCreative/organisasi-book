import { prisma } from "../../lib/prisma"
import { Tag, ArrowLeft } from "lucide-react"
import Link from "next/link"
import CategoryModal from "../../components/forms/CategoryModal"
import EditCategoryModal from "../../components/forms/EditCategoryModal"
import AddAccountModal from "../../components/forms/AddAccountModal"
import EditAccountModal from "../../components/forms/EditAccountModal"
import DeleteCategoryButton from "../../components/DeleteCategoryButton"
import DeleteAccountButton from "../../components/DeleteAccountButton"
import InitializeAccountsButton from "../../components/forms/InitializeAccountsButton"
import { requireModuleAccess } from "../../lib/auth"

export default async function AkunPage() {
  const { organization } = await requireModuleAccess("accounts")
  const activeOrg = await prisma.organization.findUnique({
    where: { id: organization.id },
    include: { 
      categories: true,
      accounts: { orderBy: { code: 'asc' } }
    }
  })
  const accounts = await prisma.chartOfAccount.findMany({
    where: { organizationId: activeOrg?.id },
    include: { organization: true, category: true },
    orderBy: { code: 'asc' }
  })

  return (
    <div className="max-w-6xl mx-auto space-y-8">
      <div className="mb-6">
        <Link href="/dashboard" className="inline-flex items-center gap-2 text-slate-600 hover:text-slate-800 transition-colors">
          <ArrowLeft size={20} />
          <span>Kembali ke Dashboard</span>
        </Link>
      </div>
      {/* Categories Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Kategori Akun</h2>
            <p className="text-slate-500 text-sm">Kelompokkan akun berdasarkan kategori.</p>
          </div>
          {activeOrg && <CategoryModal orgId={activeOrg.id} />}
        </div>

        <div className="grid gap-3">
          {activeOrg?.categories && activeOrg.categories.length > 0 ? (
            activeOrg.categories.map((category) => (
              <div 
                key={category.id} 
                className="bg-white p-4 rounded-xl border border-slate-100 shadow-sm hover:border-blue-200 transition-all flex items-center justify-between group"
              >
                <div className="flex items-center gap-3 flex-1">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center text-white font-bold flex-shrink-0"
                    style={{ backgroundColor: category.color }}
                  >
                    <Tag size={18} />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-700">{category.name}</h3>
                  </div>
                </div>
                
                <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                  <EditCategoryModal category={category} />
                  <DeleteCategoryButton categoryId={category.id} />
                </div>
              </div>
            ))
          ) : (
            <div className="text-center py-12 bg-slate-50 rounded-xl border border-slate-100">
              <p className="text-slate-400 text-sm">Belum ada kategori. Tambahkan untuk memulai.</p>
            </div>
          )}
        </div>
      </div>

      <hr className="border-slate-200" />

      {/* Chart of Accounts Section */}
      <div className="space-y-4">
        <div className="flex justify-between items-center gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-800">Chart of Accounts</h2>
            <p className="text-slate-500 text-sm">Kelola daftar akun untuk setiap organisasi.</p>
          </div>
          <div className="flex gap-2">
            {activeOrg && accounts.length === 0 && (
              <InitializeAccountsButton organizationId={activeOrg.id} />
            )}
            {activeOrg && <AddAccountModal orgId={activeOrg.id} categories={activeOrg.categories} />}
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-slate-50 border-b border-slate-200">
                <tr>
                  <th className="p-4 font-semibold text-slate-600 text-sm">Kode</th>
                  <th className="p-4 font-semibold text-slate-600 text-sm">Nama Akun</th>
                  <th className="p-4 font-semibold text-slate-600 text-sm">Kategori</th>
                  <th className="p-4 font-semibold text-slate-600 text-sm">Tipe</th>
                  <th className="p-4 font-semibold text-slate-600 text-sm">Organisasi</th>
                  <th className="p-4 font-semibold text-slate-600 text-sm text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {accounts.map((acc) => (
                  <tr key={acc.id} className="hover:bg-slate-50 transition-colors">
                    <td className="p-4 font-mono text-sm text-blue-600 font-bold">{acc.code}</td>
                    <td className="p-4 text-slate-700 font-medium">{acc.name}</td>
                    <td className="p-4">
                      {acc.category ? (
                        <div className="flex items-center gap-2">
                          <div 
                            className="w-3 h-3 rounded-full"
                            style={{ backgroundColor: acc.category.color }}
                          ></div>
                          <span className="text-sm text-slate-600">{acc.category.name}</span>
                        </div>
                      ) : (
                        <span className="text-slate-400 text-sm italic">-</span>
                      )}
                    </td>
                    <td className="p-4">
                      <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs rounded-md uppercase font-bold border border-slate-200">
                        {acc.type}
                      </span>
                    </td>
                    <td className="p-4 text-slate-500 text-sm">{acc.organization.name}</td>
                    <td className="p-4 text-right space-x-2">
                      <EditAccountModal account={acc} categories={activeOrg?.categories || []} />
                      <DeleteAccountButton accountId={acc.id} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  )
}
