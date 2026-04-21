import { formatDateRange } from "./date-range"

type OrganizationInfo = {
  name: string
  addressLines?: string[]
  label?: string
}

type GenericReport = {
  title: string
  description?: string
  data?: ReportRow[]
  totals?: ReportTotals
}

type ReportTotals = Record<string, number | string | undefined>

type TransactionLikeRow = {
  date: string | Date
  reference?: string
  description?: string
  reportBankLine?: { debit?: number; credit?: number }
  reportCategoryLine?: { account?: { name?: string } }
}

type ProfitLossRow = {
  label: string
  amount: number
}

type LedgerRow = {
  code: string
  name: string
  debit: number
  credit: number
  balance: number
}

type BankRow = {
  bankName: string
  accountNumber: string
  accountName: string
  balance?: number
}

type ReportRow = TransactionLikeRow | ProfitLossRow | LedgerRow | BankRow

const MAX_ROWS = 12

function formatCurrency(value: number | undefined) {
  return `Rp ${(value || 0).toLocaleString("id-ID")}`
}

function formatDate(value: string | Date) {
  return new Date(value).toLocaleDateString("id-ID")
}

function limitRows(lines: string[]) {
  if (lines.length <= MAX_ROWS) {
    return lines
  }

  return [
    ...lines.slice(0, MAX_ROWS),
    `... dan ${lines.length - MAX_ROWS} baris lainnya`,
  ]
}

function buildHeader(reportTitle: string, org: OrganizationInfo, period: string, description?: string) {
  return [
    reportTitle,
    `${org.label || "Nama Organisasi"}: ${org.name}`,
    ...(org.addressLines || []).map((line) => `Alamat: ${line}`),
    `Periode: ${period}`,
    ...(description && !description.startsWith("Periode:") ? [description] : []),
  ]
}

export function buildReportWhatsappText(reportType: string, report: GenericReport, org: OrganizationInfo, period: string) {
  const header = buildHeader(report.title, org, period, report.description)
  const data = report.data || []
  const totals = report.totals || {}

  switch (reportType) {
    case "transactions":
      return [
        ...header,
        "",
        "Rincian Transaksi:",
        ...limitRows(
          (data as TransactionLikeRow[]).map((trx) => {
            const amount = Math.max(trx.reportBankLine?.debit || 0, trx.reportBankLine?.credit || 0)
            const direction = (trx.reportBankLine?.debit || 0) > 0 ? "Masuk" : "Keluar"
            return `${formatDate(trx.date)} | ${trx.reference} | ${trx.description} | ${direction} ${formatCurrency(amount)}`
          })
        ),
        "",
        `Total Penerimaan: ${formatCurrency(totals.income)}`,
        `Total Pengeluaran: ${formatCurrency(totals.expense)}`,
        `Saldo Bersih: ${formatCurrency(totals.net)}`,
      ].join("\n")
    case "income":
      return [
        ...header,
        "",
        "Rincian Penerimaan:",
        ...limitRows(
          (data as TransactionLikeRow[]).map(
            (trx) =>
              `${formatDate(trx.date)} | ${trx.description} | ${trx.reportCategoryLine?.account?.name || "-"} | ${formatCurrency(trx.reportBankLine?.debit || 0)}`
          )
        ),
        "",
        `Total Penerimaan: ${formatCurrency(totals.totalIncome)}`,
      ].join("\n")
    case "expense":
      return [
        ...header,
        "",
        "Rincian Pengeluaran:",
        ...limitRows(
          (data as TransactionLikeRow[]).map(
            (trx) =>
              `${formatDate(trx.date)} | ${trx.description} | ${trx.reportCategoryLine?.account?.name || "-"} | ${formatCurrency(trx.reportBankLine?.credit || 0)}`
          )
        ),
        "",
        `Total Pengeluaran: ${formatCurrency(totals.totalExpense)}`,
      ].join("\n")
    case "profitLoss":
      return [
        ...header,
        "",
        "Ringkasan:",
        ...(data as ProfitLossRow[]).map((row) => `${row.label}: ${formatCurrency(row.amount)}`),
        "",
        `Pendapatan: ${formatCurrency(totals.income)}`,
        `Beban: ${formatCurrency(totals.expense)}`,
        `${report.title === "Laporan Aktivitas" ? "Surplus / Defisit" : "Laba Bersih"}: ${formatCurrency(totals.netIncome)}`,
      ].join("\n")
    case "generalLedger":
      return [
        ...header,
        "",
        "Ringkasan Buku Besar:",
        ...limitRows(
          (data as LedgerRow[]).map(
            (item) =>
              `${item.code} | ${item.name} | D ${formatCurrency(item.debit)} | K ${formatCurrency(item.credit)} | Saldo ${formatCurrency(item.balance)}`
          )
        ),
        "",
        `Total Debit: ${formatCurrency(totals.totalDebit)}`,
        `Total Kredit: ${formatCurrency(totals.totalCredit)}`,
      ].join("\n")
    case "bank":
      return [
        ...header,
        "",
        "Saldo Rekening:",
        ...limitRows(
          (data as BankRow[]).map(
            (bank) =>
              `${bank.bankName} (${bank.accountNumber}) a.n. ${bank.accountName} | Saldo ${formatCurrency(bank.balance || 0)}`
          )
        ),
        "",
        `Total Saldo Bank & Kas: ${formatCurrency(totals.totalBalance)}`,
      ].join("\n")
    default:
      return [...header, "", report.description || ""].filter(Boolean).join("\n")
  }
}

