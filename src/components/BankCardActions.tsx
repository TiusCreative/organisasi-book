'use client'

import { useState } from 'react'
import { MoreVertical, Trash2, Power, PowerOff } from 'lucide-react'
import { deleteBankAccount, updateBankStatus } from '../app/actions/bank'

interface BankCardActionsProps {
  bank: {
    id: string
    bankName: string
    status: string
  }
}

export default function BankCardActions({ bank }: BankCardActionsProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')

  const handleToggleStatus = async () => {
    try {
      setIsLoading(true)
      const newStatus = bank.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE'
      await updateBankStatus(bank.id, newStatus)
      setIsOpen(false)
    } catch (err: any) {
      setError(err.message || 'Gagal mengubah status')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDelete = async () => {
    try {
      setIsLoading(true)
      const result = await deleteBankAccount(bank.id)
      if (!result.success) {
        setError(result.error || 'Gagal menghapus rekening')
        return
      }
      setShowDeleteModal(false)
      setIsOpen(false)
    } catch (err: any) {
      setError(err.message || 'Gagal menghapus rekening')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <>
      {/* Menu Button */}
      <div className="relative">
        <button
          onClick={() => setIsOpen(!isOpen)}
          className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
          disabled={isLoading}
        >
          <MoreVertical size={18} className="text-slate-600" />
        </button>

        {/* Dropdown Menu */}
        {isOpen && (
          <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-slate-200 z-50">
            <button
              onClick={handleToggleStatus}
              disabled={isLoading}
              className="w-full text-left px-4 py-2 hover:bg-slate-50 flex items-center gap-2 text-sm first:rounded-t-lg disabled:opacity-50"
            >
              {bank.status === 'ACTIVE' ? (
                <>
                  <PowerOff size={16} className="text-amber-600" />
                  <span>Nonaktifkan</span>
                </>
              ) : (
                <>
                  <Power size={16} className="text-emerald-600" />
                  <span>Aktifkan</span>
                </>
              )}
            </button>

            <div className="border-t border-slate-100" />

            <button
              onClick={() => {
                setShowDeleteModal(true)
                setIsOpen(false)
              }}
              disabled={isLoading}
              className="w-full text-left px-4 py-2 hover:bg-red-50 flex items-center gap-2 text-sm text-red-600 last:rounded-b-lg disabled:opacity-50"
            >
              <Trash2 size={16} />
              <span>Hapus</span>
            </button>
          </div>
        )}
      </div>

      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-2xl p-6 max-w-sm shadow-xl">
            <h3 className="text-lg font-bold text-slate-800 mb-2">Hapus Rekening?</h3>
            <p className="text-slate-600 mb-4">
              Yakin ingin menghapus rekening bank <strong>{bank.bankName}</strong>? Tindakan ini tidak dapat dibatalkan.
            </p>
            
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-600 px-4 py-2 rounded-lg text-sm mb-4">
                {error}
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <button
                onClick={() => setShowDeleteModal(false)}
                disabled={isLoading}
                className="px-4 py-2 text-slate-600 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                Batal
              </button>
              <button
                onClick={handleDelete}
                disabled={isLoading}
                className="px-4 py-2 bg-red-600 text-white hover:bg-red-700 rounded-lg transition-colors disabled:opacity-50"
              >
                {isLoading ? 'Menghapus...' : 'Hapus'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Click outside to close menu */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setIsOpen(false)}
        />
      )}
    </>
  )
}
