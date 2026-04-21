
import { prisma } from "../../lib/prisma"
import BankModal from "../../components/forms/BankModal"
import BankClientComponent from "../../components/BankClientComponent"
import { requireModuleAccess } from "../../lib/auth"

export default async function BankPage() {
  const { organization: activeOrg } = await requireModuleAccess("bank")
  const banks = await prisma.bankAccount.findMany({
    where: { organizationId: activeOrg.id },
    include: { account: true, organization: true }
  })

  if (!activeOrg) {
    return (
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Rekening Bank & Kas</h1>
        <p className="text-slate-500 mt-2">Belum ada organisasi. Silakan buat organisasi terlebih dahulu.</p>
      </div>
    )
  }

  const activeBanks = banks.filter(b => b.status === "ACTIVE")
  const inactiveBanks = banks.filter(b => b.status === "INACTIVE")

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Rekening Bank & Kas</h1>
        {activeOrg && <BankModal orgId={activeOrg.id} />}
      </div>

      <BankClientComponent 
        banks={banks}
        activeBanks={activeBanks}
        inactiveBanks={inactiveBanks}
      />
    </div>
  )
}
