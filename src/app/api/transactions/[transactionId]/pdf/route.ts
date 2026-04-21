import { NextRequest, NextResponse } from "next/server"
import { prisma } from "../../../../../lib/prisma"
import { terbilang } from "../../../../../lib/terbilang"
import { formatCurrency, formatDate } from "../../../../../lib/transaction-utils"
import { getOrganizationBranding } from "../../../../../lib/branding"

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ transactionId: string }> }
) {
  try {
    const { transactionId } = await params
    const transaction = await prisma.transaction.findUnique({
      where: { id: transactionId },
      include: {
        lines: { include: { account: true } },
        organization: true
      }
    })

    if (!transaction) {
      return NextResponse.json({ error: "Transaksi tidak ditemukan" }, { status: 404 })
    }

    const branding = await getOrganizationBranding(transaction.organizationId)
    const totalDebit = transaction.lines.reduce((sum, line) => sum + line.debit, 0)
    const totalCredit = transaction.lines.reduce((sum, line) => sum + line.credit, 0)
    const totalAmount = Math.max(totalDebit, totalCredit)
    const amountInWords = terbilang(totalAmount)

    const html = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Nota Transaksi - ${transaction.reference}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Arial', sans-serif;
            background: white;
            padding: 40px;
          }
          .container {
            max-width: 600px;
            margin: 0 auto;
            background: white;
          }
          .header {
            text-align: center;
            margin-bottom: 30px;
            border-bottom: 2px solid #1e293b;
            padding-bottom: 20px;
          }
          .org-name {
            font-size: 24px;
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 5px;
          }
          .org-address {
            font-size: 12px;
            color: #64748b;
            margin-bottom: 2px;
          }
          .document-title {
            font-size: 14px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin-top: 10px;
          }
          .content {
            margin-bottom: 30px;
          }
          .row {
            display: flex;
            justify-content: space-between;
            margin-bottom: 15px;
            font-size: 14px;
          }
          .label {
            color: #64748b;
            font-weight: 600;
          }
          .value {
            color: #1e293b;
            font-weight: bold;
            text-align: right;
            word-break: break-word;
          }
          .reference {
            background: #f1f5f9;
            padding: 8px 12px;
            border-radius: 4px;
            font-family: 'Courier New', monospace;
            color: #0ea5e9;
          }
          .divider {
            border-top: 1px solid #e2e8f0;
            margin: 20px 0;
          }
          .items-section {
            margin-bottom: 20px;
          }
          .items-header {
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 10px;
            border-bottom: 1px solid #cbd5e1;
            padding-bottom: 8px;
          }
          .item {
            margin-bottom: 12px;
            padding: 10px;
            background: #f8fafc;
            border-radius: 4px;
            font-size: 13px;
          }
          .item-name {
            font-weight: 600;
            color: #1e293b;
            margin-bottom: 4px;
          }
          .item-code {
            color: #64748b;
            font-size: 12px;
            margin-bottom: 4px;
          }
          .item-amount {
            display: flex;
            justify-content: space-between;
            margin-top: 6px;
            font-weight: bold;
          }
          .debit {
            color: #10b981;
          }
          .credit {
            color: #ef4444;
          }
          .total-section {
            background: #f1f5f9;
            padding: 20px;
            border-radius: 8px;
            margin-top: 20px;
          }
          .terbilang-section {
            margin-top: 20px;
            padding: 16px 20px;
            border: 1px solid #cbd5e1;
            border-radius: 8px;
            background: #ffffff;
          }
          .terbilang-label {
            font-size: 11px;
            color: #64748b;
            text-transform: uppercase;
            letter-spacing: 1px;
            font-weight: 700;
            margin-bottom: 8px;
          }
          .terbilang-text {
            font-size: 16px;
            color: #0f172a;
            font-weight: 700;
            line-height: 1.6;
          }
          .total-row {
            display: flex;
            justify-content: space-between;
            font-size: 18px;
            font-weight: bold;
            color: #1e293b;
            margin-bottom: 10px;
          }
          .footer {
            text-align: center;
            margin-top: 30px;
            padding-top: 20px;
            border-top: 1px solid #e2e8f0;
            font-size: 12px;
            color: #64748b;
          }
          @page {
            size: A4;
            margin: 20mm;
          }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <div class="org-name">${branding?.name || transaction.organization.name}</div>
            ${branding?.addressLines.map(line => `<div class="org-address">${line}</div>`).join('') || ''}
            <div class="document-title">Nota Transaksi</div>
          </div>

          <div class="content">
            <div class="row">
              <span class="label">Nomor Referensi:</span>
              <span class="value"><span class="reference">${transaction.reference || 'N/A'}</span></span>
            </div>
            <div class="row">
              <span class="label">Tanggal:</span>
              <span class="value">${formatDate(transaction.date)}</span>
            </div>
            <div class="row">
              <span class="label">Keterangan:</span>
              <span class="value">${transaction.description}</span>
            </div>
          </div>

          <div class="divider"></div>

          <div class="items-section">
            <div class="items-header">Detail Transaksi</div>
            ${transaction.lines.map((line) => `
              <div class="item">
                <div class="item-name">${line.account.name}</div>
                <div class="item-code">Kode: ${line.account.code}</div>
                <div class="item-amount">
                  ${line.debit > 0 ? `<span class="debit">Debit: ${formatCurrency(line.debit)}</span>` : '<span></span>'}
                  ${line.credit > 0 ? `<span class="credit">Kredit: ${formatCurrency(line.credit)}</span>` : '<span></span>'}
                </div>
              </div>
            `).join('')}
          </div>

          <div class="total-section">
            <div class="total-row">
              <span>Total Debit:</span>
              <span class="debit">${formatCurrency(totalDebit)}</span>
            </div>
            <div class="total-row">
              <span>Total Kredit:</span>
              <span class="credit">${formatCurrency(totalCredit)}</span>
            </div>
          </div>

          <div class="terbilang-section">
            <div class="terbilang-label">Terbilang</div>
            <div class="terbilang-text">${amountInWords}</div>
          </div>

          <div class="footer">
            <p>Dicetak pada ${new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
          </div>
        </div>

        <script>
          window.onload = () => {
            window.print();
          }
        </script>
      </body>
      </html>
    `

    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Content-Disposition': `attachment; filename="Transaksi-${transaction.reference}.pdf"`
      }
    })
  } catch (error) {
    console.error('Error:', error)
    return NextResponse.json({ error: "Gagal membuat PDF" }, { status: 500 })
  }
}
