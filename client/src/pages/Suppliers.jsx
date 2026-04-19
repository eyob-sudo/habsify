import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from '../services/toastService'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSuppliers, createSupplier, updateSupplier, deleteSupplier } from '../services/supplierService'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { cn } from '../utils/cn'
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, Edit2, Trash2 } from 'lucide-react'

function formatCurrency(v) {
  const sign = v < 0 ? '-' : ''
  return sign + '$' + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// PHASE 20 & 21: Professional Zod schemas injected for Suppliers
const supplierSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(6, 'Please enter a valid phone number'),
  address: z.string().min(1, 'Address is required')
})

const sortOptions = [
  { k: 'name', l: 'Name (A → Z)' },
  { k: '-name', l: 'Name (Z → A)' },
  { k: 'created_at', l: 'Created (oldest first)' },
  { k: '-created_at', l: 'Created (newest first)' },
  { k: 'balance', l: 'Balance (low → high)' },
  { k: '-balance', l: 'Balance (high → low)' },
  { k: 'products', l: 'Products (fewest → most)' },
  { k: '-products', l: 'Products (most → fewest)' },
  { k: 'address', l: 'Address (A → Z)' },
  { k: '-address', l: 'Address (Z → A)' },
  { k: 'latest_purchase', l: 'Latest Purchase (oldest first)' },
  { k: '-latest_purchase', l: 'Latest Purchase (newest first)' }
]

