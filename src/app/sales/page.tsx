import { requireModuleAccess } from "@/lib/auth"
import { getSalesModuleData, getSalesReportSummary } from "@/app/actions/sales"
import SalesMarketingManager from "@/components/sales/SalesMarketingManager"

export default async function SalesPage() {
  await requireModuleAccess("sales")

  const [data, report] = await Promise.all([
    getSalesModuleData(),
    getSalesReportSummary(),
  ])

  return <SalesMarketingManager initialData={data} initialReport={report} />
}
