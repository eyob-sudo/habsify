import React, { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { useAuth } from '../context/AuthContext'
import { getSubscriptionPlans, startFreeTrial, getPaymentMethods, getBankAccounts, subscribeAndPay } from '../services/subscriptionService'
import toast from '../services/toastService'
import api from '../services/api'  

export default function ChoosePlan() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [plans, setPlans] = useState([])
  const [paymentMethods, setPaymentMethods] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [processing, setProcessing] = useState(null)

  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payPlan, setPayPlan] = useState(null)
  const [payLoading, setPayLoading] = useState(false)
  const [payForm, setPayForm] = useState({ payment_method: '', bank_account: '', transaction_id: '' })

  useEffect(() => {
    getSubscriptionPlans()
      .then(plansData => {
        setPlans(Array.isArray(plansData) ? plansData : [])
        setLoading(false)
      })
      .catch(() => {
        toast.error('Failed to load plans')
        setLoading(false)
      })
  }, [])

  // Only load dropdowns when modal is opened, preventing unnecessary aggressive requests
  useEffect(() => {
    let alive = true
    if (payModalOpen) {
      Promise.all([
        getPaymentMethods().catch(() => []),
        getBankAccounts().catch(() => [])
      ]).then(([pmData, bankData]) => {
        if (alive) {
          setPaymentMethods(Array.isArray(pmData) ? pmData : [])
          setBankAccounts(Array.isArray(bankData) ? bankData : [])
        }
      })
    }
    return () => { alive = false }
  }, [payModalOpen])

const redirectToDashboard = async () => {
  try {
    await queryClient.fetchQuery({ 
      queryKey: ['accessStatus'],
      queryFn: async () => {
        const res = await api.get('/subscriptions/me/access-status/')
        setGlobalAccessStatus(res.data)   
        return res.data
      }
    })

    await new Promise(resolve => setTimeout(resolve, 300))

    navigate('/dashboard', { replace: true })
  } catch (err) {
    console.error("Failed to fetch access status:", err)
    navigate('/dashboard', { replace: true })
  }
}

