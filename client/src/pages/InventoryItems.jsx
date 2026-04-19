import React, { useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import InventoryTabs from '../components/InventoryTabs'
import toast from '../services/toastService'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../utils/cn'
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, Edit2, Trash2, Plus, Box, Hash, Tag, DollarSign, Filter } from 'lucide-react'
import { getItems, createItem, updateItem, deleteItem, getCategories } from '../services/inventoryService'

function formatCurrency(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// PHASE 37: Zod validations explicitly tied to Item properties
const itemSchema = z.object({
  name: z.string().min(1, 'Item name is required'),
  code: z.string().min(1, 'Item code/SKU is required'),
  category: z.string().nullable().optional(),
  unit_price: z.number({ invalid_type_error: 'Must be a valid number' }).min(0, 'Price cannot be negative').nullable().optional(),
  unit_measure: z.string().optional()
})

const sortOptions = [
  { k: 'name', l: 'Name (A → Z)' },
  { k: '-name', l: 'Name (Z → A)' },
  { k: 'created_at', l: 'Created (oldest first)' },
  { k: '-created_at', l: 'Created (newest first)' },
  { k: 'code', l: 'Code (A → Z)' },
  { k: '-code', l: 'Code (Z → A)' },
  { k: 'unit_price', l: 'Price (low → high)' },
  { k: '-unit_price', l: 'Price (high → low)' }
]

export default function InventoryItems() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState('')
  const [ordering, setOrdering] = useState('name')

  const [sortOpen, setSortOpen] = useState(false)
  const [filterOpen, setFilterOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingItem, setEditingItem] = useState(null)

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(itemSchema),
    defaultValues: { name: '', code: '', category: '', unit_price: null, unit_measure: '' }
  })

  // Debouncing search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // Automatically reset page when search, filter or order changes
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, ordering, categoryFilter])

  // Click outside listener for dropdowns
  useEffect(() => {
    function onDoc() {
      setSortOpen(false)
      setFilterOpen(false)
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  // Auto Form Population based on Editing Item
  useEffect(() => {
    if (editingItem) {
      reset({
        name: editingItem.name || '',
        code: editingItem.code || '',
        category: editingItem.category ? String(editingItem.category) : '',
        unit_price: editingItem.unit_price != null ? Number(editingItem.unit_price) : null,
        unit_measure: editingItem.unit_measure || ''
      })
    } else {
      reset({ name: '', code: '', category: '', unit_price: null, unit_measure: 'piece' })
    }
  }, [editingItem, reset])

  // PHASE 38: Optimize backend data fetching with React Query
  // Category Metada Cache
  const { data: categoriesRaw } = useQuery({
    queryKey: ['inventoryCategoriesCache'],
    queryFn: async () => {
      const res = await getCategories({ page: 1 })
      return Array.isArray(res?.data) ? res.data : (res?.data?.results || res || [])
    },
    staleTime: 5 * 60 * 1000 // Cache categories for 5 mins
  })

  const categories = Array.isArray(categoriesRaw) ? categoriesRaw : []
  const categoryMap = useMemo(() => {
    const map = new Map()
    categories.forEach(c => map.set(c.id, c.name))
    return map
  }, [categories])

  function categoryLabel(id) {
    if (id == null || id === '') return '-'
    return categoryMap.get(Number(id)) || String(id)
  }

  // Main Items Cache
  const { data, isLoading: loading } = useQuery({
    queryKey: ['inventoryItems', page, debouncedSearch, ordering, categoryFilter],
    queryFn: async () => {
      const queryParams = { page, search: debouncedSearch, ordering }
      // Category filter injected if present
      if (categoryFilter) queryParams.category__name = categoryFilter
      const res = await getItems(queryParams)
      return res?.data ?? res ?? {}
    },
    keepPreviousData: true,
    staleTime: 60 * 1000
  })

  const count = data?.count ?? 0
  const nextPageUrl = data?.next ?? null
  const prevPageUrl = data?.previous ?? null

  const rawItems = Array.isArray(data) ? data : (data?.results ?? [])
  const pageSize = data?.page_size ?? data?.pageSize ?? (rawItems.length || 0)

  // PHASE 38 Continued: Mutation hooks with invalidations automatically healing cache anomalies
  const saveMutator = useMutation({
    mutationFn: async (payload) => {
      // transform standard data cleanly
      const submitData = {
        ...payload,
        category: payload.category ? Number(payload.category) : null,
        unit_price: payload.unit_price != null ? Number(payload.unit_price) : null
      }
      if (editingItem) return updateItem(editingItem.id, submitData)
      return createItem(submitData)
    },
    onMutate: async (newItem) => {
      if (editingItem) return
      await queryClient.cancelQueries({ queryKey: ['inventoryItems'] })
      const previous = queryClient.getQueryData(['inventoryItems', page, debouncedSearch, ordering, categoryFilter])
      const tempId = `temp-${Date.now()}`
      queryClient.setQueryData(['inventoryItems', page, debouncedSearch, ordering, categoryFilter], (old) => {
        if (!old) return old
        const updatedList = [{ id: tempId, ...newItem, isOptimistic: true }, ...(old.results || old)]
        return { ...old, results: updatedList }
      })
      return { previous }
    },
onSuccess: () => {
  toast.success(`Item ${editingItem ? 'updated' : 'created'} successfully`)
  queryClient.invalidateQueries({ queryKey: ['inventoryItems'] })
  queryClient.invalidateQueries({ queryKey: ['dashboardData'] })
  closeModal()
},
    onError: (err, newItem, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['inventoryItems', page, debouncedSearch, ordering, categoryFilter], context.previous)
      }
      toast.error(`Failed to ${editingItem ? 'update' : 'create'} item`)
    }
  })

  const deleteMutator = useMutation({
    mutationFn: async (id) => deleteItem(id),
    onSuccess: () => {
      toast.success('Item deleted successfully')
      queryClient.invalidateQueries({ queryKey: ['inventoryItems'] })
    },
    onError: () => toast.error('Failed to delete item')
  })

  const filtered = useMemo(() => rawItems.slice(), [rawItems])

  function openEdit(item) {
    setEditingItem(item)
    setIsModalOpen(true)
  }

  function handleDelete(item) {
    if (window.confirm('If you delete this item you will lose all related stock references. Proceed?')) {
      deleteMutator.mutate(item.id)
    }
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingItem(null)
    reset()
  }

  function onSubmit(formData) {
    saveMutator.mutate(formData)
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pt-20 pb-20 md:pb-0">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 md:ml-64 w-full transition-all duration-300">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 border-b-2 border-primary inline-block pb-1">Items Directory</h2>
            <p className="text-gray-500 text-sm mt-2">Manage individual product units and track core pricing metrics.</p>
          </div>

          <div className="mb-6">
            <InventoryTabs />
          </div>

          <div className="bg-white border text-sm md:text-base border-gray-200 rounded-2xl shadow-sm mb-8 overflow-hidden">
            <div className="p-4 md:p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/30">

              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1">
                <div className="relative w-full md:w-80 group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="text-gray-400 group-focus-within:text-primary transition-colors" size={18} />
                  </div>
                  <input
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    placeholder="Search items..."
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  />
                </div>

                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setFilterOpen(v => !v); setSortOpen(false) }}
                    className={cn("w-full md:w-auto px-4 py-2 border rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 shadow-sm whitespace-nowrap", categoryFilter ? "bg-primary/5 text-primary border-primary/20" : "bg-white text-gray-700 border-gray-200 hover:bg-gray-50")}
                  >
                    <Filter size={16} />
                    <span>{categoryFilter || 'All Categories'}</span>
                  </button>
                  {filterOpen && (
                    <div className="absolute top-full left-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden">
                      <div className="py-2 max-h-64 overflow-y-auto">
                        <button onClick={(ev) => { ev.stopPropagation(); setCategoryFilter(''); setFilterOpen(false) }} className={cn("w-full text-left px-4 py-2 text-sm transition-colors", !categoryFilter ? "bg-primary/5 text-primary font-medium" : "text-gray-700 hover:bg-gray-50")}>
                          All Categories
                        </button>
                        {categories.map(opt => (
                          <button
                            key={opt.id}
                            onClick={(ev) => { ev.stopPropagation(); setCategoryFilter(opt.name); setFilterOpen(false) }}
                            className={cn("w-full text-left px-4 py-2 text-sm transition-colors", categoryFilter === opt.name ? "bg-primary/5 text-primary font-medium" : "text-gray-700 hover:bg-gray-50")}
                          >
                            {opt.name}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="relative flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={(e) => { e.stopPropagation(); setSortOpen(v => !v); setFilterOpen(false) }}
                  className="w-full md:w-auto px-4 py-2 border border-gray-200 bg-white rounded-lg text-sm text-gray-700 hover:bg-gray-50 !rounded-button flex items-center justify-center gap-2 shadow-sm"
                >
                  <ArrowUpDown className="w-4 h-4" />
                  <span>Sort</span>
                </button>

                {sortOpen && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden">
                    <div className="py-2">
                      {sortOptions.map(opt => (
                        <button
                          key={opt.k}
                          onClick={(ev) => { ev.stopPropagation(); setOrdering(opt.k); setSortOpen(false) }}
                          className={cn("w-full text-left px-4 py-2 text-sm transition-colors", ordering === opt.k ? "bg-primary/5 text-primary font-medium" : "text-gray-700 hover:bg-gray-50")}
                        >
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={() => { setEditingItem(null); setIsModalOpen(true) }}
                  className="w-full md:w-auto px-5 py-2 !rounded-button bg-primary text-white font-medium hover:bg-primary/95 transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Add Item
                </button>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="p-4 md:p-5 hidden md:block">
              <table className="w-full text-left">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
                    <th className="py-3 px-4">Item Name</th>
                    <th className="py-3 px-4">Code / SKU</th>
                    <th className="py-3 px-4">Category</th>
                    <th className="py-3 px-4">Unit Price</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading items...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-500">No items found.</td></tr>
                  ) : (
                    filtered.map((item) => (
                      <tr key={item.id} className={cn("hover:bg-gray-50 transition-colors", item.isOptimistic ? "opacity-50" : "")}>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-gray-900 flex items-center gap-2">
                             <Box className="text-primary/70 shrink-0" size={16} />
                             {item.name}
                          </span>
                        </td>
                        <td className="py-3 px-4 flex items-center gap-1.5"><Hash className="text-gray-400" size={14}/><span className="text-sm text-gray-600 font-mono tracking-tight">{item.code}</span></td>
                        <td className="py-3 px-4">
                          <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-purple-50 text-purple-700">
                            {categoryLabel(item.category)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className="font-medium text-gray-900 flex items-center justify-start gap-1">
                             <DollarSign className="text-gray-400 shrink-0" size={14} />
                             {item.unit_price != null ? Number(item.unit_price).toFixed(2) : '0.00'}
                             <span className="text-xs font-normal text-gray-400 ml-1">/ {item.unit_measure || 'unt'}</span>
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button onClick={(ev)=>{ ev.stopPropagation(); openEdit(item) }} className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors !rounded-button">
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button onClick={(ev)=>{ ev.stopPropagation(); handleDelete(item) }} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors !rounded-button">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            {/* Mobile View */}
            <div className="p-4 md:hidden space-y-4">
              {loading ? (
                <div className="p-6 text-center text-gray-500">Loading items...</div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No items found.</div>
              ) : (
                filtered.map((item) => (
                  <div key={item.id} className={cn("bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow", item.isOptimistic ? "opacity-50" : "")}>
                    <div className="flex items-start justify-between mb-2">
                       <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                         <Box className="text-primary/70 shrink-0" size={14} />
                         {item.name}
                       </h3>
                       <span className="font-bold text-gray-900">${item.unit_price != null ? Number(item.unit_price).toFixed(2) : '0.00'}</span>
                    </div>
                    <div className="text-xs flex flex-wrap gap-2 text-gray-600 mb-3 font-mono items-center">
                      <span className="flex items-center gap-1 bg-gray-100 px-2 py-0.5 rounded text-gray-600"><Hash size={12}/>{item.code}</span>
                      <span className="bg-purple-50 text-purple-700 px-2 py-0.5 rounded-full font-sans tracking-normal font-medium">{categoryLabel(item.category)}</span>
                      <span className="text-gray-400 font-sans tracking-normal">/{item.unit_measure || 'unt'}</span>
                    </div>
                    <div className="flex items-center gap-2 pt-3 border-t border-gray-50 justify-end">
                      <button onClick={(ev)=>{ ev.stopPropagation(); openEdit(item) }} className="px-3 py-1.5 bg-yellow-50 text-xs font-medium rounded-lg text-yellow-700 hover:bg-yellow-100 flex items-center gap-1">
                        <Edit2 size={12} /> Edit
                      </button>
                      <button onClick={(ev)=>{ ev.stopPropagation(); handleDelete(item) }} className="px-3 py-1.5 bg-red-50 text-xs font-medium rounded-lg text-red-700 hover:bg-red-100 flex items-center gap-1">
                        <Trash2 size={12} /> Delete
                      </button>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination matching logical checks */}
            {(() => {
              const hasMeta = Boolean(count)
              const showPagination = Boolean(prevPageUrl) || Boolean(nextPageUrl) || (hasMeta && pageSize && count > pageSize)
              if (!showPagination) return null
              return (
                <div className="flex items-center justify-between p-4 border-t border-gray-200">
                  <div className="text-sm text-gray-500 hidden sm:block">
                     Page {page}{count ? ' of ' + Math.max(1, Math.ceil(count / (pageSize || 1))) : ''}
                  </div>
                  <div className="flex gap-2 w-full sm:w-auto justify-between sm:justify-end">
                    <button
                      type="button"
                      onClick={() => {
                        if (!prevPageUrl) return
                        try {
                          const u = new URL(prevPageUrl, window.location.origin)
                          const p = Number(u.searchParams.get('page') || 1)
                          setPage(Number.isFinite(p) ? Math.max(1, p) : (page > 1 ? page - 1 : 1))
                        } catch (e) {
                          setPage(p => Math.max(1, p - 1))
                        }
                      }}
                      className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap !rounded-button flex items-center"
                      disabled={!prevPageUrl}
                    >
                      <ChevronLeft className="w-4 h-4 sm:mr-1" />
                      <span className="hidden sm:block">Previous</span>
                    </button>

                    <span className="text-sm text-gray-500 sm:hidden self-center">Page {page}</span>

                    <button
                      type="button"
                      onClick={() => {
                        if (!nextPageUrl) return
                        try {
                          const u = new URL(nextPageUrl, window.location.origin)
                          const p = Number(u.searchParams.get('page') || 1)
                          setPage(Number.isFinite(p) ? p : page + 1)
                        } catch (e) {
                          setPage(p => p + 1)
                        }
                      }}
                      className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap !rounded-button flex items-center"
                      disabled={!nextPageUrl}
                    >
                      <span className="hidden sm:block">Next</span>
                      <ChevronRight className="w-4 h-4 sm:ml-1" />
                    </button>
                  </div>
                </div>
              )
            })()}
          </div>

          {/* Phase 39: Framer Motion Modal Layer connected natively to React Hook Form */}
          <AnimatePresence>
            {isModalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 custom-scrollbar overflow-y-auto"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                  className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden my-8"
                >
                  <div className="p-6 md:p-8 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold tracking-tight text-gray-900">{editingItem ? 'Edit Item' : 'Add New Item'}</h3>
                        <p className="text-gray-500 text-sm mt-1">Configure product SKUs, pricing and taxonomy.</p>
                    </div>
                    <button onClick={closeModal} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-full border shadow-sm transition-colors shrink-0">
                      <i className="ri-close-line"></i>
                    </button>
                  </div>
                  <form onSubmit={handleSubmit(onSubmit)} className="p-6 md:p-8 space-y-5">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Item Name</label>
                          <input
                            {...register('name')}
                            className={cn("w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20", errors.name ? "border-red-500" : "border-gray-200 focus:border-primary")}
                            placeholder="MacBook Pro"
                          />
                          {errors.name && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.name.message}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">SKU / Code</label>
                          <input
                            {...register('code')}
                            className={cn("w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-gray-50 font-mono tracking-tight", errors.code ? "border-red-500" : "border-gray-200 focus:border-primary")}
                            placeholder="MAC-001"
                          />
                          {errors.code && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.code.message}</p>}
                        </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Category Assignment</label>
                      <select
                        {...register('category')}
                        className={cn("w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white", errors.category ? "border-red-500" : "border-gray-200 focus:border-primary")}
                      >
                         <option value="">-- No Category --</option>
                         {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Unit Price</label>
                          <div className="relative">
                            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                              <DollarSign className="text-gray-400" size={14}/>
                            </div>
                            <input
                              type="number" step="0.01"
                              {...register('unit_price', { valueAsNumber: true })}
                              className={cn("w-full pl-9 pr-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20", errors.unit_price ? "border-red-500" : "border-gray-200 focus:border-primary")}
                              placeholder="0.00"
                            />
                          </div>
                          {errors.unit_price && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.unit_price.message}</p>}
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Unit of Measure</label>
                          <input
                            {...register('unit_measure')}
                            className={cn("w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white", errors.unit_measure ? "border-red-500" : "border-gray-200 focus:border-primary")}
                            placeholder="pieces, kg, boxes..."
                          />
                        </div>
                    </div>

                    <div className="flex gap-4 pt-6 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={closeModal}
                        className="flex-1 px-5 py-3.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saveMutator.isPending}
                        className="flex-1 px-5 py-3.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-black transition-colors shadow-sm disabled:opacity-50 flex justify-center items-center"
                      >
                        {saveMutator.isPending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (editingItem ? 'Save Updates' : 'Add Item')}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

        </main>
      </div>
    </div>
  )
}
