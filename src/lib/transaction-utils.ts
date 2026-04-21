// Utility untuk share dan print transaksi (tanpa prisma)
export const printTransaction = (transactionId: string) => {
  const printWindow = window.open(`/api/transactions/${transactionId}/print`, '_blank')
  if (printWindow) {
    printWindow.focus()
  }
}

export const downloadTransactionPDF = async (transactionId: string) => {
  try {
    const response = await fetch(`/api/transactions/${transactionId}/pdf`)
    const blob = await response.blob()
    
    const url = window.URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `Transaksi-${Date.now()}.pdf`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    window.URL.revokeObjectURL(url)
  } catch (error) {
    console.error('Error downloading PDF:', error)
    alert('Gagal mengunduh PDF')
  }
}

export const shareToWhatsApp = async (organizationId: string, reference: string, description: string, amount: number) => {
  // Pindahkan logika branding ke Server Action atau rute API, tidak di klien
  const message = encodeURIComponent(
    `Transaksi: ${description}\nNomor Nota: ${reference}\nJumlah: Rp ${amount.toLocaleString('id-ID')}`
  )
  window.open(`https://wa.me/?text=${message}`, '_blank')
}

// Utility untuk format currency
export const formatCurrency = (value: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0
  }).format(value)
}

// Utility untuk format date
export const formatDate = (date: Date | string): string => {
  const d = typeof date === 'string' ? new Date(date) : date
  return d.toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  })
}
