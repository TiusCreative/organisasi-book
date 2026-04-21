'use server'

import { prisma } from '../../lib/prisma'
import { revalidatePath } from 'next/cache'
import {
  calculatePayrollDeductions,
  type PTKP_VALUES
} from '../../lib/tax-utils'
import { syncSalarySlipTaxEntries } from '../../lib/tax-entries'
import { requireCurrentOrganization } from '../../lib/auth'
import { hasModulePermission } from '../../lib/permissions'

// CREATE EMPLOYEE
export async function createEmployee(formData: FormData) {
  try {
    const { user, organization } = await requireCurrentOrganization()

    // Permission check: hanya ADMIN, MANAGER yang bisa membuat karyawan
    if (!hasModulePermission(user, "payroll")) {
      throw new Error('Anda tidak memiliki izin untuk membuat data karyawan.')
    }

    const organizationId = organization.id
    const name = formData.get('name') as string
    const position = formData.get('position') as string
    const baseSalary = parseFloat(formData.get('baseSalary') as string)
    const joinDate = new Date(formData.get('joinDate') as string)
    const employeeNumber = formData.get('employeeNumber') as string
    const nik = formData.get('nik') as string
    const email = formData.get('email') as string
    const phone = formData.get('phone') as string
    const taxFileNumber = formData.get('taxFileNumber') as string
    const bankAccount = formData.get('bankAccount') as string
    const bankName = formData.get('bankName') as string
    const taxStatus = (formData.get('taxStatus') as string) || 'TK'
    const department = formData.get('department') as string

    if (!name || !position || !baseSalary || !joinDate) {
      throw new Error('Data karyawan tidak lengkap')
    }

    const employee = await prisma.employee.create({
      data: {
        organizationId,
        name,
        position,
        baseSalary,
        joinDate,
        employeeNumber: employeeNumber || undefined,
        nik: nik || undefined,
        email: email || undefined,
        phone: phone || undefined,
        taxFileNumber: taxFileNumber || undefined,
        bankAccount: bankAccount || undefined,
        bankName: bankName || undefined,
        taxStatus,
        department: department || undefined
      }
    })

    revalidatePath('/gaji')
    return { success: true, employee }
  } catch (error) {
    console.error('Create employee error:', error)
    return { success: false, error: 'Gagal membuat data karyawan' }
  }
}

// UPDATE EMPLOYEE
export async function updateEmployee(formData: FormData) {
  try {
    const { user } = await requireCurrentOrganization()

    // Permission check: hanya ADMIN, MANAGER yang bisa update karyawan
    if (!hasModulePermission(user, "payroll")) {
      throw new Error('Anda tidak memiliki izin untuk mengubah data karyawan.')
    }

    const id = formData.get('id') as string
    const name = formData.get('name') as string
    const position = formData.get('position') as string
    const baseSalary = parseFloat(formData.get('baseSalary') as string)
    const taxStatus = (formData.get('taxStatus') as string) || 'TK'
    const email = formData.get('email') as string
    const phone = formData.get('phone') as string
    const bankAccount = formData.get('bankAccount') as string
    const bankName = formData.get('bankName') as string
    const department = formData.get('department') as string
    const status = (formData.get('status') as string) || 'ACTIVE'

    const employee = await prisma.employee.update({
      where: { id },
      data: {
        name,
        position,
        baseSalary,
        taxStatus,
        email: email || null,
        phone: phone || null,
        bankAccount: bankAccount || null,
        bankName: bankName || null,
        department: department || null,
        status
      }
    })

    revalidatePath('/gaji')
    return { success: true, employee }
  } catch (error) {
    console.error('Update employee error:', error)
    return { success: false, error: 'Gagal mengupdate data karyawan' }
  }
}

// DELETE EMPLOYEE
export async function deleteEmployee(id: string) {
  try {
    const { user } = await requireCurrentOrganization()

    // Permission check: hanya ADMIN yang bisa hapus karyawan
    if (user.role !== "ADMIN") {
      throw new Error('Anda tidak memiliki izin untuk menghapus data karyawan. Hanya admin yang dapat menghapus.')
    }

    await prisma.employee.delete({
      where: { id }
    })

    revalidatePath('/gaji')
    return { success: true }
  } catch (error) {
    console.error('Delete employee error:', error)
    return { success: false, error: 'Gagal menghapus data karyawan' }
  }
}

// ADD ALLOWANCE
export async function addAllowance(formData: FormData) {
  try {
    const { user } = await requireCurrentOrganization()

    // Permission check: hanya ADMIN, MANAGER yang bisa menambah tunjangan
    if (!hasModulePermission(user, "payroll")) {
      throw new Error('Anda tidak memiliki izin untuk menambah tunjangan.')
    }

    const employeeId = formData.get('employeeId') as string
    const name = formData.get('name') as string
    const amount = parseFloat(formData.get('amount') as string)
    const effectiveDate = new Date(formData.get('effectiveDate') as string)
    const isTaxable = formData.get('isTaxable') === 'on'

    const allowance = await prisma.allowance.create({
      data: {
        employeeId,
        name,
        amount,
        effectiveDate,
        isTaxable
      }
    })

    return { success: true, allowance }
  } catch (error) {
    console.error('Add allowance error:', error)
    return { success: false, error: 'Gagal menambah tunjangan' }
  }
}

