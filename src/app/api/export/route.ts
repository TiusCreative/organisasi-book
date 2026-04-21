import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '../../../lib/prisma'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const orgId = searchParams.get('orgId')
    if (!orgId) {
      return NextResponse.json(
        { error: 'Organization ID required' },
        { status: 400 }
      )
    }

    // Fetch all organization data
    const organization = await prisma.organization.findUnique({
      where: { id: orgId }
    })

    const accounts = await prisma.chartOfAccount.findMany({
      where: { organizationId: orgId },
      include: { category: true }
    })

    const categories = await prisma.accountCategory.findMany({
      where: { organizationId: orgId }
    })

    const banks = await prisma.bankAccount.findMany({
      where: { organizationId: orgId }
    })

    const investments = await prisma.investment.findMany({
      where: { organizationId: orgId }
    })

    const transactions = await prisma.transaction.findMany({
      where: { organizationId: orgId },
      include: {
        lines: {
          include: { account: true }
        }
      }
    })

    const transactionLines = await prisma.transactionLine.findMany({
      where: {
        transaction: {
          organizationId: orgId
        }
      }
    })

    let fixedAssets: any[] = []
    let depreciationRuns: any[] = []

    try {
      fixedAssets = await prisma.$queryRaw`
        SELECT *
        FROM fixed_assets
        WHERE organization_id = ${orgId}
        ORDER BY purchase_date ASC, code ASC
      `

      depreciationRuns = await prisma.$queryRaw`
        SELECT runs.*
        FROM fixed_asset_depreciation_runs runs
        INNER JOIN fixed_assets assets ON assets.id = runs.fixed_asset_id
        WHERE assets.organization_id = ${orgId}
        ORDER BY year DESC, month DESC, created_at DESC
      `
    } catch (error) {
      console.warn('Fixed asset tables not available yet, skipping asset export.')
    }

    const exportData = {
      version: '1.0',
      exportDate: new Date().toISOString(),
      organization,
      accounts,
      categories,
      banks,
      investments,
      transactions,
      transactionLines,
      fixedAssets,
      depreciationRuns
    }

    return NextResponse.json(exportData)
  } catch (error) {
    console.error('Export error:', error)
    return NextResponse.json(
      { error: 'Export failed' },
      { status: 500 }
    )
  }
}
