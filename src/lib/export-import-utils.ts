// Export and Import utilities for database management

export interface DatabaseExport {
  version: string
  exportDate: string
  organization: any
  accounts: any[]
  categories: any[]
  banks: any[]
  transactions: any[]
  transactionLines: any[]
  investments?: any[]
  fixedAssets?: any[]
  depreciationRuns?: any[]
}

const XML_WORKBOOK_HEADER = `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">`

const XML_WORKBOOK_FOOTER = "</Workbook>"

function sanitizeFileNamePart(value: string) {
  return value.replace(/[^\w.-]+/g, "-").replace(/-+/g, "-").replace(/^-|-$/g, "")
}

function escapeCsvValue(value: unknown) {
  if (value === null || value === undefined) {
    return ""
  }

  const stringValue = typeof value === "string" ? value : String(value)
  return `"${stringValue.replace(/"/g, '""')}"`
}

function escapeXml(value: unknown) {
  if (value === null || value === undefined) {
    return ""
  }

  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;")
}

function decodeXml(value: string) {
  return value
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
}

function formatCellValue(value: unknown) {
  if (value instanceof Date) {
    return value.toISOString()
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return value
  }

  if (value === null || value === undefined) {
    return ""
  }

  return String(value)
}

function buildWorksheet(name: string, rows: Array<Record<string, unknown>>) {
  const headers = rows.length > 0 ? Object.keys(rows[0]) : ["value"]
  const tableRows = [
    headers,
    ...rows.map((row) => headers.map((header) => formatCellValue(row[header])))
  ]

  const xmlRows = tableRows
    .map((cells) => {
      const xmlCells = cells
        .map((cell) => {
          const dataType = typeof cell === "number" ? "Number" : "String"
          return `<Cell><Data ss:Type="${dataType}">${escapeXml(cell)}</Data></Cell>`
        })
        .join("")

      return `<Row>${xmlCells}</Row>`
    })
    .join("")

  return `<Worksheet ss:Name="${escapeXml(name)}"><Table>${xmlRows}</Table></Worksheet>`
}

export function createExcelWorkbookContent(data: DatabaseExport) {
  const organizationRows = Object.entries(data.organization || {}).map(([field, value]) => ({
    field,
    value: formatCellValue(value),
  }))

  const worksheets = [
    buildWorksheet("Organization", organizationRows),
    buildWorksheet("Categories", (data.categories || []).map((category) => ({
      id: category.id,
      name: category.name,
      color: category.color,
    }))),
    buildWorksheet("Accounts", (data.accounts || []).map((account) => ({
      id: account.id,
      code: account.code,
      name: account.name,
      type: account.type,
      categoryId: account.categoryId || "",
      isHeader: account.isHeader ? "true" : "false",
    }))),
    buildWorksheet("Banks", (data.banks || []).map((bank) => ({
      id: bank.id,
      accountId: bank.accountId,
      bankName: bank.bankName,
      accountNumber: bank.accountNumber,
      accountName: bank.accountName,
      balance: bank.balance ?? 0,
      notes: bank.notes || "",
      lastReconciled: bank.lastReconciled || "",
    }))),
    buildWorksheet("Transactions", (data.transactions || []).map((transaction) => ({
      id: transaction.id,
      date: transaction.date,
      description: transaction.description,
      reference: transaction.reference || "",
    }))),
    buildWorksheet("TransactionLines", (data.transactionLines || []).map((line) => ({
      id: line.id,
      transactionId: line.transactionId,
      accountId: line.accountId,
      debit: line.debit ?? 0,
      credit: line.credit ?? 0,
      description: line.description || "",
    }))),
    buildWorksheet("Investments", (data.investments || []).map((investment) => ({
      id: investment.id,
      accountId: investment.accountId,
      sourceBankAccountId: investment.sourceBankAccountId || "",
      settlementBankAccountId: investment.settlementBankAccountId || "",
      inkasoTransactionId: investment.inkasoTransactionId || "",
      type: investment.type,
      name: investment.name,
      institution: investment.institution,
      referenceNumber: investment.referenceNumber || "",
      startDate: investment.startDate,
      maturityDate: investment.maturityDate || "",
      purchaseAmount: investment.purchaseAmount,
      currentValue: investment.currentValue,
      expectedReturn: investment.expectedReturn || 0,
      status: investment.status,
      notes: investment.notes || "",
    }))),
    buildWorksheet("FixedAssets", (data.fixedAssets || []).map((asset) => ({
      id: asset.id,
      organization_id: asset.organization_id,
      asset_account_id: asset.asset_account_id || "",
      depreciation_expense_account_id: asset.depreciation_expense_account_id,
      accumulated_depreciation_account_id: asset.accumulated_depreciation_account_id,
      name: asset.name,
      code: asset.code,
      category: asset.category || "",
      purchase_date: asset.purchase_date,
      purchase_price: asset.purchase_price,
      residual_value: asset.residual_value,
      useful_life_months: asset.useful_life_months,
      depreciation_method: asset.depreciation_method,
      status: asset.status,
    }))),
    buildWorksheet("DepreciationRuns", (data.depreciationRuns || []).map((run) => ({
      id: run.id,
      fixed_asset_id: run.fixed_asset_id,
      transaction_id: run.transaction_id,
      month: run.month,
      year: run.year,
      depreciation_amount: run.depreciation_amount,
      accumulated_depreciation: run.accumulated_depreciation,
      book_value_ending: run.book_value_ending,
      created_at: run.created_at,
    }))),
  ]

  return `${XML_WORKBOOK_HEADER}${worksheets.join("")}${XML_WORKBOOK_FOOTER}`
}

