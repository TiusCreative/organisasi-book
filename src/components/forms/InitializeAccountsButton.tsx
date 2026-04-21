'use client'

import { useState } from 'react'
import { initializeDefaultAccounts } from '../../app/actions/account'
import { Plus, Loader } from 'lucide-react'

interface InitializeAccountsButtonProps {
  organizationId: string
}

export default function InitializeAccountsButton({ organizationId }: InitializeAccountsButtonProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const handleInitialize = async () => {
    if (!window.confirm('Ini akan menambah 100+ akun default berdasarkan sistem akuntansi Indonesia. Lanjutkan?')) {
      return
    }

    setLoading(true)
    setError('')
    setSuccess('')

    try {
      const result = await initializeDefaultAccounts(organizationId)
      
      if (result.success) {
        setSuccess(result.message || 'Berhasil menginisialisasi akun default')
        // Refresh page after 1 second
        setTimeout(() => window.location.reload(), 1000)
      } else {
        setError(result.error || 'Gagal menginisialisasi akun')
      }
    } catch (err: any) {
      setError(err.message || 'Terjadi kesalahan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-3">
      {error && (
        <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
          {error}
        </div>
      )}
      {success && (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg text-sm text-green-700">
          {success}
        </div>
      )}
      <button
        onClick={handleInitialize}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 bg-emerald-600 text-white px-4 py-3 rounded-lg hover:bg-emerald-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed font-bold text-sm"
      >
        {loading ? (
          <>
            <Loader size={18} className="animate-spin" />
            Menginisialisasi...
          </>
        ) : (
          <>
            <Plus size={18} />
            Inisialisasi Akun Indonesia
          </>
        )}
      </button>
      <p className="text-xs text-slate-500">
        Tambahkan 100+ akun standard sesuai sistem akuntansi Indonesia dengan kategori otomatis
      </p>
    </div>
  )
}
