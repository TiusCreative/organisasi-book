"use client"

import { useRef } from "react"
import { useReactToPrint } from "react-to-print"
import { Printer } from "lucide-react"

type DynamicPrintLayoutProps = {
  templateHtml: string
  data: any // Data transaksi (contoh: invoice data)
  documentTitle?: string
  customButton?: React.ReactNode // Memungkinkan custom UI untuk tombol trigger cetak
}

/**
 * Mini Template Engine 
 * Mendukung variabel {{nama}} dan array loop {{#each items}} ... {{/each}}
 */
function renderTemplate(template: string, data: any) {
  if (!template) return ""

  // Helper untuk memformat value (mendukung format currency)
  const formatValue = (val: any, format?: string) => {
    if (val === undefined || val === null) return ""
    if (format === 'currency') {
      return new Intl.NumberFormat("id-ID", { style: "currency", currency: "IDR", minimumFractionDigits: 0 }).format(Number(val) || 0)
    }
    if (format === 'date') {
      const d = new Date(val)
      return isNaN(d.getTime()) ? String(val) : d.toLocaleDateString("id-ID", { day: 'numeric', month: 'long', year: 'numeric' })
    }
    return String(val)
  }

  // 1. Proses Looping Array: {{#each items}} <tr><td>{{name}}</td></tr> {{/each}}
  let html = template.replace(/{{#each\s+([a-zA-Z0-9_]+)}}(.*?){{\/each}}/gs, (match, arrayName, content) => {
    const array = data[arrayName]
    if (!Array.isArray(array)) return ""

    return array.map((item: any) => {
      // Ganti variabel di dalam blok looping dengan dukungan pipe format (contoh: {{total | currency}})
      return content.replace(/{{([a-zA-Z0-9_.]+)(?:\s*\|\s*([a-zA-Z0-9_]+))?}}/g, (m: string, prop: string, format?: string) => {
        const value = prop.split('.').reduce((obj, key) => (obj ? obj[key] : ""), item)
        return formatValue(value, format)
      })
    }).join("")
  })

  // 2. Proses Variabel Biasa dengan dukungan pipe format: {{invoiceNumber}}, {{totalAmount | currency}}
  html = html.replace(/{{([a-zA-Z0-9_.]+)(?:\s*\|\s*([a-zA-Z0-9_]+))?}}/g, (match, prop, format?: string) => {
    const value = prop.split('.').reduce((obj, key) => (obj ? obj[key] : ""), data)
    return formatValue(value, format)
  })

  return html
}

export default function DynamicPrintLayout({ templateHtml, data, documentTitle = "Document", customButton }: DynamicPrintLayoutProps) {
  const componentRef = useRef<HTMLDivElement>(null)
  
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: documentTitle,
  })

  const finalHtml = renderTemplate(templateHtml, data)

  return (
    <div>
      <div onClick={() => handlePrint()} className="cursor-pointer inline-block">
        {customButton || (
          <button className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2 text-sm font-bold text-white hover:bg-slate-900 transition-colors">
            <Printer size={16} /> Cetak Dokumen
          </button>
        )}
      </div>
      <div className="hidden">
        <div ref={componentRef} className="bg-white text-slate-900 p-10 print:block" style={{ width: '210mm', minHeight: '297mm', margin: '0 auto' }} dangerouslySetInnerHTML={{ __html: finalHtml }} />
      </div>
    </div>
  )
}