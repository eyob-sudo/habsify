import React, { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useLocation } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import toast from '../services/toastService'

function formatCurrency(value) {
  if (value == null) return ''
  // If the backend already returned a formatted currency string, return as-is
  if (typeof value === 'string' && value.trim().startsWith('$')) return value
  const num = Number(typeof value === 'string' ? value.replace(/[^0-9.-]+/g, '') : value)
  if (Number.isNaN(num)) return ''
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function InventoryTable() {
  const { id } = useParams()
  const [item, setItem] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [page, setPage] = useState(1)
  const [count, setCount] = useState(0)
  const [nextPageUrl, setNextPageUrl] = useState(null)
  const [prevPageUrl, setPrevPageUrl] = useState(null)
  const [pageSize, setPageSize] = useState(0)
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [currentFilter, setCurrentFilter] = useState('all')
  const [currentSort, setCurrentSort] = useState('item__name')
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingProduct, setEditingProduct] = useState(null)

  const location = useLocation()

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const svc = await import('../services/inventoryService')
        const res = await svc.getInventoryDetail(id, { page, inventory_search: debouncedSearch, inventory_ordering: currentSort })
        const data = res?.data ?? res
        if (!mounted) return
        // If navigation provided warehouse metadata use it (Inventory page passes state when navigating)
        const navWarehouse = location?.state?.warehouse
        setItem(navWarehouse ?? (data?.item ?? null))
        // paginated response: { count, next, previous, results }
        setCount(data?.count ?? 0)
        setNextPageUrl(data?.next ?? null)
        setPrevPageUrl(data?.previous ?? null)
        const ps = data?.page_size ?? data?.pageSize ?? (Array.isArray(data?.results) ? data.results.length : (Array.isArray(data) ? data.length : 0))
        setPageSize(ps || 0)
        if (Array.isArray(data)) {
          setProducts(data)
        } else if (Array.isArray(data?.results)) {
          setProducts(data.results)
        } else if (Array.isArray(data?.products)) {
          setProducts(data.products)
        } else {
          setProducts([])
        }
      } catch (err) {
        toast.error('Failed to load inventory detail')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [id, location, page, debouncedSearch, currentSort])

  // Reset page when filter, sort or search changes
  useEffect(() => {
    setPage(1)
  }, [currentFilter, currentSort, debouncedSearch])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  const filtered = useMemo(() => {
    let list = products.slice()
    if (currentFilter !== 'all') {
      list = list.filter((product) => String(product.category || '').toLowerCase() === currentFilter)
    }
    // helpers to extract numeric values safely from backend-provided strings
    const numericStock = (p) => {
      if (p == null) return 0
      const s = p.stock
      if (typeof s === 'number') return s
      if (typeof s === 'string') {
        const n = parseFloat(s.replace(/[^0-9.-]+/g, ''))
        return Number.isFinite(n) ? n : 0
      }
      return 0
    }
    const numericWorth = (p) => {
      if (p == null) return 0
      const w = p.worth
      if (typeof w === 'number') return w
      if (typeof w === 'string') {
        const n = parseFloat(w.replace(/[^0-9.-]+/g, ''))
        return Number.isFinite(n) ? n : 0
      }
      return 0
    }
    switch (currentSort) {
      case 'item__name':
        list.sort((a, b) => (a.product || '').localeCompare(b.product || ''))
        break
      case '-item__name':
        list.sort((a, b) => (b.product || '').localeCompare(a.product || ''))
        break
      case 'current_stock':
        list.sort((a, b) => numericStock(a) - numericStock(b))
        break
      case '-current_stock':
        list.sort((a, b) => numericStock(b) - numericStock(a))
        break
      case 'item__category__name':
        list.sort((a, b) => (String(a.category || '')).localeCompare(String(b.category || '')))
        break
      case '-item__category__name':
        list.sort((a, b) => (String(b.category || '')).localeCompare(String(a.category || '')))
        break
      case 'item__unit_price':
        list.sort((a, b) => {
          const ap = Number(String(a.unit_price || a.item_unit_price || 0).replace(/[^0-9.-]+/g, ''))
          const bp = Number(String(b.unit_price || b.item_unit_price || 0).replace(/[^0-9.-]+/g, ''))
          return ap - bp
        })
        break
      case '-item__unit_price':
        list.sort((a, b) => {
          const ap = Number(String(a.unit_price || a.item_unit_price || 0).replace(/[^0-9.-]+/g, ''))
          const bp = Number(String(b.unit_price || b.item_unit_price || 0).replace(/[^0-9.-]+/g, ''))
          return bp - ap
        })
        break
      case 'worth':
        list.sort((a, b) => numericWorth(a) - numericWorth(b))
        break
      case '-worth':
        list.sort((a, b) => numericWorth(b) - numericWorth(a))
        break
      default:
        break
    }
    return list
  }, [products, currentFilter, currentSort])

  function openEdit(product) {
    setEditingProduct(product)
    setEditModalOpen(true)
  }

  function handleDelete(productId) {
    const target = products.find((p) => p.id === productId)
    if (!target) return
    if (!window.confirm(`Are you sure you want to delete ${target.product}?`)) return
    setProducts((prev) => prev.filter((p) => p.id !== productId))
    toast.error(`${target.product} has been deleted`)
  }

  function handleEditSubmit(e) {
    e.preventDefault()
    if (!editingProduct) return
    const fd = new FormData(e.target)
    const product = (fd.get('editProduct') || '').toString().trim()
    const category = (fd.get('editCategory') || '').toString().trim()
    const stock = Number(fd.get('editStock') || 0)
    const worth = Number(fd.get('editWorth') || 0)
    if (!product || !category) {
      toast.error('Product and category are required')
      return
    }
    setProducts((prev) => prev.map((p) => p.id === editingProduct.id ? { ...p, product, category, stock, worth } : p))
    toast.success('Product updated')
    setEditModalOpen(false)
    setEditingProduct(null)
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 md:ml-64">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-4">
              <Link to="/inventory" className="flex items-center gap-2 text-gray-600 hover:text-primary transition-colors">
                <div className="w-4 h-4 flex items-center justify-center"><i className="ri-arrow-left-line"></i></div>
                <span className="text-sm">Back to Inventory</span>
              </Link>
            </div>

            
            <h2 className="text-2xl md:text-3xl font-bold text-gray-900 mb-2">{item?.name || 'Inventory Detail'}</h2>
            <p className="text-gray-600 text-sm md:text-base">Comprehensive product information and inventory management</p>
          </div>

          <div className="mb-4 md:mb-6">
            <div className="flex flex-col sm:flex-row gap-2 md:gap-4 sm:items-center sm:justify-between">
              <div className="flex flex-row gap-2 sm:gap-3 items-center">
                <div className="relative flex-1">
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search products..." className="pl-3 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-full" />
                </div>

                <div className="relative">
                  <button onClick={(e) => { e.stopPropagation(); setFilterOpen(v => !v); setSortOpen(false) }} className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 !rounded-button">
                    <div className="flex items-center gap-2"><i className="ri-filter-3-line"></i><span className="hidden sm:inline">All Categories</span></div>
                  </button>
                  {filterOpen && (
                    <div className="absolute left-0 top-full mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      <div className="p-2">
                        {[
                          { k: 'all', l: 'All Categories' },
                          { k: 'safety equipment', l: 'Safety Equipment' },
                          { k: 'tools', l: 'Tools' },
                          { k: 'machinery', l: 'Machinery' },
                          { k: 'materials', l: 'Materials' }
                        ].map((opt) => (
                          <button key={opt.k} onClick={(ev) => { ev.stopPropagation(); setCurrentFilter(opt.k); setFilterOpen(false) }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">
                            {opt.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                <div className="relative sm:flex-initial">
                  <button onClick={(e) => { e.stopPropagation(); setSortOpen(v => !v); setFilterOpen(false) }} className="w-full sm:w-auto flex items-center justify-center gap-2 px-2 md:px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap !rounded-button">
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-sort-desc"></i></div>
                    <span className="hidden sm:inline">Sort</span>
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-arrow-down-s-line"></i></div>
                  </button>
                  {sortOpen && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      <div className="p-2">
                        {[
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
                        ].map((opt) => (
                          <button key={opt.k} onClick={(ev) => { ev.stopPropagation(); setCurrentSort(opt.k); setSortOpen(false) }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">
                            {opt.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>


          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 md:p-6 mb-8">
            <div className="hidden md:block overflow-x-auto">
              <table className="w-full">
                <thead>
                    <tr className="border-b border-gray-100">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Product</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Category</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Stock</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Worth</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr><td colSpan={4} className="p-6 text-center text-gray-500">Loading inventory...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={4} className="p-6 text-center text-gray-500">No products found.</td></tr>
                  ) : (
                    filtered.map((product) => (
                      <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4">
                          <div className="flex items-center gap-3">
                            <div>
                              <p className="font-medium text-gray-900">{product.product}</p>
                            </div>
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 text-blue-800">{product.category}</span>
                        </td>
                        <td className="py-4 px-4">
                          <span className="text-sm font-medium text-gray-900">{product.stock}</span>
                        </td>
                        <td className="py-4 px-4 font-semibold text-gray-900">{formatCurrency(product.worth)}</td>
                        
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <div className="md:hidden space-y-4">
              {loading ? (
                <div className="p-4 text-center text-gray-500">Loading inventory...</div>
              ) : filtered.length === 0 ? (
                <div className="p-4 text-center text-gray-500">No products found.</div>
              ) : (
                filtered.map((product) => (
                  <div key={product.id} className="border border-gray-100 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <h3 className="font-medium text-gray-900">{product.product}</h3>
                          <p className="text-xs text-gray-400 mt-1">{product.category}</p>
                        </div>
                      </div>
                      {/* actions removed - no edit/delete in mobile card */}
                    </div>
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <span className="text-sm font-medium text-gray-900">{product.stock} units</span>
                        <span className="font-semibold text-gray-900">{formatCurrency(product.worth)}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {editModalOpen && editingProduct && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Edit Product</h3>
                    <button onClick={() => { setEditModalOpen(false); setEditingProduct(null) }} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100"><i className="ri-close-line"></i></button>
                  </div>
                  <form onSubmit={handleEditSubmit} id="editProductForm">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Product</label>
                        <input name="editProduct" required defaultValue={editingProduct.product || ''} className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                        <input name="editCategory" required defaultValue={editingProduct.category || ''} className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Stock</label>
                        <input type="number" name="editStock" required defaultValue={editingProduct.stock || 0} className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Worth</label>
                        <input type="number" name="editWorth" required defaultValue={editingProduct.worth || 0} className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm" />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button type="button" onClick={() => { setEditModalOpen(false); setEditingProduct(null) }} className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-700">Cancel</button>
                      <button type="submit" className="flex-1 px-4 py-3 bg-primary text-white rounded-lg text-sm font-medium">Save Changes</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center justify-center mt-6 mb-4">
            {(() => {
              const hasMeta = Boolean(count)
              const showPagination = Boolean(prevPageUrl) || Boolean(nextPageUrl) || (hasMeta && pageSize && count > pageSize)
              if (!showPagination) return null
              return (
                <div className="flex items-center gap-2">
                    <button type="button" onClick={() => {
                      if (!prevPageUrl) return
                      console.debug('InventoryTable: prevPageUrl click', { prevPageUrl, page })
                      try {
                        const u = new URL(prevPageUrl, window.location.origin)
                        const p = Number(u.searchParams.get('page') || 1)
                        console.debug('InventoryTable: parsed prev page', p)
                        setPage(Number.isFinite(p) ? Math.max(1, p) : (page > 1 ? page - 1 : 1))
                      } catch (e) {
                        console.debug('InventoryTable: prev parse failed, fallback', e)
                        setPage(p => Math.max(1, p - 1))
                      }
                    }} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap !rounded-button" disabled={!prevPageUrl} aria-disabled={!prevPageUrl}>
                    <i className="ri-arrow-left-s-line"></i>
                    <span className="ml-1">Previous</span>
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-600">Page {page}{count ? ' of ' + Math.max(1, Math.ceil(count / (pageSize || 1))) : ''}</span>
                  <button type="button" onClick={() => {
                      if (!nextPageUrl) return
                      console.debug('InventoryTable: nextPageUrl click', { nextPageUrl, page })
                      try {
                        const u = new URL(nextPageUrl, window.location.origin)
                        const p = Number(u.searchParams.get('page') || (page + 1))
                        console.debug('InventoryTable: parsed next page', p)
                        setPage(Number.isFinite(p) ? p : (page + 1))
                      } catch (e) {
                        console.debug('InventoryTable: next parse failed, fallback', e)
                        setPage(p => p + 1)
                      }
                    }} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap !rounded-button" disabled={!nextPageUrl} aria-disabled={!nextPageUrl}>
                    <span className="mr-1">Next</span>
                    <i className="ri-arrow-right-s-line"></i>
                  </button>
                </div>
              )
            })()}
          </div>
        </main>
      </div>
    </div>
  )
}
