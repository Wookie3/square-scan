import { createFileRoute, useNavigate } from '@tanstack/react-router'
import { Scanner } from '../components/Scanner'
import { useState } from 'react'
import { Search, Camera, Package } from 'lucide-react'

export const Route = createFileRoute('/')({
  component: Home
})

function Home() {
  const [sku, setSku] = useState('')
  const navigate = useNavigate()

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault()
    if (sku.trim()) {
      navigate({ 
        to: '/product/$sku', 
        params: { sku: sku.trim() } 
      })
    }
  }

  return (
    <div className="min-h-screen bg-marks-gray-bg p-6 md:p-12 flex flex-col items-center">
      {/* App Branding */}
      <header className="mb-12 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 bg-marks-navy rounded-2xl mb-4 shadow-lg shadow-blue-900/20">
          <Package className="w-10 h-10 text-white" />
        </div>
        <h1 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">
          Square <span className="text-marks-orange underline decoration-slate-200 underline-offset-8">Scan</span>
        </h1>
        <p className="text-slate-500 font-medium">Inventory & Price Check</p>
      </header>

      <div className="w-full max-w-md space-y-8">
        {/* Scanner Module */}
        <section className="bg-white p-2 rounded-[2rem] shadow-2xl shadow-slate-200 border border-slate-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-slate-50 flex items-center justify-between">
            <h2 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center">
              <Camera className="w-4 h-4 mr-2 text-marks-orange" />
              Live Scanner
            </h2>
            <span className="flex h-2 w-2 rounded-full bg-marks-orange animate-pulse"></span>
          </div>
          <Scanner />
        </section>

        {/* Divider */}
        <div className="relative py-4">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-slate-200"></div>
          </div>
          <div className="relative flex justify-center text-xs">
            <span className="px-4 bg-marks-gray-bg text-slate-400 font-black uppercase tracking-widest">Manual Entry Fallback</span>
          </div>
        </div>

        {/* Manual Search Form */}
        <form 
          onSubmit={handleSearch} 
          className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-100 border border-slate-100 transition-all focus-within:ring-2 focus-within:ring-marks-orange/20"
        >
          <div className="flex flex-col gap-4">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center px-1">
              <Search className="w-3.5 h-3.5 mr-2" />
              SKU or Barcode Number
            </label>
            <div className="flex gap-2">
              <input 
                type="text" 
                inputMode="numeric"
                value={sku}
                onChange={(e) => setSku(e.target.value)}
                placeholder="e.g. 12345678"
                className="flex-grow min-h-[54px] px-5 rounded-2xl border border-slate-100 bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-marks-orange transition-all font-mono text-lg font-bold text-slate-700 placeholder:text-slate-300"
              />
              <button 
                type="submit"
                disabled={!sku.trim()}
                className="bg-marks-navy text-white px-6 rounded-2xl font-black hover:bg-marks-navy-light transition-all active:scale-95 disabled:opacity-50 disabled:active:scale-100 shadow-lg shadow-slate-200"
              >
                GO
              </button>
            </div>
          </div>
        </form>

        {/* Bottom Status */}
        <footer className="pt-8 text-center">
          <p className="text-[10px] font-bold text-slate-300 uppercase tracking-widest">
            System V1.0.5 • Warehouse Connected
          </p>
        </footer>
      </div>
    </div>
  )
}