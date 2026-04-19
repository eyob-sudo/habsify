import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import InventoryTab from '../components/InventoryTabs'
import toast from '../services/toastService'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../utils/cn'
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, Edit2, Trash2, MapPin, Archive, Plus } from 'lucide-react'
import { getWarehouses, createWarehouse, updateWarehouse, deleteWarehouse } from '../services/inventoryService'

function formatCurrency(value) {
  if (value == null) return ''
  if (typeof value === 'string') return value
  return `$${Number(value).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// PHASE 31: Zod validation Schema for Warehouses
const warehouseSchema = z.object({
  name: z.string().min(1, 'Warehouse name is required'),
  address: z.string().min(1, 'Address/Location is required')
})

const sortOptions = [
  { k: 'name', l: 'Name (A → Z)' },
  { k: '-name', l: 'Name (Z → A)' },
  { k: 'created_at', l: 'Created (oldest first)' },
  { k: '-created_at', l: 'Created (newest first)' },
  { k: 'current_stock', l: 'Current Stock (low → high)' },
  { k: '-current_stock', l: 'Current Stock (high → low)' },
  { k: 'total_worth', l: 'Total Worth (low → high)' },
  { k: '-total_worth', l: 'Total Worth (high → low)' },
  { k: 'address', l: 'Address (A → Z)' },
  { k: '-address', l: 'Address (Z → A)' },
  { k: 'item_count', l: 'Item Count (fewest → most)' },
  { k: '-item_count', l: 'Item Count (most → fewest)' }
]

export default function Inventory() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()

  // URL state trackers
  const [page, setPage] = useState(1)
  const [ordering, setOrdering] = useState('name')
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')

  // UI interaction states
  const [sortOpen, setSortOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingWarehouse, setEditingWarehouse] = useState(null)

  // React Hook Form Configuration
  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(warehouseSchema)
  })

  // Debouncing Search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // Automatically reset pagination
  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, ordering])

  // Sub-Hooks for closing popups globally
  useEffect(() => {
    function onDoc() { setSortOpen(false) }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  // Auto Form Population when Editing exists
  useEffect(() => {
    if (editingWarehouse) {
      reset({ name: editingWarehouse.name || '', address: editingWarehouse.address || '' })
    } else {
      reset({ name: '', address: '' })
    }
  }, [editingWarehouse, reset])

  // PHASE 32: Core React Query replacing custom loading loop
  const { data, isLoading: loading } = useQuery({
    queryKey: ['warehouses', page, debouncedSearch, ordering],
    queryFn: async () => {
      const res = await getWarehouses({ search: debouncedSearch, ordering, page })
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

  // Optimistic Cache Updating Mutations
  const saveMutator = useMutation({
    mutationFn: async (payload) => {
      if (editingWarehouse) return updateWarehouse(editingWarehouse.id, payload)
      return createWarehouse(payload)
    },
    onMutate: async (newWarehouse) => {
      if (editingWarehouse) return
      // Optimistic visual pop for creating Warehouses instantly without lag
      await queryClient.cancelQueries({ queryKey: ['warehouses'] })
      const previous = queryClient.getQueryData(['warehouses', page, debouncedSearch, ordering])
      const tempId = `temp-${Date.now()}`
      queryClient.setQueryData(['warehouses', page, debouncedSearch, ordering], (old) => {
        if (!old) return old
        const updatedList = [{ id: tempId, ...newWarehouse, total_stock: 0, total_worth: '$0.00', isOptimistic: true }, ...(old.results || old)]
        return { ...old, results: updatedList }
      })
      return { previous }
    },
  onSuccess: () => {
    toast.success(`Warehouse ${editingWarehouse ? 'updated' : 'added'} successfully`)
    queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    queryClient.invalidateQueries({ queryKey: ['dashboardData'] })
    closeModal()
  },
    onError: (err, newWarehouse, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['warehouses', page, debouncedSearch, ordering], context.previous)
      }
      toast.error(`Failed to ${editingWarehouse ? 'update' : 'create'} warehouse`)
    }
  })

  const deleteMutator = useMutation({
    mutationFn: async (id) => deleteWarehouse(id),
    onSuccess: () => {
      toast.success('Warehouse successfully deleted')
      queryClient.invalidateQueries({ queryKey: ['warehouses'] })
    },
    onError: () => toast.error('Failed to delete warehouse')
  })

  // Handlers
  function openDetail(item) {
    navigate(`/inventory/${item.id}`, { state: { warehouse: item } })
  }

  function openEdit(warehouse) {
    setEditingWarehouse(warehouse)
    setIsModalOpen(true)
  }

  function handleDelete(item) {
    if (window.confirm('If you delete this warehouse you will lose all stock products inside it. Proceed?')) {
      deleteMutator.mutate(item.id)
    }
  }

  function closeModal() {
    setIsModalOpen(false)
    setEditingWarehouse(null)
    reset()
  }

  function onSubmit(formData) {
    saveMutator.mutate(formData)
  }

  // Derive Table visibility condition exactly like before
  const filtered = useMemo(() => rawItems.slice(), [rawItems])

  return (
    <div className="min-h-screen bg-gray-50/50 pt-20 pb-20 md:pb-0">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 md:ml-64 w-full transition-all duration-300">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 border-b-2 border-primary inline-block pb-1">Inventory Management</h2>
            <p className="text-gray-500 text-sm mt-2">Track stock levels, manage products, and monitor inventory movements across your warehouse.</p>
          </div>

          <div className="mb-6">
            <InventoryTab />
          </div>

          <div className="bg-white border text-sm md:text-base border-gray-200 rounded-2xl shadow-sm mb-8 overflow-hidden">
            <div className="p-4 md:p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/30">
              <div className="relative w-full md:w-96 group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="text-gray-400 group-focus-within:text-primary transition-colors" size={18} />
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search warehouses..."
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                />
              </div>

              <div className="relative flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={(e) => { e.stopPropagation(); setSortOpen(v => !v) }}
                  className="w-full md:w-auto px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 !rounded-button flex items-center justify-center gap-2"
                >
                  <ArrowUpDown className="w-4 h-4" />
                  <span>Sort</span>
                </button>

                {sortOpen && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-lg shadow-xl z-20 overflow-hidden">
                    <div className="py-2 h-64 overflow-y-auto custom-scrollbar">
                      {sortOptions.map((opt) => (
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
                  onClick={() => { setEditingWarehouse(null); setIsModalOpen(true) }}
                  className="w-full md:w-auto px-5 py-2 !rounded-button bg-primary text-white font-medium hover:bg-primary/95 transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Add Warehouse
                </button>
              </div>
            </div>

            {/* Desktop Table */}
            <div className="p-4 md:p-5 hidden md:block">
              <table className="w-full text-left">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
                    <th className="py-3 px-4">Name</th>
                    <th className="py-3 px-4">Address</th>
                    <th className="py-3 px-4">Total Stock</th>
                    <th className="py-3 px-4">Total Worth</th>
                    <th className="py-3 px-4">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading warehouses...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-500">No warehouses found.</td></tr>
                  ) : (
                    filtered.map((item) => (
                      <tr key={item.id} className={cn("hover:bg-gray-50 transition-colors", item.isOptimistic ? "opacity-50" : "")}>
                        <td className="py-3 px-4">
                          <a onClick={() => openDetail(item)} className="cursor-pointer font-medium text-gray-900 hover:text-primary transition-colors">{item.name}</a>
                        </td>
                        <td className="py-3 px-4"><p className="text-sm text-gray-900">{item.address}</p></td>
                        <td className="py-3 px-4"><span className="text-sm text-gray-900 font-medium">{item.total_stock}</span></td>
                        <td className="py-3 px-4">
                          <p className={cn("text-sm font-medium", String(item.total_worth || '').includes('$') ? (item.total_worth === '$0.00' ? 'text-gray-900' : 'text-green-600') : 'text-gray-900')}>
                            {formatCurrency(item.total_worth)}
                          </p>
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
                <div className="p-6 text-center text-gray-500">Loading inventory...</div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No inventory found.</div>
              ) : (
                filtered.map((item) => (
                  <div key={item.id} className={cn("bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow", item.isOptimistic ? "opacity-50" : "")}>
                    <div className="flex items-start justify-between mb-2">
                      <a onClick={() => openDetail(item)} className="cursor-pointer h-full">
                        <h3 className="font-semibold text-gray-900 hover:text-primary transition-colors">{item.name}</h3>
                      </a>
                      <span className={cn("font-bold", String(item.total_worth || '').includes('$') ? (item.total_worth === '$0.00' ? 'text-gray-900' : 'text-green-600') : 'text-gray-900')}>
                        {formatCurrency(item.total_worth)}
                      </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-600 mt-2">
                      <span className="flex items-center gap-1.5 truncate pr-2">
                        <MapPin className="text-gray-400 Shrink-0" size={14} />
                        <span className="truncate">{item.address}</span>
                      </span>
                      <span className="flex items-center gap-1.5 shrink-0">
                        <Archive className="text-gray-400" size={14} />
                        {item.total_stock} items
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-4 pt-3 border-t border-gray-50 justify-end">
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

            {/* Pagination block intact matching original logical conditions */}
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

          {/* Phase 33 Modal Framer Motion Layer */}
          <AnimatePresence>
            {isModalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
                  className="bg-white rounded-2xl shadow-xl w-full max-w-md overflow-hidden"
                >
                  <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <h3 className="text-xl font-bold tracking-tight text-gray-900">{editingWarehouse ? 'Edit Warehouse' : 'Add New Warehouse'}</h3>
                    <button onClick={closeModal} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-full border shadow-sm transition-colors">
                      <i className="ri-close-line"></i>
                    </button>
                  </div>
                  <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Warehouse Name</label>
                      <input
                        {...register('name')}
                        className={cn("w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20", errors.name ? "border-red-500" : "border-gray-200 focus:border-primary")}
                        placeholder="Main Storage"
                      />
                      {errors.name && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.name.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Location Address</label>
                      <input
                        {...register('address')}
                        className={cn("w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20", errors.address ? "border-red-500" : "border-gray-200 focus:border-primary")}
                        placeholder="City, State"
                      />
                      {errors.address && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.address.message}</p>}
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={closeModal}
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saveMutator.isPending}
                        className="flex-1 px-4 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/95 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        {saveMutator.isPending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (editingWarehouse ? 'Save Changes' : 'Create Warehouse')}
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
