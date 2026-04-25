"use client"

import { useRef } from "react"
import { useReactToPrint } from "react-to-print"
import { Printer } from "lucide-react"

type DeliveryOrderPrintProps = {
  deliveryOrder: any // Ganti dengan tipe DeliveryOrder dari Prisma Anda
  companyProfile?: any // Data dari SettingsTemplate
}

export default function DeliveryOrderPrintLayout({ deliveryOrder, companyProfile }: DeliveryOrderPrintProps) {
  const componentRef = useRef<HTMLDivElement>(null)
  
  const handlePrint = useReactToPrint({
    contentRef: componentRef,
    documentTitle: `Surat-Jalan-${deliveryOrder?.code || 'DO'}`,
  })

  if (!deliveryOrder) return null

  return (
    <div>
      {/* Tombol Cetak (Tampil di layar, disembunyikan saat mode cetak) */}
      <button
        onClick={() => handlePrint()}
        className="flex items-center gap-2 rounded-lg bg-purple-700 px-4 py-2 text-sm font-bold text-white hover:bg-purple-800 transition-colors"
      >
        <Printer size={16} /> Cetak Surat Jalan (DO)
      </button>

      {/* Area Render Cetak (Hidden di layar utama, absolute block saat print) */}
      <div className="hidden">
        <div 
          ref={componentRef} 
          className="bg-white text-slate-900 p-10 print:block" 
          style={{ width: '210mm', minHeight: '297mm', margin: '0 auto' }}
        >
          
          {/* KOP PERUSAHAAN */}
          <div className="flex justify-between items-center border-b-2 border-slate-800 pb-6 mb-6">
            <div className="flex items-center gap-4">
              {companyProfile?.logoUrl ? (
                <img src={companyProfile.logoUrl} alt="Logo" className="h-16 object-contain" />
              ) : (
                <div className="h-16 w-16 bg-slate-200 flex items-center justify-center rounded-lg font-bold text-slate-400">LOGO</div>
              )}
              <div>
                <h2 className="font-black text-2xl text-slate-800 uppercase tracking-wide">
                  {companyProfile?.companyName || "NAMA PERUSAHAAN PT"}
                </h2>
                <p className="text-sm text-slate-600 mt-1 max-w-sm leading-relaxed">
                  {companyProfile?.address || "Alamat perusahaan belum diatur di Pengaturan."}<br/>
                  {companyProfile?.phone && `Telp: ${companyProfile.phone}`}
                </p>
              </div>
            </div>
            <div className="text-right">
              <h1 className="text-3xl font-black text-slate-800 tracking-tight">SURAT JALAN</h1>
              <p className="text-slate-500 mt-1 font-bold text-lg">DO: {deliveryOrder.code}</p>
            </div>
          </div>

          {/* INFO PENGIRIMAN */}
          <div className="flex justify-between mb-8 text-sm">
            <div className="p-4 border border-slate-300 rounded-lg w-[48%]">
              <p className="font-bold text-slate-500 uppercase tracking-wider mb-2 text-xs">Dikirim Kepada (Penerima):</p>
              <p className="font-bold text-base text-slate-800">{deliveryOrder.customer?.name}</p>
              <p className="text-slate-700 mt-1 leading-relaxed">{deliveryOrder.deliveryAddress || deliveryOrder.customer?.address || "Alamat tidak tersedia"}</p>
              <p className="text-slate-700 mt-2"><span className="font-medium">Attn:</span> {deliveryOrder.customer?.contactPerson || "-"}</p>
            </div>
            <div className="w-[48%] space-y-2">
              <div className="flex justify-between"><span className="font-bold text-slate-500">Tanggal Pengiriman:</span> <span className="font-medium">{new Date(deliveryOrder.deliveryDate).toLocaleDateString("id-ID")}</span></div>
              <div className="flex justify-between"><span className="font-bold text-slate-500">No. Referensi (SO):</span> <span className="font-medium">{deliveryOrder.salesOrder?.code || "-"}</span></div>
              <div className="flex justify-between"><span className="font-bold text-slate-500">Nama Pengemudi:</span> <span className="font-medium">{deliveryOrder.driverName || "-"}</span></div>
              <div className="flex justify-between"><span className="font-bold text-slate-500">No. Polisi Kendaraan:</span> <span className="font-medium uppercase">{deliveryOrder.vehiclePlate || "-"}</span></div>
            </div>
          </div>

          {/* TABEL BARANG (TANPA HARGA) */}
          <table className="w-full text-left border-collapse mb-8">
            <thead>
              <tr className="bg-slate-100 border-y-2 border-slate-800">
                <th className="py-3 px-4 font-bold text-slate-800 text-sm w-12 text-center">No</th>
                <th className="py-3 px-4 font-bold text-slate-800 text-sm">Deskripsi Barang</th>
                <th className="py-3 px-4 font-bold text-slate-800 text-sm text-center w-24">Qty</th>
                <th className="py-3 px-4 font-bold text-slate-800 text-sm w-48">Keterangan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-300 border-b-2 border-slate-800">
              {(deliveryOrder.items || []).map((item: any, idx: number) => (
                <tr key={item.id || idx}>
                  <td className="py-4 px-4 text-sm text-slate-800 text-center">{idx + 1}</td>
                  <td className="py-4 px-4 text-sm text-slate-800 font-medium">
                    {item.item?.name || item.description}
                    <div className="text-xs text-slate-500 font-normal mt-0.5">Kode: {item.item?.code || "-"}</div>
                  </td>
                  <td className="py-4 px-4 text-sm text-center font-bold text-slate-900">{item.quantity} {item.item?.unit || "Pcs"}</td>
                  <td className="py-4 px-4 text-sm text-slate-600">{item.notes || "-"}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* SIGNATURE BLOCK */}
          <div className="grid grid-cols-3 gap-8 mt-16 text-center text-sm">
            <div><p className="mb-20 font-bold text-slate-600">Penerima Barang,</p><div className="border-b border-slate-400 mx-8"></div><p className="mt-2 text-slate-500">(Nama Jelas & Stempel)</p></div>
            <div><p className="mb-20 font-bold text-slate-600">Pengemudi / Ekspedisi,</p><div className="border-b border-slate-400 mx-8"></div><p className="mt-2 text-slate-500">({deliveryOrder.driverName || "Nama Jelas"})</p></div>
            <div><p className="mb-20 font-bold text-slate-600">Hormat Kami,</p><div className="border-b border-slate-400 mx-8"></div><p className="mt-2 text-slate-500">(Bagian Pengiriman)</p></div>
          </div>
        </div>
      </div>
    </div>
  )
}