export default function Suppliers() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // State Management
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [currentSort, setCurrentSort] = useState('-created_at')
  const [currentPage, setCurrentPage] = useState(1)

  // UI Interaction States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState(null)
  const [sortOpen, setSortOpen] = useState(false)

  // Sub-Hooks for closing popups globally
  useEffect(() => {
    function onDoc() { setSortOpen(false) }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  // Debouncing search
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  // React-Hook-Form
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(supplierSchema)
  })

  useEffect(() => {
    if (editingSupplier) {
      reset({
        name: editingSupplier.name || '',
        phone: editingSupplier.phone || '',
        address: editingSupplier.address || ''
      })
    } else {
      reset({ name: '', phone: '', address: '' })
    }
  }, [editingSupplier, reset])

  // PHASE 20 continued: Replacing raw Promises with smart React Query
  const { data, isLoading: loading, isFetching } = useQuery({
    queryKey: ['suppliers', currentPage, debouncedQuery, currentSort],
    queryFn: () => getSuppliers({ page: currentPage, search: debouncedQuery, ordering: currentSort }),
    keepPreviousData: true,
    staleTime: 60 * 1000
  })

  const rawResults = data?.results || (Array.isArray(data) ? data : [])
  const suppliers = rawResults.map(d => ({
    id: d.id,
    name: d.name,
    phone: d.phone,
    address: d.address || '',
    products: d.products || d.products_count || 0,
    balance: d.balance || 0
  }))

  const saveMutator = useMutation({
    mutationFn: async (payload) => {
      if (editingSupplier) return updateSupplier(editingSupplier.id, payload)
      return createSupplier(payload)
    },
  onSuccess: () => {
    toast.success(`Supplier ${editingSupplier ? 'updated' : 'added'} successfully`)
    queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    queryClient.invalidateQueries({ queryKey: ['dashboardData'] })
    handleCloseModal()
  },
    onError: () => toast.error('Check your form fields or network connection')
  })

  const deleteMutator = useMutation({
    mutationFn: async (id) => deleteSupplier(id),
    onSuccess: () => {
      toast.success('Supplier permanently deleted')
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
    }
  })

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingSupplier(null)
    reset()
  }

  const onSubmit = (formData) => saveMutator.mutate(formData)

  const handleDelete = (id, e) => {
    e.stopPropagation()
    if (window.confirm('Warning: Deleting this supplier will remove all related records. Proceed?')) {
      deleteMutator.mutate(id)
    }
  }

  function openProfile(id) { navigate(`/suppliers/supplier/${id}`) }

  return (
    <div className="min-h-screen bg-gray-50/50 pt-20">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 md:ml-64 w-full transition-all duration-300">

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 border-b-2 border-primary inline-block pb-1">Suppliers</h2>
              <p className="text-gray-500 text-sm mt-2">Manage suppliers and track purchase history.</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex-1 md:flex-initial px-5 py-2.5 !rounded-button bg-primary text-white font-medium hover:bg-primary/95 transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <i className="ri-add-line ri-lg"></i>
              Add Supplier
            </button>
          </div>

          <div className="bg-white border text-sm md:text-base border-gray-200 rounded-2xl shadow-sm mb-8 overflow-hidden">
            <div className="p-4 md:p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/30">
              <div className="relative w-full md:w-96 group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="text-gray-400 group-focus-within:text-primary transition-colors" size={18} />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  placeholder="Search suppliers..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>

              <div className="relative flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={(e) => { e.stopPropagation(); setSortOpen(v => !v); }}
                  className="px-4 py-2 w-full md:w-auto border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 !rounded-button flex items-center justify-center gap-2"
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
                          onClick={(ev)=>{ ev.stopPropagation(); setCurrentSort(opt.k); setSortOpen(false)}}
                          className={cn("w-full text-left px-4 py-2 text-sm transition-colors", currentSort === opt.k ? "bg-primary/5 text-primary font-medium" : "text-gray-700 hover:bg-gray-50")}
                        >
                          {opt.l}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="p-4 md:p-5">
              <div className="hidden md:block">
                <table className="w-full text-left">
                  <thead className="bg-gray-50">
                    <tr className="text-xs font-semibold text-gray-500 uppercase border-b border-gray-200">
                      <th className="py-3 px-4">Supplier</th>
                      <th className="py-3 px-4">Phone</th>
                      <th className="py-3 px-4">Address</th>
                      <th className="py-3 px-4">Products</th>
                      <th className="py-3 px-4">Balance</th>
                      <th className="py-3 px-4">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {loading ? (
                      <tr><td colSpan={6} className="p-8 text-center text-gray-500">Loading suppliers...</td></tr>
                    ) : suppliers.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-gray-500">No suppliers found.</td></tr>
                    ) : (
                      suppliers.map((s) => (
                        <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4"><a onClick={()=>openProfile(s.id)} className="font-medium text-gray-900 hover:text-primary cursor-pointer transition-colors">{s.name}</a></td>
                          <td className="py-3 px-4"><p className="text-sm text-gray-500">{s.phone}</p></td>
                          <td className="py-3 px-4"><p className="text-sm text-gray-900">{s.address}</p></td>
                          <td className="py-3 px-4"><p className="text-sm text-gray-900">{s.products}</p></td>
                          <td className="py-3 px-4">
                            <p className={"font-semibold " + (s.balance >= 0 ? 'text-green-600' : 'text-red-600')}>{formatCurrency(s.balance)}</p>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <button onClick={(ev)=>{ ev.stopPropagation(); setEditingSupplier(s); setIsModalOpen(true)}} className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors !rounded-button">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={(ev)=>{ ev.stopPropagation(); handleDelete(s.id, ev)}} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors !rounded-button">
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
              <div className="md:hidden space-y-4">
                {loading ? (
                  <div className="p-6 text-center text-gray-500">Loading suppliers...</div>
                ) : suppliers.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">No suppliers found.</div>
                ) : (
                  suppliers.map((s) => (
                    <div key={s.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="font-semibold text-gray-900">{s.name}</div>
                          <div className="text-sm text-gray-600 mt-1">{s.phone}</div>
                          <div className="text-sm text-gray-600 mt-1">{s.address}</div>
                        </div>
                        <div className="text-right">
                          <p className={"font-semibold " + (s.balance >= 0 ? 'text-green-600' : 'text-red-600')}>{formatCurrency(s.balance)}</p>
                          <p className="text-sm text-gray-600 mt-1">{s.products} products</p>
                          <div className="mt-3 flex gap-2 justify-end">
                            <button onClick={() => openProfile(s.id)} className="px-3 py-1.5 bg-gray-50 text-xs font-medium rounded-lg text-gray-700 hover:bg-gray-100">View</button>
                            <button onClick={(ev)=>{ ev.stopPropagation(); setEditingSupplier(s); setIsModalOpen(true)}} className="px-3 py-1.5 bg-yellow-50 text-xs font-medium rounded-lg text-yellow-700 hover:bg-yellow-100">Edit</button>
                            <button onClick={(ev)=>{ ev.stopPropagation(); handleDelete(s.id, ev)}} className="px-3 py-1.5 bg-red-50 text-xs font-medium rounded-lg text-red-700 hover:bg-red-100">Delete</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                Page {currentPage} of {data ? Math.max(1, Math.ceil(data.count / (data.pageSize || 1))) : 1}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap !rounded-button flex items-center"
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4 mr-1" /> Prev
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil((data?.count || 1) / (data?.pageSize || 1)), p + 1))}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap !rounded-button flex items-center"
                  disabled={!(data && data.next)}
                >
                  Next <ChevronRight className="w-4 h-4 ml-1" />
                </button>
              </div>
            </div>
          </div>

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
                    <h3 className="text-xl font-bold tracking-tight text-gray-900">{editingSupplier ? 'Edit Supplier' : 'Add New Supplier'}</h3>
                    <button onClick={handleCloseModal} className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-full border shadow-sm transition-colors">
                      <i className="ri-close-line"></i>
                    </button>
                  </div>
                  <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Supplier Name</label>
                      <input
                        {...register('name')}
                        className={cn("w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20", errors.name ? "border-red-500" : "border-gray-200 focus:border-primary")}
                        placeholder="Supplier Co."
                      />
                      {errors.name && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.name.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone Number</label>
                      <input
                        {...register('phone')}
                        className={cn("w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20", errors.phone ? "border-red-500" : "border-gray-200 focus:border-primary")}
                        placeholder="+1 (555) 000-0000"
                      />
                      {errors.phone && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.phone.message}</p>}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Address</label>
                      <input
                        {...register('address')}
                        className={cn("w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20", errors.address ? "border-red-500" : "border-gray-200 focus:border-primary")}
                        placeholder="123 Business St."
                      />
                      {errors.address && <p className="mt-1.5 text-xs text-red-500 font-medium">{errors.address.message}</p>}
                    </div>
                    <div className="flex gap-3 pt-4">
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="flex-1 px-4 py-3 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saveMutator.isPending}
                        className="flex-1 px-4 py-3 bg-primary text-white rounded-xl text-sm font-medium hover:bg-primary/95 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
                      >
                        {saveMutator.isPending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (editingSupplier ? 'Save Changes' : 'Create Supplier')}
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
