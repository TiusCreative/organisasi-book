import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'
import { parseExcelWorkbookText } from '../../../lib/export-import-utils'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File
    const orgId = formData.get('orgId') as string

    if (!file || !orgId) {
      return NextResponse.json(
        { error: 'File and Organization ID required' },
        { status: 400 }
      )
    }

    const fileContent = await file.text()
    const normalizedName = file.name.toLowerCase()
    const isExcelWorkbook =
      normalizedName.endsWith('.xls') ||
      normalizedName.endsWith('.xml') ||
      fileContent.includes('<Workbook')

    const importData = isExcelWorkbook
      ? parseExcelWorkbookText(fileContent)
      : JSON.parse(fileContent)

    // Validate structure
    if (!importData || !importData.organization || !importData.accounts || !importData.transactions) {
      return NextResponse.json(
        { error: 'Invalid backup file format' },
        { status: 400 }
      )
    }

    // Start transaction
    await prisma.$transaction(async (tx) => {
      // 1. Delete existing data (in reverse order of dependencies)
      await tx.transactionLine.deleteMany({
        where: {
          transaction: {
            organizationId: orgId
          }
        }
      })

      await tx.transaction.deleteMany({
        where: { organizationId: orgId }
      })

      await tx.bankAccount.deleteMany({
        where: { organizationId: orgId }
      })

      await tx.investment.deleteMany({
        where: { organizationId: orgId }
      })

      await tx.chartOfAccount.deleteMany({
        where: { organizationId: orgId }
      })

      await tx.accountCategory.deleteMany({
        where: { organizationId: orgId }
      })

      try {
        await tx.$executeRaw`
          DELETE FROM fixed_asset_depreciation_runs
          WHERE fixed_asset_id IN (
            SELECT id FROM fixed_assets WHERE organization_id = ${orgId}
          )
        `

        await tx.$executeRaw`
          DELETE FROM fixed_assets
          WHERE organization_id = ${orgId}
        `
      } catch (error) {
        console.warn('Fixed asset tables not available yet, skipping asset import cleanup.')
      }

      await tx.organization.update({
        where: { id: orgId },
        data: {
          name: importData.organization.name,
          type: importData.organization.type,
          address: importData.organization.address || null,
          city: importData.organization.city || null,
          province: importData.organization.province || null,
          postalCode: importData.organization.postalCode || null,
          phone: importData.organization.phone || null,
          email: importData.organization.email || null,
          logo: importData.organization.logo || null,
          taxId: importData.organization.taxId || null,
          registrationNumber: importData.organization.registrationNumber || null,
          currency: importData.organization.currency || 'IDR',
          fiscalYearStart: Number(importData.organization.fiscalYearStart || 1),
        }
      })

      // 2. Import new data
      // Import categories first
      const categoryMap: Record<string, string> = {}
      for (const category of importData.categories || []) {
        const newCategory = await tx.accountCategory.create({
          data: {
            name: category.name,
            color: category.color,
            organizationId: orgId
          }
        })
        categoryMap[category.id] = newCategory.id
      }

      // Import chart of accounts
      const accountMap: Record<string, string> = {}
      for (const account of importData.accounts || []) {
        const newAccount = await tx.chartOfAccount.create({
          data: {
            code: account.code,
            name: account.name,
            type: account.type,
            categoryId: account.categoryId ? categoryMap[account.categoryId] : null,
            organizationId: orgId
          }
        })
        accountMap[account.id] = newAccount.id
      }

      // Import bank accounts
      const bankMap: Record<string, string> = {}
      for (const bank of importData.banks || []) {
        const newBank = await tx.bankAccount.create({
          data: {
            bankName: bank.bankName,
            accountNumber: bank.accountNumber,
            accountName: bank.accountName,
            balance: bank.balance,
            accountId: accountMap[bank.accountId],
            organizationId: orgId,
            notes: bank.notes || null,
            lastReconciled: bank.lastReconciled ? new Date(bank.lastReconciled) : null,
          }
        })
        bankMap[bank.id] = newBank.id
      }

      const transactionMap: Record<string, string> = {}

      // Import transactions
      for (const transaction of importData.transactions || []) {
        const newTransaction = await tx.transaction.create({
          data: {
            reference: transaction.reference || null,
            date: new Date(transaction.date),
            description: transaction.description,
            organizationId: orgId,
          }
        })
        transactionMap[transaction.id] = newTransaction.id
      }

      // Import investments
      for (const investment of importData.investments || []) {
        await tx.investment.create({
          data: {
            organizationId: orgId,
            accountId: accountMap[investment.accountId],
            sourceBankAccountId: investment.sourceBankAccountId ? bankMap[investment.sourceBankAccountId] : null,
            settlementBankAccountId: investment.settlementBankAccountId ? bankMap[investment.settlementBankAccountId] : null,
            type: investment.type,
            name: investment.name,
            institution: investment.institution,
            referenceNumber: investment.referenceNumber || null,
            startDate: new Date(investment.startDate),
            maturityDate: investment.maturityDate ? new Date(investment.maturityDate) : null,
            purchaseAmount: investment.purchaseAmount,
            currentValue: investment.currentValue,
            expectedReturn: investment.expectedReturn || 0,
            status: investment.status || 'ACTIVE',
            notes: investment.notes || null,
          }
        })
      }

      for (const investment of importData.investments || []) {
        if (!investment.inkasoTransactionId) {
          continue
        }

        await tx.investment.updateMany({
          where: {
            organizationId: orgId,
            accountId: accountMap[investment.accountId],
          },
          data: {
            inkasoTransactionId: transactionMap[investment.inkasoTransactionId] || null,
          }
        })
      }

      // Import transaction lines
      for (const line of importData.transactionLines || []) {
        if (transactionMap[line.transactionId] && accountMap[line.accountId]) {
          await tx.transactionLine.create({
            data: {
              transactionId: transactionMap[line.transactionId],
              accountId: accountMap[line.accountId],
              debit: line.debit,
              credit: line.credit,
              description: line.description
            }
          })
        }
      }

      try {
        const fixedAssetMap: Record<string, string> = {}

        for (const asset of importData.fixedAssets || []) {
          const rows = await tx.$queryRaw<Array<{ id: string }>>`
            INSERT INTO fixed_assets (
              organization_id,
              asset_account_id,
              depreciation_expense_account_id,
              accumulated_depreciation_account_id,
              name,
              code,
              category,
              purchase_date,
              purchase_price,
              residual_value,
              useful_life_months,
              depreciation_method,
              status
            )
            VALUES (
              ${orgId},
              ${asset.asset_account_id ? accountMap[asset.asset_account_id] : null},
              ${accountMap[asset.depreciation_expense_account_id]},
              ${accountMap[asset.accumulated_depreciation_account_id]},
              ${asset.name},
              ${asset.code},
              ${asset.category || null},
              ${new Date(asset.purchase_date)},
              ${asset.purchase_price},
              ${asset.residual_value},
              ${asset.useful_life_months},
              ${asset.depreciation_method},
              ${asset.status || 'ACTIVE'}
            )
            RETURNING id
          `

          fixedAssetMap[asset.id] = rows[0].id
        }

        for (const run of importData.depreciationRuns || []) {
          if (!fixedAssetMap[run.fixed_asset_id] || !transactionMap[run.transaction_id]) {
            continue
          }

          await tx.$executeRaw`
            INSERT INTO fixed_asset_depreciation_runs (
              fixed_asset_id,
              transaction_id,
              month,
              year,
              depreciation_amount,
              accumulated_depreciation,
              book_value_ending
            )
            VALUES (
              ${fixedAssetMap[run.fixed_asset_id]},
              ${transactionMap[run.transaction_id]},
              ${run.month},
              ${run.year},
              ${run.depreciation_amount},
              ${run.accumulated_depreciation},
              ${run.book_value_ending}
            )
          `
        }
      } catch (error) {
        console.warn('Fixed asset tables not available yet, skipping asset import.')
      }
    })

    return NextResponse.json(
      { success: true, message: 'Data imported successfully' },
      { status: 200 }
    )
  } catch (error) {
    console.error('Import error:', error)
    return NextResponse.json(
      { error: 'Import failed: ' + (error instanceof Error ? error.message : 'Unknown error') },
      { status: 500 }
    )
  }
}
