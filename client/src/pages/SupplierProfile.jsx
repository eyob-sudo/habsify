import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import toast from '../services/toastService'
import { cn } from '../utils/cn'
import { useQuery } from '@tanstack/react-query'
import { getSuppliers, getSupplierTransactions, exportSupplierTransactions } from '../services/supplierService'
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, Download, ArrowLeft } from 'lucide-react'

function formatCurrency(v) {
  if (v == null) return ''
  return `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const sortOptions = [
  { k: 'date', l: 'Date (oldest first)' },
  { k: '-date', l: 'Date (newest first)' },
  { k: 'quantity', l: 'Quantity (low → high)' },
  { k: '-quantity', l: 'Quantity (high → low)' },
  { k: 'unit_price', l: 'Unit Price (low → high)' },
  { k: '-unit_price', l: 'Unit Price (high → low)' },
  { k: 'total', l: 'Total (low → high)' },
  { k: '-total', l: 'Total (high → low)' },
  { k: 'status', l: 'Status (A → Z)' },
  { k: '-status', l: 'Status (Z → A)' },
  { k: 'item__code', l: 'Item Code (A → Z)' },
  { k: '-item__code', l: 'Item Code (Z → A)' },
]

export default function SupplierProfile() {
  const { id } = useParams()
  const [searchQuery, setSearchQuery] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [ordering, setOrdering] = useState('-date')
  const [sortOpen, setSortOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [txPage, setTxPage] = useState(1)

  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedSearch(searchQuery)
      setTxPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  useEffect(() => {
    function onDoc() { setSortOpen(false); setExportOpen(false) }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  const { data: suppliersData } = useQuery({
    queryKey: ['suppliers', 1, '', ''],
    queryFn: () => getSuppliers({ page: 1 }),
    staleTime: 60 * 1000,
  })

  const supplier = (suppliersData?.results ?? []).find(x => Number(x.id) === Number(id))

  const { data: txData, isLoading: loading } = useQuery({
    queryKey: ['supplierTransactions', id, txPage, debouncedSearch, ordering],
    queryFn: () => getSupplierTransactions(id, { search: debouncedSearch, ordering, page: txPage }),
    placeholderData: (prev) => prev,
    staleTime: 30 * 1000,
  })

  const transactions = txData?.results ?? (Array.isArray(txData) ? txData : [])
  const txMeta = txData && !Array.isArray(txData) ? txData : null

  async function downloadExport(format) {
    if (!transactions.length && !txMeta?.count) {
      toast.error('No transactions to export')
      setExportOpen(false)
      return
    }
    const toastId = toast.loading(`Exporting ${format.toUpperCase()}...`)
    try {
      await exportSupplierTransactions(id, format)
      toast.update(toastId, { render: 'Export downloaded', type: 'success' })
    } catch {
      toast.update(toastId, { render: 'Failed to export', type: 'error' })
    } finally {
      setExportOpen(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pt-20 pb-20 md:pb-0">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 md:ml-64 w-full transition-all duration-300">

          <div className="mb-8">
            <Link to="/suppliers" className="inline-flex items-center gap-2 text-gray-500 hover:text-primary transition-colors font-medium mb-4">
              <ArrowLeft size={16} />
              <span className="text-sm">Back to Suppliers</span>
            </Link>
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 border-b-2 border-primary inline-block pb-1">
              {supplier?.name || 'Supplier'}
            </h2>
            <p className="text-gray-500 text-sm mt-2">Supplier details and transaction history</p>
          </div>

          <div className="bg-white border text-sm md:text-base border-gray-200 rounded-2xl shadow-sm mb-8 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 md:p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/30">
              <div className="relative w-full md:w-96 group flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="text-gray-400 group-focus-within:text-primary transition-colors" size={18} />
                </div>
                <input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="Search transactions..."
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                />
              </div>

              <div className="relative flex items-center gap-3 w-full md:w-auto">
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSortOpen(v => !v); setExportOpen(false) }}
                    className="px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                  >
                    <ArrowUpDown size={16} />
                    <span className="hidden sm:inline">Sort</span>
                  </button>
                  {sortOpen && (
                    <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
                      <div className="py-2 max-h-64 overflow-y-auto">
                        {sortOptions.map(s => (
                          <button
                            key={s.k}
                            onClick={(e) => { e.stopPropagation(); setOrdering(s.k); setSortOpen(false) }}
                            className={cn(
                              'w-full text-left px-4 py-2 text-sm transition-colors',
                              ordering === s.k ? 'bg-primary/5 text-primary font-medium' : 'text-gray-700 hover:bg-gray-50'
                            )}
                          >
                            {s.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setExportOpen(v => !v); setSortOpen(false) }}
                    className="px-5 py-2 bg-primary text-white font-medium rounded-lg hover:bg-primary/95 transition-colors flex items-center gap-2"
                  >
                    <Download size={18} />
                    <span>Export</span>
                  </button>
                  {exportOpen && (
                    <div className="absolute top-full right-0 mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
                      <div className="py-2">
                        <button onClick={(e) => { e.stopPropagation(); downloadExport('csv') }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Export CSV</button>
                        <button onClick={(e) => { e.stopPropagation(); downloadExport('pdf') }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">Export PDF</button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Table */}
            <div className="p-4 md:p-5">
              <h3 className="text-lg font-bold text-gray-900 mb-4 border-b pb-2 border-gray-200 inline-block">
                Transaction History
              </h3>

              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-left">
                  <thead className="bg-gray-50">
                    <tr className="text-xs font-semibold text-gray-500 uppercase">
                      {['Date', 'Product Code', 'Units', 'Unit Price', 'Payable', 'Payment Sent', 'Bank', 'Remain'].map(h => (
                        <th key={h} className="py-3 px-4 border-b border-gray-200">{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr><td colSpan={8} className="p-8 text-center text-gray-500">Loading transactions...</td></tr>
                    ) : transactions.length === 0 ? (
                      <tr><td colSpan={8} className="p-8 text-center text-gray-500">No transactions found.</td></tr>
                    ) : transactions.map((t, i) => (
                      <tr key={t.id ?? i} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4 text-sm font-semibold text-gray-600">{t.date}</td>
                        <td className="py-3 px-4 text-sm font-medium text-gray-900">{t.product_code}</td>
                        <td className="py-3 px-4 text-sm text-gray-900">{t.units}</td>
                        <td className="py-3 px-4 text-sm text-gray-900">{formatCurrency(t.unit_price)}</td>
                        <td className="py-3 px-4 text-sm text-gray-900">{formatCurrency(t.payable)}</td>
                        <td className={cn('py-3 px-4 text-sm font-semibold', Number(t.payment_sent) > 0 ? 'text-green-600' : 'text-gray-900')}>
                          {t.payment_sent}
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-900">{t.bank}</td>
                        <td className={cn('py-3 px-4 text-sm font-semibold', Number(t.remain) > 0 ? 'text-red-600' : 'text-gray-900')}>
                          {formatCurrency(t.remain)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-4">
                {loading ? (
                  <div className="p-6 text-center text-gray-500">Loading transactions...</div>
                ) : transactions.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">No transactions found.</div>
                ) : transactions.map((t, i) => (
                  <div key={t.id ?? i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-xs font-bold text-gray-500">{t.date}</div>
                        <div className="text-sm font-semibold text-gray-900">{t.product_code}</div>
                      </div>
                      <div className={cn('text-sm font-bold', Number(t.remain) > 0 ? 'text-red-600' : 'text-gray-900')}>
                        {formatCurrency(t.remain)}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                      <div><span className="text-gray-500 block font-medium">Units</span><span className="font-semibold">{t.units}</span></div>
                      <div><span className="text-gray-500 block font-medium">Price</span><span className="font-semibold">{formatCurrency(t.unit_price)}</span></div>
                      <div><span className="text-gray-500 block font-medium">Payable</span><span className="font-semibold">{formatCurrency(t.payable)}</span></div>
                      <div><span className="text-gray-500 block font-medium">Sent</span><span className="text-green-600 font-bold">{t.payment_sent}</span></div>
                    </div>
                    <div className="mt-2 text-right text-xs text-gray-400">
                      Bank: <span className="font-semibold text-gray-900">{t.bank}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pagination */}
            {(txMeta?.previous || txMeta?.next) && (
              <div className="flex items-center justify-between p-4 border-t border-gray-200">
                <span className="text-sm text-gray-500">
                  Page {txPage} of {txMeta?.count ? Math.ceil(txMeta.count / (transactions.length || 10)) : 1}
                </span>
                <div className="flex gap-2">
                  <button
                    onClick={() => setTxPage(p => Math.max(1, p - 1))}
                    disabled={!txMeta?.previous}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span className="hidden sm:inline">Previous</span>
                  </button>
                  <button
                    onClick={() => setTxPage(p => p + 1)}
                    disabled={!txMeta?.next}
                    className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 flex items-center gap-1"
                  >
                    <span className="hidden sm:inline">Next</span>
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}
          </div>
        </main>
      </div>
    </div>
  )
}