const handleStartTrial = async (planId) => {
  setProcessing(planId)
  try {
    await startFreeTrial(planId)
    toast.success('Trial started successfully!')
    await redirectToDashboard()
  } catch (err) {
    const status = err?.response?.status
    const detail = err?.response?.data?.detail || ''

    if (status === 400 && detail.toLowerCase().includes('already')) {
      toast.info('You already have an active subscription')
      await redirectToDashboard()
    } else if (status === 400) {
      toast.error(detail || 'Invalid request. Please try again.')
    } else if (status === 401) {
      toast.error('Session expired. Please log in again.')
      navigate('/login', { replace: true })
    } else {
      toast.error('Failed to start trial. Please try again.')
    }
  } finally {
    setProcessing(null)
  }
}

  const handleSubscribe = (plan) => {
    setPayPlan(plan)
    setPayForm({ payment_method: '', bank_account: '', transaction_id: '' })
    setPayModalOpen(true)
  }

  const handlePaySubmit = async (e) => {
    e.preventDefault()
    if (!payPlan?.id) return
    if (!payForm.payment_method || !payForm.bank_account || !payForm.transaction_id.trim()) {
      toast.error('All fields are required')
      return
    }
    setPayLoading(true)
    try {
      await subscribeAndPay({
        plan_id: payPlan.id,
        payment_method: payForm.payment_method,
        bank_account: Number(payForm.bank_account),
        transaction_id: payForm.transaction_id.trim()
      })
    toast.success('Subscription request sent! Awaiting approval.')
    setPayModalOpen(false)
    
    await queryClient.invalidateQueries({ queryKey: ['accessStatus'] })

    const updatedAccess = await queryClient.fetchQuery({ 
      queryKey: ['accessStatus'],
      queryFn: async () => {
        const res = await api.get('/subscriptions/me/access-status/')
        return res.data
      }
    })
    
    if (updatedAccess?.can_enter_app) {
      navigate('/dashboard', { replace: true })
    }
    } catch (err) {
      // global error handler covers toast
    } finally {
      setPayLoading(false)
    }
  }

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center text-gray-500">Loading plans...</div>
  }

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto text-center">
        <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
          Welcome {user?.user_first_name || user?.username || ''} 👋 <br/>
          To start using the ERP, choose a plan:
        </h2>
        <p className="mt-3 text-lg text-gray-600">Select a plan that fits your business needs to continue.</p>
      </div>
      <div className="mt-10 max-w-md mx-auto grid gap-6 lg:grid-cols-3 lg:max-w-5xl">
        {plans.map(plan => (
          <div key={plan.id} className="flex flex-col bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden transform hover:scale-[1.02] transition-transform duration-300">
            <div className="p-6 bg-white">
              <div>
                <h3 className="inline-flex px-3 py-1 rounded-full text-xs font-semibold tracking-wide uppercase bg-primary/10 text-primary">
                  {plan.name}
                </h3>
              </div>
              <div className="mt-4 flex items-baseline text-4xl font-extrabold">
                ${plan.price_monthly}
                <span className="ml-1 text-xl font-medium text-gray-500">/mo</span>
              </div>
              <p className="mt-3 text-sm text-gray-500">
                {plan.user_limit ? `Up to ${plan.user_limit} users included.` : 'Unlimited users'}
              </p>
            </div>
            <div className="flex-1 flex flex-col justify-between p-6 bg-gray-50/50 space-y-6">
              <ul className="space-y-3">
                {(plan.features || []).map(f => (
                  <li key={f.id} className="flex items-start">
                    <div className="flex-shrink-0 mt-0.5">
                      {f.is_included ? (
                        <div className="w-4 h-4 rounded-full bg-green-100 flex items-center justify-center"><i className="ri-check-line text-green-600 text-[10px]"></i></div>
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-gray-200 flex items-center justify-center"><i className="ri-close-line text-gray-500 text-[10px]"></i></div>
                      )}
                    </div>
                    <p className={`ml-2 text-sm ${f.is_included ? 'text-gray-700' : 'text-gray-400 line-through'}`}>
                      {f.name}
                    </p>
                  </li>
                ))}
              </ul>
              <div className="space-y-3 pt-2">
                <button
                  onClick={() => handleStartTrial(plan.id)}
                  disabled={processing === plan.id}
                  className="w-full flex items-center justify-center px-4 py-2 border border-primary text-sm font-medium rounded-lg text-primary bg-white hover:bg-primary/5 transition-colors disabled:opacity-50"
                >
                  {processing === plan.id ? 'Processing...' : 'Start 14-Day Free Trial'}
                </button>
                <button
                  onClick={() => handleSubscribe(plan)}
                  className="w-full flex items-center justify-center px-4 py-2 border border-transparent text-sm font-medium rounded-lg text-white bg-primary hover:bg-primary/90 transition-colors shadow-sm"
                >
                  Subscribe / Pay
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {payModalOpen && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md m-auto overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300">
            <div className="p-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
              <h3 className="text-xl font-bold text-gray-900">Subscribe to {payPlan?.name}</h3>
              <button
                onClick={() => setPayModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 transition-colors w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <form onSubmit={handlePaySubmit} className="p-6 space-y-5">
              <div className="bg-primary/5 rounded-xl p-4 border border-primary/10 flex justify-between items-center">
                <span className="text-gray-600 text-sm">Monthly Total</span>
                <span className="text-2xl font-black text-gray-900">${payPlan?.price_monthly}</span>
              </div>

              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Payment Method</label>
                  <select
                    value={payForm.payment_method}
                    onChange={e => setPayForm({ ...payForm, payment_method: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                  >
                    <option value="">Select a payment method</option>
                    {paymentMethods.map(m => (
                      <option key={m.id} value={m.code}>{m.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Bank Account</label>
                  <select
                    value={payForm.bank_account}
                    onChange={e => setPayForm({ ...payForm, bank_account: e.target.value })}
                    required
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none"
                  >
                    <option value="">Select a bank account</option>
                    {bankAccounts.map(b => (
                      <option key={b.id} value={b.id}>{b.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Transaction ID / Reference</label>
                  <input
                    type="text"
                    value={payForm.transaction_id}
                    onChange={e => setPayForm({ ...payForm, transaction_id: e.target.value })}
                    required
                    placeholder="Enter payment reference"
                    className="w-full px-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:bg-white focus:ring-2 focus:ring-primary focus:border-transparent transition-all outline-none placeholder:text-gray-400"
                  />
                  <p className="mt-1.5 text-xs text-gray-500">Please enter the exact transaction reference to verify your payment.</p>
                </div>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="button"
                  onClick={() => setPayModalOpen(false)}
                  className="flex-1 px-4 py-2.5 border border-gray-200 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={payLoading}
                  className="flex-1 px-4 py-2.5 bg-primary text-white font-medium rounded-xl hover:bg-primary/90 transition-colors shadow-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {payLoading ? (
                    <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>Processing...</>
                  ) : (
                    'Confirm Payment'
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