// ADD DEDUCTION
export async function addDeduction(formData: FormData) {
  try {
    const { user } = await requireCurrentOrganization()

    // Permission check: hanya ADMIN, MANAGER yang bisa menambah potongan
    if (!hasModulePermission(user, "payroll")) {
      throw new Error('Anda tidak memiliki izin untuk menambah potongan.')
    }

    const employeeId = formData.get('employeeId') as string
    const name = formData.get('name') as string
    const amount = parseFloat(formData.get('amount') as string)
    const effectiveDate = new Date(formData.get('effectiveDate') as string)

    const deduction = await prisma.deduction.create({
      data: {
        employeeId,
        name,
        amount,
        effectiveDate
      }
    })

    return { success: true, deduction }
  } catch (error) {
    console.error('Add deduction error:', error)
    return { success: false, error: 'Gagal menambah potongan' }
  }
}

// GENERATE SALARY SLIP
export async function generateSalarySlip(
  organizationId: string,
  employeeId: string,
  month: number,
  year: number
) {
  try {
    const { user } = await requireCurrentOrganization()

    // Permission check: hanya ADMIN, MANAGER yang bisa generate slip gaji
    if (!hasModulePermission(user, "payroll")) {
      throw new Error('Anda tidak memiliki izin untuk membuat slip gaji.')
    }

    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        allowances: {
          where: {
            effectiveDate: { lte: new Date(year, month - 1, 1) },
            OR: [
              { endDate: null },
              { endDate: { gte: new Date(year, month - 1, 1) } }
            ]
          }
        },
        deductions: {
          where: {
            effectiveDate: { lte: new Date(year, month - 1, 1) },
            OR: [
              { endDate: null },
              { endDate: { gte: new Date(year, month - 1, 1) } }
            ]
          }
        }
      }
    })

    if (!employee) {
      throw new Error('Karyawan tidak ditemukan')
    }

    // Calculate allowances
    const totalAllowance = employee.allowances.reduce((sum, a) => sum + a.amount, 0)

    // Calculate deductions (non-tax)
    const totalDeduction = employee.deductions.reduce((sum, d) => sum + d.amount, 0)

    // Gross income = Base Salary + Taxable Allowances
    const grossIncome = employee.baseSalary + totalAllowance

    // Calculate payroll deductions (BPJS, PPh)
    const payrollData = calculatePayrollDeductions(
      grossIncome,
      (employee.taxStatus as keyof typeof PTKP_VALUES) || 'TK'
    )

    // Net income = Gross - All Deductions - Taxes
    const netIncome = grossIncome - totalDeduction - payrollData.totalDeduction

    // Check if slip already exists
    const existing = await prisma.salarySlip.findUnique({
      where: {
        employeeId_month_year: {
          employeeId,
          month,
          year
        }
      }
    })

    let salarySlip
    if (existing) {
      // Update existing
      salarySlip = await prisma.salarySlip.update({
        where: { id: existing.id },
        data: {
          baseSalary: employee.baseSalary,
          totalAllowance,
          totalDeduction,
          bpjsKesehatanEmployee: payrollData.bpjsKesehatanEmployee,
          bpjsKetenagakerjaan: payrollData.bpjsKetenagakerjaan,
          pph21: payrollData.pph21,
          grossIncome,
          netIncome
        },
        include: { employee: true }
      })
    } else {
      // Create new
      salarySlip = await prisma.salarySlip.create({
        data: {
          organizationId,
          employeeId,
          month,
          year,
          baseSalary: employee.baseSalary,
          totalAllowance,
          totalDeduction,
          bpjsKesehatanEmployee: payrollData.bpjsKesehatanEmployee,
          bpjsKetenagakerjaan: payrollData.bpjsKetenagakerjaan,
          pph21: payrollData.pph21,
          grossIncome,
          netIncome
        },
        include: { employee: true }
      })
    }

    await syncSalarySlipTaxEntries({
      organizationId,
      salarySlipId: salarySlip.id,
      date: new Date(year, month - 1, 1),
      month,
      year,
      grossIncome,
      pph21: payrollData.pph21,
      employeeName: employee.name,
    })

    revalidatePath('/gaji')
    revalidatePath('/pajak')
    return { success: true, salarySlip }
  } catch (error) {
    console.error('Generate salary slip error:', error)
    return { success: false, error: 'Gagal membuat slip gaji' }
  }
}

// UPDATE SALARY SLIP STATUS
export async function updateSalarySlipStatus(id: string, status: string, paymentDate?: Date) {
  try {
    const { user } = await requireCurrentOrganization()

    // Permission check: hanya ADMIN, MANAGER yang bisa update status slip gaji
    if (!hasModulePermission(user, "payroll")) {
      throw new Error('Anda tidak memiliki izin untuk mengubah status slip gaji.')
    }

    const salarySlip = await prisma.salarySlip.update({
      where: { id },
      data: {
        status,
        paymentDate: paymentDate || null
      }
    })

    revalidatePath('/gaji')
    return { success: true, salarySlip }
  } catch (error) {
    console.error('Update salary slip status error:', error)
    return { success: false, error: 'Gagal mengupdate status slip gaji' }
  }
}

// GET EMPLOYEE WITH SALARY SLIPS
export async function getEmployeePayroll(employeeId: string) {
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: {
        salarySlips: {
          orderBy: { createdAt: 'desc' },
          take: 12 // Last 12 months
        },
        allowances: {
          where: { endDate: null }
        },
        deductions: {
          where: { endDate: null }
        }
      }
    })

    return employee
  } catch (error) {
    console.error('Get employee payroll error:', error)
    return null
  }
}