type BalanceSheetData = {
  period: { startDate: Date; endDate: Date }
  assets: { current: BalanceLine[]; fixed: BalanceLine[]; other: BalanceLine[] }
  liabilities: { current: BalanceLine[]; longTerm: BalanceLine[] }
  equity: BalanceLine[]
  totalAssets: number
  totalLiabilities: number
  totalEquity: number
  totalLiabilitiesAndEquity?: number
}

type BalanceLine = {
  code: string
  name: string
  balance: number
}

export function buildBalanceSheetWhatsappText(
  report: BalanceSheetData,
  org: OrganizationInfo & { type?: string }
) {
  const equityLabel = org.type === "YAYASAN" ? "Aset Neto" : "Ekuitas"
  const lines = buildHeader("Laporan Neraca", org, formatDateRange(report.period.startDate, report.period.endDate))

  return [
    ...lines,
    "",
    "Ringkasan:",
    `Total Aset: ${formatCurrency(report.totalAssets)}`,
    `Total Kewajiban: ${formatCurrency(report.totalLiabilities)}`,
    `Total ${equityLabel}: ${formatCurrency(report.totalEquity)}`,
    "",
    "Aset:",
    ...limitRows(
      [...report.assets.current, ...report.assets.fixed, ...report.assets.other].map(
        (item) => `${item.code} ${item.name}: ${formatCurrency(item.balance)}`
      )
    ),
    "",
    "Kewajiban & Ekuitas:",
    ...limitRows(
      [...report.liabilities.current, ...report.liabilities.longTerm, ...report.equity].map(
        (item) => `${item.code} ${item.name}: ${formatCurrency(item.balance)}`
      )
    ),
  ].join("\n")
}

type IncomeStatementData = {
  period: { startDate: Date; endDate: Date }
  revenues: BalanceLine[]
  operatingExpenses: BalanceLine[]
  administrativeExpenses: BalanceLine[]
  otherExpenses: BalanceLine[]
  totalRevenue: number
  totalExpense: number
  netIncome: number
}

export function buildIncomeStatementWhatsappText(
  report: IncomeStatementData,
  org: OrganizationInfo & { type?: string }
) {
  const isYayasan = org.type === "YAYASAN"
  const title = isYayasan ? "Laporan Aktivitas" : "Laporan Laba Rugi"

  return [
    ...buildHeader(title, org, formatDateRange(report.period.startDate, report.period.endDate)),
    "",
    "Pendapatan / Arus Masuk:",
    ...limitRows(report.revenues.map((item) => `${item.code} ${item.name}: ${formatCurrency(item.balance)}`)),
    "",
    "Beban / Arus Keluar:",
    ...limitRows(
      [...report.operatingExpenses, ...report.administrativeExpenses, ...report.otherExpenses].map(
        (item) => `${item.code} ${item.name}: ${formatCurrency(item.balance)}`
      )
    ),
    "",
    `${isYayasan ? "Total Arus Masuk" : "Total Pendapatan"}: ${formatCurrency(report.totalRevenue)}`,
    `${isYayasan ? "Total Arus Keluar" : "Total Beban"}: ${formatCurrency(report.totalExpense)}`,
    `${isYayasan ? "Surplus / Defisit" : "Laba / Rugi Bersih"}: ${formatCurrency(report.netIncome)}`,
  ].join("\n")
}
