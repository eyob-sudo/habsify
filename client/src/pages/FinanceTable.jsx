import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import toast from '../services/toastService'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowLeft, Wallet, TrendingUp, TrendingDown, Filter, Search, PlusCircle, X } from 'lucide-react'
import { cn } from '../utils/cn'
import { getCashSummary, getAccounts, getSaleDropdown, getPurchaseDropdown, createFinanceTransaction, getTransactionTypes } from '../services/financeService'

function formatMoney(value, sign = '') {
  if (value == null || value === '') return `${sign}$0.00`
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  return `${sign}$${Math.abs(num).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// PHASE 25: Implement isolated Zod validation for Finance Forms
const transactionSchema = z.object({
  account: z.string().min(1, 'Account is required'),
  type: z.string().min(1, 'Transaction type is required'),
  amount: z.number().min(0.01, 'Amount must be greater than zero'),
  description: z.string().min(1, 'Description is required'),
  notes: z.string().optional(),
  linked_sale: z.string().optional(),
  linked_purchase: z.string().optional()
})

export default function FinanceTable() {
  const queryClient = useQueryClient()
  const [query, setQuery] = useState('')
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState('all')
  const [filterOpen, setFilterOpen] = useState(false)
  const [modalOpen, setModalOpen] = useState(false)

  const { register, handleSubmit, reset, formState: { errors }, watch } = useForm({
    resolver: zodResolver(transactionSchema),
    defaultValues: { account: '', type: 'revenue', amount: '', description: '', notes: '', linked_sale: '', linked_purchase: '' }
  })
  const txType = watch('type')

  // Debouncing Query
  useEffect(() => {
    const t = setTimeout(() => setDebouncedQuery(query.trim()), 300)
    return () => clearTimeout(t)
  }, [query])

  // Sub-Hooks for closing popups globally
  useEffect(() => {
    function onDoc() { setFilterOpen(false) }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  // PHASE 26: Aggressive React Query fetching architecture mapped implicitly to Cash Summary
  const { data: summary, isLoading: loadingSummary } = useQuery({
    queryKey: ['cashSummary', debouncedQuery, typeFilter],
    queryFn: async () => {
      const res = await getCashSummary({ search: debouncedQuery, type: typeFilter === 'all' ? '' : typeFilter })
      return res?.data ?? res ?? {}
    },
    staleTime: 60 * 1000
  })

  const transactions = Array.isArray(summary?.transaction_history) ? summary.transaction_history : []

  // Prefetching supporting data fields (Accounts, Sales, Purchases linkings)
  const { data: metadata } = useQuery({
    queryKey: ['financeMetadata'],
    queryFn: async () => {
      const [accountsRes, salesRes, purchasesRes, typesRes] = await Promise.all([
        getAccounts(), getSaleDropdown(), getPurchaseDropdown(), getTransactionTypes()
      ])
      return {
        accounts: accountsRes?.data ?? accountsRes ?? [],
        sales: salesRes?.data ?? salesRes ?? [],
        purchases: purchasesRes?.data ?? purchasesRes ?? [],
        types: typesRes?.data ?? typesRes ?? []
      }
    },
    staleTime: 5 * 60 * 1000 // Cache for 5 minutes
  })

  // Auto-mutation Cache refetcher
  const txMutator = useMutation({
    mutationFn: async (payload) => createFinanceTransaction(payload),
    onSuccess: () => {
      toast.success('Transaction saved')
      queryClient.invalidateQueries({ queryKey: ['cashSummary'] })
      queryClient.invalidateQueries({ queryKey: ['financeMetadata'] })
      queryClient.invalidateQueries({ queryKey: ['financeStats'] })
      queryClient.invalidateQueries({ queryKey: ['financeAccounts'] })
      queryClient.invalidateQueries({ queryKey: ['dashboardData'] })
      queryClient.invalidateQueries({ queryKey: ['crmCustomers'] })
      queryClient.invalidateQueries({ queryKey: ['suppliers'] })
      closeModal()
    },
    onError: () => toast.error('Failed to save transaction')
  })

  function openModal() {
    reset({ account: '', type: 'revenue', amount: '', description: '', notes: '', linked_sale: '', linked_purchase: '' })
    setModalOpen(true)
  }

  function closeModal() {
    setModalOpen(false)
  }

  const onSubmit = (formData) => {
    const payload = {
      ...formData,
      linked_sale: formData.linked_sale || null,
      linked_purchase: formData.linked_purchase || null
    }
    txMutator.mutate(payload)
  }

  return (
    <div className="min-h-screen bg-gray-50/50 pt-20">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 md:ml-64 w-full transition-all duration-300">

          {/* Header */}
          <div className="flex items-center gap-4 mb-8">
            <Link to="/finance" className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-primary hover:bg-white bg-white border border-gray-200 rounded-xl transition-all shadow-sm">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 border-b-2 border-primary inline-block pb-1">Cash Management</h2>
              <p className="text-gray-500 text-sm mt-2">Track and manage all cash transactions with detailed history and reporting</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 relative overflow-hidden group">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-purple-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
              <div className="flex items-center justify-between mb-4 relative">
                <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center shadow-sm">
                  <Wallet className="text-purple-600" size={24} />
                </div>
                <span className="text-sm font-semibold tracking-wider text-gray-400 uppercase">Current Balance</span>
              </div>
              <p className="text-3xl font-black text-purple-600 mb-1 relative">{loadingSummary ? '...' : formatMoney(summary?.current_balance)}</p>
              <p className="text-sm font-medium text-gray-500 relative">Available Cash</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 relative overflow-hidden group">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
              <div className="flex items-center justify-between mb-4 relative">
                <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center shadow-sm">
                  <TrendingUp className="text-green-600" size={24} />
                </div>
                <span className="text-sm font-semibold tracking-wider text-gray-400 uppercase">Total Inflows</span>
              </div>
              <p className="text-3xl font-black text-green-600 mb-1 relative">{loadingSummary ? '...' : formatMoney(summary?.total_inflows, '+')}</p>
              <p className="text-sm font-medium text-gray-500 relative">All Inflows</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 relative overflow-hidden group">
              <div className="absolute -right-6 -top-6 w-24 h-24 bg-red-50 rounded-full opacity-50 group-hover:scale-110 transition-transform"></div>
              <div className="flex items-center justify-between mb-4 relative">
                <div className="w-12 h-12 bg-red-100 rounded-xl flex items-center justify-center shadow-sm">
                  <TrendingDown className="text-red-600" size={24} />
                </div>
                <span className="text-sm font-semibold tracking-wider text-gray-400 uppercase">Total Outflows</span>
              </div>
              <p className="text-3xl font-black text-red-600 mb-1 relative">{loadingSummary ? '...' : formatMoney(summary?.total_outflows, '-')}</p>
              <p className="text-sm font-medium text-gray-500 relative">All Outflows</p>
            </div>
          </div>

          <div className="bg-white border text-sm md:text-base border-gray-200 rounded-2xl shadow-sm mb-8">
            <div className="p-4 md:p-5 border-b border-gray-100 flex flex-col md:flex-row gap-4 items-center justify-between bg-gray-50/30 rounded-t-2xl">
              <h3 className="text-lg font-bold tracking-tight text-gray-900 hidden md:block w-48">History</h3>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto flex-1 md:justify-end">
                <div className="relative group w-full md:w-64">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="text-gray-400 group-focus-within:text-primary transition-colors" size={18} />
                  </div>
                  <input
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Search history..."
                    className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  />
                </div>
                <div className="relative">
                  <button
                    onClick={(e) => { e.stopPropagation(); setFilterOpen(v => !v) }}
                    className="w-full md:w-auto px-4 py-2.5 border border-gray-200 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50 flex items-center justify-center gap-2 shadow-sm transition-colors"
                  >
                    <Filter size={16} />
                    <span>
                      {{
                        all: 'All Types',
                        revenue: 'Revenue (Sale)',
                        cogs: 'Cost of Goods',
                        expense: 'Business Expense',
                        refund_in: 'Refund In',
                        refund_out: 'Refund Out',
                        capital: 'Capital'
                      }[typeFilter] || typeFilter}
                    </span>
                  </button>
                  {filterOpen && (
                    <div className="absolute top-full right-0 mt-2 w-48 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden">
                      <div className="py-2">
                        {[
                          { k: 'all', l: 'All Types' },
                          { k: 'revenue', l: 'Revenue (Sale)' },
                          { k: 'cogs', l: 'Cost of Goods' },
                          { k: 'expense', l: 'Business Expense' },
                          { k: 'refund_in', l: 'Refund In' },
                          { k: 'refund_out', l: 'Refund Out' },
                          { k: 'capital', l: 'Capital' }
                        ].map(opt => (
                          <button
                            key={opt.k}
                            onClick={(ev) => { ev.stopPropagation(); setTypeFilter(opt.k); setFilterOpen(false) }}
                            className={cn("w-full text-left px-4 py-2 text-sm transition-colors", typeFilter === opt.k ? "bg-primary/5 text-primary font-medium" : "text-gray-700 hover:bg-gray-50")}
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

            <div className="w-full overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th scope="col" className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Description</th>
                    <th scope="col" className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Type</th>
                    <th scope="col" className="px-6 py-3 text-left text-sm font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Amount</th>
                    <th scope="col" className="px-6 py-3 text-right text-sm font-semibold text-gray-700 uppercase tracking-wider whitespace-nowrap">Balance</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {loadingSummary ? (
                    <tr><td colSpan={4} className="p-8 text-center text-gray-500">Loading transactions...</td></tr>
                  ) : transactions.length === 0 ? (
                    <tr><td colSpan={4} className="p-8 text-center text-gray-500">No transactions found.</td></tr>
                  ) : (
                    transactions.map(tx => (
                      <tr key={tx.id} className="hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-6 border-b border-gray-100 min-w-[200px]">
                          <p className="text-sm font-semibold text-gray-900">{tx.description}</p>
                          <p className="text-xs text-gray-400 mt-1">{tx.date}</p>
                        </td>
                        <td className="py-4 px-6 border-b border-gray-100 whitespace-nowrap">
                          <span className={cn("text-xs font-semibold px-2.5 py-1 rounded-full uppercase tracking-wider", tx.type === 'inflow' || tx.type === 'revenue' || tx.type === 'refund_in' || tx.type === 'capital' ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700")}>
                            {tx.type}
                          </span>
                        </td>
                        <td className="py-4 px-6 border-b border-gray-100 whitespace-nowrap">
                          <p className={cn("font-bold", tx.type === 'inflow' || tx.type === 'revenue' || tx.type === 'refund_in' || tx.type === 'capital' ? "text-green-600" : "text-red-600")}>
                            {formatMoney(tx.amount, tx.type === 'inflow' || tx.type === 'revenue' || tx.type === 'refund_in' || tx.type === 'capital' ? '+' : '-')}
                          </p>
                        </td>
                        <td className="py-4 px-6 border-b border-gray-100 text-right whitespace-nowrap">
                          <p className="text-sm font-bold text-gray-900">{formatMoney(tx.balance)}</p>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </main>
      </div>

      {/* Floating Add Data Modal Phase 27! */}
      <div className="fixed right-6 flex flex-col gap-3 z-30 bottom-[75px] md:bottom-6">
        <button
          onClick={openModal}
          className="w-16 h-16 bg-white hover:bg-white text-primary rounded-full shadow-lg hover:shadow-2xl transition-all duration-300 flex items-center justify-center group border-2 border-primary/20 hover:border-primary/40 hover:scale-110 active:scale-95"
          title="Add Transaction"
        >
           <PlusCircle size={32} className="group-hover:rotate-90 transition-transform duration-300" />
        </button>
      </div>

      <AnimatePresence>
        {modalOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/50 backdrop-blur-sm shadow-sm flex items-center justify-center z-[100] p-4 overflow-y-auto custom-scrollbar"
          >
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
              className="bg-white rounded-3xl shadow-2xl w-full max-w-xl mx-4 my-8 relative overflow-hidden"
            >
              <div className="p-6 md:p-8 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                <div>
                  <h3 className="text-2xl font-bold tracking-tight text-gray-900">New Transaction</h3>
                  <p className="text-gray-500 text-sm mt-1">Record a manual deposit or withdrawal.</p>
                </div>
                <button
                  onClick={closeModal}
                  className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit(onSubmit)} className="p-6 md:p-8 space-y-6">

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Account</label>
                    <select
                      {...register('account')}
                      className={cn("w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white", errors.account ? "border-red-500" : "border-gray-200 focus:border-primary")}
                    >
                      <option value="">Select Account</option>
                      {metadata?.accounts.map(acc => (
                        <option key={acc.id} value={acc.id}>{acc.name} ({acc.account_number})</option>
                      ))}
                    </select>
                    {errors.account && <p className="mt-1.5 text-xs font-medium text-red-500">{errors.account.message}</p>}
                  </div>

                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Transaction Type</label>
                    <select
                      {...register('type')}
                      className={cn("w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white", errors.type ? "border-red-500" : "border-gray-200 focus:border-primary")}
                    >
                      <option value="">Select Type</option>
                      {metadata?.types?.map((typeOpt) => (
                        <option key={typeOpt.value} value={typeOpt.value}>
                          {typeOpt.label}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Amount</label>
                  <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                      <span className="text-gray-500 font-medium">$</span>
                    </div>
                    <input
                      type="number" step="0.01"
                      {...register('amount', { valueAsNumber: true })}
                      className={cn("w-full pl-8 pr-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20", errors.amount ? "border-red-500" : "border-gray-200 focus:border-primary")}
                      placeholder="0.00"
                    />
                  </div>
                  {errors.amount && <p className="mt-1.5 text-xs font-medium text-red-500">{errors.amount.message}</p>}
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Description</label>
                  <input
                    {...register('description')}
                    className={cn("w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20", errors.description ? "border-red-500" : "border-gray-200 focus:border-primary")}
                    placeholder="E.g. Invoice Payment #1024"
                  />
                  {errors.description && <p className="mt-1.5 text-xs font-medium text-red-500">{errors.description.message}</p>}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-100">
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Link Sale (Optional)</label>
                    <select {...register('linked_sale')} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                      <option value="">No linked sale</option>
                      {metadata?.sales.map(s => (
                        <option key={s.id} value={s.id}>{s.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-2">Link Purchase (Optional)</label>
                    <select {...register('linked_purchase')} className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary bg-white">
                      <option value="">No linked purchase</option>
                      {metadata?.purchases.map(p => (
                        <option key={p.id} value={p.id}>{p.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-2">Additional Notes</label>
                  <textarea
                    {...register('notes')}
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary"
                    placeholder="Optional notes..."
                    rows={3}
                  />
                </div>

                <div className="flex gap-4 pt-6 border-t border-gray-100">
                  <button
                    type="button" onClick={closeModal}
                    className="flex-1 px-5 py-3.5 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit" disabled={txMutator.isPending}
                    className="flex-1 px-5 py-3.5 bg-gray-900 text-white rounded-xl text-sm font-semibold hover:bg-black transition-colors shadow-sm disabled:opacity-50 flex justify-center items-center"
                  >
                    {txMutator.isPending ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Save Transaction'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
