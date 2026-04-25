"use client"

import { useState, useEffect } from "react"
import { Save, Code } from "lucide-react"
import { getDocumentTemplate, saveDocumentTemplate } from "@/app/actions/document-template"

const DOC_TYPES = [
  { value: "INVOICE", label: "Invoice (Faktur Penjualan)", variables: "{{invoiceNumber}}, {{customerName}}, {{date}}, {{total}}, {{#each items}}...{{/each}}" },
  { value: "PO", label: "Purchase Order (PO)", variables: "{{poNumber}}, {{supplierName}}, {{date}}, {{total}}" },
  { value: "DO", label: "Delivery Order (Surat Jalan)", variables: "{{doNumber}}, {{customerName}}, {{date}}, {{driverName}}" },
  { value: "RECEIPT", label: "Bon Penerimaan Barang (GRN)", variables: "{{poNumber}}, {{receivedDate}}, {{warehouse}}" },
  { value: "RETURN", label: "Nota Retur (Sales Return)", variables: "{{invoiceNumber}}, {{customerName}}, {{returnDate}}" },
]

const DEFAULT_HTML = `
<div style="font-family: Arial, sans-serif; padding: 20px; color: #333;">
  <h1 style="color: #2563eb; border-bottom: 2px solid #2563eb;">INVOICE</h1>
  <p><strong>Nomor:</strong> {{invoiceNumber}}</p>
  <p><strong>Tanggal:</strong> {{date}}</p>
  <p><strong>Kepada:</strong> {{customerName}}</p>
  
  <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
    <tr>
      <th style="border: 1px solid #ccc; padding: 8px; text-align: left; background: #f8fafc;">Deskripsi Barang</th>
      <th style="border: 1px solid #ccc; padding: 8px; text-align: right; background: #f8fafc;">Harga</th>
    </tr>
    {{#each items}}
    <tr>
      <td style="border: 1px solid #ccc; padding: 8px;">{{description}} (x{{quantity}})</td>
      <td style="border: 1px solid #ccc; padding: 8px; text-align: right;">Rp {{total}}</td>
    </tr>
    {{/each}}
  </table>
  <h3 style="text-align: right; margin-top: 20px;">Grand Total: Rp {{total}}</h3>
</div>
`.trim()

export default function DocumentTemplateSettings() {
  const [docType, setDocType] = useState(DOC_TYPES[0].value)
  const [htmlContent, setHtmlContent] = useState(DEFAULT_HTML)
  const [isSaving, setIsSaving] = useState(false)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const fetchTemplate = async () => {
      setLoading(true)
      const res = await getDocumentTemplate(docType)
      if (res.success && res.template) {
        setHtmlContent(res.template.contentHtml)
      } else {
        // Fallback HTML if no template found
        setHtmlContent(`<h1>Template ${docType}</h1>\n<p>Nomor: {{docNumber}}</p>`)
      }
      setLoading(false)
    }
    fetchTemplate()
  }, [docType])

  const handleSave = async () => {
    setIsSaving(true)
    const res = await saveDocumentTemplate({
      type: docType,
      name: `Template ${docType} Custom`,
      contentHtml: htmlContent
    })
    if (res.success) alert("Template berhasil disimpan!")
    else alert("Gagal menyimpan template: " + res.error)
    setIsSaving(false)
  }

  const activeDocMeta = DOC_TYPES.find(d => d.value === docType)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-6 space-y-6">
      <div className="flex justify-between items-center border-b pb-4">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Desain Template Cetak</h2>
          <p className="text-sm text-slate-500">Sesuaikan format dokumen menggunakan HTML (Custom Print Layout)</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Editor Side */}
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-bold text-slate-700 mb-1">Pilih Jenis Dokumen</label>
            <select 
              value={docType} 
              onChange={(e) => setDocType(e.target.value)}
              className="w-full rounded-lg border border-slate-300 p-2.5 text-sm focus:border-blue-500 focus:outline-none"
            >
              {DOC_TYPES.map(doc => (
                <option key={doc.value} value={doc.value}>{doc.label}</option>
              ))}
            </select>
          </div>

          <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
            <p className="text-xs font-bold text-slate-600 mb-1 flex items-center gap-1"><Code size={14} /> Variabel Tersedia (Gunakan format {{}}):</p>
            <code className="text-xs text-blue-600 break-words">{String(activeDocMeta?.variables || "")}</code>
          </div>

          <textarea
            value={htmlContent}
            onChange={(e) => setHtmlContent(e.target.value)}
            className="w-full h-[400px] font-mono text-sm p-4 rounded-lg border border-slate-300 bg-slate-900 text-green-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
            disabled={loading}
          />

          <button onClick={handleSave} disabled={isSaving || loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 flex justify-center items-center gap-2">
            <Save size={18} /> {isSaving ? "Menyimpan..." : "Simpan Template HTML"}
          </button>
        </div>

        {/* Preview Side */}
        <div>
          <label className="block text-sm font-bold text-slate-700 mb-1">Pratinjau Langsung (Preview)</label>
          <div 
            className="w-full h-[600px] border-2 border-dashed border-slate-300 rounded-lg p-4 overflow-auto bg-white"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
          />
        </div>
      </div>
    </div>
  )
}