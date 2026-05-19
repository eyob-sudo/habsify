import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import { useQuery } from '@tanstack/react-query'
import { cn } from '../utils/cn'
import {
  Search, ArrowUpDown, ChevronLeft, ChevronRight,
  Filter, ArrowLeft, Package, DollarSign, Tag
} from 'lucide-react'
import { getWarehouseProducts } from '../services/inventoryService'
import { getPageFromUrl } from '../utils/pagination'

function formatCurrency(value) {
  if (value == null) return ''
  if (typeof value === 'string' && value.trim().startsWith('$')) return value
  const num = Number(
      typeof value === 'string' ? value.replace(/[^0-9.-]+/g, '') : value
  )
  if (Number.isNaN(num)) return ''
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const SORT_OPTIONS = [
  { k: 'current_stock', l: 'Stock (low → high)' },
  { k: '-current_stock', l: 'Stock (high → low)' },
  { k: 'item__name', l: 'Product Name (A → Z)' },
  { k: '-item__name', l: 'Product Name (Z → A)' },
  { k: 'item__category__name', l: 'Category (A → Z)' },
  { k: '-item__category__name', l: 'Category (Z → A)' },
  { k: 'item__unit_price', l: 'Unit Price (low → high)' },
  { k: '-item__unit_price', l: 'Unit Price (high → low)' },
  { k: 'worth', l: 'Worth (low → high)' },
  { k: '-worth', l: 'Worth (high → low)' }
]

const FILTER_OPTIONS = [
  { k: 'all', l: 'All Categories' },
  { k: 'safety equipment', l: 'Safety Equipment' },
  { k: 'tools', l: 'Tools' },
  { k: 'machinery', l: 'Machinery' },
  { k: 'materials', l: 'Materials' }
]

export default function InventoryTable() {
  const { id } = useParams()
  const location = useLocation()

  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [currentFilter, setCurrentFilter] = useState('all')
  const [currentSort, setCurrentSort] = useState('item__name')
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)

  // Warehouse info from navigation state (instant — no loading flicker)
  const navWarehouse = location?.state?.warehouse ?? null

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => { setPage(1) }, [debouncedSearch, currentSort, currentFilter])

  useEffect(() => {
    function onDoc() { setFilterOpen(false); setSortOpen(false) }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  // ── React Query — replaces manual useEffect load ─────────────
  const { data, isLoading: loading } = useQuery({
    queryKey: ['warehouseDetail', id, page, debouncedSearch, currentSort],
    queryFn: () => getWarehouseProducts(id, {
      page,
      inventory_search: debouncedSearch,
      inventory_ordering: currentSort
    }),
    placeholderData: (prev) => prev,
    staleTime: 60 * 1000,
  })

  // Service already unwraps .data
  const warehouseMeta = data?.item ?? navWarehouse ?? null
  const count = data?.count ?? 0
  const nextPageUrl = data?.next ?? null
  const prevPageUrl = data?.previous ?? null
  const pageSize = data?.page_size ?? 10

  const rawProducts = useMemo(() => {
    if (Array.isArray(data?.results)) return data.results
    if (Array.isArray(data?.products)) return data.products
    if (Array.isArray(data)) return data
    return []
  }, [data])

  // Client-side category filter only (server handles sort + search)
  const filtered = useMemo(() => {
    if (currentFilter === 'all') return rawProducts
    return rawProducts.filter(
        p => String(p.category || '').toLowerCase() === currentFilter
    )
  }, [rawProducts, currentFilter])

  return (
      <div className="min-h-screen bg-gray-50/50 pt-20 pb-20 md:pb-0">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6 md:p-8 md:ml-64 w-full transition-all duration-300">

            <div className="mb-6">
              <div className="flex items-center gap-3 mb-3 md:mb-4">
                <Link
                    to="/inventory"
                    className="flex items-center gap-2 text-gray-500 hover:text-primary transition-colors font-medium"
                >
                  <ArrowLeft size={16} />
                  <span className="text-sm">Back to Inventory</span>
                </Link>
              </div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 border-b-2 border-primary inline-block pb-1">
                {warehouseMeta?.name || 'Inventory Detail'}
              </h2>
              <p className="text-gray-500 text-sm mt-2">
                Comprehensive product information and inventory management
              </p>
            </div>

            <div className="bg-white border text-sm md:text-base border-gray-200 rounded-2xl shadow-sm mb-8 overflow-hidden">

              {/* ── Toolbar ── */}
              <div className="p-4 md:p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/30">
                <div className="relative w-full md:w-96 group flex-1">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search
                        className="text-gray-400 group-focus-within:text-primary transition-colors"
                        size={18}
                    />
                  </div>
                  <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search products..."
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  />
                </div>

                <div className="relative flex items-center gap-3 w-full md:w-auto">
                  <div className="relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); setFilterOpen(v => !v); setSortOpen(false) }}
                        className="w-full md:w-auto px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 shadow-sm"
                    >
                      <Filter size={16} />
                      <span className="hidden sm:inline">All Categories</span>
                    </button>
                    {filterOpen && (
                        <div className="absolute top-full left-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
                          <div className="py-2">
                            {FILTER_OPTIONS.map(opt => (
                                <button
                                    key={opt.k}
                                    onClick={(ev) => {
                                      ev.stopPropagation()
                                      setCurrentFilter(opt.k)
                                      setFilterOpen(false)
                                    }}
                                    className={cn(
                                        "w-full text-left px-4 py-2 text-sm transition-colors",
                                        currentFilter === opt.k
                                            ? "bg-primary/5 text-primary font-medium"
                                            : "text-gray-700 hover:bg-gray-50"
                                    )}
                                >
                                  {opt.l}
                                </button>
                            ))}
                          </div>
                        </div>
                    )}
                  </div>

                  <div className="relative">
                    <button
                        onClick={(e) => { e.stopPropagation(); setSortOpen(v => !v); setFilterOpen(false) }}
                        className="w-full md:w-auto px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 shadow-sm"
                    >
                      <ArrowUpDown size={16} />
                      <span className="hidden sm:inline">Sort</span>
                    </button>
                    {sortOpen && (
                        <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
                          <div className="py-2 max-h-64 overflow-y-auto">
                            {SORT_OPTIONS.map(opt => (
                                <button
                                    key={opt.k}
                                    onClick={(ev) => {
                                      ev.stopPropagation()
                                      setCurrentSort(opt.k)
                                      setSortOpen(false)
                                    }}
                                    className={cn(
                                        "w-full text-left px-4 py-2 text-sm transition-colors",
                                        currentSort === opt.k
                                            ? "bg-primary/5 text-primary font-medium"
                                            : "text-gray-700 hover:bg-gray-50"
                                    )}
                                >
                                  {opt.l}
                                </button>
                            ))}
                          </div>
                        </div>
                    )}
                  </div>
                </div>
              </div>

              <div className="p-4 md:p-5">
                <h3 className="text-lg md:text-xl font-bold tracking-tight text-gray-900 mb-4 border-b pb-2 inline-block border-gray-200">
                  Products Overview
                </h3>

                {/* ── Desktop Table ── */}
                <div className="hidden md:block overflow-x-auto">
                  <table className="w-full text-left">
                    <thead className="bg-gray-50">
                    <tr className="text-xs font-semibold text-gray-500 uppercase">
                      <th className="py-3 px-4 border-b border-gray-200">Product</th>
                      <th className="py-3 px-4 border-b border-gray-200">Category</th>
                      <th className="py-3 px-4 border-b border-gray-200">Stock Node</th>
                      <th className="py-3 px-4 border-b border-gray-200">Worth Metric</th>
                    </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                    {loading ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-gray-500">
                            Loading inventory...
                          </td>
                        </tr>
                    ) : filtered.length === 0 ? (
                        <tr>
                          <td colSpan={4} className="p-8 text-center text-gray-500">
                            No products found.
                          </td>
                        </tr>
                    ) : (
                        filtered.map((product) => (
                            <tr key={product.id} className="hover:bg-gray-50 transition-colors">
                              <td className="py-3 px-4">
                                <div className="flex items-center gap-3">
                                  <Package className="text-primary/70 shrink-0" size={16} />
                                  <p className="font-semibold text-gray-900">{product.product}</p>
                                </div>
                              </td>
                              <td className="py-3 px-4">
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700 border border-purple-100">
                              <Tag size={12} />{product.category || 'Uncategorized'}
                            </span>
                              </td>
                              <td className="py-3 px-4">
                            <span className="text-sm font-semibold text-gray-900 bg-gray-50 px-2 py-1 rounded-md">
                              {product.stock} count
                            </span>
                              </td>
                              <td className="py-3 px-4">
                            <span className="font-semibold text-gray-900 flex items-center gap-1">
                              <DollarSign className="text-gray-400" size={14} />
                              {formatCurrency(product.worth).replace('$', '')}
                            </span>
                              </td>
                            </tr>
                        ))
                    )}
                    </tbody>
                  </table>
                </div>

                {/* ── Mobile Cards ── */}
                <div className="md:hidden space-y-4">
                  {loading ? (
                      <div className="p-6 text-center text-gray-500">Loading inventory...</div>
                  ) : filtered.length === 0 ? (
                      <div className="p-6 text-center text-gray-500">No products found.</div>
                  ) : (
                      filtered.map((product) => (
                          <div
                              key={product.id}
                              className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow"
                          >
                            <div className="flex items-start justify-between mb-3 border-b border-gray-50 pb-2">
                              <div className="flex items-center gap-2">
                                <Package className="text-primary/50" size={16} />
                                <h3 className="font-semibold text-gray-900 text-sm">{product.product}</h3>
                              </div>
                              <span className="font-bold text-gray-900 text-sm">
                          {formatCurrency(product.worth)}
                        </span>
                            </div>
                            <div className="flex items-center justify-between text-xs text-gray-500">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full bg-purple-50 text-purple-700 border border-purple-100">
                          {product.category || 'Uncategorized'}
                        </span>
                              <span className="font-medium bg-gray-100 px-2 py-0.5 rounded">
                          {product.stock} units
                        </span>
                            </div>
                          </div>
                      ))
                  )}
                </div>
              </div>

              {/* ── Pagination ── */}
              {(() => {
                const showPagination =
                    Boolean(prevPageUrl) ||
                    Boolean(nextPageUrl) ||
                    (Boolean(count) && pageSize && count > pageSize)
                if (!showPagination) return null
                return (
                    <div className="flex items-center justify-between p-4 border-t border-gray-200">
                      <div className="text-sm text-gray-500 hidden sm:block">
                        Page {page}
                        {count ? ' of ' + Math.max(1, Math.ceil(count / (pageSize || 1))) : ''}
                      </div>
                      <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end">
                        <button
                            onClick={() => setPage(getPageFromUrl(prevPageUrl, Math.max(1, page - 1)))}
                            disabled={!prevPageUrl}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
                          <ChevronLeft className="w-4 h-4 sm:mr-1" />
                          <span className="hidden sm:block">Previous</span>
                        </button>
                        <span className="text-sm text-gray-500 sm:hidden self-center">Page {page}</span>
                        <button
                            onClick={() => setPage(getPageFromUrl(nextPageUrl, page + 1))}
                            disabled={!nextPageUrl}
                            className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center"
                        >
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