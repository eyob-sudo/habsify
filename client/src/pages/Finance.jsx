import React, { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import toast from '../services/toastService'
import { getFinanceStats, getAccounts, createAccount, updateAccount } from "../services/financeService";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '../utils/cn'
import { ArrowUpRight, ArrowDownRight, ArrowRight, Building2, Banknote, Search, Plus, Edit2, Wallet, X, TrendingUp, TrendingDown, ArrowRightLeft } from 'lucide-react'

function formatMoney(value) {
  if (value == null || value === '') return '$0'
  const num = Number(value)
  if (Number.isNaN(num)) return String(value)
  return `$${num.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

// PHASE 28: Zod Schemas for Finance Accounts
const accountSchema = z.object({
  name: z.string().min(1, 'Short name is required'),
  full_name: z.string().min(1, 'Full name is required'),
  account_type: z.enum(['bank', 'cash']),
  account_number: z.string().optional().nullable()
}).refine(data => {
  if (data.account_type === 'bank' && (!data.account_number || data.account_number.trim().length === 0)) {
    return false;
  }
  return true;
}, {
  message: 'Account number is required for bank accounts',
  path: ['account_number']
});

export default function Finance() {
  const queryClient = useQueryClient()
  const [search, setSearch] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [accountModalOpen, setAccountModalOpen] = useState(false)
  const [editingAccount, setEditingAccount] = useState(null)

  const { register, handleSubmit, reset, watch, formState: { errors } } = useForm({
    resolver: zodResolver(accountSchema),
    defaultValues: { name: '', full_name: '', account_type: 'bank', account_number: '' }
  })

  const accountType = watch('account_type')

  // Debouncing Search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search.trim()), 300)
    return () => clearTimeout(t)
  }, [search])

  // Automatically reset modal form on distinct states
  useEffect(() => {
    if (editingAccount) {
      reset({
        name: editingAccount.name || '',
        full_name: editingAccount.full_name || '',
        account_type: editingAccount.account_type || 'bank',
        account_number: editingAccount.account_number || ''
      })
    } else {
      reset({ name: '', full_name: '', account_type: 'bank', account_number: '' })
    }
  }, [editingAccount, reset])

  // PHASE 29: React Query replacing the huge custom manual promise resolution
  const { data: stats, isLoading: loadingStats } = useQuery({
    queryKey: ['financeStats', debouncedSearch],
    queryFn: async () => {
      const res = await getFinanceStats({ search: debouncedSearch })
      return res?.data ?? res ?? null
    },
    staleTime: 60 * 1000
  })

  const { data: accountsRaw, isLoading: loadingAccounts } = useQuery({
    queryKey: ['financeAccounts'],
    queryFn: async () => {
      const res = await getAccounts()
      const data = res?.data || res;
      if (Array.isArray(data)) return data;
      if (data?.results && Array.isArray(data.results)) return data.results;
      return [];
    },
    staleTime: 60 * 1000
  })

  const accounts = Array.isArray(accountsRaw) ? accountsRaw : []

  // Derived Values utilizing safely resolved backend payloads
  const expenses = stats?.total_expenses
  const statsCash = stats?.cash_on_hand

  const cashAccounts = accounts.filter(a => a.account_type === 'cash').map(acct => ({ ...acct, id: acct.id, account_type: 'cash' }))
  const bankAccounts = accounts.filter(a => a.account_type === 'bank').map(acct => ({ ...acct, id: acct.id, account_type: 'bank' }))

  const loadingStatsLocal = loadingStats || loadingAccounts

  const createAccountMutator = useMutation({
    mutationFn: async (payload) => createAccount(payload),
    onSuccess: () => {
      toast.success('Account created successfully')
      queryClient.invalidateQueries({ queryKey: ['financeStats'] })
      queryClient.invalidateQueries({ queryKey: ['financeAccounts'] })
      closeModal()
    },
    onError: () => toast.error('Failed to create account')
  })

  const updateAccountMutator = useMutation({
    mutationFn: async ({ id, payload }) => updateAccount(id, payload),
  onSuccess: () => {
    toast.success('Account updated successfully')
    queryClient.invalidateQueries({ queryKey: ['financeStats'] })
    queryClient.invalidateQueries({ queryKey: ['financeAccounts'] })
    queryClient.invalidateQueries({ queryKey: ['dashboardData'] })
    closeModal()
  },
    onError: () => toast.error('Failed to update account')
  })

  function openAddAccount() {
    setEditingAccount(null)
    setAccountModalOpen(true)
  }

  function openEditAccount(account, event) {
    if (event) event.stopPropagation()

    // It already has the ID injected into the spread object!
    let resolvedId = account?.id || account?.account_id

    setEditingAccount({
      ...account,
      id: resolvedId,
      account_id: resolvedId,
      name: account.name || '',
      full_name: account.full_name || account.name || '',
      account_type: account.account_type || (account?.label?.includes('Currency') ? 'cash' : 'bank'),
      account_number: account.account_number || ''
    })
    setAccountModalOpen(true)
  }

  function closeModal() {
    setAccountModalOpen(false)
    setEditingAccount(null)
    reset()
  }

  function onSubmit(formData) {
    const payload = { ...formData, account_number: formData.account_type === 'cash' ? '' : formData.account_number }
    const targetId = editingAccount?.id || editingAccount?.account_id;
    if (editingAccount && targetId) {
      updateAccountMutator.mutate({ id: targetId, payload: { ...payload, id: targetId } })
    } else {
      createAccountMutator.mutate(payload)
    }
  }

  const isSaving = createAccountMutator.isPending || updateAccountMutator.isPending;

  return (
      <div className="min-h-screen bg-gray-50/50 pt-20">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6 md:p-8 md:ml-64 w-full transition-all duration-300">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8">
              <div>
                <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-gray-900 border-b-2 border-primary inline-block pb-1">Operating Finance</h2>
                <p className="text-gray-500 text-sm mt-2">Monitor financial performance, manage cash flow, and track bank holdings.</p>
              </div>

              <div className="flex flex-col md:flex-row items-center gap-3">
                <div className="relative w-full md:w-64 group">
                  <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                    <Search className="text-gray-400 group-focus-within:text-primary transition-colors" size={18} />
                  </div>
                  <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="Search accounts..."
                      className="block w-full pl-10 pr-3 py-2.5 border border-gray-200 rounded-xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all shadow-sm"
                  />
                </div>
                <Link
                    to="/finance/cash"
                    className="w-full md:w-auto px-5 py-2.5 !rounded-button bg-gray-100 text-gray-700 font-medium hover:bg-gray-200 transition-colors shadow-sm flex items-center justify-center gap-2 border border-gray-200"
                >
                  <ArrowRightLeft size={18} />
                  Cash Flow
                </Link>
                <button
                    onClick={openAddAccount}
                    className="w-full md:w-auto px-5 py-2.5 !rounded-button bg-primary text-white font-medium hover:bg-primary/95 transition-colors shadow-sm flex items-center justify-center gap-2"
                >
                  <Plus size={18} />
                  Add Account
                </button>
              </div>
            </div>

            {/* KPI Dashboard - Phase 30: Liquid Framer Motion layout */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 mb-8">
              {/* Expense Card */}
              <motion.div
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.1 }}
                  className="bg-white rounded-2xl shadow-sm border border-red-100 p-6 md:p-8 relative overflow-hidden group hover:border-red-200 transition-colors"
              >
                <div className="absolute -right-6 -top-6 w-24 h-24 bg-red-50 rounded-full opacity-50 group-hover:scale-125 transition-transform duration-500"></div>
                <div className="flex items-center justify-between mb-4 relative">
                  <div className="w-12 h-12 bg-red-50 rounded-xl flex items-center justify-center shadow-sm">
                    <TrendingDown className="text-red-600" size={24} />
                  </div>
                  <span className="text-xs font-semibold tracking-wider text-red-400 uppercase">Expense</span>
                </div>
              <h3 className="text-sm font-semibold text-gray-900 mb-1 relative shrink">{expenses?.label || 'Operating Costs'}</h3>
              <p className="text-3xl font-black text-red-600 mb-2 relative">{loadingStatsLocal ? '...' : formatMoney(expenses?.amount)}</p>
              <div className="flex items-center gap-1.5 text-xs font-medium text-red-600 relative">
                  <ArrowUpRight size={14} />
                  <span>{expenses?.change_vs_last_month || '0%'}</span>
                  <span className="text-gray-400 font-normal">vs last month</span>
                </div>
              </motion.div>

              {/* Cash on Hand Cards */}
              {cashAccounts.map((cashAcct, i) => (
                  <motion.div
                      key={cashAcct.id || `cash-${i}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.2 + (i * 0.05) }}
                      className="bg-white rounded-2xl shadow-sm border border-green-100 p-6 md:p-8 relative overflow-hidden group hover:border-green-200 transition-colors"
                  >
                    <div className="absolute -right-6 -top-6 w-24 h-24 bg-green-50 rounded-full opacity-50 group-hover:scale-125 transition-transform duration-500"></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                      <div className="w-12 h-12 bg-green-50 rounded-xl flex items-center justify-center shadow-sm">
                        <Wallet className="text-green-600" size={24} />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => openEditAccount(cashAcct, e)}
                            className="w-8 h-8 rounded-full border bg-white flex items-center justify-center text-gray-400 hover:text-primary hover:border-primary/30 transition-colors shadow-sm"
                            title="Edit Account"
                        >
                          <Edit2 size={14} />
                        </button>
                        <span className="text-xs font-semibold tracking-wider text-green-400 uppercase">Storage</span>
                      </div>
                    </div>
                    <h3 className="text-sm font-semibold text-gray-900 mb-1 relative shrink truncate" title={cashAcct.full_name}>{cashAcct.full_name || cashAcct.name || cashAcct.label || 'Physical Currency'}</h3>
                    <p className="text-3xl font-black text-green-600 mb-2 relative">{loadingStatsLocal ? '...' : formatMoney(cashAcct.balance ?? cashAcct.amount ?? 0)}</p>
                  </motion.div>
              ))}

              {/* Bank Nodes */}
              {bankAccounts.map((bank, i) => (
                  <motion.div
                      key={bank.id || `bank-${i}`}
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: 0.3 + (i * 0.1) }}
                      className={cn("bg-white rounded-2xl shadow-sm border border-gray-100 p-6 md:p-8 relative overflow-hidden group transition-colors", bank.balance < 0 ? "border-red-100 hover:border-red-200" : "hover:border-primary/30")}
                  >
                    <div className={cn("absolute -right-6 -top-6 w-24 h-24 rounded-full opacity-50 group-hover:scale-125 transition-transform duration-500", bank.balance < 0 ? "bg-red-50" : "bg-primary/5")}></div>
                    <div className="flex items-center justify-between mb-4 relative z-10">
                      <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center shadow-sm", bank.balance < 0 ? "bg-red-50" : "bg-primary/10")}>
                        <Building2 className={cn(bank.balance < 0 ? "text-red-600" : "text-primary")} size={24} />
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                            onClick={(e) => openEditAccount(bank, e)}
                            className="w-8 h-8 rounded-full border bg-white flex items-center justify-center text-gray-400 hover:text-primary hover:border-primary/30 transition-colors shadow-sm"
                            title="Edit Account"
                        >
                          <Edit2 size={14} />
                        </button>
                        <span className="text-xs font-semibold tracking-wider text-gray-400 uppercase truncate max-w-[80px]" title={bank.full_name}>{bank.name}</span>
                      </div>
                    </div>
                <h3 className="text-sm font-semibold text-gray-900 mb-1 relative shrink truncate">{bank.full_name || bank.name || bank.label || 'Available Balance'}</h3>
                <p className={cn("text-3xl font-black mb-2 relative", bank.balance < 0 ? "text-red-600" : "text-gray-900")}>
                  {loadingStatsLocal ? '...' : formatMoney(bank.balance || 0)}
                </p>
                <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium relative mt-3 break-all">
                      <span className="truncate">{bank.account_number}</span>
                    </div>
                  </motion.div>
              ))}
            </div>
          </main>
        </div>

        {/* Modern Account Modal */}
        <AnimatePresence>
          {accountModalOpen && (
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
                    className="bg-white rounded-3xl shadow-2xl w-full max-w-md mx-4 my-8 relative overflow-hidden"
                >
                  <div className="p-6 md:p-8 border-b border-gray-100 bg-gray-50/50 flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-bold tracking-tight text-gray-900">{editingAccount ? 'Edit Account' : 'Add New Account'}</h3>
                      <p className="text-gray-500 text-sm mt-1">{editingAccount ? 'Update account details mapping.' : 'Register a new cash or bank node.'}</p>
                    </div>
                    <button
                        onClick={closeModal}
                        className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                    >
                      <X size={20} />
                    </button>
                  </div>

                  <form onSubmit={handleSubmit(onSubmit)} className="p-6 md:p-8 space-y-5">
                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Short Name <span className="text-gray-400 font-normal">(e.g. CBE)</span></label>
                      <input
                          {...register('name')}
                          className={cn("w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20", errors.name ? "border-red-500" : "border-gray-200 focus:border-primary")}
                          placeholder="Enter short name"
                      />
                      {errors.name && <p className="mt-1.5 text-xs font-medium text-red-500">{errors.name.message}</p>}
                    </div>

                    <div>
                      <label className="block text-sm font-semibold text-gray-700 mb-2">Full Bank/Entity Name</label>
                      <input
                          {...register('full_name')}
                          className={cn("w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20", errors.full_name ? "border-red-500" : "border-gray-200 focus:border-primary")}
                          placeholder="Commercial Bank of Ethiopia"
                      />
                      {errors.full_name && <p className="mt-1.5 text-xs font-medium text-red-500">{errors.full_name.message}</p>}
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Account Type</label>
                        <select
                            {...register('account_type')}
                            className={cn("w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20 bg-white", errors.account_type ? "border-red-500" : "border-gray-200 focus:border-primary")}
                        >
                          <option value="bank">Bank Account</option>
                          <option value="cash">Cash Storage</option>
                        </select>
                      </div>

                      {accountType === 'bank' && (
                        <div>
                          <label className="block text-sm font-semibold text-gray-700 mb-2">Account Number / ID</label>
                          <input
                              {...register('account_number')}
                              className={cn("w-full px-4 py-3 border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/20", errors.account_number ? "border-red-500" : "border-gray-200 focus:border-primary")}
                              placeholder="1000500..."
                          />
                          {errors.account_number && <p className="mt-1.5 text-xs font-medium text-red-500">{errors.account_number.message}</p>}
                        </div>
                      )}
                    </div>

                    <div className="flex gap-4 pt-6 border-t border-gray-100">
                      <button
                          type="button" onClick={closeModal}
                          className="flex-1 px-5 py-3 border border-gray-200 rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                      >
                        Cancel
                      </button>
                      <button
                          type="submit" disabled={isSaving}
                          className="flex-1 px-5 py-3 bg-primary text-white rounded-xl text-sm font-semibold hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 flex justify-center items-center"
                      >
                        {isSaving ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : 'Save Account'}
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