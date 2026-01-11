import { createFileRoute, Link } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { supabase } from '../lib/supabase'
import { fetchMarkData } from '../server/scraper'
import { upcSchema, skuSchema } from '../lib/validation'
import { Package, MapPin, ExternalLink, Search, ArrowLeft, RefreshCw } from 'lucide-react'
import { z } from 'zod'

// Server function to fetch internal warehouse data by UPC (for scanned items)
const getWarehouseDataByUPC = createServerFn({
  method: 'GET',
})
  .inputValidator((data: unknown) => z.object({ upc: z.coerce.string() }).parse(data))
  .handler(async ({ data }) => {
    const input = data
    try {
      const validatedUpc = upcSchema.parse(input.upc)

      const { data: dbData, error } = await supabase
        .from('Inventory')
        .select('*')
        .eq('UPC', validatedUpc)
        .single()

      if (error) {
        console.error('Supabase error:', error.message)
        return null
      }
      return dbData
    } catch (e) {
      console.error('UPC validation error:', e)
      return null
    }
  })

// Server function to fetch internal warehouse data by SKU (for manual entry)
const getWarehouseDataBySKU = createServerFn({
  method: 'GET',
})
  .inputValidator((data: unknown) => z.object({ sku: z.coerce.string() }).parse(data))
  .handler(async ({ data }) => {
    const input = data
    try {
      const validatedSku = skuSchema.parse(input.sku)

      // Try to find by 'SKU' column first (preferred) or 'Style Number' as fallback
      const { data: dbData, error } = await supabase
        .from('Inventory')
        .select('*')
        .or(`SKU.eq.${validatedSku},Style Number.eq.${validatedSku}`)
        .single()

      if (error) {
        console.error('Supabase error:', error.message)
        return null
      }
      return dbData
    } catch (e) {
      console.error('SKU validation error:', e)
      return null
    }
  })

export const Route = createFileRoute('/product/$sku')({
  loader: async ({ params: { sku } }) => {
    // Determine if input is UPC (12-13 digits) or SKU
    const isUPC = /^[0-9]{12,13}$/.test(sku)

    let warehouse = null
    let skuForScraper = sku

    if (isUPC) {
      // Input is UPC - look up in database and extract SKU
      warehouse = await getWarehouseDataByUPC({ data: { upc: sku } })
      if (warehouse?.SKU) {
        skuForScraper = warehouse.SKU
      }
    } else {
      // Input is SKU - look up by SKU
      warehouse = await getWarehouseDataBySKU({ data: { sku } })
    }


    interface MarketData {
      title: string;
      price: string;
      imageUrl: string;
      webLink: string;
    }

    const scraperApiKey = process.env.SCRAPER_API_KEY
    const market = await fetchMarkData({
      data: {
        sku: skuForScraper,
        apiKey: scraperApiKey
      }
    }) as MarketData | null

    return { warehouse, market, sku: skuForScraper }
  },
  component: ProductView
})

