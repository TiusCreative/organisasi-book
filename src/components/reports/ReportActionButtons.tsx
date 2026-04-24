"use client"

import { FileDown, Printer, Share2 } from "lucide-react"

interface ReportActionButtonsProps {
  pdfUrl: string
  whatsappText: string
  printTargetId?: string
  shareUrl?: string
}

export default function ReportActionButtons({
  pdfUrl,
  whatsappText,
  printTargetId,
  shareUrl,
}: ReportActionButtonsProps) {
  const handlePrint = () => {
    if (printTargetId) {
      const printContent = document.getElementById(printTargetId)
      if (printContent) {
        const printWindow = window.open("", "", "height=720,width=1024")
        if (!printWindow) return
        printWindow.document.write(`
          <html>
            <head>
              <title>Cetak Laporan</title>
              <style>
                body { font-family: Arial, sans-serif; padding: 24px; color: #0f172a; }
              </style>
            </head>
            <body>${printContent.innerHTML}</body>
          </html>
        `)
        printWindow.document.close()
        printWindow.print()
        return
      }
    }

    window.print()
  }

  const handleDownloadPDF = () => {
    window.open(pdfUrl, "_blank", "noopener,noreferrer")
  }

  const handleShare = async () => {
    const url = shareUrl || pdfUrl || window.location.href
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: "Laporan",
          text: whatsappText,
          url,
        })
        return
      } catch {
        // fall through to WhatsApp fallback
      }
    }

    const encodedMessage = encodeURIComponent([whatsappText, url ? `\n\n${url}` : ""].join(""))
    window.open(`https://wa.me/?text=${encodedMessage}`, "_blank", "noopener,noreferrer")
  }

  return (
    <div className="flex flex-col sm:flex-row gap-2">
      <button
        type="button"
        onClick={handlePrint}
        className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-600 text-white rounded-lg hover:bg-slate-700 transition-colors text-sm font-bold"
      >
        <Printer size={18} /> Cetak
      </button>
      <button
        type="button"
        onClick={handleDownloadPDF}
        className="flex items-center justify-center gap-2 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors text-sm font-bold"
      >
        <FileDown size={18} /> PDF
      </button>
      <button
        type="button"
        onClick={handleShare}
        className="flex items-center justify-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors text-sm font-bold"
      >
        <Share2 size={18} /> Bagikan
      </button>
    </div>
  )
}
