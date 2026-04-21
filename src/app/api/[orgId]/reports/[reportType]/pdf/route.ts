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

    const organization = await prisma.organization.findUnique({
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
    })

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
      case "transactions":
      case "income":
      case "expense":
      case "profit-loss":
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
