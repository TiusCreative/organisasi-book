import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { buildOrganizationAddressLines } from "@/lib/branding"
import { resolveDateRange, formatDateRange } from "@/lib/date-range"
import {
  formatDate,
  formatRupiah,
  renderPrintableReportHtml,
  renderText,
} from "@/lib/report-export"
import {
  generateBalanceSheetByDateRange,
  generateIncomeStatementByDateRange,
} from "@/lib/periodic-financial-reports"
import { generateInvestmentReport } from "@/lib/investment-reports"
import { generateBankOutstandingReport } from "@/lib/bank-reports"
import {
  generateExpenseReport,
  generateGeneralLedger,
  generateIncomeReport,
  generateProfitLossReport,
  generateTransactionReport,
} from "@/lib/report-utils"

function summaryCard(label: string, value: string) {
  return `
    <div class="summary-card">
      <div class="summary-label">${renderText(label)}</div>
      <div class="summary-value">${renderText(value)}</div>
    </div>
  `
}

function renderSection(title: string, body: string) {
  return `
    <section class="section">
      <div class="section-title">${renderText(title)}</div>
      ${body}
    </section>
  `
}

function renderSimpleTable(headers: string[], rows: string[][], totalRow?: string[]) {
  return `
    <table>
      <thead>
        <tr>${headers.map((header) => `<th>${renderText(header)}</th>`).join("")}</tr>
      </thead>
      <tbody>
        ${rows
          .map(
            (row) => `
              <tr>${row.map((cell, index) => `<td class="${index === row.length - 1 ? "text-right" : ""}">${cell}</td>`).join("")}</tr>
            `
          )
          .join("")}
        ${
          totalRow
            ? `<tr class="total-row">${totalRow
                .map((cell, index) => `<td class="${index === totalRow.length - 1 ? "text-right" : ""}">${cell}</td>`)
                .join("")}</tr>`
            : ""
        }
      </tbody>
    </table>
  `
}

function renderEmpty(message: string, colSpan = 2) {
  return `<tr><td colspan="${colSpan}" class="text-center muted">${renderText(message)}</td></tr>`
}

function roundMoney(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100
}

async function getNetIncome(orgId: string, startDate: Date, endDate: Date) {
  const rows = await prisma.$queryRawUnsafe<Array<{ netIncome: number }>>(
    `
      SELECT
        COALESCE(SUM(
          CASE
            WHEN a."type" = 'Revenue' THEN (tl."credit" - tl."debit")
            WHEN a."type" = 'Expense' THEN -(tl."debit" - tl."credit")
            ELSE 0
          END
        ), 0)::double precision AS "netIncome"
      FROM "TransactionLine" tl
      JOIN "Transaction" t ON t."id" = tl."transactionId"
      JOIN "ChartOfAccount" a ON a."id" = tl."accountId"
      WHERE t."organizationId" = $1
        AND t."date" >= $2 AND t."date" <= $3
    `,
    orgId,
    startDate,
    endDate,
  )

  return roundMoney(Number(rows[0]?.netIncome || 0))
}

