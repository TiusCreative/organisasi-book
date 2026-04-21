'use client'

import { useState } from 'react'
import { Landmark, CreditCard } from 'lucide-react'
import BankEditModal from './forms/BankEditModal'
import BankCardActions from './BankCardActions'

interface BankClientComponentProps {
  banks: any[]
  activeBanks: any[]
  inactiveBanks: any[]
}

export default function BankClientComponent({
  banks,
  activeBanks,
  inactiveBanks,
}: BankClientComponentProps) {
  const [filter, setFilter] = useState<'ALL' | 'ACTIVE' | 'INACTIVE'>('ALL')

  let filteredBanks = banks
  if (filter === 'ACTIVE') filteredBanks = activeBanks
  if (filter === 'INACTIVE') filteredBanks = inactiveBanks

  return (
    <>
      {/* Filter Buttons */}
      <div className="flex gap-2">
        <button
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'ALL'
              ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
          onClick={() => setFilter('ALL')}
        >
          Semua ({banks.length})
        </button>
        <button
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            filter === 'ACTIVE'
              ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
              : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
          }`}
          onClick={() => setFilter('ACTIVE')}
        >
          Aktif ({activeBanks.length})
        </button>
        {inactiveBanks.length > 0 && (
          <button
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              filter === 'INACTIVE'
                ? 'bg-blue-50 text-blue-600 hover:bg-blue-100'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100'
            }`}
            onClick={() => setFilter('INACTIVE')}
          >
            Tidak Aktif ({inactiveBanks.length})
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {filteredBanks.map((bank) => (
          <div
            key={bank.id}
            className={`bg-white p-6 rounded-2xl border shadow-sm relative overflow-hidden group transition-opacity ${
              bank.status === 'INACTIVE'
                ? 'opacity-60 border-slate-200'
                : 'border-slate-100'
            }`}
          >
            <div className="absolute top-0 right-0 p-8 opacity-5 text-slate-900 group-hover:scale-110 transition-transform">
              <Landmark size={80} />
            </div>

            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center">
                <CreditCard size={24} />
              </div>
              <div>
                <h3 className="font-bold text-lg text-slate-800">{bank.bankName}</h3>
                <p className="text-xs text-slate-400 font-medium uppercase tracking-widest">
                  {bank.organization.name}
                </p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Nomor Rekening</span>
                <span className="font-mono font-bold text-slate-700">{bank.accountNumber}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Atas Nama</span>
                <span className="font-bold text-slate-700">{bank.accountName}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-400">Saldo</span>
                <span className="font-bold text-emerald-600">
                  Rp {bank.balance?.toLocaleString('id-ID') || '0'}
                </span>
              </div>
            </div>

            <div className="mt-6 pt-4 border-t border-slate-50 flex justify-between items-center">
              <span
                className={`text-xs font-bold px-2 py-1 rounded ${
                  bank.status === 'ACTIVE'
                    ? 'bg-emerald-50 text-emerald-600'
                    : 'bg-red-50 text-red-600'
                }`}
              >
                {bank.status === 'ACTIVE' ? 'Aktif' : 'Tidak Aktif'}
              </span>
              <div className="flex gap-2">
                <BankEditModal bank={bank} />
                <BankCardActions bank={bank} />
              </div>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}