function extractWorksheetRows(xml: string, sheetName: string) {
  const worksheetRegex = new RegExp(
    `<Worksheet[^>]*ss:Name="${sheetName}"[^>]*>[\\s\\S]*?<Table>([\\s\\S]*?)</Table>[\\s\\S]*?</Worksheet>`,
    "i"
  )
  const worksheetMatch = xml.match(worksheetRegex)

  if (!worksheetMatch) {
    return []
  }

  const rowMatches = [...worksheetMatch[1].matchAll(/<Row>([\s\S]*?)<\/Row>/gi)]

  return rowMatches.map((rowMatch) => {
    const cellMatches = [...rowMatch[1].matchAll(/<Data[^>]*>([\s\S]*?)<\/Data>/gi)]
    return cellMatches.map((cellMatch) => decodeXml(cellMatch[1]))
  })
}

function rowsToObjects(rows: string[][]) {
  if (rows.length < 2) {
    return []
  }

  const [headers, ...dataRows] = rows
  return dataRows
    .filter((row) => row.some((value) => value !== ""))
    .map((row) =>
      headers.reduce<Record<string, string>>((accumulator, header, index) => {
        accumulator[header] = row[index] || ""
        return accumulator
      }, {})
    )
}

function toNumber(value: string) {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

function toNullableString(value: string) {
  return value ? value : null
}

function toNullableDateString(value: string) {
  return value ? new Date(value).toISOString() : null
}

export function parseExcelWorkbookText(text: string): DatabaseExport | null {
  try {
    const organizationRowObjects = rowsToObjects(extractWorksheetRows(text, "Organization"))
    const organization = organizationRowObjects.reduce<Record<string, string>>((accumulator, row) => {
      accumulator[row.field] = row.value
      return accumulator
    }, {})

    const categories = rowsToObjects(extractWorksheetRows(text, "Categories")).map((row) => ({
      id: row.id,
      name: row.name,
      color: row.color,
    }))

    const accounts = rowsToObjects(extractWorksheetRows(text, "Accounts")).map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      type: row.type,
      categoryId: toNullableString(row.categoryId),
      isHeader: row.isHeader === "true",
    }))

    const banks = rowsToObjects(extractWorksheetRows(text, "Banks")).map((row) => ({
      id: row.id,
      accountId: row.accountId,
      bankName: row.bankName,
      accountNumber: row.accountNumber,
      accountName: row.accountName,
      balance: toNumber(row.balance),
      notes: toNullableString(row.notes),
      lastReconciled: toNullableDateString(row.lastReconciled),
    }))

    const transactions = rowsToObjects(extractWorksheetRows(text, "Transactions")).map((row) => ({
      id: row.id,
      date: row.date,
      description: row.description,
      reference: toNullableString(row.reference),
    }))

    const transactionLines = rowsToObjects(extractWorksheetRows(text, "TransactionLines")).map((row) => ({
      id: row.id,
      transactionId: row.transactionId,
      accountId: row.accountId,
      debit: toNumber(row.debit),
      credit: toNumber(row.credit),
      description: toNullableString(row.description),
    }))

    const investments = rowsToObjects(extractWorksheetRows(text, "Investments")).map((row) => ({
      id: row.id,
      accountId: row.accountId,
      sourceBankAccountId: toNullableString(row.sourceBankAccountId),
      settlementBankAccountId: toNullableString(row.settlementBankAccountId),
      inkasoTransactionId: toNullableString(row.inkasoTransactionId),
      type: row.type,
      name: row.name,
      institution: row.institution,
      referenceNumber: toNullableString(row.referenceNumber),
      startDate: row.startDate,
      maturityDate: toNullableDateString(row.maturityDate),
      purchaseAmount: toNumber(row.purchaseAmount),
      currentValue: toNumber(row.currentValue),
      expectedReturn: toNumber(row.expectedReturn),
      status: row.status,
      notes: toNullableString(row.notes),
    }))

    const fixedAssets = rowsToObjects(extractWorksheetRows(text, "FixedAssets")).map((row) => ({
      id: row.id,
      organization_id: row.organization_id,
      asset_account_id: toNullableString(row.asset_account_id),
      depreciation_expense_account_id: row.depreciation_expense_account_id,
      accumulated_depreciation_account_id: row.accumulated_depreciation_account_id,
      name: row.name,
      code: row.code,
      category: toNullableString(row.category),
      purchase_date: row.purchase_date,
      purchase_price: toNumber(row.purchase_price),
      residual_value: toNumber(row.residual_value),
      useful_life_months: toNumber(row.useful_life_months),
      depreciation_method: row.depreciation_method,
      status: row.status,
    }))

    const depreciationRuns = rowsToObjects(extractWorksheetRows(text, "DepreciationRuns")).map((row) => ({
      id: row.id,
      fixed_asset_id: row.fixed_asset_id,
      transaction_id: row.transaction_id,
      month: toNumber(row.month),
      year: toNumber(row.year),
      depreciation_amount: toNumber(row.depreciation_amount),
      accumulated_depreciation: toNumber(row.accumulated_depreciation),
      book_value_ending: toNumber(row.book_value_ending),
      created_at: row.created_at,
    }))

    return {
      version: organization.version || "1.0",
      exportDate: organization.exportDate || new Date().toISOString(),
      organization,
      accounts,
      categories,
      banks,
      transactions,
      transactionLines,
      investments,
      fixedAssets,
      depreciationRuns,
    }
  } catch (error) {
    console.error("Error parsing Excel workbook:", error)
    return null
  }
}

