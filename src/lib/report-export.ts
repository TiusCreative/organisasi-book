function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;")
}

export function formatRupiah(amount: number) {
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount)
}

export function formatDate(value: Date | string) {
  return new Date(value).toLocaleDateString("id-ID")
}

export function formatDateTime(value: Date | string) {
  return new Date(value).toLocaleDateString("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function renderText(value?: string | null) {
  return escapeHtml(value || "-")
}

export function renderPrintableReportHtml(input: {
  title: string
  orgName: string
  addressLines: string[]
  subtitle?: string
  bodyHtml: string
}) {
  return `
    <!DOCTYPE html>
    <html lang="id">
    <head>
      <meta charset="UTF-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <title>${escapeHtml(input.title)} - ${escapeHtml(input.orgName)}</title>
      <style>
        * { box-sizing: border-box; }
        body {
          margin: 0;
          font-family: Arial, sans-serif;
          color: #0f172a;
          background: #fff;
          font-size: 12px;
          line-height: 1.5;
        }
        .page {
          padding: 18mm 14mm 22mm;
        }
        .header {
          text-align: center;
          border-bottom: 2px solid #0f172a;
          padding-bottom: 14px;
          margin-bottom: 18px;
        }
        .org-name {
          font-size: 22px;
          font-weight: 700;
          margin-bottom: 4px;
        }
        .org-line {
          color: #475569;
          margin-bottom: 2px;
        }
        .title {
          margin-top: 10px;
          font-size: 16px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .subtitle {
          margin-top: 4px;
          color: #475569;
        }
        .section {
          margin-bottom: 18px;
        }
        .section-title {
          font-size: 13px;
          font-weight: 700;
          padding-bottom: 6px;
          border-bottom: 1px solid #cbd5e1;
          margin-bottom: 10px;
        }
        .summary-grid {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 10px;
          margin-bottom: 16px;
        }
        .summary-card {
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 10px 12px;
          background: #f8fafc;
        }
        .summary-label {
          font-size: 11px;
          color: #475569;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .summary-value {
          margin-top: 4px;
          font-size: 15px;
          font-weight: 700;
        }
        table {
          width: 100%;
          border-collapse: collapse;
        }
        th, td {
          border: 1px solid #cbd5e1;
          padding: 8px 10px;
          vertical-align: top;
        }
        th {
          background: #e2e8f0;
          text-align: left;
          font-size: 11px;
          text-transform: uppercase;
          letter-spacing: 0.04em;
        }
        .text-right {
          text-align: right;
        }
        .text-center {
          text-align: center;
        }
        .muted {
          color: #64748b;
        }
        .total-row td {
          font-weight: 700;
          background: #f8fafc;
        }
        .footer {
          position: fixed;
          left: 14mm;
          right: 14mm;
          bottom: 8mm;
          display: flex;
          justify-content: space-between;
          color: #64748b;
          font-size: 10px;
        }
        .page-number::before {
          content: counter(page);
        }
        .page-count::before {
          content: counter(pages);
        }
        @page {
          size: A4;
          margin: 0;
        }
        @media print {
          .page {
            padding-bottom: 24mm;
          }
        }
      </style>
    </head>
    <body>
      <div class="page">
        <div class="header">
          <div class="org-name">${escapeHtml(input.orgName)}</div>
          ${input.addressLines.map((line) => `<div class="org-line">${escapeHtml(line)}</div>`).join("")}
          <div class="title">${escapeHtml(input.title)}</div>
          ${input.subtitle ? `<div class="subtitle">${escapeHtml(input.subtitle)}</div>` : ""}
        </div>
        ${input.bodyHtml}
      </div>
      <div class="footer">
        <span>Dicetak pada ${escapeHtml(formatDateTime(new Date()))}</span>
        <span>Halaman <span class="page-number"></span> / <span class="page-count"></span></span>
      </div>
      <script>
        window.onload = () => {
          window.print();
        }
      </script>
    </body>
    </html>
  `
}
