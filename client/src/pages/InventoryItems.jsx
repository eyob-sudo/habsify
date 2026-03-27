import React, { useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import InventoryTabs from '../components/InventoryTabs'
import toast from '../services/toastService'

function formatCurrency(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function InventoryItems() {
  const [items, setItems] = useState([])
  const [categories, setCategories] = useState([])
  const [loadingCategories, setLoadingCategories] = useState(false)
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [ordering, setOrdering] = useState('name')
  const [sortOpen, setSortOpen] = useState(false)
  const [page, setPage] = useState(1)
  const [meta, setMeta] = useState(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editModalOpen, setEditModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)

  const categoryMap = useMemo(() => {
    const map = new Map()
    categories.forEach(c => map.set(c.id, c.name))
    return map
  }, [categories])

  function categoryLabel(id) {
    if (id == null || id === '') return ''
    return categoryMap.get(Number(id)) || String(id)
  }

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoadingCategories(true)
        const svc = await import('../services/inventoryService')
        const res = await svc.getCategories({ page: 1 })
        const data = res?.data ?? res
        const list = Array.isArray(data) ? data : (data?.results ?? [])
        if (!mounted) return
        setCategories(list)
      } catch (err) {
        if (mounted) setCategories([])
      } finally {
        if (mounted) setLoadingCategories(false)
      }
    })()
    return () => { mounted = false }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, ordering])

  useEffect(() => {
    let mounted = true
    ;(async () => {
      try {
        setLoading(true)
        const svc = await import('../services/inventoryService')
        const res = await svc.getItems({ page, search: debouncedSearch, ordering })
        const data = res?.data ?? res
        const list = Array.isArray(data) ? data : (data?.results ?? [])
        if (!mounted) return
        setItems(list)
        if (data && !Array.isArray(data)) {
          setMeta({ count: data.count, next: data.next, previous: data.previous, pageSize: (data.results || []).length })
        } else {
          setMeta({ count: list.length, next: null, previous: null, pageSize: list.length })
        }
      } catch (err) {
        toast.error('Failed to load items')
      } finally {
        if (mounted) setLoading(false)
      }
    })()
    return () => { mounted = false }
  }, [debouncedSearch, ordering, page])

  const filtered = useMemo(() => items.slice(), [items])

  function openEdit(item) {
    setEditingItem(item)
    setEditModalOpen(true)
  }

  async function handleDelete(item) {
    const confirmed = window.confirm('If you delete this item you will lose all related records')
    if (!confirmed) return
    try {
      toast.info('Deleting item...')
      const svc = await import('../services/inventoryService')
      await svc.deleteItem(item.id)
      setItems(prev => prev.filter(i => i.id !== item.id))
      toast.success('Item deleted')
    } catch (err) {
      toast.error('Failed to delete item')
    }
  }

  async function handleCreate(e) {
    e.preventDefault()
    const fd = new FormData(e.target)
    const name = (fd.get('itemName') || '').toString().trim()
    const code = (fd.get('itemCode') || '').toString().trim()
    const category = (fd.get('itemCategory') || '').toString().trim()
    const unitPrice = (fd.get('itemUnitPrice') || '').toString().trim()
    const unitMeasure = (fd.get('itemUnitMeasure') || '').toString().trim()

    if (!name || !code) {
      toast.error('Name and code are required')
      return
    }

    const payload = {
      name,
      code,
      category: category ? Number(category) : null,
      unit_price: unitPrice ? Number(unitPrice) : null,
      unit_measure: unitMeasure || ''
    }

    const tempId = `temp-${Date.now()}`
    const optimistic = { id: tempId, ...payload, optimistic: true }
    setItems(prev => [optimistic, ...prev])
    setIsModalOpen(false)
    e.target.reset()

    try {
      toast.info('Creating item...')
      const svc = await import('../services/inventoryService')
      const res = await svc.createItem(payload)
      const created = res?.data ?? res
      const merged = { ...optimistic, ...created }
      setItems(prev => prev.map(i => (i.id === tempId ? merged : i)))
      toast.success('Item created')
    } catch (err) {
      setItems(prev => prev.filter(i => i.id !== tempId))
      toast.error('Failed to create item')
      setIsModalOpen(true)
    }
  }

  async function handleEditSubmit(e) {
    e.preventDefault()
    if (!editingItem) return
    const fd = new FormData(e.target)
    const name = (fd.get('editItemName') || '').toString().trim()
    const code = (fd.get('editItemCode') || '').toString().trim()
    const category = (fd.get('editItemCategory') || '').toString().trim()
    const unitPrice = (fd.get('editItemUnitPrice') || '').toString().trim()
    const unitMeasure = (fd.get('editItemUnitMeasure') || '').toString().trim()

    if (!name || !code) {
      toast.error('Name and code are required')
      return
    }

    const payload = {
      name,
      code,
      category: category ? Number(category) : null,
      unit_price: unitPrice ? Number(unitPrice) : null,
      unit_measure: unitMeasure || ''
    }

    const prev = items.find(i => i.id === editingItem.id)
    if (!prev) return
    const optimistic = { ...prev, ...payload }
    setItems(prevList => prevList.map(i => (i.id === optimistic.id ? optimistic : i)))
    setEditModalOpen(false)
    setEditingItem(null)

    try {
      toast.info('Updating item...')
      const svc = await import('../services/inventoryService')
      const res = await svc.updateItem(optimistic.id, payload)
      const updated = res?.data ?? res
      setItems(prevList => prevList.map(i => (i.id === updated.id ? { ...i, ...updated } : i)))
      toast.success('Item updated')
    } catch (err) {
      setItems(prevList => prevList.map(i => (i.id === prev.id ? prev : i)))
      toast.error('Failed to update item')
      setEditingItem(prev)
      setEditModalOpen(true)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50 pt-20 pb-20 md:pb-0">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 md:ml-64">
          <div className="mb-8">
            <h2 className="text-xl md:text-3xl font-bold text-gray-900 mb-1 md:mb-2">Inventory Items</h2>
            <p className="text-sm md:text-base text-gray-600">Manage items, pricing, and item details.</p>
          </div>

          <div className="mb-6">
            <InventoryTabs />
          </div>

          <div className="mb-6">
            <div className="flex flex-col sm:flex-row gap-4 sm:items-center sm:justify-between">
              <div className="flex flex-row gap-2 sm:gap-3 items-center">
                <div className="relative flex-1">
                  <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search items..." className="pl-3 pr-4 py-2 border border-gray-200 rounded-lg text-sm w-full" />
                </div>
                <div className="relative sm:flex-initial">
                  <button onClick={(e) => { e.stopPropagation(); setSortOpen(v => !v) }} className="w-full sm:w-auto flex items-center justify-center gap-2 px-2 md:px-4 py-2 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors whitespace-nowrap !rounded-button">
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-sort-desc"></i></div>
                    <span className="hidden sm:inline">Sort</span>
                    <div className="w-4 h-4 flex items-center justify-center"><i className="ri-arrow-down-s-line"></i></div>
                  </button>
                  {sortOpen && (
                    <div className="absolute top-full left-0 mt-1 w-48 bg-white border border-gray-200 rounded-lg shadow-lg z-10">
                      <div className="p-2">
                        {[
                          { k: 'name', l: 'Name (A → Z)' },
                          { k: '-name', l: 'Name (Z → A)' },
                          { k: 'code', l: 'Code (A → Z)' },
                          { k: '-code', l: 'Code (Z → A)' },
                          { k: 'unit_price', l: 'Unit Price (low → high)' },
                          { k: '-unit_price', l: 'Unit Price (high → low)' }
                        ].map(opt => (
                          <button key={opt.k} onClick={(ev) => { ev.stopPropagation(); setOrdering(opt.k); setSortOpen(false) }} className="w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-50 rounded">
                            {opt.l}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button onClick={() => setIsModalOpen(true)} className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition-colors text-sm">Add Item</button>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-3 md:p-6 mb-8 hidden md:block">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Name</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Code</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Category</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Unit Price</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Unit Measure</th>
                    <th className="text-left py-3 px-4 font-semibold text-gray-900">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={6} className="p-6 text-center text-gray-500">Loading items...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={6} className="p-6 text-center text-gray-500">No items found.</td></tr>
                  ) : (
                    filtered.map((item) => (
                      <tr key={item.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4"><p className="text-sm font-medium text-gray-900">{item.name}</p></td>
                        <td className="py-3 px-4"><p className="text-sm text-gray-700">{item.code}</p></td>
                        <td className="py-3 px-4"><p className="text-sm text-gray-700">{categoryLabel(item.category)}</p></td>
                        <td className="py-3 px-4"><p className="text-sm text-gray-900">{formatCurrency(item.unit_price)}</p></td>
                        <td className="py-3 px-4"><p className="text-sm text-gray-700">{item.unit_measure}</p></td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button onClick={(ev)=>{ ev.stopPropagation(); openEdit(item) }} className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors !rounded-button" title="Edit Item">
                              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-edit-line"></i></div>
                            </button>
                            <button onClick={(ev)=>{ ev.stopPropagation(); handleDelete(item) }} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors !rounded-button" title="Delete Item">
                              <div className="w-4 h-4 flex items-center justify-center"><i className="ri-delete-bin-line"></i></div>
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="md:hidden space-y-4 mt-4">
            {loading ? (
              <div className="p-4 text-center text-gray-500">Loading items...</div>
            ) : filtered.length === 0 ? (
              <div className="p-4 text-center text-gray-500">No items found.</div>
            ) : (
              filtered.map((item) => (
                <div key={item.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                  <div className="flex items-start justify-between mb-2">
                    <div>
                      <h3 className="font-medium text-sm text-gray-900">{item.name}</h3>
                      <p className="text-xs text-gray-500">{item.code}</p>
                    </div>
                    <span className="text-sm font-semibold text-gray-900">{formatCurrency(item.unit_price)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-xs text-gray-600">
                    <div>Category: <span className="text-gray-900">{categoryLabel(item.category)}</span></div>
                    <div>Unit: <span className="text-gray-900">{item.unit_measure}</span></div>
                  </div>
                  <div className="flex items-center gap-2 mt-3">
                    <button onClick={(ev)=>{ ev.stopPropagation(); openEdit(item) }} className="px-3 py-1.5 text-xs font-medium border border-gray-200 rounded-lg hover:bg-gray-50">
                      <i className="ri-edit-line mr-1"></i>Edit
                    </button>
                    <button onClick={(ev)=>{ ev.stopPropagation(); handleDelete(item) }} className="px-3 py-1.5 text-xs font-medium border border-red-200 text-red-600 rounded-lg hover:bg-red-50">
                      <i className="ri-delete-bin-line mr-1"></i>Delete
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>

          {(() => {
            const hasMeta = Boolean(meta && meta.count)
            const showPagination = Boolean(meta && meta.previous) || Boolean(meta && meta.next) || (hasMeta && meta.pageSize && meta.count > meta.pageSize)
            if (!showPagination) return null
            return (
              <div className="flex items-center justify-center mt-6 mb-4">
                <div className="flex items-center gap-2">
                  <button onClick={() => { if (!(meta && meta.previous)) return; setPage(p => Math.max(1, p - 1)) }} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap !rounded-button" disabled={!(meta && meta.previous)} aria-disabled={!(meta && meta.previous)}>
                    <i className="ri-arrow-left-s-line"></i>
                    <span className="ml-1">Previous</span>
                  </button>
                  <span className="px-4 py-2 text-sm text-gray-600">Page {page}{meta && meta.count ? ' of ' + Math.max(1, Math.ceil(meta.count / (meta.pageSize || 1))) : ''}</span>
                  <button onClick={() => { if (!(meta && meta.next)) return; setPage(p => p + 1) }} className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap !rounded-button" disabled={!(meta && meta.next)} aria-disabled={!(meta && meta.next)}>
                    <span className="mr-1">Next</span>
                    <i className="ri-arrow-right-s-line"></i>
                  </button>
                </div>
              </div>
            )
          })()}

          {editModalOpen && editingItem && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Edit Item</h3>
                    <button onClick={() => { setEditModalOpen(false); setEditingItem(null) }} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                      <i className="ri-close-line"></i>
                    </button>
                  </div>
                  <form onSubmit={handleEditSubmit} id="editItemForm">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                        <input name="editItemName" required defaultValue={editingItem.name || ''} className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm" placeholder="Enter item name" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Code</label>
                        <input name="editItemCode" required defaultValue={editingItem.code || ''} className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm" placeholder="Enter item code" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                        <select name="editItemCategory" defaultValue={editingItem.category ?? ''} className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm" disabled={loadingCategories}>
                          <option value="">Select category</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Unit Price</label>
                        <input name="editItemUnitPrice" defaultValue={editingItem.unit_price ?? ''} className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm" placeholder="Enter unit price" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Unit Measure</label>
                        <input name="editItemUnitMeasure" defaultValue={editingItem.unit_measure ?? ''} className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm" placeholder="Enter unit measure" />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button type="button" onClick={() => { setEditModalOpen(false); setEditingItem(null) }} className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-700">Cancel</button>
                      <button type="submit" className="flex-1 px-4 py-3 bg-primary text-white rounded-lg text-sm font-medium">Save Changes</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {isModalOpen && (
            <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
              <div className="bg-white rounded-xl shadow-2xl w-full max-w-md mx-4">
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xl font-bold text-gray-900">Add New Item</h3>
                    <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
                      <i className="ri-close-line"></i>
                    </button>
                  </div>
                  <form onSubmit={handleCreate} id="addItemForm">
                    <div className="space-y-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Name</label>
                        <input name="itemName" required className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm" placeholder="Enter item name" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Code</label>
                        <input name="itemCode" required className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm" placeholder="Enter item code" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                        <select name="itemCategory" className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm" disabled={loadingCategories}>
                          <option value="">Select category</option>
                          {categories.map(cat => (
                            <option key={cat.id} value={cat.id}>{cat.name}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Unit Price</label>
                        <input name="itemUnitPrice" className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm" placeholder="Enter unit price" />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Unit Measure</label>
                        <input name="itemUnitMeasure" className="w-full px-4 py-3 border border-gray-200 rounded-lg text-sm" placeholder="Enter unit measure" />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-6">
                      <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 px-4 py-3 border border-gray-200 rounded-lg text-sm font-medium text-gray-700">Cancel</button>
                      <button type="submit" className="flex-1 px-4 py-3 bg-primary text-white rounded-lg text-sm font-medium">Add Item</button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