/**
 * Export all data to JSON
 */
export const exportToJSON = (data: DatabaseExport) => {
  const jsonString = JSON.stringify(data, null, 2)
  const blob = new Blob([jsonString], { type: 'application/json' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `backup-${sanitizeFileNamePart(data.organization.name || "organisasi")}-${new Date().getTime()}.json`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/**
 * Export all data to CSV format
 */
export const exportToCSV = (data: DatabaseExport) => {
  let csvContent = "data:text/csv;charset=utf-8,"
  
  // Organization info
  csvContent += "ORGANISASI\n"
  csvContent += `Nama,${escapeCsvValue(data.organization.name)}\n`
  csvContent += `Tipe,${escapeCsvValue(data.organization.type)}\n`
  csvContent += `Alamat,${escapeCsvValue(data.organization.address || '')}\n`
  csvContent += `Kota,${escapeCsvValue(data.organization.city || '')}\n`
  csvContent += `Telepon,${escapeCsvValue(data.organization.phone || '')}\n\n`
  
  // Accounts
  csvContent += "CHART OF ACCOUNTS\n"
  csvContent += "Kode,Nama,Tipe,Organisasi\n"
  data.accounts.forEach(acc => {
    csvContent += `${escapeCsvValue(acc.code)},${escapeCsvValue(acc.name)},${escapeCsvValue(acc.type)},${escapeCsvValue(data.organization.name)}\n`
  })
  csvContent += "\n"
  
  // Transactions
  csvContent += "TRANSAKSI\n"
  csvContent += "No Ref,Tanggal,Keterangan,Masuk,Keluar\n"
  data.transactions.forEach(trx => {
    const income = trx.lines.find((l: any) => l.account?.type === 'Asset' && l.debit > 0)
    const expense = trx.lines.find((l: any) => l.account?.type === 'Asset' && l.credit > 0)
    csvContent += `${escapeCsvValue(trx.reference || '')},${escapeCsvValue(trx.date)},${escapeCsvValue(trx.description)},${escapeCsvValue(income?.debit || '')},${escapeCsvValue(expense?.credit || '')}\n`
  })
  csvContent += "\n"
  
  // Bank Accounts
  csvContent += "REKENING BANK\n"
  csvContent += "Bank,Nomor,Atas Nama,Saldo\n"
  data.banks.forEach(bank => {
    csvContent += `${escapeCsvValue(bank.bankName)},${escapeCsvValue(bank.accountNumber)},${escapeCsvValue(bank.accountName)},${escapeCsvValue(bank.balance)}\n`
  })
  csvContent += "\n"

  // Investments
  csvContent += "INVESTASI\n"
  csvContent += "Jenis,Nama,Institusi,Nilai Perolehan,Nilai Buku,Estimasi Hasil,Status\n"
  ;(data.investments || []).forEach((investment) => {
    csvContent += `${escapeCsvValue(investment.type)},${escapeCsvValue(investment.name)},${escapeCsvValue(investment.institution)},${escapeCsvValue(investment.purchaseAmount)},${escapeCsvValue(investment.currentValue)},${escapeCsvValue(investment.expectedReturn || 0)},${escapeCsvValue(investment.status)}\n`
  })
  
  const encodedUri = encodeURI(csvContent)
  const link = document.createElement('a')
  link.setAttribute('href', encodedUri)
  link.setAttribute('download', `backup-${sanitizeFileNamePart(data.organization.name || "organisasi")}-${new Date().getTime()}.csv`)
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/**
 * Export data to Excel Spreadsheet XML format
 */
export const exportToExcel = (data: DatabaseExport) => {
  const excelContent = createExcelWorkbookContent(data)
  const blob = new Blob([excelContent], { type: 'application/vnd.ms-excel' })
  const url = window.URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = `backup-${sanitizeFileNamePart(data.organization.name || "organisasi")}-${new Date().getTime()}.xls`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  window.URL.revokeObjectURL(url)
}

/**
 * Import data from JSON file
 */
export const importFromJSON = async (file: File): Promise<DatabaseExport | null> => {
  return new Promise((resolve) => {
    const reader = new FileReader()
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string
        const data = JSON.parse(content)
        resolve(data)
      } catch (error) {
        console.error('Error parsing JSON:', error)
        resolve(null)
      }
    }
    reader.readAsText(file)
  })
}
