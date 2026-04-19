import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import toast from '../services/toastService'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCustomers, createCustomer, updateCustomer, deleteCustomer } from '../services/crmService'
import { motion, AnimatePresence } from 'framer-motion'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { cn } from '../utils/cn'
import { Search, Filter, ArrowUpDown, ChevronLeft, ChevronRight, Edit2, Trash2, Phone, MapPin, Package, DollarSign, X } from 'lucide-react'

function formatCurrency(v) {
  const sign = v < 0 ? '-' : ''
  return sign + '$' + Math.abs(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

// PHASE 17 & 18: Professional Zod schemas injected for CRM
const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(6, 'Please enter a valid phone number'),
  address: z.string().min(1, 'Address is required'),
  notes: z.string().optional()
})

const sortOptions = [
  { k: 'name', l: 'Name (A → Z)' },
  { k: '-name', l: 'Name (Z → A)' },
  { k: 'balance', l: 'Balance (Low → High)' },
  { k: '-balance', l: 'Balance (High → Low)' },
  { k: 'created_at', l: 'Created (Oldest first)' },
  { k: '-created_at', l: 'Created (Newest first)' }
]

export default function CRM() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  // State Management
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [currentSort, setCurrentSort] = useState('-created_at')
  const [currentPage, setCurrentPage] = useState(1)

  // UI Interaction States
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [filterOpen, setFilterOpen] = useState(false)
  const [sortOpen, setSortOpen] = useState(false)

  // Sub-Hooks for closing popups globally
  useEffect(() => {
    function onDoc() { setFilterOpen(false); setSortOpen(false) }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  // Debouncing CRM search before fetching
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query)
      setCurrentPage(1) // Reset pagination on new search
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  // React-Hook-Form instance
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(customerSchema)
  })

  // Populate form if editing
  useEffect(() => {
    if (editingCustomer) {
      reset({
        name: editingCustomer.name || '',
        phone: editingCustomer.phone || '',
        address: editingCustomer.address || editingCustomer.city || '',
        notes: editingCustomer.notes || ''
      })
    } else {
      reset({ name: '', phone: '', address: '', notes: '' })
    }
  }, [editingCustomer, reset])

  // PHASE 17 continued: Replacing raw Promises with smart React Query Cached Engine
  const { data, isLoading: loadingCustomers, isFetching } = useQuery({
    queryKey: ['crmCustomers', currentPage, debouncedQuery, currentSort],
    queryFn: () => getCustomers({ page: currentPage, search: debouncedQuery, ordering: currentSort }),
    keepPreviousData: true, // Smooth transitions between pages!
    staleTime: 60 * 1000
  })

  const rawResults = data?.results || (Array.isArray(data) ? data : [])
  const customers = rawResults.map(d => ({
    id: d.id,
    name: d.name,
    phone: d.phone,
    address: d.address || d.city || '',
    products: d.products_count != null ? d.products_count : (d.products || 0),
    balance: d.balance != null ? d.balance : 0
  }))

  // Database Mutations (Automated Cache Validation!)
  const saveMutator = useMutation({
    mutationFn: async (payload) => {
      if (editingCustomer) return updateCustomer(editingCustomer.id, payload)
      return createCustomer(payload)
    },
  onSuccess: () => {
    toast.success(`Customer ${editingCustomer ? 'updated' : 'added'} successfully`)
    queryClient.invalidateQueries({ queryKey: ['crmCustomers'] }) // Smart self-healing UI
    queryClient.invalidateQueries({ queryKey: ['dashboardData'] })
    handleCloseModal()
  },
    onError: () => toast.error('Check your form fields or network connection')
  })

  const deleteMutator = useMutation({
    mutationFn: async (id) => deleteCustomer(id),
    onSuccess: () => {
      toast.success('Customer permanently deleted')
      queryClient.invalidateQueries({ queryKey: ['crmCustomers'] })
    }
  })

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingCustomer(null)
    reset()
  }

  const onSubmit = (formData) => {
    saveMutator.mutate(formData)
  }

  const handleDelete = (id, e) => {
    e.stopPropagation() // Prevent row click
    if (window.confirm('Warning: Deleting this customer will remove all related history. Proceed?')) {
      deleteMutator.mutate(id)
    }
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pt-20">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 md:ml-64 w-full transition-all duration-300">

          {/* Header Controls */}
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 border-b-2 border-primary inline-block pb-1">Customer CRM</h2>
              <p className="text-gray-500 text-sm mt-2">Manage relationships, contact details, and financial balances.</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex-1 md:flex-initial px-5 py-2.5 !rounded-button bg-primary text-white font-medium hover:bg-primary/95 transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <i className="ri-add-line ri-lg"></i>
              Add New Customer
            </button>
          </div>

          <div className="bg-white border text-sm md:text-base border-gray-200 rounded-2xl shadow-sm mb-8 overflow-hidden">
            <div className="p-4 md:p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/30">
              {/* Search Bar */}
              <div className="relative w-full md:w-96 group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="text-gray-400 group-focus-within:text-primary transition-colors" size={18} />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  placeholder="Search by name or phone..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>

              {/* Action Toolbar */}
              <div className="flex items-center gap-3 w-full md:w-auto">
                <button
                  onClick={(e) => { e.stopPropagation(); setFilterOpen(v => !v); setSortOpen(false) }}
                  className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 !rounded-button flex items-center gap-2"
                >
                  <Filter className="w-4 h-4" />
                  <span className="hidden sm:inline">Filter</span>
                </button>

                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setSortOpen(v => !v); setFilterOpen(false) }}
                    className="px-4 py-2 border border-gray-200 rounded-lg text-sm text-gray-700 hover:bg-gray-50 !rounded-button flex items-center gap-2"
                  >
                    <ArrowUpDown className="w-4 h-4" />
                    <span className="hidden sm:inline">Sort</span>
                  </button>
                  {sortOpen && (
                    <div className="absolute top-full right-0 mt-2 w-56 bg-white border border-gray-200 rounded-xl shadow-xl z-20 overflow-hidden">
                      <div className="py-2">
                        {sortOptions.map(opt => (
                          <button
                            key={opt.k}
                            onClick={(ev) => { ev.stopPropagation(); setCurrentSort(opt.k); setSortOpen(false) }}
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
            </div>

            {/* Customer Table */}
            <div className="p-4 md:p-5">
              {/* Table for Desktop */}
              <div className="hidden md:block">
                <table className="w-full text-left">
                  <thead className="bg-gray-50">
                    <tr className="text-xs font-semibold text-gray-500 uppercase">
                      <th className="px-4 py-3 border-b border-gray-200">Customer</th>
                      <th className="px-4 py-3 border-b border-gray-200">Phone</th>
                      <th className="px-4 py-3 border-b border-gray-200">Address</th>
                      <th className="px-4 py-3 border-b border-gray-200">Products</th>
                      <th className="px-4 py-3 border-b border-gray-200">Balance</th>
                      <th className="px-4 py-3 border-b border-gray-200">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {loadingCustomers ? (
                      <tr><td colSpan={6} className="p-6 text-center text-gray-500">Loading customers...</td></tr>
                    ) : customers.length === 0 ? (
                      <tr><td colSpan={6} className="p-8 text-center text-gray-500">No customers found. Use the "Add" button to create a customer.</td></tr>
                    ) : (
                      customers.map((c) => (
                        <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-3">
                              <div>
                                <a onClick={() => navigate(`/crm/customer/${c.id}`)} className="font-medium text-gray-900 hover:text-primary cursor-pointer transition-colors">{c.name}</a>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4"><p className="text-sm text-gray-500">{c.phone}</p></td>
                          <td className="py-3 px-4"><p className="text-sm text-gray-900">{c.address}</p></td>
                          <td className="py-3 px-4"><p className="text-sm text-gray-900">{c.products}</p></td>
                          <td className="py-3 px-4">
                            <p className={"font-semibold " + (c.balance >= 0 ? 'text-green-600' : 'text-red-600')}>{formatCurrency(c.balance)}</p>
                          </td>
                          <td className="py-3 px-4">
                            <div className="flex items-center gap-2">
                              <button onClick={(ev)=>{ ev.stopPropagation(); setEditingCustomer(c); setIsModalOpen(true)}} className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors !rounded-button" title="Edit Customer">
                                <Edit2 className="w-4 h-4" />
                              </button>
                              <button onClick={(ev)=>{ ev.stopPropagation(); handleDelete(c.id, ev)}} className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors !rounded-button" title="Delete Customer">
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

              {/* Mobile Card View */}
              <div className="md:hidden space-y-4 mt-4">
                {loadingCustomers ? (
                  <div className="p-6 text-center text-gray-500">Loading customers...</div>
                ) : customers.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">No customers found.</div>
                ) : (
                  customers.map((c) => (
                    <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4 hover:shadow-md transition-shadow">
                      <div className="flex justify-between items-start mb-2">
                        <div>
                          <div className="font-semibold text-gray-900">{c.name}</div>
                          <div className="text-sm text-gray-900 mt-1">{c.phone}</div>
                          <div className="text-sm text-gray-900 mt-1">{c.address}</div>
                        </div>
                        <div className="text-right">
                          <p className={"font-semibold " + (c.balance >= 0 ? 'text-green-600' : 'text-red-600')}>{formatCurrency(c.balance)}</p>
                          <p className="text-sm text-gray-900 mt-1">{c.products}</p>
                          <div className="mt-3 flex gap-2 justify-end">
                            <button onClick={() => navigate(`/crm/customer/${c.id}`)} className="px-3 py-2 bg-white border border-gray-200 text-sm rounded-lg text-gray-700 hover:bg-gray-50">View</button>
                            <button onClick={(ev)=>{ ev.stopPropagation(); setEditingCustomer(c); setIsModalOpen(true)}} className="px-3 py-2 bg-white border border-gray-200 text-sm rounded-lg text-gray-700 hover:bg-gray-50">Edit</button>
                            <button onClick={(ev)=>{ ev.stopPropagation(); handleDelete(c.id, ev)}} className="px-3 py-2 bg-white border border-red-200 text-sm rounded-lg text-red-600 hover:bg-red-50">Delete</button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Pagination controls */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200">
              <div className="text-sm text-gray-500">
                Page {currentPage} of {data ? Math.ceil(data.count / (data.pageSize || 1)) : 1}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap !rounded-button"
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="ml-1">Previous</span>
                </button>
                <button
                  onClick={() => setCurrentPage(p => Math.min(Math.ceil((data?.count || 1) / (data?.pageSize || 1)), p + 1))}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap !rounded-button"
                  disabled={!(data && data.next)}
                >
                  <span className="mr-1">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Add Customer Modal */}
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
                      <h3 className="text-xl font-bold tracking-tight text-gray-900">{editingCustomer ? 'Edit' : 'Add New'} Customer</h3>
                      <p className="text-gray-500 text-sm mt-1">Manage customer profile and contact details.</p>
                    </div>
                    <button onClick={handleCloseModal} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-full border shadow-sm transition-colors shrink-0">
                      <X size={20} />
                    </button>
                  </div>
                  <form onSubmit={handleSubmit(onSubmit)} className="p-6 md:p-8 space-y-5">
                    <div className="space-y-4">
                      <div>
                        <label htmlFor="name" className="block text-sm font-semibold text-gray-700 mb-1.5">Customer Name</label>
                        <input
                          {...register('name')}
                          id="name"
                          className={cn("w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20", errors.name ? "border-red-500" : "border-gray-200 focus:border-primary")}
                          placeholder="Enter customer name"
                        />
                        {errors.name && <p className="mt-1.5 text-xs text-red-600 font-medium">{errors.name.message}</p>}
                      </div>
                      <div>
                        <label htmlFor="phone" className="block text-sm font-semibold text-gray-700 mb-1.5">Phone Number</label>
                        <input
                          {...register('phone')}
                          id="phone"
                          className={cn("w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20", errors.phone ? "border-red-500" : "border-gray-200 focus:border-primary")}
                          placeholder="Enter phone number"
                        />
                        {errors.phone && <p className="mt-1.5 text-xs text-red-600 font-medium">{errors.phone.message}</p>}
                      </div>
                      <div>
                        <label htmlFor="address" className="block text-sm font-semibold text-gray-700 mb-1.5">Address</label>
                        <input
                          {...register('address')}
                          id="address"
                          className={cn("w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20", errors.address ? "border-red-500" : "border-gray-200 focus:border-primary")}
                          placeholder="Enter address"
                        />
                        {errors.address && <p className="mt-1.5 text-xs text-red-600 font-medium">{errors.address.message}</p>}
                      </div>
                      <div>
                        <label htmlFor="notes" className="block text-sm font-semibold text-gray-700 mb-1.5">Notes</label>
                        <textarea
                          {...register('notes')}
                          id="notes"
                          className={cn("w-full px-4 py-2.5 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder-gray-400 border-gray-200")}
                          placeholder="Notes (optional)"
                          rows={3}
                        />
                      </div>
                    </div>
                    <div className="flex gap-4 pt-6 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="flex-1 px-5 py-3.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saveMutator.isPending}
                        className="flex-1 px-5 py-3.5 bg-primary hover:bg-primary/95 text-white rounded-xl text-sm font-semibold transition-colors shadow-sm flex items-center justify-center disabled:opacity-50"
                      >
                        {saveMutator.isPending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : (editingCustomer ? 'Save Changes' : 'Add Customer')}
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
