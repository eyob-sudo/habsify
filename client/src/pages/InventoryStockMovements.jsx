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
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, Edit2, Trash2, Plus, ArrowUpRight, ArrowDownRight, Package, X, Anchor } from 'lucide-react'
import { getStockMovements, getStockMovementDetail, createStockMovement, updateStockMovement, deleteStockMovement, getInventoryDropdown, getPurchaseDropdown, getSaleDropdown } from '../services/inventoryService'

function formatDate(value) {
  if (!value) return ''
  const d = new Date(value)
  if (Number.isNaN(d.getTime())) return value
  return d.toLocaleString(undefined, {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: 'numeric', minute: 'numeric'
  })
}

// PHASE 40: Zod definitions protecting financial inventory hooks
const movementSchema = z.object({
  inventory: z.string().min(1, 'Inventory selection is required'),
  movement_type: z.enum(['purchase', 'sale', 'adjustment']),
  quantity: z.number().min(1, 'Quantity must be at least 1').or(z.number().max(-1, 'Quantity cannot be zero')),
  notes: z.string().optional(),
  purchase: z.string().optional(),
  sale: z.string().optional()
})

const sortOptions = [
  { k: '-date', l: 'Date (newest first)' },
  { k: 'date', l: 'Date (oldest first)' },
  { k: 'quantity', l: 'Quantity (low → high)' },
  { k: '-quantity', l: 'Quantity (high → low)' },
  { k: 'item_name', l: 'Item Name (A → Z)' },
  { k: '-item_name', l: 'Item Name (Z → A)' }
]

