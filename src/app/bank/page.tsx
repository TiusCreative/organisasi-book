
import { prisma } from "../../lib/prisma"
import BankModal from "../../components/forms/BankModal"
import BankClientComponent from "../../components/BankClientComponent"
import { requireModuleAccess } from "../../lib/auth"
import BankManagement from "../../components/bank/BankManagement"

export default async function BankPage() {
  const { organization: activeOrg } = await requireModuleAccess("bank")
  
  if (!activeOrg) {
    return (
      <div className="max-w-5xl mx-auto">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Rekening Bank & Kas</h1>
        <p className="text-slate-500 mt-2">Belum ada organisasi. Silakan buat organisasi terlebih dahulu.</p>
      </div>
    )
  }

  const banks = await prisma.bankAccount.findMany({
    where: { organizationId: activeOrg.id },
    include: { account: true, currency: true }
  })

  const pettyCashAccounts = await prisma.pettyCash.findMany({
    where: { organizationId: activeOrg.id },
    include: { currency: true, custodian: true }
  })

  const reconciliations = await prisma.bankReconciliation.findMany({
    where: { organizationId: activeOrg.id },
    include: { bankAccount: { include: { account: true } } },
    orderBy: { reconciliationDate: 'desc' },
    take: 10
  })

  const activeBanks = banks.filter(b => b.status === "ACTIVE")
  const inactiveBanks = banks.filter(b => b.status === "INACTIVE")

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">Manajemen Kas & Bank</h1>
      </div>

      <BankManagement 
        banks={banks}
        activeBanks={activeBanks}
        inactiveBanks={inactiveBanks}
        pettyCashAccounts={pettyCashAccounts}
        reconciliations={reconciliations}
        organizationId={activeOrg.id}
      />
    </div>
  )
}
