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
import { Search, ArrowUpDown, ChevronLeft, ChevronRight, Edit2, Trash2, X } from 'lucide-react'

function formatCurrency(v) {
  if (!v) return '$0.00'
  const n = Number(v)
  const sign = n < 0 ? '-' : '+'
  return sign + '$' + Math.abs(n).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

const customerSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  phone: z.string().min(6, 'Please enter a valid phone number'),
  address: z.string().min(1, 'Address is required'),
  notes: z.string().optional(),
})

const sortOptions = [
  { k: 'name', l: 'Name (A → Z)' },
  { k: '-name', l: 'Name (Z → A)' },
  { k: 'balance', l: 'Balance (Low → High)' },
  { k: '-balance', l: 'Balance (High → Low)' },
  { k: 'created_at', l: 'Created (Oldest first)' },
  { k: '-created_at', l: 'Created (Newest first)' },
]

export default function CRM() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [currentSort, setCurrentSort] = useState('-created_at')
  const [currentPage, setCurrentPage] = useState(1)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [editingCustomer, setEditingCustomer] = useState(null)
  const [sortOpen, setSortOpen] = useState(false)

  // Close dropdowns on outside click
  useEffect(() => {
    function onDoc() { setSortOpen(false) }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  // Debounce search + reset page
  useEffect(() => {
    const t = setTimeout(() => {
      setDebouncedQuery(query)
      setCurrentPage(1)
    }, 300)
    return () => clearTimeout(t)
  }, [query])

  const { register, handleSubmit, reset, formState: { errors } } = useForm({
    resolver: zodResolver(customerSchema),
  })

  useEffect(() => {
    if (editingCustomer) {
      reset({
        name: editingCustomer.name || '',
        phone: editingCustomer.phone || '',
        address: editingCustomer.address || editingCustomer.city || '',
        notes: editingCustomer.notes || '',
      })
    } else {
      reset({ name: '', phone: '', address: '', notes: '' })
    }
  }, [editingCustomer, reset])

  //  Main data query — cached 60s, smooth page transitions
  const { data, isLoading: loadingCustomers } = useQuery({
    queryKey: ['crmCustomers', currentPage, debouncedQuery, currentSort],
    queryFn: () => getCustomers({ page: currentPage, search: debouncedQuery, ordering: currentSort }),
    placeholderData: (prev) => prev, 
    staleTime: 60 * 1000,
  })

  const customers = (data?.results ?? []).map(d => ({
    id: d.id,
    name: d.name,
    phone: d.phone,
    address: d.address || d.city || '',
    products: d.products_count ?? d.products ?? 0,
    balance: d.balance ?? 0,
  }))

  const totalPages = data?.count ? Math.ceil(data.count / 10) : 1

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ['crmCustomers'] })
    queryClient.invalidateQueries({ queryKey: ['dashboardData'] })
  }

  const saveMutator = useMutation({
    mutationFn: (payload) =>
      editingCustomer
        ? updateCustomer(editingCustomer.id, payload)
        : createCustomer(payload),
    onSuccess: () => {
      toast.success(`Customer ${editingCustomer ? 'updated' : 'added'} successfully`)
      invalidate()
      handleCloseModal()
    },
    onError: () => toast.error('Check your form fields or network connection'),
  })

  const deleteMutator = useMutation({
    mutationFn: deleteCustomer,
    onSuccess: () => {
      toast.success('Customer permanently deleted')
      invalidate()
    },
    onError: () => toast.error('Failed to delete customer'),
  })

  const handleCloseModal = () => {
    setIsModalOpen(false)
    setEditingCustomer(null)
    reset()
  }

  const handleDelete = (id, e) => {
    e.stopPropagation()
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

          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 border-b-2 border-primary inline-block pb-1">
                Customer CRM
              </h2>
              <p className="text-gray-500 text-sm mt-2">Manage relationships, contact details, and financial balances.</p>
            </div>
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex-1 md:flex-initial px-5 py-2.5 !rounded-button bg-primary text-white font-medium hover:bg-primary/95 transition-colors shadow-sm flex items-center justify-center gap-2"
            >
              <i className="ri-add-line ri-lg" />
              Add New Customer
            </button>
          </div>

          <div className="bg-white border text-sm md:text-base border-gray-200 rounded-2xl shadow-sm mb-8 overflow-hidden">
            {/* Toolbar */}
            <div className="p-4 md:p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/30">
              <div className="relative w-full md:w-96 group">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Search className="text-gray-400 group-focus-within:text-primary transition-colors" size={18} />
                </div>
                <input
                  type="text"
                  className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  placeholder="Search by name or phone..."
                  value={query}
                  onChange={e => setQuery(e.target.value)}
                />
              </div>

              <div className="relative">
                <button
                  onClick={(e) => { e.stopPropagation(); setSortOpen(v => !v) }}
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
                          onClick={(e) => { e.stopPropagation(); setCurrentSort(opt.k); setSortOpen(false) }}
                          className={cn(
                            'w-full text-left px-4 py-2 text-sm transition-colors',
                            currentSort === opt.k ? 'bg-primary/5 text-primary font-medium' : 'text-gray-700 hover:bg-gray-50'
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

            {/* Table */}
            <div className="p-4 md:p-5">
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
                      <tr>
                        <td colSpan={6} className="p-6 text-center text-gray-500">Loading customers...</td>
                      </tr>
                    ) : customers.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="p-8 text-center text-gray-500">
                          No customers found. Use the "Add" button to create one.
                        </td>
                      </tr>
                    ) : customers.map(c => (
                      <tr key={c.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-3 px-4">
                          <a
                            onClick={() => navigate(`/crm/customer/${c.id}`)}
                            className="font-medium text-gray-900 hover:text-primary cursor-pointer transition-colors"
                          >
                            {c.name}
                          </a>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500">{c.phone}</td>
                        <td className="py-3 px-4 text-sm text-gray-900">{c.address}</td>
                        <td className="py-3 px-4 text-sm text-gray-900">{c.products}</td>
                        <td className="py-3 px-4">
                          <span className={cn('font-semibold text-sm', !c.balance ? 'text-gray-500' : c.balance > 0 ? 'text-green-600' : 'text-red-600')}>
                            {formatCurrency(c.balance)}
                          </span>
                        </td>
                        <td className="py-3 px-4">
                          <div className="flex items-center gap-2">
                            <button
                              onClick={(e) => { e.stopPropagation(); setEditingCustomer(c); setIsModalOpen(true) }}
                              className="p-1.5 text-gray-500 hover:text-yellow-600 hover:bg-yellow-50 rounded transition-colors"
                              title="Edit"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              onClick={(e) => handleDelete(c.id, e)}
                              className="p-1.5 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Mobile cards */}
              <div className="md:hidden space-y-4 mt-4">
                {loadingCustomers ? (
                  <div className="p-6 text-center text-gray-500">Loading customers...</div>
                ) : customers.length === 0 ? (
                  <div className="p-6 text-center text-gray-500">No customers found.</div>
                ) : customers.map(c => (
                  <div key={c.id} className="bg-white rounded-xl border border-gray-100 shadow-sm p-4">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold text-gray-900">{c.name}</div>
                        <div className="text-sm text-gray-500 mt-1">{c.phone}</div>
                        <div className="text-sm text-gray-500 mt-1">{c.address}</div>
                      </div>
                      <div className="text-right">
                        <span className={cn('font-semibold text-sm', !c.balance ? 'text-gray-500' : c.balance > 0 ? 'text-green-600' : 'text-red-600')}>
                          {formatCurrency(c.balance)}
                        </span>
                        <p className="text-sm text-gray-500 mt-1">{c.products} Products</p>
                        <div className="mt-3 flex gap-2 justify-end">
                          <button onClick={() => navigate(`/crm/customer/${c.id}`)} className="px-3 py-1.5 bg-white border border-gray-200 text-sm rounded-lg text-gray-700 hover:bg-gray-50">View</button>
                          <button onClick={(e) => { e.stopPropagation(); setEditingCustomer(c); setIsModalOpen(true) }} className="px-3 py-1.5 bg-white border border-gray-200 text-sm rounded-lg text-gray-700 hover:bg-gray-50">Edit</button>
                          <button onClick={(e) => handleDelete(c.id, e)} className="px-3 py-1.5 bg-white border border-red-200 text-sm rounded-lg text-red-600 hover:bg-red-50">Delete</button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Pagination */}
            <div className="flex items-center justify-between p-4 border-t border-gray-200">
              <span className="text-sm text-gray-500">Page {currentPage} of {totalPages}</span>
              <div className="flex gap-2">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span className="hidden sm:inline">Previous</span>
                </button>
                <button
                  onClick={() => setCurrentPage(p => p + 1)}
                  disabled={!data?.next}
                  className="px-3 py-2 text-sm border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <span className="hidden sm:inline">Next</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Modal */}
          <AnimatePresence>
            {isModalOpen && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4 overflow-y-auto"
              >
                <motion.div
                  initial={{ scale: 0.95, opacity: 0, y: 20 }}
                  animate={{ scale: 1, opacity: 1, y: 0 }}
                  exit={{ scale: 0.95, opacity: 0, y: 20 }}
                  transition={{ type: 'spring', duration: 0.4, bounce: 0.2 }}
                  className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden my-8"
                >
                  <div className="p-6 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        {editingCustomer ? 'Edit' : 'Add New'} Customer
                      </h3>
                      <p className="text-gray-500 text-sm mt-1">Manage customer profile and contact details.</p>
                    </div>
                    <button onClick={handleCloseModal} className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-gray-600 bg-white rounded-full border shadow-sm transition-colors">
                      <X size={20} />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit(d => saveMutator.mutate(d))} className="p-6 space-y-4">
                    {[
                      { id: 'name', label: 'Customer Name', placeholder: 'Enter customer name' },
                      { id: 'phone', label: 'Phone Number', placeholder: 'Enter phone number' },
                      { id: 'address', label: 'Address', placeholder: 'Enter address' },
                    ].map(({ id, label, placeholder }) => (
                      <div key={id}>
                        <label htmlFor={id} className="block text-sm font-semibold text-gray-700 mb-1.5">{label}</label>
                        <input
                          {...register(id)}
                          id={id}
                          placeholder={placeholder}
                          className={cn(
                            'w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20',
                            errors[id] ? 'border-red-500' : 'border-gray-200 focus:border-primary'
                          )}
                        />
                        {errors[id] && <p className="mt-1 text-xs text-red-600">{errors[id].message}</p>}
                      </div>
                    ))}

                    <div>
                      <label htmlFor="notes" className="block text-sm font-semibold text-gray-700 mb-1.5">Notes</label>
                      <textarea
                        {...register('notes')}
                        id="notes"
                        rows={3}
                        placeholder="Notes (optional)"
                        className="w-full px-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary placeholder-gray-400"
                      />
                    </div>

                    <div className="flex gap-3 pt-4 border-t border-gray-100">
                      <button
                        type="button"
                        onClick={handleCloseModal}
                        className="flex-1 px-5 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={saveMutator.isPending}
                        className="flex-1 px-5 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/95 transition-colors flex items-center justify-center disabled:opacity-50"
                      >
                        {saveMutator.isPending
                          ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : editingCustomer ? 'Save Changes' : 'Add Customer'
                        }
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