export default function InventoryStockMovements() {
  const queryClient = useQueryClient()
  const [page, setPage] = useState(1)
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [ordering, setOrdering] = useState('-date')

  const [sortOpen, setSortOpen] = useState(false)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [detailOpen, setDetailOpen] = useState(false)
  const [detailMovement, setDetailMovement] = useState(null)
  const [detailLoading, setDetailLoading] = useState(false)

  const [inventorySearch, setInventorySearch] = useState('')
  const [debouncedInventorySearch, setDebouncedInventorySearch] = useState('')

  const { register, handleSubmit, reset, formState: { errors }, watch, setValue } = useForm({
    resolver: zodResolver(movementSchema),
    defaultValues: { movement_type: 'adjustment', quantity: '', notes: '', inventory: '', purchase: '', sale: '' }
  })

  const watchInventory = watch('inventory')

  // Debouncing main & dropdown search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  useEffect(() => {
    const t = setTimeout(() => setDebouncedInventorySearch(inventorySearch.trim()), 300)
    return () => clearTimeout(t)
  }, [inventorySearch])

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch, ordering])

  // Click outside listener for dropdowns
  useEffect(() => {
    function onDoc() { setSortOpen(false) }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  // PHASE 41: Replace all sequential backend loads with strict queries
  // Metadata Caches (Inventory Options / Purchases / Sales)
  const { data: inventoryOptionsRaw } = useQuery({
    queryKey: ['inventoryDropdown', debouncedInventorySearch],
    queryFn: async () => {
      const res = await getInventoryDropdown({ search: debouncedInventorySearch })
      return Array.isArray(res?.data) ? res.data : (res?.data?.results || res || [])
    },
    staleTime: 30 * 1000
  })
  const inventoryOptions = Array.isArray(inventoryOptionsRaw) ? inventoryOptionsRaw : []

  const { data: metadata } = useQuery({
    queryKey: ['movementsMetadata'],
    queryFn: async () => {
      const [pRes, sRes] = await Promise.all([getPurchaseDropdown(), getSaleDropdown()])
      return {
        purchases: pRes?.data ?? pRes ?? [],
        sales: sRes?.data ?? sRes ?? []
      }
    },
    staleTime: 5 * 60 * 1000
  })

  // Core Movements Data
  const { data, isLoading: loading } = useQuery({
    queryKey: ['stockMovements', page, debouncedSearch, ordering],
    queryFn: async () => {
      const res = await getStockMovements({ page, search: debouncedSearch, ordering })
      return res?.data ?? res ?? {}
    },
    keepPreviousData: true,
    staleTime: 30 * 1000
  })

  const count = data?.count ?? 0
  const nextPageUrl = data?.next ?? null
  const prevPageUrl = data?.previous ?? null

  const rawItems = Array.isArray(data) ? data : (data?.results ?? [])
  const pageSize = data?.page_size ?? data?.pageSize ?? (rawItems.length || 0)

  // Creation Mutation mapped natively out of legacy arrays
  const createMutator = useMutation({
    mutationFn: async (payload) => {
      const submitData = {
        ...payload,
        inventory: Number(payload.inventory),
        purchase: payload.purchase ? Number(payload.purchase) : null,
        sale: payload.sale ? Number(payload.sale) : null
      }
      return createStockMovement(submitData)
    },
    onMutate: async (newMovement) => {
      await queryClient.cancelQueries({ queryKey: ['stockMovements'] })
      const previous = queryClient.getQueryData(['stockMovements', page, debouncedSearch, ordering])
      const tempId = `temp-${Date.now()}`

      // Look up visual data
      const selected = inventoryOptions.find(opt => String(opt.id) === String(newMovement.inventory))

      queryClient.setQueryData(['stockMovements', page, debouncedSearch, ordering], (old) => {
        if (!old) return old
        const updatedList = [{
          id: tempId,
          movement_type: newMovement.movement_type,
          item_name: selected?.item_name || '',
          warehouse_name: selected?.warehouse_name || '',
          reference: selected?.reference || '',
          quantity: newMovement.quantity,
          date: new Date().toISOString(),
          isOptimistic: true
        }, ...(old.results || old)]
        return { ...old, results: updatedList }
      })
      return { previous }
    },
onSuccess: () => {
  toast.success('Movement recorded successfully')
  queryClient.invalidateQueries({ queryKey: ['stockMovements'] })
  queryClient.invalidateQueries({ queryKey: ['dashboardData'] })
  closeModal()
},
    onError: (err, newMovement, context) => {
      if (context?.previous) {
        queryClient.setQueryData(['stockMovements', page, debouncedSearch, ordering], context.previous)
      }
      toast.error('Failed to create movement')
    }
  })

  // Handlers
  async function openDetail(movement) {
    setDetailOpen(true)
    setDetailLoading(true)
    try {
      const res = await getStockMovementDetail(movement.id)
      setDetailMovement(res?.data ?? res)
    } catch (err) {
      toast.error('Failed to load movement detail')
    } finally {
      setDetailLoading(false)
    }
  }

  function closeModal() {
    setIsModalOpen(false)
    reset()
    setInventorySearch('')
  }

  function onSubmit(formData) {
    createMutator.mutate(formData)
  }

  const filtered = useMemo(() => rawItems.slice(), [rawItems])

  return (
    <div className="min-h-screen bg-gray-50/50 pt-20 pb-20 md:pb-0">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 md:ml-64 w-full transition-all duration-300">
          <div className="mb-8">
            <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 border-b-2 border-primary inline-block pb-1">Stock Ledgers</h2>
            <p className="text-gray-500 text-sm mt-2">Audit all stock interactions including inbound purchases, local adjustments and outbound sales.</p>
          </div>

          <div className="mb-6">
            <InventoryTabs />
          </div>

          <div className="bg-white border text-sm md:text-base border-gray-200 rounded-2xl shadow-sm mb-8 overflow-hidden">
            <div className="p-4 md:p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/30">

              <div className="relative w-full md:w-96 group flex-1">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="text-gray-400 group-focus-within:text-primary transition-colors" size={18} />
                </div>
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search item or reference..."
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                />
              </div>

              <div className="relative flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={(e) => { e.stopPropagation(); setSortOpen(v => !v) }}
                  className="w-full md:w-auto px-4 py-2 border border-gray-200 rounded-xl text-sm font-medium transition-colors flex items-center justify-center gap-2 bg-white text-gray-700 hover:bg-gray-50 shadow-sm"
                >
                  <ArrowUpDown size={16} />
                  <span>Sort Records</span>
                </button>
                {sortOpen && (
                  <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-30 overflow-hidden">
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
                  onClick={() => setIsModalOpen(true)}
                  className="w-full md:w-auto px-5 py-2 !rounded-button bg-primary text-white font-medium hover:bg-primary/95 transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Add Legder
                </button>
              </div>
            </div>

            {/* Desktop Table View */}
            <div className="p-4 md:p-5 hidden md:block">
              <table className="w-full text-left">
                <thead className="bg-gray-50">
                  <tr className="text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
                    <th className="py-3 px-4">Item Target</th>
                    <th className="py-3 px-4">Node Location</th>
                    <th className="py-3 px-4">Movement Type</th>
                    <th className="py-3 px-4">Offset</th>
                    <th className="py-3 px-4">Timestamp</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loading ? (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-500">Loading ledgers...</td></tr>
                  ) : filtered.length === 0 ? (
                    <tr><td colSpan={5} className="p-8 text-center text-gray-500">No ledgers found.</td></tr>
                  ) : (
                    filtered.map((item) => (
                      <tr key={item.id} onClick={(ev)=>{ ev.stopPropagation(); openDetail(item) }} className={cn("hover:bg-gray-50 transition-colors cursor-pointer group", item.isOptimistic ? "opacity-50" : "")}>
                        <td className="py-3 px-4">
                          <span className="font-semibold text-gray-900 group-hover:text-primary transition-colors flex items-center gap-2">
                             <Package className="text-primary/50 shrink-0" size={16} />
                             {item.item_name}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-600">{item.warehouse_name}</td>
                        <td className="py-3 px-4">
                          <span className={cn("inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold border",
                            item.movement_type === 'purchase' ? 'text-green-700 bg-green-50 border-green-200' :
                            item.movement_type === 'sale' ? 'text-red-700 bg-red-50 border-red-200' :
                            'text-blue-700 bg-blue-50 border-blue-200'
                          )}>
                            {item.movement_type}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <span className={cn("font-medium text-gray-900 flex items-center gap-1", item.movement_type === 'purchase' || item.quantity > 0 ? "text-green-600" : "text-red-500")}>
                             {item.quantity > 0 ? '+' : ''}{item.quantity}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-xs font-medium text-gray-400">
                           {formatDate(item.date)}
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
                <div className="p-6 text-center text-gray-500">Loading ledgers...</div>
              ) : filtered.length === 0 ? (
                <div className="p-6 text-center text-gray-500">No ledgers found.</div>
              ) : (
                filtered.map((item) => (
                  <div key={item.id} onClick={(ev)=>{ ev.stopPropagation(); openDetail(item) }} className={cn("bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow cursor-pointer", item.isOptimistic ? "opacity-50" : "")}>
                    <div className="flex items-start justify-between mb-2">
                       <h3 className="font-semibold text-gray-900 flex items-center gap-2">
                         <Package className="text-primary/50 shrink-0" size={14} />
                         {item.item_name}
                       </h3>
                       <span className={cn("font-semibold text-lg", item.movement_type === 'purchase' || item.quantity > 0 ? "text-green-600" : "text-red-500")}>
                         {item.quantity > 0 ? '+' : ''}{item.quantity}
                       </span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-gray-500 mb-3 mt-3 font-medium">
                      <span className="flex items-center gap-1"><Anchor size={12}/>{item.warehouse_name}</span>
                      <span className={cn("px-2 py-0.5 rounded-full font-semibold border",
                            item.movement_type === 'purchase' ? 'text-green-700 bg-green-50 border-green-200' :
                            item.movement_type === 'sale' ? 'text-red-700 bg-red-50 border-red-200' :
                            'text-blue-700 bg-blue-50 border-blue-200'
                          )}>
                        {item.movement_type}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Pagination Extracted Safely */}
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

          {/* Phase 42: Creation Form with React Hook Form integrated natively onto Framer layer */}
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
                        <h3 className="text-xl font-bold tracking-tight text-gray-900">Process Ledger</h3>
                        <p className="text-gray-500 text-sm mt-1">Audit and push a local offset to inventory stock node amounts.</p>
                    </div>
                    <button onClick={closeModal} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-full border shadow-sm transition-colors shrink-0">
                      <X size={20}/>
                    </button>
                  </div>
                  <form onSubmit={handleSubmit(onSubmit)} className="p-6 md:p-8 space-y-5">

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5 flex items-center justify-between">
                        Inventory Object
                        <div className="relative w-48">
                          <input
                            value={inventorySearch}
                            onChange={(e) => setInventorySearch(e.target.value)}
                            placeholder="Type to filter objects..."
                            className="w-full pl-3 pr-2 py-1 border rounded text-xs font-normal focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary/20"
                          />
                        </div>
                      </label>
                      <select
                        {...register('inventory')}
                        className={cn("w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white", errors.inventory ? "border-red-500" : "border-gray-200 focus:border-primary")}
                      >
                         <option value="">-- Choose Stock Node --</option>
                         {inventoryOptions.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                      </select>
                      {errors.inventory && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.inventory.message}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Action Type</label>
                          <select
                            {...register('movement_type')}
                            className={cn("w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white border-gray-200 focus:border-primary")}
                          >
                             <option value="adjustment">Adjustment Cycle</option>
                             <option value="purchase">Purchase Input</option>
                             <option value="sale">Sale Output</option>
                          </select>
                        </div>
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Quantity Variance</label>
                          <input
                            type="number" step="1"
                            {...register('quantity', { valueAsNumber: true })}
                            className={cn("w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-gray-50", errors.quantity ? "border-red-500" : "border-gray-200 focus:border-primary")}
                            placeholder="+10 or -5"
                          />
                          {errors.quantity && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.quantity.message}</p>}
                        </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100 flex flex-col gap-4">
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Link Commercial Sale <span className="font-normal text-gray-400 ml-1">(Optional)</span></label>
                          <select
                            {...register('sale')}
                            className="w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white border-gray-200 focus:border-primary"
                          >
                             <option value="">-- Unlinked --</option>
                             {metadata?.sales?.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                          </select>
                        </div>

                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-1.5">Link Commercial Purchase <span className="font-normal text-gray-400 ml-1">(Optional)</span></label>
                          <select
                            {...register('purchase')}
                            className="w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white border-gray-200 focus:border-primary"
                          >
                             <option value="">-- Unlinked --</option>
                             {metadata?.purchases?.map(opt => <option key={opt.id} value={opt.id}>{opt.label}</option>)}
                          </select>
                        </div>
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-1.5">Description Notes</label>
                      <textarea
                        {...register('notes')}
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder-gray-400"
                        placeholder="Additional details regarding movement..."
                        rows={2}
                      />
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
                        disabled={createMutator.isPending}
                        className="flex-1 px-5 py-3.5 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex justify-center items-center"
                      >
                        {createMutator.isPending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Push Movement'}
                      </button>
                    </div>
                  </form>
                </motion.div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Phase 42B: Detail Information Snapshot Wrapper */}
          <AnimatePresence>
            {detailOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 custom-scrollbar overflow-y-auto"
              >
                <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden my-8 border border-gray-100">
                  <div className="p-6 md:p-8 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <div>
                        <h3 className="text-xl font-bold tracking-tight text-gray-900">Ledger Entry Core</h3>
                        <p className="text-gray-500 text-sm mt-1">Immutable data signature.</p>
                    </div>
                    <button onClick={() => setDetailOpen(false)} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-full border shadow-sm transition-colors shrink-0">
                      <X size={20}/>
                    </button>
                  </div>
                  <div className="p-6 md:p-8">
                     {detailLoading ? (
                       <div className="flex justify-center p-12"><div className="w-8 h-8 border-4 border-gray-200 border-t-primary rounded-full animate-spin"></div></div>
                     ) : !detailMovement ? (
                       <p className="text-gray-500 text-center p-4">No details found.</p>
                     ) : (
                       <div className="space-y-6">
                          <div className="bg-gray-50 rounded-xl p-6 border border-gray-100">
                            <div className="flex items-center gap-3 justify-between">
                               <div>
                                  <p className="text-sm font-medium text-gray-500 mb-1">Target Resource</p>
                                  <h4 className="text-lg font-bold text-gray-900 leading-tight">{detailMovement.inventory?.item}</h4>
                               </div>
                               <div className={cn("px-4 py-2 rounded-xl border text-center",
                                  detailMovement.movement_type === 'purchase' ? 'border-green-200 bg-green-50' :
                                  detailMovement.movement_type === 'sale' ? 'border-red-200 bg-red-50' :
                                  'border-blue-200 bg-blue-50'
                               )}>
                                 <p className={cn("text-2xl font-black", detailMovement.quantity > 0 ? "text-green-700" : "text-red-700")}>{detailMovement.quantity > 0 ? '+' : ''}{detailMovement.quantity}</p>
                                 <p className={cn("text-xs font-bold uppercase tracking-wider", detailMovement.quantity > 0 ? "text-green-600" : "text-red-600")}>{detailMovement.movement_type}</p>
                               </div>
                            </div>
                          </div>

                          <div className="grid grid-cols-2 gap-4">
                            <div>
                               <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Node Warehouse</p>
                               <span className="text-sm font-medium text-gray-900">{detailMovement.inventory?.warehouse}</span>
                            </div>
                            <div>
                               <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Timestamp</p>
                               <span className="text-sm font-medium text-gray-900">{formatDate(detailMovement.date)}</span>
                            </div>
                            <div>
                               <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Remaining Offset</p>
                               <span className="text-sm font-medium text-gray-900">{detailMovement.inventory?.current_stock} count</span>
                            </div>
                            <div>
                               <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider">Link</p>
                               <span className="text-sm font-medium text-gray-900 font-mono">{detailMovement.purchase ? detailMovement.purchase.reference : (detailMovement.sale ? detailMovement.sale.reference : '-')}</span>
                            </div>
                          </div>

                          {detailMovement.notes && (
                            <div className="pt-4 border-t border-gray-100">
                               <p className="text-sm font-semibold text-gray-400 uppercase tracking-wider mb-2">Audit Notes</p>
                               <div className="text-sm text-gray-700 bg-gray-50/50 p-4 rounded-xl border border-gray-100/50 leading-relaxed">
                                  {detailMovement.notes}
                               </div>
                            </div>
                          )}
                       </div>
                     )}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

        </main>
      </div>
    </div>
  )
}
