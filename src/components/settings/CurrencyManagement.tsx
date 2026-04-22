"use client"

import { useState, useEffect } from "react"
import { getCurrencies, getExchangeRates, createCurrency, createExchangeRate } from "@/app/actions/currency"

interface CurrencyManagementProps {
  organizationId: string
}

export default function CurrencyManagement({ organizationId }: CurrencyManagementProps) {
  const [currencies, setCurrencies] = useState<any[]>([])
  const [exchangeRates, setExchangeRates] = useState<any[]>([])
  const [isCurrencyOpen, setIsCurrencyOpen] = useState(false)
  const [isRateOpen, setIsRateOpen] = useState(false)
  const [activeTab, setActiveTab] = useState("currencies")
  const [currencyForm, setCurrencyForm] = useState({
    code: "",
    name: "",
    symbol: "",
    isBase: false
  })
  const [rateForm, setRateForm] = useState({
    fromCurrencyId: "",
    toCurrencyId: "",
    rate: "",
    effectiveDate: new Date().toISOString().split('T')[0]
  })

  useEffect(() => {
    loadData()
  }, [organizationId])

  const loadData = async () => {
    try {
      const [currenciesData, ratesData] = await Promise.all([
        getCurrencies(organizationId),
        getExchangeRates(organizationId)
      ])
      setCurrencies(currenciesData)
      setExchangeRates(ratesData)
    } catch (error) {
      console.error("Error loading data:", error)
    }
  }

  const handleCreateCurrency = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createCurrency({
        organizationId,
        code: currencyForm.code,
        name: currencyForm.name,
        symbol: currencyForm.symbol,
        isBase: currencyForm.isBase
      })
      setIsCurrencyOpen(false)
      setCurrencyForm({ code: "", name: "", symbol: "", isBase: false })
      loadData()
    } catch (error) {
      console.error("Error creating currency:", error)
    }
  }

  const handleCreateRate = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await createExchangeRate({
        organizationId,
        fromCurrencyId: rateForm.fromCurrencyId,
        toCurrencyId: rateForm.toCurrencyId,
        rate: parseFloat(rateForm.rate),
        effectiveDate: new Date(rateForm.effectiveDate)
      })
      setIsRateOpen(false)
      setRateForm({
        fromCurrencyId: "",
        toCurrencyId: "",
        rate: "",
        effectiveDate: new Date().toISOString().split('T')[0]
      })
      loadData()
    } catch (error) {
      console.error("Error creating exchange rate:", error)
    }
  }

  return (
    <div className="p-6">
      <div className="flex gap-2 mb-4">
        <button
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "currencies"
              ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
          }`}
          onClick={() => setActiveTab("currencies")}
        >
          Mata Uang
        </button>
        <button
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === "rates"
              ? "bg-blue-50 text-blue-600 hover:bg-blue-100"
              : "bg-slate-50 text-slate-600 hover:bg-slate-100"
          }`}
          onClick={() => setActiveTab("rates")}
        >
          Kurs
        </button>
      </div>

      {activeTab === "currencies" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">Kelola mata uang yang digunakan dalam transaksi</p>
            <button
              onClick={() => setIsCurrencyOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Tambah Mata Uang
            </button>
          </div>

          <div className="grid gap-3">
            {currencies.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-center text-slate-500 text-sm">Belum ada mata uang</p>
              </div>
            ) : (
              currencies.map((currency) => (
                <div key={currency.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{currency.code}</span>
                        <span className="text-slate-500">{currency.name}</span>
                        <span className="text-xl">{currency.symbol}</span>
                      </div>
                    </div>
                    {currency.isBase && (
                      <span className="px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                        Mata Uang Dasar
                      </span>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {activeTab === "rates" && (
        <div className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-slate-500">Kelola kurs mata uang untuk konversi</p>
            <button
              onClick={() => setIsRateOpen(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors text-sm"
            >
              Tambah Kurs
            </button>
          </div>

          <div className="grid gap-3">
            {exchangeRates.length === 0 ? (
              <div className="bg-white rounded-xl border border-slate-200 p-6">
                <p className="text-center text-slate-500 text-sm">Belum ada kurs</p>
              </div>
            ) : (
              exchangeRates.map((rate) => (
                <div key={rate.id} className="bg-white rounded-xl border border-slate-200 p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <div className="font-semibold">
                        1 {rate.fromCurrency?.code} = {rate.rate.toLocaleString('id-ID')} {rate.toCurrency?.code}
                      </div>
                      <p className="text-xs text-slate-500 mt-1">
                        Efektif: {new Date(rate.effectiveDate).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {isCurrencyOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Tambah Mata Uang</h3>
            <form onSubmit={handleCreateCurrency} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Kode (USD, EUR, dll)</label>
                <input
                  placeholder="USD"
                  value={currencyForm.code}
                  onChange={(e) => setCurrencyForm({ ...currencyForm, code: e.target.value.toUpperCase() })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Nama</label>
                <input
                  placeholder="US Dollar"
                  value={currencyForm.name}
                  onChange={(e) => setCurrencyForm({ ...currencyForm, name: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Simbol</label>
                <input
                  placeholder="$"
                  value={currencyForm.symbol}
                  onChange={(e) => setCurrencyForm({ ...currencyForm, symbol: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="checkbox"
                  id="isBase"
                  checked={currencyForm.isBase}
                  onChange={(e) => setCurrencyForm({ ...currencyForm, isBase: e.target.checked })}
                  className="rounded"
                />
                <label htmlFor="isBase" className="text-sm">Jadikan sebagai mata uang dasar</label>
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsCurrencyOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {isRateOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">Tambah Kurs</h3>
            <form onSubmit={handleCreateRate} className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Dari</label>
                <select
                  value={rateForm.fromCurrencyId}
                  onChange={(e) => setRateForm({ ...rateForm, fromCurrencyId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                >
                  <option value="">Pilih mata uang</option>
                  {currencies.map((currency) => (
                    <option key={currency.id} value={currency.id}>
                      {currency.code} - {currency.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Ke</label>
                <select
                  value={rateForm.toCurrencyId}
                  onChange={(e) => setRateForm({ ...rateForm, toCurrencyId: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                >
                  <option value="">Pilih mata uang</option>
                  {currencies.map((currency) => (
                    <option key={currency.id} value={currency.id}>
                      {currency.code} - {currency.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Kurs</label>
                <input
                  type="number"
                  step="0.0001"
                  placeholder="15000.00"
                  value={rateForm.rate}
                  onChange={(e) => setRateForm({ ...rateForm, rate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tanggal Efektif</label>
                <input
                  type="date"
                  value={rateForm.effectiveDate}
                  onChange={(e) => setRateForm({ ...rateForm, effectiveDate: e.target.value })}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setIsRateOpen(false)}
                  className="flex-1 px-4 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 transition-colors"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  Simpan
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
