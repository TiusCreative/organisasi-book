"use client"

import { Printer, FileDown, Share2 } from 'lucide-react'
import { useReactToPrint } from 'react-to-print'
import { useRef } from 'react'
import { formatCurrency } from '../../lib/tax-utils'

interface SalarySlipData {
  id: string
  employee: {
    name: string
    position: string
    employeeNumber?: string
    taxFileNumber?: string
  }
  month: number
  year: number
  baseSalary: number
  totalAllowance: number
  totalDeduction: number
  bpjsKesehatanEmployee: number
  bpjsKetenagakerjaan: number
  pph21: number
  grossIncome: number
  netIncome: number
  status: string
  paymentDate?: Date
  organization: {
    name: string
    address?: string
    phone?: string
  }
}

const MONTHS = [
  'Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni',
  'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'
]

export default function SalarySlipViewer({ slip, organization }: { slip: SalarySlipData; organization: any }) {
  const printRef = useRef<HTMLDivElement>(null)
  const handlePrint = useReactToPrint({ contentRef: printRef })

  const handleWhatsApp = () => {
    const message = `
Slip Gaji - ${slip.employee.name}
Periode: ${MONTHS[slip.month - 1]} ${slip.year}

Gaji Pokok: Rp ${formatCurrency(slip.baseSalary)}
Tunjangan: Rp ${formatCurrency(slip.totalAllowance)}
Penghasilan Bruto: Rp ${formatCurrency(slip.grossIncome)}

Potongan:
- BPJS Kesehatan: Rp ${formatCurrency(slip.bpjsKesehatanEmployee)}
- BPJS Ketenagakerjaan: Rp ${formatCurrency(slip.bpjsKetenagakerjaan)}
- PPh 21: Rp ${formatCurrency(slip.pph21)}
- Lainnya: Rp ${formatCurrency(slip.totalDeduction)}

Gaji Bersih: Rp ${formatCurrency(slip.netIncome)}

${organization.name}`
    const encodedMessage = encodeURIComponent(message)
    window.open(`https://wa.me/?text=${encodedMessage}`, '_blank')
  }

  return (
    <div className="space-y-4">
      {/* Action Buttons */}
      <div className="flex flex-col sm:flex-row gap-2 justify-end">
        <button
          onClick={() => handlePrint()}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-medium"
        >
          <Printer size={18} /> Cetak
        </button>
        <button
          onClick={handleWhatsApp}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-medium"
        >
          <Share2 size={18} /> WhatsApp
        </button>
      </div>

      {/* Print Area */}
      <div ref={printRef} className="bg-white p-6 sm:p-8 rounded-xl border border-slate-200 print:border-none">
        {/* Header */}
        <div className="border-b-2 border-slate-300 pb-6 mb-6">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
            <div>
              <h1 className="text-xl sm:text-2xl font-bold text-slate-800">{organization.name}</h1>
              {organization.address && (
                <p className="text-xs sm:text-sm text-slate-500 mt-1">{organization.address}</p>
              )}
            </div>
            <div className="text-right">
              <p className="text-lg sm:text-xl font-bold text-slate-800">SLIP GAJI</p>
              <p className="text-xs sm:text-sm text-slate-500">
                {MONTHS[slip.month - 1]} {slip.year}
              </p>
            </div>
          </div>
        </div>

        {/* Employee Info */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
          <div>
            <p className="text-xs text-slate-500 uppercase font-bold mb-1">Nama Karyawan</p>
            <p className="text-sm sm:text-base font-bold text-slate-800">{slip.employee.name}</p>
          </div>
          <div>
            <p className="text-xs text-slate-500 uppercase font-bold mb-1">Jabatan</p>
            <p className="text-sm sm:text-base font-bold text-slate-800">{slip.employee.position}</p>
          </div>
          {slip.employee.employeeNumber && (
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold mb-1">Nomor Pegawai</p>
              <p className="text-sm sm:text-base text-slate-700">{slip.employee.employeeNumber}</p>
            </div>
          )}
          {slip.employee.taxFileNumber && (
            <div>
              <p className="text-xs text-slate-500 uppercase font-bold mb-1">NPWP</p>
              <p className="text-sm sm:text-base text-slate-700">{slip.employee.taxFileNumber}</p>
            </div>
          )}
        </div>

        {/* Earnings */}
        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-800 uppercase mb-3 border-b-2 border-slate-300 pb-2">
            Penghasilan
          </h3>
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-slate-700">Gaji Pokok</span>
              <span className="font-mono font-medium">Rp {formatCurrency(slip.baseSalary)}</span>
            </div>
            {slip.totalAllowance > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-700">Tunjangan</span>
                <span className="font-mono font-medium">Rp {formatCurrency(slip.totalAllowance)}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold bg-slate-100 p-2 rounded">
              <span>Penghasilan Bruto</span>
              <span className="font-mono">Rp {formatCurrency(slip.grossIncome)}</span>
            </div>
          </div>
        </div>

        {/* Deductions */}
        <div className="mb-8">
          <h3 className="text-sm font-bold text-slate-800 uppercase mb-3 border-b-2 border-slate-300 pb-2">
            Potongan
          </h3>
          <div className="space-y-2">
            {slip.bpjsKesehatanEmployee > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-700">BPJS Kesehatan (4%)</span>
                <span className="font-mono">- Rp {formatCurrency(slip.bpjsKesehatanEmployee)}</span>
              </div>
            )}
            {slip.bpjsKetenagakerjaan > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-700">BPJS Ketenagakerjaan (2%)</span>
                <span className="font-mono">- Rp {formatCurrency(slip.bpjsKetenagakerjaan)}</span>
              </div>
            )}
            {slip.pph21 > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-700">PPh Pasal 21</span>
                <span className="font-mono">- Rp {formatCurrency(slip.pph21)}</span>
              </div>
            )}
            {slip.totalDeduction > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-slate-700">Potongan Lainnya</span>
                <span className="font-mono">- Rp {formatCurrency(slip.totalDeduction)}</span>
              </div>
            )}
          </div>
        </div>

        {/* Net Income */}
        <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 mb-8">
          <div className="flex justify-between items-center">
            <span className="text-base sm:text-lg font-bold text-slate-800">Gaji Bersih</span>
            <span className="text-lg sm:text-2xl font-bold text-green-600 font-mono">
              Rp {formatCurrency(slip.netIncome)}
            </span>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs sm:text-sm text-slate-500 border-t border-slate-200 pt-4 print:text-xs">
          <p>Status: <span className="font-bold uppercase">{slip.status}</span></p>
          {slip.paymentDate && (
            <p>Tanggal Pembayaran: {new Date(slip.paymentDate).toLocaleDateString('id-ID')}</p>
          )}
          <p className="mt-2 text-slate-400">Dokumen ini dicetak otomatis oleh sistem akuntansi</p>
        </div>
      </div>
    </div>
  )
}
