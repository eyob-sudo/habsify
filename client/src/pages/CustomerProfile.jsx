import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import toast from '../services/toastService'
import { cn } from '../utils/cn'
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, Download, ArrowLeft } from 'lucide-react'

function formatCurrency(v) {
  if (v == null) return ''
  return `$${Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function CustomerProfile() {
  const { id } = useParams()
  const [transactions, setTransactions] = useState([])
  const [loading, setLoading] = useState(false)
  const [customer, setCustomer] = useState(null)
  const [loadingCustomer, setLoadingCustomer] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [ordering, setOrdering] = useState('-date')
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [exportOpen, setExportOpen] = useState(false)
  const [txPage, setTxPage] = useState(1)
  const [txMeta, setTxMeta] = useState(null)

  useEffect(() => {
    let mounted = true
    async function loadCustomer() {
      try {
        setLoadingCustomer(true)
        const svc = await import('../services/crmService')
        const custData = await svc.getCustomers()
        const cList = Array.isArray(custData) ? custData : (custData?.results ?? [])
        const c = cList.find(x => Number(x.id) === Number(id)) || null
        if (mounted) setCustomer(c)
      } catch (err) {
        if (mounted) setCustomer(null)
      } finally {
        if (mounted) setLoadingCustomer(false)
      }
    }
    loadCustomer()
    return () => { mounted = false }
  }, [id])

  useEffect(() => {
    let mounted = true
    function onDoc() {
      if (sortOpen || filterOpen || exportOpen) {
        setSortOpen(false)
        setFilterOpen(false)
        setExportOpen(false)
      }
    }
    const timer = setTimeout(async () => {
      if (!mounted) return
      try {
        setLoading(true)
        const svc = await import('../services/crmService')
        const txData = await svc.getCustomerTransactions(id, { search: searchQuery, ordering, page: txPage })
        const txList = Array.isArray(txData) ? txData : (txData?.results ?? [])
        if (mounted) {
          setTransactions(txList)
          if (txData && !Array.isArray(txData)) {
            setTxMeta({ count: txData.count, next: txData.next, previous: txData.previous, pageSize: (txData.results || []).length })
          } else {
            setTxMeta({ count: txList.length, next: null, previous: null, pageSize: txList.length })
          }
        }
      } catch (err) {
        if (mounted) setTransactions([])
        toast.error('Failed to load transactions')
      } finally {
        if (mounted) setLoading(false)
      }
    }, 300)
    document.addEventListener('click', onDoc)
    return () => { mounted = false; clearTimeout(timer); document.removeEventListener('click', onDoc) }
  }, [id, txPage, searchQuery, ordering, exportOpen, filterOpen, sortOpen])

  async function downloadExport(format) {
    const hasTx = (txMeta && txMeta.count > 0) || (transactions && transactions.length > 0)
    if (!hasTx) {
      toast.error('No transactions to export')
      setExportOpen(false)
      return
    }
    const t = toast.loading(`Exporting ${format.toUpperCase()}...`)
    try {
      const svc = await import('../services/crmService')
      await svc.exportCustomerTransactions(id, format)
      if (t && t.dismiss) t.dismiss()
      toast.success('Export downloaded')
    } catch (err) {
      console.error('Export error', err)
      if (t && t.dismiss) t.dismiss()
      toast.error('Failed to export')
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
            <div className="flex items-center gap-3 mb-3 md:mb-4">
              <Link to="/crm" className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors font-medium">
                <ArrowLeft size={16} />
                <span className="text-sm">Back to CRM</span>
              </Link>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 border-b-2 border-primary inline-block pb-1">{loadingCustomer ? 'Loading...' : (customer?.name || 'Customer not found')}</h2>
                <p className="text-gray-500 text-sm mt-2">Comprehensive customer information and relationship management</p>
              </div>
            </div>
          </div>

          <div className="bg-white border text-sm md:text-base border-gray-200 rounded-2xl shadow-sm mb-8 overflow-hidden">
            <div className="p-4 md:p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/30">
              <div className="relative w-full md:w-96 group flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="text-gray-400 group-focus-within:text-primary transition-colors" size={18} />
                </div>
                <input
                  value={searchQuery}
                  onChange={e=>setSearchQuery(e.target.value)}
                  placeholder="Search transactions..."
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                />
              </div>

              <div className="relative flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={(e)=>{ e.stopPropagation(); setSortOpen(v=>!v); setFilterOpen(false)}}
                  id="sortByTx"
                  className="w-full md:w-auto px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm text-gray-700 hover:bg-gray-50 !rounded-button flex items-center justify-center gap-2 shadow-sm"
                >
                  <ArrowUpDown size={16} />
                  <span className="hidden sm:inline">Sort</span>
                </button>
                {sortOpen && (
                  <div id="sortDropdownTx" className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
                    <div className="py-2 max-h-64 overflow-y-auto">
                      {[
                        { "k": "date", "l": "Date (oldest first)" },
                        { "k": "-date", "l": "Date (newest first)" },
                        { "k": "quantity", "l": "Quantity (low → high)" },
                        { "k": "-quantity", "l": "Quantity (high → low)" },
                        { "k": "unit_price", "l": "Unit Price (low → high)" },
                        { "k": "-unit_price", "l": "Unit Price (high → low)" },
                        { "k": "total", "l": "Total (low → high)" },
                        { "k": "-total", "l": "Total (high → low)" },
                        { "k": "status", "l": "Status (A → Z)" },
                        { "k": "-status", "l": "Status (Z → A)" },
                        { "k": "item__code", "l": "Item Code (A → Z)" },
                        { "k": "-item__code", "l": "Item Code (Z → A)" }
                      ].map(s => (
                        <button
                          key={s.k}
                          onClick={(ev)=>{ ev.stopPropagation(); setOrdering(s.k); setSortOpen(false)}}
                          className={cn("w-full text-left px-4 py-2 text-sm transition-colors", ordering === s.k ? "bg-primary/5 text-primary font-medium" : "text-gray-700 hover:bg-gray-50")}
                        >
                          {s.l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={(e)=>{ e.stopPropagation(); setExportOpen(v=>!v); setSortOpen(false); setFilterOpen(false)}}
                  className="w-full md:w-auto px-5 py-2 !rounded-button bg-primary text-white font-medium hover:bg-primary/95 transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <Download size={18} />
                  <span>Export</span>
                </button>
                {exportOpen && (
                  <div id="exportDropdown" className="absolute top-full right-0 mt-2 w-40 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
                    <div className="py-2">
                       <button onClick={(ev)=>{ ev.stopPropagation(); downloadExport('csv') }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">Export CSV</button>
                       <button onClick={(ev)=>{ ev.stopPropagation(); downloadExport('pdf') }} className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors">Export PDF</button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 md:p-5">
              <h3 className="text-lg md:text-xl font-bold tracking-tight text-gray-900 mb-4 border-b pb-2 inline-block border-gray-200">Transaction History</h3>

              <div className="hidden md:block">
                {loading ? (
                  <div className="p-8 text-center text-gray-500">Loading transactions...</div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left">
                      <thead className="bg-gray-50">
                        <tr className="text-xs font-semibold text-gray-500 uppercase">
                          <th className="py-3 px-4 border-b border-gray-200">Date</th>
                          <th className="py-3 px-4 border-b border-gray-200">Product Code</th>
                          <th className="py-3 px-4 border-b border-gray-200">Units</th>
                          <th className="py-3 px-4 border-b border-gray-200">Product Price</th>
                          <th className="py-3 px-4 border-b border-gray-200">Payable</th>
                          <th className="py-3 px-4 border-b border-gray-200">Payment Receive</th>
                          <th className="py-3 px-4 border-b border-gray-200">Bank</th>
                          <th className="py-3 px-4 border-b border-gray-200">Remain</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-100">
                        {transactions.length === 0 ? (
                          <tr><td colSpan={8} className="p-8 text-center text-gray-500">No transactions found.</td></tr>
                        ) : (
                          transactions.map((t, i) => (
                            <tr key={t.id ?? i} className="hover:bg-gray-50 transition-colors">
                              <td className="py-3 px-4 text-sm font-semibold text-gray-600">{t.date}</td>
                              <td className="py-3 px-4 text-sm font-medium text-gray-900">{t.product_code}</td>
                              <td className="py-3 px-4 text-sm text-gray-900">{t.units}</td>
                              <td className="py-3 px-4 text-sm font-medium text-gray-900">{t.product_price != null ? formatCurrency(t.product_price) : ''}</td>
                              <td className="py-3 px-4 text-sm font-medium text-gray-900">{t.payable != null ? formatCurrency(t.payable) : ''}</td>
                              <td className={`py-3 px-4 text-sm font-semibold ${t.payment_received && t.payment_received.toString().includes('$') ? 'text-green-600' : 'text-gray-900'}`}>{t.payment_received}</td>
                              <td className="py-3 px-4 text-sm text-gray-900">{t.bank}</td>
                              <td className={`py-3 px-4 text-sm font-semibold ${Number(t.remain) > 0 ? 'text-red-600' : 'text-gray-900'}`}>{t.remain != null ? formatCurrency(t.remain) : ''}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              <div className="md:hidden space-y-4">
                {loading ? (
                  <div className="p-6 text-center text-gray-500">Loading transactions...</div>
                ) : transactions.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">No transactions found.</div>
                ) : (
                  transactions.map((t, i) => (
                    <div key={t.id ?? i} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-3">
                        <div>
                          <div className="text-xs font-bold text-gray-500 mb-1">{t.date}</div>
                          <div className="text-sm font-semibold text-gray-900">{t.product_code}</div>
                        </div>
                        <div className="text-right">
                          <div className="text-xs text-gray-500 mb-1 font-medium">Remain</div>
                          <div className={`text-sm font-bold ${Number(t.remain) > 0 ? 'text-red-600' : 'text-gray-900'}`}>{t.remain != null ? formatCurrency(t.remain) : ''}</div>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-3 text-xs bg-gray-50/50 p-3 rounded-lg border border-gray-100">
                        <div><span className="text-gray-500 block mb-0.5 font-medium">Units</span><span className="text-gray-900 font-semibold">{t.units}</span></div>
                        <div><span className="text-gray-500 block mb-0.5 font-medium">Price</span><span className="text-gray-900 font-semibold">{t.product_price != null ? formatCurrency(t.product_price) : ''}</span></div>
                        <div><span className="text-gray-500 block mb-0.5 font-medium">Payable</span><span className="text-gray-900 font-semibold">{t.payable != null ? formatCurrency(t.payable) : ''}</span></div>
                        <div><span className="text-gray-500 block mb-0.5 font-medium">Received</span><span className="text-green-600 font-bold">{t.payment_received}</span></div>
                      </div>
                      <div className="mt-3 pt-2 text-right"><span className="text-xs text-gray-400 font-medium">Bank:</span><span className="text-xs font-semibold text-gray-900 ml-1">{t.bank}</span></div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {(() => {
              const hasMeta = Boolean(txMeta && txMeta.count)
              const showPagination = Boolean(txMeta && txMeta.previous) || Boolean(txMeta && txMeta.next) || (hasMeta && txMeta.pageSize && txMeta.count > txMeta.pageSize)
              if (!showPagination) return null
              return (
                <div className="flex items-center justify-between p-4 border-t border-gray-200">
                  <div className="text-sm text-gray-500">
                    Page {txPage} {txMeta && txMeta.count ? ' of ' + Math.max(1, Math.ceil(txMeta.count / (txMeta.pageSize || 1))) : ''}
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { if (!(txMeta && txMeta.previous)) return; setTxPage(p => Math.max(1, p - 1)) }}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap !rounded-button flex items-center"
                            disabled={!(txMeta && txMeta.previous)} aria-disabled={!(txMeta && txMeta.previous)}>
                      <ChevronLeft className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:block">Previous</span>
                    </button>
                    <button onClick={() => { if (!(txMeta && txMeta.next)) return; setTxPage(p => p + 1) }}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap !rounded-button flex items-center"
                            disabled={!(txMeta && txMeta.next)} aria-disabled={!(txMeta && txMeta.next)}>
                      <span className="hidden sm:block">Next</span>
                      <ChevronRight className="w-4 h-4 sm:ml-1" />
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>
        </main>
      </div>
    </div>
  )
}
