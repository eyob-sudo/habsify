import React, { useEffect, useState } from 'react'
import { useParams, Link } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import toast from '../services/toastService'

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
      toast.dismiss(t)
      toast.success('Export downloaded')
    } catch (err) {
      console.error('Export error', err)
      toast.dismiss(t)
      toast.error('Failed to export')
    } finally {
      setExportOpen(false)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 md:ml-64">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-3 md:mb-4">
              <Link to="/crm" className="flex items-center gap-2 text-gray-600 hover:text-primary transition-colors">
                <div className="w-5 h-5 flex items-center justify-center"><i className="ri-arrow-left-line"></i></div>
                <span className="text-sm">Back to CRM</span>
              </Link>
            </div>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between md:gap-4">
              <div>
                <h2 className="text-xl md:text-3xl font-bold text-gray-900 mb-1 md:mb-2">{loadingCustomer ? 'Loading...' : (customer?.name || 'Customer not found')}</h2>
                <p className="text-gray-600 text-sm md:text-base">Comprehensive customer information and relationship management</p>
              </div>
            </div>
          </div>

          <div className="mb-6">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
              <div className="flex flex-row gap-2 sm:gap-3 items-center">
                <div className="relative flex-1">
                  <input value={searchQuery} onChange={e=>setSearchQuery(e.target.value)} placeholder="Search transactions..." className="pl-3 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-full" />
                </div>
                <div className="relative sm:flex-initial">
                  <button onClick={(e)=>{ e.stopPropagation(); setSortOpen(v=>!v); setFilterOpen(false)}} id="sortByTx" className="w-full sm:w-auto flex items-center justify-center gap-2 px-2 md:px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap !rounded-button">
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-sort-desc"></i></div>
                    <span className="hidden xs:inline sm:inline">Sort</span>
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-arrow-down-s-line"></i></div>
                  </button>
                  {sortOpen && (
                    <div id="sortDropdownTx" className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      <div className="p-2">
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
                          <button key={s.k} onClick={(ev)=>{ ev.stopPropagation(); setOrdering(s.k); setSortOpen(false)}} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">{s.l}</button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative">
                <button onClick={(e)=>{ e.stopPropagation(); setExportOpen(v=>!v); setSortOpen(false); setFilterOpen(false)}} className="flex-1 md:flex-initial px-3 md:px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap !rounded-button text-sm">
                  <div className="flex items-center gap-2 justify-center"><div className="w-4 h-4 flex items-center justify-center"><i className="ri-download-line"></i></div><span>Export</span></div>
                </button>
                {exportOpen && (
                  <div id="exportDropdown" className="absolute top-full right-0 mt-1 w-40 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                    <div className="p-2">
                      <button onClick={(ev)=>{ ev.stopPropagation(); downloadExport('csv') }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">Export CSV</button>
                      <button onClick={(ev)=>{ ev.stopPropagation(); downloadExport('pdf') }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">Export PDF</button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className="mb-8">
            <h3 className="text-lg md:text-xl font-semibold text-gray-900 mb-4 md:mb-6">Transaction History</h3>
            <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 md:p-6 mb-8 hidden md:block">
              {loading ? (
                <div className="p-6 text-center text-gray-500">Loading transactions...</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-gray-100 bg-gray-50">
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Date</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Product Code</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Units</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Product Price</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Payable</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Payment Receive</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Bank</th>
                        <th className="text-left py-3 px-4 font-semibold text-gray-900">Remain</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {transactions.length === 0 ? (
                        <tr><td colSpan={8} className="p-6 text-center text-gray-500">No transactions found.</td></tr>
                      ) : (
                        transactions.map((t, i) => (
                          <tr key={t.id ?? i} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                            <td className="py-3 px-4 text-sm font-bold text-gray-600">{t.date}</td>
                            <td className="py-3 px-4 text-sm font-medium text-gray-900">{t.product_code}</td>
                            <td className="py-3 px-4 text-sm text-gray-900">{t.units}</td>
                            <td className="py-3 px-4 text-sm font-semibold text-gray-900">{t.product_price != null ? formatCurrency(t.product_price) : ''}</td>
                            <td className="py-3 px-4 text-sm font-semibold text-gray-900">{t.payable != null ? formatCurrency(t.payable) : ''}</td>
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

            <div className="md:hidden space-y-4 mt-4">
              {loading ? (
                <div className="p-4 text-center text-gray-500">Loading transactions...</div>
              ) : transactions.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No transactions found.</div>
              ) : (
                transactions.map((t, i) => (
                  <div key={t.id ?? i} className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex justify-between items-start mb-3">
                      <div>
                        <div className="text-xs font-bold text-gray-500 mb-1">{t.date}</div>
                        <div className="text-sm font-medium text-gray-900">{t.product_code}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-xs text-gray-500 mb-1">Remain</div>
                        <div className={`text-sm font-semibold ${Number(t.remain) > 0 ? 'text-red-600' : 'text-gray-900'}`}>{t.remain != null ? formatCurrency(t.remain) : ''}</div>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3 text-xs">
                      <div><span className="text-gray-500">Units:</span><span className="text-gray-900 ml-1">{t.units}</span></div>
                      <div><span className="text-gray-500">Price:</span><span className="text-gray-900 ml-1">{t.product_price != null ? formatCurrency(t.product_price) : ''}</span></div>
                      <div><span className="text-gray-500">Payable:</span><span className="text-gray-900 ml-1">{t.payable != null ? formatCurrency(t.payable) : ''}</span></div>
                      <div><span className="text-gray-500">Received:</span><span className="text-green-600 ml-1">{t.payment_received}</span></div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-200"><span className="text-xs text-gray-500">Bank:</span><span className="text-xs text-gray-900 ml-1">{t.bank}</span></div>
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
              <div className="flex items-center justify-center mt-8">
                <div className="flex items-center gap-2">
                  <button onClick={() => { if (!(txMeta && txMeta.previous)) return; setTxPage(p => Math.max(1, p - 1)) }}
                          className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap !rounded-button"
                          disabled={!(txMeta && txMeta.previous)} aria-disabled={!(txMeta && txMeta.previous)}>
                    <i className="ri-arrow-left-s-line"></i>
                    <span className="ml-1">Previous</span>
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-600">Page {txPage}{txMeta && txMeta.count ? ' of ' + Math.max(1, Math.ceil(txMeta.count / (txMeta.pageSize || 1))) : ''}</span>
                  <button onClick={() => { if (!(txMeta && txMeta.next)) return; setTxPage(p => p + 1) }}
                          className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap !rounded-button"
                          disabled={!(txMeta && txMeta.next)} aria-disabled={!(txMeta && txMeta.next)}>
                    <span className="mr-1">Next</span>
                    <i className="ri-arrow-right-s-line"></i>
                  </button>
                </div>
              </div>
            )
          })()}
        </main>
      </div>
    </div>
  )
}