export async function handleReportPdfRequest(
  req: NextRequest,
  orgId: string,
  reportType: string
) {
  try {
    const url = new URL(req.url)
    const { startDate, endDate } = resolveDateRange({
      startDate: url.searchParams.get("startDate") || undefined,
      endDate: url.searchParams.get("endDate") || undefined,
    })

    const isHrgaReport = reportType === "attendance" || reportType === "maintenance"

    const organization = await prisma.organization.findUnique(
      isHrgaReport
        ? {
            where: { id: orgId },
            select: {
              id: true,
              name: true,
              type: true,
              address: true,
              city: true,
              province: true,
              postalCode: true,
              phone: true,
              email: true,
              banks: true,
            },
          }
        : {
            where: { id: orgId },
            include: {
              accounts: {
                include: {
                  journalItems: {
                    where: {
                      transaction: {
                        date: {
                          gte: startDate,
                          lte: endDate,
                        },
                      },
                    },
                  },
                },
              },
              banks: true,
              transactions: {
                where: {
                  date: {
                    gte: startDate,
                    lte: endDate,
                  },
                },
                include: {
                  lines: {
                    include: {
                      account: true,
                    },
                  },
                },
                orderBy: [{ date: "asc" }, { createdAt: "asc" }],
              },
              taxEntries: {
                where: {
                  date: {
                    gte: startDate,
                    lte: endDate,
                  },
                },
                orderBy: [{ periodYear: "desc" }, { periodMonth: "desc" }, { date: "desc" }],
              },
              salarySlips: {
                orderBy: [{ year: "desc" }, { month: "desc" }],
                include: { employee: true },
              },
            },
          }
    )

    if (!organization) {
      return NextResponse.json({ error: "Organisasi tidak ditemukan" }, { status: 404 })
    }

    const orgName = organization.name
    const addressLines = buildOrganizationAddressLines(organization)
    const bankAccountIds = new Set((organization.banks || []).map((bank) => bank.accountId))

    let title = "Laporan"
    let subtitle = formatDateRange(startDate, endDate)
    let bodyHtml = ""

    switch (reportType) {
      case "neraca": {
        const report = await generateBalanceSheetByDateRange(
          orgId,
          endDate,
          (organization.type as "YAYASAN" | "PERUSAHAAN") || "PERUSAHAAN",
          startDate
        )
        title = "Laporan Neraca"
        subtitle = `Per ${formatDate(report.period.endDate)}`

        const assetRows = [
          ...report.assets.current,
          ...report.assets.fixed,
          ...report.assets.other,
        ].map((row) => [renderText(`${row.code} ${row.name}`), renderText(formatRupiah(row.balance))])
        const liabilityRows = [...report.liabilities.current, ...report.liabilities.longTerm].map((row) => [
          renderText(`${row.code} ${row.name}`),
          renderText(formatRupiah(row.balance)),
        ])
        const equityRows = report.equity.map((row) => [
          renderText(`${row.code} ${row.name}`),
          renderText(formatRupiah(row.balance)),
        ])

        bodyHtml = `
          <div class="summary-grid">
            ${summaryCard("Total Aset", formatRupiah(report.totalAssets))}
            ${summaryCard("Total Kewajiban", formatRupiah(report.totalLiabilities))}
            ${summaryCard(
              organization.type === "YAYASAN" ? "Total Aset Neto" : "Total Ekuitas",
              formatRupiah(report.totalEquity)
            )}
            ${summaryCard("Status Neraca", report.balanced ? "Seimbang" : "Belum Seimbang")}
          </div>
          ${renderSection(
            "Aset",
            `
              <table>
                <thead>
                  <tr><th>Akun</th><th>Saldo</th></tr>
                </thead>
                <tbody>
                  ${assetRows.length
                    ? assetRows.map((row) => `<tr><td>${row[0]}</td><td class="text-right">${row[1]}</td></tr>`).join("")
                    : renderEmpty("Tidak ada data aset", 2)}
                  <tr class="total-row"><td>Total Aset</td><td class="text-right">${renderText(formatRupiah(report.totalAssets))}</td></tr>
                </tbody>
              </table>
            `
          )}
          ${renderSection(
            "Kewajiban",
            `
              <table>
                <thead>
                  <tr><th>Akun</th><th>Saldo</th></tr>
                </thead>
                <tbody>
                  ${liabilityRows.length
                    ? liabilityRows.map((row) => `<tr><td>${row[0]}</td><td class="text-right">${row[1]}</td></tr>`).join("")
                    : renderEmpty("Tidak ada data kewajiban", 2)}
                  <tr class="total-row"><td>Total Kewajiban</td><td class="text-right">${renderText(formatRupiah(report.totalLiabilities))}</td></tr>
                </tbody>
              </table>
            `
          )}
          ${renderSection(
            organization.type === "YAYASAN" ? "Aset Neto" : "Ekuitas",
            `
              <table>
                <thead>
                  <tr><th>Akun</th><th>Saldo</th></tr>
                </thead>
                <tbody>
                  ${equityRows.length
                    ? equityRows.map((row) => `<tr><td>${row[0]}</td><td class="text-right">${row[1]}</td></tr>`).join("")
                    : renderEmpty("Tidak ada data ekuitas", 2)}
                  <tr class="total-row">
                    <td>${renderText(organization.type === "YAYASAN" ? "Total Aset Neto" : "Total Ekuitas")}</td>
                    <td class="text-right">${renderText(formatRupiah(report.totalEquity))}</td>
                  </tr>
                </tbody>
              </table>
            `
          )}
        `
        break
      }
      case "aktivitas":
      case "laba-rugi": {
        const report = await generateIncomeStatementByDateRange(orgId, startDate, endDate)
        const isYayasan = organization.type === "YAYASAN"
        const totalOperatingExpenses = report.operatingExpenses.reduce((sum, row) => sum + row.balance, 0)
        const totalAdminExpenses = report.administrativeExpenses.reduce((sum, row) => sum + row.balance, 0)
        const totalOtherExpenses = report.otherExpenses.reduce((sum, row) => sum + row.balance, 0)
        title = isYayasan ? "Laporan Aktivitas" : "Laporan Laba Rugi"

        bodyHtml = `
          <div class="summary-grid">
            ${summaryCard(isYayasan ? "Total Arus Masuk" : "Total Pendapatan", formatRupiah(report.totalRevenue))}
            ${summaryCard(isYayasan ? "Total Arus Keluar" : "Total Beban", formatRupiah(report.totalExpense))}
            ${summaryCard(isYayasan ? "Surplus / Defisit" : "Laba / Rugi Bersih", formatRupiah(report.netIncome))}
            ${summaryCard("Periode", formatDateRange(report.period.startDate, report.period.endDate))}
          </div>
          ${renderSection(
            isYayasan ? "Pendapatan / Arus Masuk" : "Pendapatan",
            `
              <table>
                <thead>
                  <tr><th>Akun</th><th>Saldo</th></tr>
                </thead>
                <tbody>
                  ${
                    report.revenues.length
                      ? report.revenues
                          .map((row) => `<tr><td>${renderText(`${row.code} ${row.name}`)}</td><td class="text-right">${renderText(formatRupiah(row.balance))}</td></tr>`)
                          .join("")
                      : renderEmpty("Tidak ada pendapatan pada periode ini", 2)
                  }
                  <tr class="total-row"><td>${renderText(isYayasan ? "Total Arus Masuk" : "Total Pendapatan")}</td><td class="text-right">${renderText(formatRupiah(report.totalRevenue))}</td></tr>
                </tbody>
              </table>
            `
          )}
          ${renderSection(
            isYayasan ? "Beban / Arus Keluar" : "Beban",
            renderSimpleTable(
              ["Kelompok", "Saldo"],
              [
                ["Operasional", renderText(formatRupiah(totalOperatingExpenses))],
                ["Administrasi", renderText(formatRupiah(totalAdminExpenses))],
                ["Lainnya", renderText(formatRupiah(totalOtherExpenses))],
              ],
              [isYayasan ? "Total Arus Keluar" : "Total Beban", renderText(formatRupiah(report.totalExpense))]
            )
          )}
        `
        break
      }
      case "investasi": {
        const report = await generateInvestmentReport({
          organizationId: orgId,
          type: url.searchParams.get("type") || undefined,
          status: url.searchParams.get("status") || undefined,
          startDate,
          endDate,
        })
        title = "Laporan Investasi"

        bodyHtml = `
          <div class="summary-grid">
            ${summaryCard("Jumlah Investasi", String(report.summary.totalInvestments))}
            ${summaryCard("Total Perolehan", formatRupiah(report.summary.totalPurchaseAmount))}
            ${summaryCard("Total Nilai Buku", formatRupiah(report.summary.totalCurrentValue))}
            ${summaryCard("Untung / Rugi Belum Realisasi", formatRupiah(report.summary.totalUnrealizedGainLoss))}
          </div>
          ${renderSection(
            "Daftar Investasi",
            `
              <table>
                <thead>
                  <tr>
                    <th>Jenis</th>
                    <th>Nama</th>
                    <th>Institusi</th>
                    <th>Status</th>
                    <th class="text-right">Perolehan</th>
                    <th class="text-right">Nilai Buku</th>
                    <th class="text-right">Untung / Rugi</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    report.rows.length
                      ? report.rows
                          .map(
                            (row) => `
                              <tr>
                                <td>${renderText(row.type.replaceAll("_", " "))}</td>
                                <td>${renderText(row.name)}<br /><span class="muted">${renderText(formatDate(row.startDate))}</span></td>
                                <td>${renderText(row.institution)}</td>
                                <td>${renderText(row.status)}</td>
                                <td class="text-right">${renderText(formatRupiah(Number(row.purchaseAmount)))}</td>
                                <td class="text-right">${renderText(formatRupiah(Number(row.currentValue)))}</td>
                                <td class="text-right">${renderText(formatRupiah(row.unrealizedGainLoss))}</td>
                              </tr>
                            `
                          )
                          .join("")
                      : renderEmpty("Tidak ada data investasi untuk filter ini.", 7)
                  }
                </tbody>
              </table>
            `
          )}
        `
        break
      }
      case "pajak": {
        title = "Laporan Pajak"
        const totals = {
          pph21: organization.taxEntries
            .filter((entry) => entry.taxType === "PPH21")
            .reduce((sum, entry) => sum + entry.taxAmount, 0),
          pph23: organization.taxEntries
            .filter((entry) => entry.taxType === "PPH23")
            .reduce((sum, entry) => sum + entry.taxAmount, 0),
          ppn: organization.taxEntries
            .filter((entry) => entry.taxType === "PPN")
            .reduce((sum, entry) => sum + entry.taxAmount, 0),
        }

        bodyHtml = `
          <div class="summary-grid">
            ${summaryCard("PPh 21", formatRupiah(totals.pph21))}
            ${summaryCard("PPh 23", formatRupiah(totals.pph23))}
            ${summaryCard("PPN", formatRupiah(totals.ppn))}
            ${summaryCard("Periode", formatDateRange(startDate, endDate))}
          </div>
          ${renderSection(
            "Catatan Pajak",
            `
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Jenis Pajak</th>
                    <th>Deskripsi</th>
                    <th class="text-right">Dasar Pajak</th>
                    <th class="text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    organization.taxEntries.length
                      ? organization.taxEntries
                          .map(
                            (entry) => `
                              <tr>
                                <td>${renderText(formatDate(entry.date))}</td>
                                <td>${renderText(entry.taxType)}</td>
                                <td>${renderText(entry.description)}</td>
                                <td class="text-right">${renderText(formatRupiah(entry.taxBase))}</td>
                                <td class="text-right">${renderText(formatRupiah(entry.taxAmount))}</td>
                              </tr>
                            `
                          )
                          .join("")
                      : renderEmpty("Belum ada catatan pajak pada periode ini.", 5)
                  }
                </tbody>
              </table>
            `
          )}
        `
        break
      }
      case "bank": {
        const report = await generateBankOutstandingReport(orgId, startDate, endDate)
        title = "Laporan Bank & Outstanding"

        bodyHtml = `
          <div class="summary-grid">
            ${summaryCard("Jumlah Rekening", String(report.banks.length))}
            ${summaryCard(
              "Saldo Statement",
              formatRupiah(report.banks.reduce((sum, bank) => sum + bank.statementBalance, 0))
            )}
            ${summaryCard(
              "Saldo Buku",
              formatRupiah(report.banks.reduce((sum, bank) => sum + bank.ledgerEndingBalance, 0))
            )}
            ${summaryCard(
              "Outstanding",
              formatRupiah(report.banks.reduce((sum, bank) => sum + bank.outstanding, 0))
            )}
          </div>
          ${report.banks
            .map((bank) =>
              renderSection(
                `${bank.bankName} - ${bank.accountNumber}`,
                `
                  <div class="summary-grid">
                    ${summaryCard("Saldo Awal", formatRupiah(bank.openingBalance))}
                    ${summaryCard("Mutasi Masuk", formatRupiah(bank.totalIn))}
                    ${summaryCard("Mutasi Keluar", formatRupiah(bank.totalOut))}
                    ${summaryCard("Outstanding", formatRupiah(bank.outstanding))}
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Tanggal</th>
                        <th>No. Nota</th>
                        <th>Keterangan</th>
                        <th>Arah</th>
                        <th class="text-right">Nominal</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${
                        bank.transactions.length
                          ? bank.transactions
                              .map(
                                (trx) => `
                                  <tr>
                                    <td>${renderText(formatDate(trx.date))}</td>
                                    <td>${renderText(trx.reference)}</td>
                                    <td>${renderText(trx.description)}</td>
                                    <td>${renderText(trx.direction === "IN" ? "Masuk" : "Keluar")}</td>
                                    <td class="text-right">${renderText(formatRupiah(trx.amount))}</td>
                                  </tr>
                                `
                              )
                              .join("")
                          : renderEmpty("Tidak ada transaksi bank pada periode ini.", 5)
                      }
                    </tbody>
                  </table>
                `
              )
            )
            .join("")}
        `
        break
      }
      case "aset-tak-berwujud": {
        title = "Laporan Aset Tak Berwujud"
        subtitle = `Per ${formatDate(endDate)}`

        try {
          const rows = await prisma.$queryRawUnsafe<
            Array<{
              id: string
              code: string
              name: string
              purchase_date: Date
              purchase_price: number
              status: string
              accumulated_amortization: number
              book_value: number
            }>
          >(
            `
              SELECT
                assets.id,
                assets.code,
                assets.name,
                assets.purchase_date,
                assets.purchase_price,
                assets.status,
                COALESCE(MAX(runs.accumulated_depreciation), 0) AS accumulated_amortization,
                assets.purchase_price - COALESCE(MAX(runs.accumulated_depreciation), 0) AS book_value
              FROM fixed_assets assets
              LEFT JOIN fixed_asset_depreciation_runs runs ON runs.fixed_asset_id = assets.id
              WHERE assets.organization_id = $1
                AND assets.category = 'Aset Tak Berwujud'
              GROUP BY assets.id
              ORDER BY assets.purchase_date DESC, assets.code ASC
            `,
            orgId,
          )

          const totals = rows.reduce(
            (acc, r) => {
              acc.purchasePrice += Number(r.purchase_price || 0)
              acc.accumulatedAmortization += Number(r.accumulated_amortization || 0)
              acc.bookValue += Number(r.book_value || 0)
              return acc
            },
            { purchasePrice: 0, accumulatedAmortization: 0, bookValue: 0 },
          )

          bodyHtml = `
            <div class="summary-grid">
              ${summaryCard("Total Harga Perolehan", formatRupiah(totals.purchasePrice))}
              ${summaryCard("Total Akum. Amortisasi", formatRupiah(totals.accumulatedAmortization))}
              ${summaryCard("Total Nilai Buku", formatRupiah(totals.bookValue))}
              ${summaryCard("Jumlah Aset", String(rows.length))}
            </div>
            ${renderSection(
              "Daftar Aset Tak Berwujud",
              `
                <table>
                  <thead>
                    <tr>
                      <th>Kode</th>
                      <th>Nama</th>
                      <th>Tanggal</th>
                      <th class="text-right">Harga</th>
                      <th class="text-right">Akum. Amortisasi</th>
                      <th class="text-right">Nilai Buku</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      rows.length
                        ? rows
                            .map(
                              (r) => `
                                <tr>
                                  <td>${renderText(r.code)}</td>
                                  <td>${renderText(r.name)}</td>
                                  <td>${renderText(formatDate(r.purchase_date))}</td>
                                  <td class="text-right">${renderText(formatRupiah(Number(r.purchase_price || 0)))}</td>
                                  <td class="text-right">${renderText(formatRupiah(Number(r.accumulated_amortization || 0)))}</td>
                                  <td class="text-right">${renderText(formatRupiah(Number(r.book_value || 0)))}</td>
                                  <td>${renderText(r.status || "")}</td>
                                </tr>
                              `
                            )
                            .join("")
                        : renderEmpty("Belum ada data Aset Tak Berwujud.", 7)
                    }
                  </tbody>
                </table>
              `
            )}
          `
        } catch {
          bodyHtml = renderSection(
            "Aset Tak Berwujud",
            `<div class="muted">${renderText(
              "Data aset tidak tersedia (pastikan schema fixed_assets sudah terbuat dan ada data)."
            )}</div>`,
          )
        }

        break
      }
      case "cash-flow": {
        title = "Cash Flow Statement"
        subtitle = formatDateRange(startDate, endDate)

        const cashAccountIds = Array.from(bankAccountIds)
        const openingRows = cashAccountIds.length
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
              orgId,
              startDate,
              cashAccountIds,
            )
          : []
        const openingBalance = roundMoney(openingRows.reduce((sum, r) => sum + Number(r.balance || 0), 0))

        type Activity = "OPERATING" | "INVESTING" | "FINANCING"
        type FlowLine = { label: string; amount: number }
        type Bucket = { in: number; out: number; net: number; linesIn: FlowLine[]; linesOut: FlowLine[] }

        const buckets: Record<Activity, Bucket> = {
          OPERATING: { in: 0, out: 0, net: 0, linesIn: [], linesOut: [] },
          INVESTING: { in: 0, out: 0, net: 0, linesIn: [], linesOut: [] },
          FINANCING: { in: 0, out: 0, net: 0, linesIn: [], linesOut: [] },
        }

        const addLine = (bucket: Bucket, dir: "in" | "out", label: string, amount: number) => {
          const list = dir === "in" ? bucket.linesIn : bucket.linesOut
          const existing = list.find((l) => l.label === label)
          if (existing) existing.amount += amount
          else list.push({ label, amount })
        }

        const classify = (account: { type?: string | null; code?: string | null }): Activity => {
          const type = String(account.type || "")
          const code = String(account.code || "")
          if (type === "Equity" || type === "Liability") return "FINANCING"
          if (type === "Asset" && (code.startsWith("17") || code.startsWith("12"))) return "INVESTING"
          return "OPERATING"
        }

        for (const tx of organization.transactions) {
          const cashLines = tx.lines.filter((l) => bankAccountIds.has(l.accountId))
          if (cashLines.length === 0) continue

          const cashDelta = roundMoney(cashLines.reduce((sum, l) => sum + (Number(l.debit || 0) - Number(l.credit || 0)), 0))
          if (Math.abs(cashDelta) < 0.000001) continue

          const otherLines = tx.lines
            .filter((l) => !bankAccountIds.has(l.accountId))
            .map((l) => ({
              account: l.account,
              abs: Math.abs(Number(l.debit || 0) - Number(l.credit || 0)),
            }))
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
          buckets[key].in = roundMoney(buckets[key].in)
          buckets[key].out = roundMoney(buckets[key].out)
          buckets[key].net = roundMoney(buckets[key].in - buckets[key].out)
          buckets[key].linesIn.sort((a, b) => b.amount - a.amount)
          buckets[key].linesOut.sort((a, b) => b.amount - a.amount)
        }

        const netCashFlow = roundMoney(buckets.OPERATING.net + buckets.INVESTING.net + buckets.FINANCING.net)
        const endingBalance = roundMoney(openingBalance + netCashFlow)

        const renderFlowLines = (label: string, lines: FlowLine[]) => {
          const rows = (lines || []).slice(0, 12).map((l) => [renderText(l.label), renderText(formatRupiah(l.amount))])
          return renderSection(
            label,
            renderSimpleTable(["Akun", "Nominal"], rows.length ? rows : [[renderText("Tidak ada data."), renderText("-")]])
          )
        }

        bodyHtml = `
          <div class="summary-grid">
            ${summaryCard("Saldo Awal Kas", formatRupiah(openingBalance))}
            ${summaryCard("Net Operasional", formatRupiah(buckets.OPERATING.net))}
            ${summaryCard("Net Investasi", formatRupiah(buckets.INVESTING.net))}
            ${summaryCard("Net Financing", formatRupiah(buckets.FINANCING.net))}
          </div>
          ${renderSection(
            "Ringkasan Arus Kas",
            renderSimpleTable(
              ["Aktivitas", "Masuk", "Keluar", "Net"],
              [
                [renderText("Operasional"), renderText(formatRupiah(buckets.OPERATING.in)), renderText(formatRupiah(buckets.OPERATING.out)), renderText(formatRupiah(buckets.OPERATING.net))],
                [renderText("Investasi"), renderText(formatRupiah(buckets.INVESTING.in)), renderText(formatRupiah(buckets.INVESTING.out)), renderText(formatRupiah(buckets.INVESTING.net))],
                [renderText("Financing"), renderText(formatRupiah(buckets.FINANCING.in)), renderText(formatRupiah(buckets.FINANCING.out)), renderText(formatRupiah(buckets.FINANCING.net))],
                [renderText("TOTAL"), renderText("-"), renderText("-"), renderText(formatRupiah(netCashFlow))],
              ]
            )
          )}
          ${renderSection(
            "Saldo Kas",
            renderSimpleTable(
              ["Keterangan", "Nominal"],
              [
                [renderText("Saldo Awal"), renderText(formatRupiah(openingBalance))],
                [renderText("Net Cash Flow"), renderText(formatRupiah(netCashFlow))],
                [renderText("Saldo Akhir"), renderText(formatRupiah(endingBalance))],
              ]
            )
          )}
          ${renderFlowLines("Top Pemasukan Operasional", buckets.OPERATING.linesIn)}
          ${renderFlowLines("Top Pengeluaran Operasional", buckets.OPERATING.linesOut)}
          ${renderFlowLines("Top Pemasukan Investasi", buckets.INVESTING.linesIn)}
          ${renderFlowLines("Top Pengeluaran Investasi", buckets.INVESTING.linesOut)}
          ${renderFlowLines("Top Pemasukan Financing", buckets.FINANCING.linesIn)}
          ${renderFlowLines("Top Pengeluaran Financing", buckets.FINANCING.linesOut)}
        `
        break
      }
      case "laba-ditahan": {
        title = "Retained Earnings (Laba Ditahan)"

        const [retainedAccounts, dividendAccounts, openingRows, periodRows, netIncome] = await Promise.all([
          prisma.chartOfAccount.findMany({
            where: { organizationId: orgId, type: "Equity", category: { is: { name: "Laba Ditahan" } } },
            select: { id: true, code: true, name: true, category: { select: { name: true } } },
            orderBy: [{ code: "asc" }],
            take: 10_000,
          }),
          prisma.chartOfAccount.findMany({
            where: { organizationId: orgId, type: "Equity", category: { is: { name: "Dividen" } } },
            select: { id: true, code: true, name: true, category: { select: { name: true } } },
            orderBy: [{ code: "asc" }],
            take: 10_000,
          }),
          prisma.$queryRawUnsafe<Array<{ accountId: string; opening: number }>>(
            `
              SELECT
                tl."accountId" as "accountId",
                COALESCE(SUM(tl."credit" - tl."debit"), 0)::double precision AS "opening"
              FROM "TransactionLine" tl
              JOIN "Transaction" t ON t."id" = tl."transactionId"
              JOIN "ChartOfAccount" a ON a."id" = tl."accountId"
              LEFT JOIN "AccountCategory" c ON c."id" = a."categoryId"
              WHERE t."organizationId" = $1
                AND a."type" = 'Equity'
                AND c."name" IN ('Laba Ditahan', 'Dividen')
                AND t."date" < $2
              GROUP BY tl."accountId"
            `,
            orgId,
            startDate,
          ),
          prisma.$queryRawUnsafe<Array<{ accountId: string; debit: number; credit: number }>>(
            `
              SELECT
                tl."accountId" as "accountId",
                COALESCE(SUM(tl."debit"), 0)::double precision AS "debit",
                COALESCE(SUM(tl."credit"), 0)::double precision AS "credit"
              FROM "TransactionLine" tl
              JOIN "Transaction" t ON t."id" = tl."transactionId"
              JOIN "ChartOfAccount" a ON a."id" = tl."accountId"
              LEFT JOIN "AccountCategory" c ON c."id" = a."categoryId"
              WHERE t."organizationId" = $1
                AND a."type" = 'Equity'
                AND c."name" IN ('Laba Ditahan', 'Dividen')
                AND t."date" >= $2 AND t."date" <= $3
              GROUP BY tl."accountId"
            `,
            orgId,
            startDate,
            endDate,
          ),
          getNetIncome(orgId, startDate, endDate),
        ])

        const openingById = new Map(openingRows.map((r) => [r.accountId, roundMoney(Number(r.opening || 0))]))
        const periodById = new Map(periodRows.map((r) => [r.accountId, { debit: roundMoney(Number(r.debit || 0)), credit: roundMoney(Number(r.credit || 0)) }]))

        const buildRows = (accounts: Array<{ id: string; code: string; name: string; category?: { name: string } | null }>) =>
          accounts.map((acc) => {
            const opening = openingById.get(acc.id) ?? 0
            const period = periodById.get(acc.id) ?? { debit: 0, credit: 0 }
            const netChange = roundMoney(period.credit - period.debit)
            const closing = roundMoney(opening + netChange)
            return {
              code: acc.code,
              name: acc.name,
              opening,
              debit: period.debit,
              credit: period.credit,
              netChange,
              closing,
            }
          })

        const retainedRows = buildRows(retainedAccounts)
        const dividendRows = buildRows(dividendAccounts)
        const totalRetainedClosing = roundMoney(retainedRows.reduce((sum, r) => sum + r.closing, 0))
        const totalDividendChange = roundMoney(dividendRows.reduce((sum, r) => sum + r.netChange, 0))

        const renderRows = (rows: typeof retainedRows) =>
          rows.map((r) => [
            renderText(r.code),
            renderText(r.name),
            renderText(formatRupiah(r.opening)),
            renderText(formatRupiah(r.debit)),
            renderText(formatRupiah(r.credit)),
            renderText(formatRupiah(r.netChange)),
            renderText(formatRupiah(r.closing)),
          ])

        bodyHtml = `
          <div class="summary-grid">
            ${summaryCard("Laba Bersih Periode", formatRupiah(netIncome))}
            ${summaryCard("Total Closing Laba Ditahan", formatRupiah(totalRetainedClosing))}
            ${summaryCard("Total Perubahan Dividen", formatRupiah(totalDividendChange))}
            ${summaryCard("Periode", formatDateRange(startDate, endDate))}
          </div>
          ${renderSection(
            "Akun Laba Ditahan",
            renderSimpleTable(
              ["Kode", "Akun", "Opening", "Debit", "Kredit", "Net", "Closing"],
              retainedRows.length ? renderRows(retainedRows) : [[renderText("-"), renderText("Tidak ada akun Laba Ditahan."), renderText("-"), renderText("-"), renderText("-"), renderText("-"), renderText("-")]]
            )
          )}
          ${renderSection(
            "Akun Dividen",
            renderSimpleTable(
              ["Kode", "Akun", "Opening", "Debit", "Kredit", "Net", "Closing"],
              dividendRows.length ? renderRows(dividendRows) : [[renderText("-"), renderText("Tidak ada akun Dividen."), renderText("-"), renderText("-"), renderText("-"), renderText("-"), renderText("-")]]
            )
          )}
          ${renderSection(
            "Catatan",
            `<div class="muted">${renderText("Jika belum ada jurnal penutupan, laba periode berjalan biasanya masih berada di akun pendapatan/biaya (bukan otomatis masuk ke Laba Ditahan).")}</div>`
          )}
        `
        break
      }
      case "cadangan-distribusi": {
        title = "Cadangan & Distribusi Laba"

        const excludedCategories = new Set(["Modal", "Laba Ditahan"])
        const accounts = await prisma.chartOfAccount.findMany({
          where: { organizationId: orgId, type: "Equity" },
          select: { id: true, code: true, name: true, category: { select: { name: true } } },
          orderBy: [{ code: "asc" }],
          take: 20_000,
        })

        const targetAccounts = accounts.filter((a) => !excludedCategories.has(a.category?.name || ""))
        const targetIds = targetAccounts.map((a) => a.id)

        const [openingRows, periodRows] = targetIds.length
          ? await Promise.all([
              prisma.$queryRawUnsafe<Array<{ accountId: string; opening: number }>>(
                `
                  SELECT
                    tl."accountId" as "accountId",
                    COALESCE(SUM(tl."credit" - tl."debit"), 0)::double precision AS "opening"
                  FROM "TransactionLine" tl
                  JOIN "Transaction" t ON t."id" = tl."transactionId"
                  WHERE t."organizationId" = $1
                    AND t."date" < $2
                    AND tl."accountId" = ANY($3::text[])
                  GROUP BY tl."accountId"
                `,
                orgId,
                startDate,
                targetIds,
              ),
              prisma.$queryRawUnsafe<Array<{ accountId: string; debit: number; credit: number }>>(
                `
                  SELECT
                    tl."accountId" as "accountId",
                    COALESCE(SUM(tl."debit"), 0)::double precision AS "debit",
                    COALESCE(SUM(tl."credit"), 0)::double precision AS "credit"
                  FROM "TransactionLine" tl
                  JOIN "Transaction" t ON t."id" = tl."transactionId"
                  WHERE t."organizationId" = $1
                    AND t."date" >= $2 AND t."date" <= $3
                    AND tl."accountId" = ANY($4::text[])
                  GROUP BY tl."accountId"
                `,
                orgId,
                startDate,
                endDate,
                targetIds,
              ),
            ])
          : [[], []]

        const openingById = new Map(openingRows.map((r) => [r.accountId, roundMoney(Number(r.opening || 0))]))
        const periodById = new Map(periodRows.map((r) => [r.accountId, { debit: roundMoney(Number(r.debit || 0)), credit: roundMoney(Number(r.credit || 0)) }]))

        const rows = targetAccounts.map((acc) => {
          const opening = openingById.get(acc.id) ?? 0
          const period = periodById.get(acc.id) ?? { debit: 0, credit: 0 }
          const netChange = roundMoney(period.credit - period.debit)
          const closing = roundMoney(opening + netChange)
          return {
            code: acc.code,
            name: acc.name,
            category: acc.category?.name ?? "-",
            opening,
            debit: period.debit,
            credit: period.credit,
            netChange,
            closing,
          }
        })

        const totals = {
          opening: roundMoney(rows.reduce((s, r) => s + r.opening, 0)),
          netChange: roundMoney(rows.reduce((s, r) => s + r.netChange, 0)),
          closing: roundMoney(rows.reduce((s, r) => s + r.closing, 0)),
        }

        bodyHtml = renderSection(
          "Cadangan & Distribusi",
          `
            <div class="summary-grid">
              ${summaryCard("Opening", formatRupiah(totals.opening))}
              ${summaryCard("Net Change", formatRupiah(totals.netChange))}
              ${summaryCard("Closing", formatRupiah(totals.closing))}
              ${summaryCard("Jumlah Akun", String(rows.length))}
            </div>
            <table>
              <thead>
                <tr>
                  <th>Kode</th>
                  <th>Akun</th>
                  <th>Kategori</th>
                  <th class="text-right">Opening</th>
                  <th class="text-right">Debit</th>
                  <th class="text-right">Kredit</th>
                  <th class="text-right">Net</th>
                  <th class="text-right">Closing</th>
                </tr>
              </thead>
              <tbody>
                ${
                  rows.length
                    ? rows
                        .map(
                          (r) => `
                            <tr>
                              <td>${renderText(r.code)}</td>
                              <td>${renderText(r.name)}</td>
                              <td>${renderText(r.category)}</td>
                              <td class="text-right">${renderText(formatRupiah(r.opening))}</td>
                              <td class="text-right">${renderText(formatRupiah(r.debit))}</td>
                              <td class="text-right">${renderText(formatRupiah(r.credit))}</td>
                              <td class="text-right">${renderText(formatRupiah(r.netChange))}</td>
                              <td class="text-right">${renderText(formatRupiah(r.closing))}</td>
                            </tr>
                          `
                        )
                        .join("")
                    : renderEmpty("Tidak ada akun cadangan/distribusi selain Modal dan Laba Ditahan.", 8)
                }
              </tbody>
            </table>
          `
        )
        break
      }
      case "perubahan-modal": {
        title = "Laporan Perubahan Modal"

        const [accounts, openingRows, periodRows, netIncome] = await Promise.all([
          prisma.chartOfAccount.findMany({
            where: { organizationId: orgId, type: "Equity" },
            select: { id: true, code: true, name: true, category: { select: { name: true } } },
            orderBy: [{ code: "asc" }],
            take: 20_000,
          }),
          prisma.$queryRawUnsafe<Array<{ accountId: string; opening: number }>>(
            `
              SELECT
                tl."accountId" as "accountId",
                COALESCE(SUM(tl."credit" - tl."debit"), 0)::double precision AS "opening"
              FROM "TransactionLine" tl
              JOIN "Transaction" t ON t."id" = tl."transactionId"
              JOIN "ChartOfAccount" a ON a."id" = tl."accountId"
              WHERE t."organizationId" = $1
                AND a."type" = 'Equity'
                AND t."date" < $2
              GROUP BY tl."accountId"
            `,
            orgId,
            startDate,
          ),
          prisma.$queryRawUnsafe<Array<{ accountId: string; debit: number; credit: number }>>(
            `
              SELECT
                tl."accountId" as "accountId",
                COALESCE(SUM(tl."debit"), 0)::double precision AS "debit",
                COALESCE(SUM(tl."credit"), 0)::double precision AS "credit"
              FROM "TransactionLine" tl
              JOIN "Transaction" t ON t."id" = tl."transactionId"
              JOIN "ChartOfAccount" a ON a."id" = tl."accountId"
              WHERE t."organizationId" = $1
                AND a."type" = 'Equity'
                AND t."date" >= $2 AND t."date" <= $3
              GROUP BY tl."accountId"
            `,
            orgId,
            startDate,
            endDate,
          ),
          getNetIncome(orgId, startDate, endDate),
        ])

        const openingById = new Map(openingRows.map((r) => [r.accountId, roundMoney(Number(r.opening || 0))]))
        const periodById = new Map(periodRows.map((r) => [r.accountId, { debit: roundMoney(Number(r.debit || 0)), credit: roundMoney(Number(r.credit || 0)) }]))

        const rows = accounts.map((acc) => {
          const opening = openingById.get(acc.id) ?? 0
          const period = periodById.get(acc.id) ?? { debit: 0, credit: 0 }
          const netChange = roundMoney(period.credit - period.debit)
          const closing = roundMoney(opening + netChange)
          return {
            code: acc.code,
            name: acc.name,
            category: acc.category?.name ?? "-",
            opening,
            debit: period.debit,
            credit: period.credit,
            netChange,
            closing,
          }
        })

        const totals = rows.reduce(
          (acc, r) => {
            acc.opening += r.opening
            acc.debit += r.debit
            acc.credit += r.credit
            acc.netChange += r.netChange
            acc.closing += r.closing
            return acc
          },
          { opening: 0, debit: 0, credit: 0, netChange: 0, closing: 0 },
        )

        bodyHtml = `
          <div class="summary-grid">
            ${summaryCard("Net Income", formatRupiah(netIncome))}
            ${summaryCard("Opening", formatRupiah(roundMoney(totals.opening)))}
            ${summaryCard("Net Change", formatRupiah(roundMoney(totals.netChange)))}
            ${summaryCard("Closing", formatRupiah(roundMoney(totals.closing)))}
          </div>
          ${renderSection(
            "Statement of Changes in Equity",
            `
              <table>
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Akun</th>
                    <th>Kategori</th>
                    <th class="text-right">Opening</th>
                    <th class="text-right">Debit</th>
                    <th class="text-right">Kredit</th>
                    <th class="text-right">Net</th>
                    <th class="text-right">Closing</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    rows.length
                      ? rows
                          .map(
                            (r) => `
                              <tr>
                                <td>${renderText(r.code)}</td>
                                <td>${renderText(r.name)}</td>
                                <td>${renderText(r.category)}</td>
                                <td class="text-right">${renderText(formatRupiah(r.opening))}</td>
                                <td class="text-right">${renderText(formatRupiah(r.debit))}</td>
                                <td class="text-right">${renderText(formatRupiah(r.credit))}</td>
                                <td class="text-right">${renderText(formatRupiah(r.netChange))}</td>
                                <td class="text-right">${renderText(formatRupiah(r.closing))}</td>
                              </tr>
                            `
                          )
                          .join("")
                      : renderEmpty("Tidak ada akun ekuitas.", 8)
                  }
                  <tr class="total-row">
                    <td colspan="3">TOTAL</td>
                    <td class="text-right">${renderText(formatRupiah(roundMoney(totals.opening)))}</td>
                    <td class="text-right">${renderText(formatRupiah(roundMoney(totals.debit)))}</td>
                    <td class="text-right">${renderText(formatRupiah(roundMoney(totals.credit)))}</td>
                    <td class="text-right">${renderText(formatRupiah(roundMoney(totals.netChange)))}</td>
                    <td class="text-right">${renderText(formatRupiah(roundMoney(totals.closing)))}</td>
                  </tr>
                </tbody>
              </table>
            `
          )}
        `
        break
      }
      case "kombinasi-bisnis":
      case "konsolidasi":
      case "segment-reporting":
      case "presentasi-keuangan": {
        const labelMap: Record<string, string> = {
          "kombinasi-bisnis": "Kombinasi Bisnis (IFRS 3)",
          konsolidasi: "Laporan Keuangan Konsolidasi (IFRS 10)",
          "segment-reporting": "Segment Reporting (PSAK 7)",
          "presentasi-keuangan": "Presentasi Laporan Keuangan (PSAK 1)",
        }
        title = labelMap[reportType] || "Laporan"
        bodyHtml = renderSection(
          title,
          `<div class="muted">${renderText("Tidak ada data untuk periode ini.")}</div>`
        )
        break
      }
      case "attendance": {
        title = "Laporan Absensi (Time & Attendance)"

        const employeeId = url.searchParams.get("employeeId") || ""
        const records = await prisma.attendanceRecord.findMany({
          where: {
            organizationId: orgId,
            ...(employeeId ? { employeeId } : {}),
            date: { gte: startDate, lte: endDate },
          },
          include: {
            employee: { select: { name: true, position: true } },
          },
          orderBy: [{ date: "asc" }, { createdAt: "asc" }],
          take: 2000,
        })

        const totalOvertimeMinutes = records.reduce((sum, r) => sum + Number(r.overtimeMinutes || 0), 0)

        bodyHtml = `
          <div class="summary-grid">
            ${summaryCard("Periode", formatDateRange(startDate, endDate))}
            ${summaryCard("Total Record", String(records.length))}
            ${summaryCard("Total Lembur (menit)", String(totalOvertimeMinutes))}
          </div>
          ${renderSection(
            "Detail Absensi",
            records.length
              ? renderSimpleTable(
                  ["Tanggal", "Karyawan", "Masuk", "Keluar", "Lembur", "Catatan"],
                  records.map((record) => [
                    renderText(formatDate(new Date(record.date))),
                    renderText(record.employee?.name || "-"),
                    renderText(
                      record.checkInAt
                        ? new Date(record.checkInAt).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"
                    ),
                    renderText(
                      record.checkOutAt
                        ? new Date(record.checkOutAt).toLocaleTimeString("id-ID", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })
                        : "-"
                    ),
                    `<span class="text-right">${renderText(String(record.overtimeMinutes || 0))}</span>`,
                    renderText(record.notes || "-"),
                  ])
                )
              : `<div class="muted">${renderText("Tidak ada data absensi untuk periode ini.")}</div>`
          )}
        `
        break
      }
      case "maintenance": {
        title = "Laporan Facility Maintenance (GA)"

        const statusFilter = url.searchParams.get("status") || ""
        const items = await prisma.facilityMaintenance.findMany({
          where: {
            organizationId: orgId,
            ...(statusFilter ? { status: statusFilter } : {}),
            scheduledAt: { gte: startDate, lte: endDate },
          },
          orderBy: [{ scheduledAt: "asc" }, { createdAt: "asc" }],
          take: 2000,
        })

        const totalEstimated = items.reduce((sum, item) => sum + Number(item.estimatedCost || 0), 0)
        const totalActual = items.reduce((sum, item) => sum + Number(item.actualCost || 0), 0)

        bodyHtml = `
          <div class="summary-grid">
            ${summaryCard("Periode", formatDateRange(startDate, endDate))}
            ${summaryCard("Total Jadwal", String(items.length))}
            ${summaryCard("Total Estimasi", formatRupiah(totalEstimated))}
            ${summaryCard("Total Aktual", formatRupiah(totalActual))}
          </div>
          ${renderSection(
            "Detail Maintenance",
            items.length
              ? renderSimpleTable(
                  ["Tanggal", "Aset", "Kategori", "Status", "Estimasi", "Aktual", "Catatan"],
                  items.map((item) => [
                    renderText(formatDate(new Date(item.scheduledAt))),
                    renderText(item.assetName),
                    renderText(item.assetCategory || "-"),
                    renderText(item.status),
                    `<span class="text-right">${renderText(formatRupiah(Number(item.estimatedCost || 0)))}</span>`,
                    `<span class="text-right">${renderText(formatRupiah(Number(item.actualCost || 0)))}</span>`,
                    renderText(item.notes || "-"),
                  ])
                )
              : `<div class="muted">${renderText("Tidak ada data maintenance untuk periode ini.")}</div>`
          )}
        `
        break
      }
      case "transactions":
      case "income":
      case "expense":
      case "profit-loss":
      case "buku-besar":
      case "general-ledger": {
        if (reportType === "transactions") {
          const report = generateTransactionReport(organization.transactions, startDate, endDate, bankAccountIds)
          title = report.title
          bodyHtml = `
            <div class="summary-grid">
              ${summaryCard("Total Masuk", formatRupiah(report.totals?.income || 0))}
              ${summaryCard("Total Keluar", formatRupiah(report.totals?.expense || 0))}
              ${summaryCard("Selisih", formatRupiah(report.totals?.net || 0))}
              ${summaryCard("Jumlah Transaksi", String(report.data.length))}
            </div>
            ${renderSection(
              "Daftar Transaksi",
              `
                <table>
                  <thead>
                    <tr>
                      <th>Tanggal</th>
                      <th>Referensi</th>
                      <th>Keterangan</th>
                      <th>Akun</th>
                      <th class="text-right">Nominal</th>
                    </tr>
                  </thead>
                  <tbody>
                    ${
                      report.data.length
                        ? report.data
                            .map(
                              (trx) => `
                                <tr>
                                  <td>${renderText(formatDate(trx.date))}</td>
                                  <td>${renderText(trx.reference)}</td>
                                  <td>${renderText(trx.description)}</td>
                                  <td>${renderText(trx.reportCategoryLine?.account?.name || trx.reportBankLine?.account?.name)}</td>
                                  <td class="text-right">${renderText(
                                    formatRupiah(Math.max(trx.reportBankLine?.debit || 0, trx.reportBankLine?.credit || 0))
                                  )}</td>
                                </tr>
                              `
                            )
                            .join("")
                        : renderEmpty("Tidak ada transaksi pada periode ini.", 5)
                    }
                  </tbody>
                </table>
              `
            )}
          `
        } else if (reportType === "income") {
          const report = generateIncomeReport(organization.transactions, startDate, endDate, bankAccountIds)
          title = report.title
          bodyHtml = renderSection(
            "Daftar Penerimaan",
            `
              <div class="summary-grid">
                ${summaryCard("Total Penerimaan", formatRupiah(report.totals?.totalIncome || 0))}
                ${summaryCard("Jumlah Transaksi", String(report.data.length))}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Referensi</th>
                    <th>Keterangan</th>
                    <th class="text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    report.data.length
                      ? report.data
                          .map(
                            (trx) => `
                              <tr>
                                <td>${renderText(formatDate(trx.date))}</td>
                                <td>${renderText(trx.reference)}</td>
                                <td>${renderText(trx.description)}</td>
                                <td class="text-right">${renderText(formatRupiah(trx.reportBankLine?.debit || 0))}</td>
                              </tr>
                            `
                          )
                          .join("")
                      : renderEmpty("Tidak ada penerimaan pada periode ini.", 4)
                  }
                </tbody>
              </table>
            `
          )
        } else if (reportType === "expense") {
          const report = generateExpenseReport(organization.transactions, startDate, endDate, bankAccountIds)
          title = report.title
          bodyHtml = renderSection(
            "Daftar Pengeluaran",
            `
              <div class="summary-grid">
                ${summaryCard("Total Pengeluaran", formatRupiah(report.totals?.totalExpense || 0))}
                ${summaryCard("Jumlah Transaksi", String(report.data.length))}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Tanggal</th>
                    <th>Referensi</th>
                    <th>Keterangan</th>
                    <th class="text-right">Nominal</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    report.data.length
                      ? report.data
                          .map(
                            (trx) => `
                              <tr>
                                <td>${renderText(formatDate(trx.date))}</td>
                                <td>${renderText(trx.reference)}</td>
                                <td>${renderText(trx.description)}</td>
                                <td class="text-right">${renderText(formatRupiah(trx.reportBankLine?.credit || 0))}</td>
                              </tr>
                            `
                          )
                          .join("")
                      : renderEmpty("Tidak ada pengeluaran pada periode ini.", 4)
                  }
                </tbody>
              </table>
            `
          )
        } else if (reportType === "profit-loss") {
          const report = generateProfitLossReport(
            organization.transactions,
            organization,
            startDate,
            endDate,
            bankAccountIds
          )
          title = report.title
          bodyHtml = renderSection(
            report.title,
            renderSimpleTable(
              ["Keterangan", "Nominal"],
              report.data.map((row) => [renderText(row.label), renderText(formatRupiah(row.amount))])
            )
          )
        } else {
          const report = generateGeneralLedger(organization.accounts, startDate, endDate)
          title = report.title
          bodyHtml = renderSection(
            "Buku Besar",
            `
              <div class="summary-grid">
                ${summaryCard("Total Debit", formatRupiah(report.totals?.totalDebit || 0))}
                ${summaryCard("Total Kredit", formatRupiah(report.totals?.totalCredit || 0))}
              </div>
              <table>
                <thead>
                  <tr>
                    <th>Kode</th>
                    <th>Akun</th>
                    <th>Tipe</th>
                    <th class="text-right">Debit</th>
                    <th class="text-right">Kredit</th>
                    <th class="text-right">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  ${
                    report.data.length
                      ? report.data
                          .map(
                            (row) => `
                              <tr>
                                <td>${renderText(row.code)}</td>
                                <td>${renderText(row.name)}</td>
                                <td>${renderText(row.type)}</td>
                                <td class="text-right">${renderText(formatRupiah(row.debit))}</td>
                                <td class="text-right">${renderText(formatRupiah(row.credit))}</td>
                                <td class="text-right">${renderText(formatRupiah(row.balance))}</td>
                              </tr>
                            `
                          )
                          .join("")
                      : renderEmpty("Tidak ada data buku besar pada periode ini.", 6)
                  }
                </tbody>
              </table>
            `
          )
        }
        break
      }
      default:
        return NextResponse.json({ error: "Jenis laporan tidak didukung" }, { status: 404 })
    }

    const html = renderPrintableReportHtml({
      title,
      orgName,
      addressLines,
      subtitle,
      bodyHtml,
    })

    return new NextResponse(html, {
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Content-Disposition": `inline; filename="${reportType}-${orgId}.pdf"`,
      },
    })
  } catch (error) {
    console.error(error)
    return NextResponse.json({ error: "Gagal membuat report PDF" }, { status: 500 })
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orgId: string; reportType: string }> }
) {
  const { orgId, reportType } = await params
  return handleReportPdfRequest(req, orgId, reportType)
}
