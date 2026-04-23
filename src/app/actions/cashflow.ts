"use server"

import { prisma } from "../../lib/prisma"
import { requireCurrentOrganization } from "../../lib/auth"

export async function getCashFlowStatement(startDate: Date, endDate: Date) {
  const { organization } = await requireCurrentOrganization()

  if (startDate > endDate) {
    throw new Error("startDate tidak boleh lebih besar dari endDate")
  }

  const bankAccounts = await prisma.bankAccount.findMany({
    where: { organizationId: organization.id, status: "ACTIVE" },
    select: { accountId: true },
    take: 10_000,
  })
  const cashAccountIds = new Set(bankAccounts.map((b) => b.accountId))

  const transactions = await prisma.transaction.findMany({
    where: {
      organizationId: organization.id,
      date: { gte: startDate, lte: endDate },
    },
    include: {
      lines: {
        include: { account: { include: { category: true } } },
      },
    },
    orderBy: { date: "asc" },
    take: 50_000,
  })

  // Opening cash balance from GL (bank account COA) before startDate.
  const openingRows = cashAccountIds.size
    ? await prisma.$queryRawUnsafe<Array<{ accountId: string; balance: number }>>(
        `
          SELECT
            tl."accountId" as "accountId",
            COALESCE(SUM(tl."debit" - tl."credit"), 0)::double precision AS "balance"
          FROM "TransactionLine" tl
          JOIN "Transaction" t ON t."id" = tl."transactionId"
          WHERE t."organizationId" = $1
            AND t."date" < $2
            AND tl."accountId" = ANY($3::text[])
          GROUP BY tl."accountId"
        `,
        organization.id,
        startDate,
        Array.from(cashAccountIds),
      )
    : []

  const openingBalance = openingRows.reduce((sum, r) => sum + Number(r.balance || 0), 0)

  type Activity = "OPERATING" | "INVESTING" | "FINANCING"
  type FlowLine = { label: string; amount: number }
  type Bucket = { in: number; out: number; net: number; linesIn: FlowLine[]; linesOut: FlowLine[] }

  const buckets: Record<Activity, Bucket> = {
    OPERATING: { in: 0, out: 0, net: 0, linesIn: [], linesOut: [] },
    INVESTING: { in: 0, out: 0, net: 0, linesIn: [], linesOut: [] },
    FINANCING: { in: 0, out: 0, net: 0, linesIn: [], linesOut: [] },
  }

  const addLine = (bucket: Bucket, dir: "in" | "out", label: string, amount: number) => {
    const lines = dir === "in" ? bucket.linesIn : bucket.linesOut
    const existing = lines.find((l) => l.label === label)
    if (existing) existing.amount += amount
    else lines.push({ label, amount })
  }

  const classify = (account: { type: string; code: string; category?: { name: string } | null }): Activity => {
    const cat = account.category?.name || ""
    if (account.type === "Equity" || account.type === "Liability") return "FINANCING"
    if (account.type === "Asset") {
      if (cat === "Aset Tetap" || cat === "Investasi" || cat === "Aset Tak Berwujud") return "INVESTING"
      if (account.code.startsWith("17") || account.code.startsWith("12")) return "INVESTING"
    }
    return "OPERATING"
  }

  for (const tx of transactions) {
    const cashLines = tx.lines.filter((l) => cashAccountIds.has(l.accountId))
    if (cashLines.length === 0) continue

    const cashDelta = cashLines.reduce((sum, l) => sum + (l.debit - l.credit), 0)
    if (Math.abs(cashDelta) < 0.000001) continue

    const otherLines = tx.lines
      .filter((l) => !cashAccountIds.has(l.accountId))
      .map((l) => ({ ...l, delta: l.debit - l.credit, abs: Math.abs(l.debit - l.credit) }))
      .sort((a, b) => b.abs - a.abs)

    const primary = otherLines[0]
    const label = primary?.account ? `${primary.account.code} ${primary.account.name}` : "Tidak Terklasifikasi"
    const activity = primary?.account ? classify(primary.account) : "OPERATING"

    const bucket = buckets[activity]
    if (cashDelta > 0) {
      bucket.in += cashDelta
      addLine(bucket, "in", label, cashDelta)
    } else {
      bucket.out += Math.abs(cashDelta)
      addLine(bucket, "out", label, Math.abs(cashDelta))
    }
  }

  for (const key of Object.keys(buckets) as Activity[]) {
    buckets[key].in = Number(buckets[key].in || 0)
    buckets[key].out = Number(buckets[key].out || 0)
    buckets[key].net = buckets[key].in - buckets[key].out
    buckets[key].linesIn.sort((a, b) => b.amount - a.amount)
    buckets[key].linesOut.sort((a, b) => b.amount - a.amount)
  }

  const operatingNet = buckets.OPERATING.net
  const investingNet = buckets.INVESTING.net
  const financingNet = buckets.FINANCING.net
  const netCashFlow = operatingNet + investingNet + financingNet
  const endingBalance = openingBalance + netCashFlow

  return {
    period: { startDate, endDate },
    operating: { in: buckets.OPERATING.in, out: buckets.OPERATING.out, net: buckets.OPERATING.net, linesIn: buckets.OPERATING.linesIn, linesOut: buckets.OPERATING.linesOut },
    investing: { in: buckets.INVESTING.in, out: buckets.INVESTING.out, net: buckets.INVESTING.net, linesIn: buckets.INVESTING.linesIn, linesOut: buckets.INVESTING.linesOut },
    financing: { in: buckets.FINANCING.in, out: buckets.FINANCING.out, net: buckets.FINANCING.net, linesIn: buckets.FINANCING.linesIn, linesOut: buckets.FINANCING.linesOut },
    netCashFlow,
    beginningBalance: openingBalance,
    endingBalance,
  }
}