function ProductView() {
  const { warehouse, market, sku } = Route.useLoaderData()

  const hasData = warehouse || market

  if (!hasData) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="bg-white p-8 rounded-2xl shadow-xl max-w-md w-full border border-slate-200">
          <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6">
            <Search className="w-10 h-10 text-slate-400" />
          </div>
          <h1 className="text-2xl font-bold text-slate-800 mb-2">Item Not Found</h1>
          <p className="text-slate-500 mb-8">
            We couldn't find any data for SKU: <span className="font-mono font-bold text-slate-700">{sku}</span> in our warehouse or online.
          </p>
          <div className="space-y-3">
            <Link
              to="/"
              className="flex items-center justify-center w-full min-h-[44px] bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition-colors"
            >
              <ArrowLeft className="w-4 h-4 mr-2" />
              BACK TO SCANNER
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/" className="text-slate-500 hover:text-slate-800 transition-colors">
            <ArrowLeft className="w-6 h-6" />
          </Link>
          <div className="text-center">
            <h1 className="text-xs font-bold text-slate-400 uppercase tracking-widest">Product Details</h1>
            <p className="text-sm font-mono font-bold text-slate-700">{sku}</p>
          </div>
          <button
            onClick={() => window.location.reload()}
            className="text-slate-500 hover:text-emerald-600 transition-colors"
          >
            <RefreshCw className="w-5 h-5" />
          </button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-4 md:p-8 space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">

          {/* Warehouse Card */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-slate-800 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider flex items-center">
                <Package className="w-4 h-4 mr-2 text-emerald-400" />
                Warehouse Inventory
              </h2>
              <span className="text-[10px] bg-slate-700 px-2 py-1 rounded text-slate-300">INTERNAL</span>
            </div>

            {warehouse ? (
              <div className="p-6 flex-grow space-y-6">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Product Name</label>
                  <p className="text-xl font-bold text-slate-800 leading-tight mt-1">{warehouse.Style}</p>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-100 pt-6">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Status</label>
                    <p className={`text-lg font-black mt-1 ${warehouse['SKU Status'] === 'Active' ? 'text-emerald-600' : 'text-amber-500'}`}>
                      {warehouse['SKU Status']}
                    </p>
                    <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">Inventory Status</p>
                  </div>
                  <div className="text-right">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Category</label>
                    <div className="flex items-center justify-end mt-1">
                      <MapPin className="w-4 h-4 text-slate-400 mr-1" />
                      <p className="text-xl font-mono font-black text-slate-700">{warehouse['Category Number']}</p>
                    </div>
                    <p className="text-[10px] text-slate-400 uppercase font-bold mt-1">{warehouse.Category}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 border-t border-slate-50 pt-4">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Colour</label>
                    <p className="text-sm font-bold text-slate-700">{warehouse.Colour}</p>
                  </div>
                  <div className="text-right">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Size</label>
                    <p className="text-sm font-bold text-slate-700">{warehouse.Size} {warehouse['Size 2'] ? `/ ${warehouse['Size 2']}` : ''}</p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="p-12 flex-grow flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <Package className="w-8 h-8 text-slate-200" />
                </div>
                <p className="text-slate-400 font-medium">No local warehouse data</p>
                <p className="text-[10px] text-slate-300 uppercase mt-1">SKU NOT IN DATABASE</p>
              </div>
            )}
          </section>

          {/* Market Card */}
          <section className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden flex flex-col">
            <div className="bg-emerald-600 text-white px-6 py-4 flex items-center justify-between">
              <h2 className="text-sm font-black uppercase tracking-wider flex items-center">
                <ExternalLink className="w-4 h-4 mr-2 text-emerald-200" />
                Live Market Data
              </h2>
              <span className="text-[10px] bg-emerald-700 px-2 py-1 rounded text-emerald-100">LIVE: MARKS.COM</span>
            </div>

            {market ? (
              <div className="p-6 flex-grow flex flex-col">
                <div className="bg-slate-50 rounded-xl p-4 mb-6 flex items-center justify-center aspect-video overflow-hidden">
                  {market.imageUrl ? (
                    <img
                      src={market.imageUrl}
                      alt={market.title}
                      className="max-h-full object-contain mix-blend-multiply"
                    />
                  ) : (
                    <div className="text-slate-200">No Image Available</div>
                  )}
                </div>

                <div className="space-y-4 mb-8">
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Market Listing</label>
                    <p className="text-lg font-bold text-slate-800 leading-tight mt-1 line-clamp-2">{market.title}</p>
                  </div>
                  <div>
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Current Price</label>
                    <p className="text-4xl font-black text-emerald-600 mt-1">{market.price}</p>
                  </div>
                </div>

                <div className="mt-auto pt-4">
                  <a
                    href={market.webLink}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center justify-center w-full min-h-[44px] bg-slate-800 text-white rounded-xl font-bold hover:bg-slate-700 transition-all active:scale-95 shadow-lg shadow-slate-200"
                  >
                    VIEW ON MARKS.COM
                    <ExternalLink className="w-4 h-4 ml-2" />
                  </a>
                </div>
              </div>
            ) : (
              <div className="p-12 flex-grow flex flex-col items-center justify-center text-center">
                <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                  <RefreshCw className="w-8 h-8 text-slate-200" />
                </div>
                <p className="text-slate-400 font-medium">Could not fetch live data</p>
                <p className="text-[10px] text-slate-300 uppercase mt-1">SCRAPER TIMEOUT OR BLOCKED</p>
              </div>
            )}
          </section>

        </div>
      </main>
    </div>
  )
}
