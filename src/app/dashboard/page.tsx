"use client"

import React from "react"
import { Card, CardHeader, CardTitle, CardBody, CardFooter } from "@/components/ui/Card"
import { Button } from "@/components/ui/Button"

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold text-slate-900">Dashboard Utama</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card>
          <CardHeader>
            <CardTitle>Total Penjualan</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-black text-slate-800">Rp 125.000.000</p>
            <p className="text-sm font-medium text-emerald-600 mt-2">↑ 12% dari bulan lalu</p>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Invoice Jatuh Tempo</CardTitle>
          </CardHeader>
          <CardBody>
            <p className="text-3xl font-black text-slate-800">12</p>
            <p className="text-sm text-slate-500 mt-2">Segera lakukan penagihan kepada pelanggan.</p>
          </CardBody>
          <CardFooter>
            <Button variant="outline" size="sm" className="w-full">
              Lihat Daftar Invoice
            </Button>
          </CardFooter>
        </Card>
      </div>
    </div>
  )
}