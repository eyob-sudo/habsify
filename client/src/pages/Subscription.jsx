import React, { useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import toast from '../services/toastService'
import { getSubscriptionPlans, getSubscriptions, startFreeTrial, cancelSubscription, getPaymentMethods, getBankAccounts, subscribeAndPay } from '../services/subscriptionService'

function formatPrice(plan) {
  if (typeof plan?.price_monthly === 'number') {
    return `${plan.price_monthly.toLocaleString()} / mo`
  }
  return plan?.price || '—'
}

function resolveUsage(subscription) {
  const raw = typeof subscription?.members_usage === 'string' ? subscription.members_usage : ''
  const match = raw.match(/(\d+)\s*\/\s*(\d+)/)
  if (match) {
    return { used: Number(match[1]), limit: Number(match[2]), unit: raw.includes('member') ? 'members' : 'users' }
  }
  return null
}

function getFeatureList(plans) {
  return Array.from(
    new Map(
      plans.flatMap((plan) => {
        if (Array.isArray(plan.features)) {
          return plan.features.map((feature) => [feature.code || feature.name, feature.name || feature.code])
        }
        if (plan.features && typeof plan.features === 'object') {
          return Object.keys(plan.features).map((name) => [name, name])
        }
        return []
      })
    )
  ).map(([key, label]) => ({ key, label }))
}

function isFeatureIncluded(plan, featureKey) {
  if (Array.isArray(plan.features)) {
    const match = plan.features.find((feature) => (feature.code || feature.name) === featureKey)
    return Boolean(match?.is_included)
  }
  if (plan.features && typeof plan.features === 'object') {
    return Boolean(plan.features[featureKey])
  }
  return false
}

function getIncludedFeatures(plan) {
  if (!Array.isArray(plan?.features)) return []
  return plan.features.filter((feature) => feature.is_included)
}

export default function Subscription() {
  const [plans, setPlans] = useState([])
  const [currentSub, setCurrentSub] = useState(null)
  const [loading, setLoading] = useState(true)
  const [trialLoadingId, setTrialLoadingId] = useState(null)
  const [payModalOpen, setPayModalOpen] = useState(false)
  const [payPlan, setPayPlan] = useState(null)
  const [paymentMethods, setPaymentMethods] = useState([])
  const [bankAccounts, setBankAccounts] = useState([])
  const [payForm, setPayForm] = useState({
    payment_method: '',
    bank_account: '',
    transaction_id: ''
  })
  const [payLoading, setPayLoading] = useState(false)

  useEffect(() => {
    let alive = true
    async function loadData() {
      setLoading(true)
      try {
        const [plansRes, subsRes] = await Promise.all([
          getSubscriptionPlans(),
          getSubscriptions()
        ])
        if (!alive) return
        const nextPlans = Array.isArray(plansRes) && plansRes.length ? plansRes : []
        const subscriptions = Array.isArray(subsRes) ? subsRes : []
        const activeSub = subscriptions.find((sub) => sub.active) || subscriptions[0] || null
        setPlans(nextPlans)
        setCurrentSub(activeSub)
      } catch (err) {
        if (!alive) return
        setPlans([])
        setCurrentSub(null)
        toast.error('Failed to load subscription data')
      } finally {
        if (alive) setLoading(false)
      }
    }
    loadData()
    return () => {
      alive = false
    }
  }, [])

  const currentPlanId = currentSub?.plan?.id
  const currentPlan = plans.find((plan) => plan.id === currentPlanId)
  const features = useMemo(() => getFeatureList(plans), [plans])
  const usage = resolveUsage(currentSub) || { used: 0, limit: 0, unit: 'members' }
  const hasUsedTrial = Boolean(currentSub?.has_used_trial)

  const canStartTrial = Boolean(currentSub && currentSub.status !== 'active' && currentPlan?.trial_days && !hasUsedTrial)
  const canCancel = Boolean(currentSub && (currentSub.status === 'active' || currentSub.status === 'pending_payment' || currentSub.status === "trialing"))

  useEffect(() => {
    let alive = true
    if (!payModalOpen) return () => { alive = false }
    async function loadPayOptions() {
      try {
        const [methodsRes, accountsRes] = await Promise.all([
          getPaymentMethods(),
          getBankAccounts()
        ])
        if (!alive) return
        setPaymentMethods(Array.isArray(methodsRes) ? methodsRes : [])
        setBankAccounts(Array.isArray(accountsRes) ? accountsRes : [])
      } catch (err) {
        if (alive) toast.error('Failed to load payment options')
      }
    }
    loadPayOptions()
    return () => { alive = false }
  }, [payModalOpen])

  const handleStartTrial = async (plan) => {
    if (!plan?.id) {
      toast.error('Missing plan id')
      return
    }
    if (hasUsedTrial || plan?.has_used_trial) {
      toast.info('Trial already used')
      return
    }
    setTrialLoadingId(plan.id)
    try {
      await startFreeTrial(plan.id)
      toast.success('Free trial started')
      const subsRes = await getSubscriptions()
      const subscriptions = Array.isArray(subsRes) ? subsRes : []
      const activeSub = subscriptions.find((sub) => sub.active) || subscriptions[0] || null
      setCurrentSub(activeSub)
    } catch (err) {
      toast.error('Failed to start free trial')
    } finally {
      setTrialLoadingId(null)
    }
  }

  const handleCancel = async () => {
    if (!currentSub?.uid) {
      toast.error('Missing subscription id')
      return
    }
    try {
      await cancelSubscription(currentSub.uid)
      toast.success('Subscription cancelled')
      const subsRes = await getSubscriptions()
      const subscriptions = Array.isArray(subsRes) ? subsRes : []
      const activeSub = subscriptions.find((sub) => sub.active) || subscriptions[0] || null
      setCurrentSub(activeSub)
    } catch (err) {
      toast.error('Failed to cancel subscription')
    }
  }

  const handleSubscribe = (plan) => {
    setPayPlan(plan)
    setPayForm({ payment_method: '', bank_account: '', transaction_id: '' })
    setPayModalOpen(true)
  }

  const handlePaySubmit = async (e) => {
    e.preventDefault()
    if (!payPlan?.id) {
      toast.error('Missing plan id')
      return
    }
    if (!payForm.payment_method || !payForm.bank_account || !payForm.transaction_id.trim()) {
      toast.error('All fields are required')
      return
    }
    setPayLoading(true)
    try {
      await subscribeAndPay({
        plan_id: payPlan.id,
        payment_method: Number(payForm.payment_method),
        bank_account: Number(payForm.bank_account),
        transaction_id: payForm.transaction_id.trim()
      })
      toast.success('Subscription request sent')
      setPayModalOpen(false)
      const subsRes = await getSubscriptions()
      const subscriptions = Array.isArray(subsRes) ? subsRes : []
      const activeSub = subscriptions.find((sub) => sub.active) || subscriptions[0] || null
      setCurrentSub(activeSub)
    } catch (err) {
      toast.error('Failed to submit payment')
    } finally {
      setPayLoading(false)
    }
  }

  return (
    <div className="bg-gradient-to-br from-gray-50 via-white to-gray-100 min-h-screen">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 md:ml-64 pt-24 md:pt-28">
          <div className="mb-8">
            <div className="flex flex-wrap items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                <i className="ri-vip-crown-line ri-lg"></i>
              </div>
              <div>
                <h2 className="block relative z-10 text-2xl md:text-3xl lg:text-4xl font-black text-gray-900 mb-1 tracking-tight">
                  Subscription
                </h2>
                <p className="text-gray-600">Manage your plan and billing preferences.</p>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6 mb-8">
            <div className="rounded-2xl border border-gray-100 bg-white/90 backdrop-blur p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs uppercase tracking-wide text-gray-500">Current plan</p>
                  <h3 className="text-2xl font-semibold text-gray-900 mt-1">
                    {currentPlan?.name || 'No active plan'}
                  </h3>
                </div>
                {currentSub?.status && (
                  <span className="text-xs font-semibold px-3 py-1 rounded-full bg-primary/10 text-primary">
                    {currentSub.status}
                  </span>
                )}
              </div>

              <div className="mt-5 grid gap-3 text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Usage</span>
                  <span className="font-semibold text-gray-900">{usage.used}/{usage.limit} {usage.unit}</span>
                </div>
                <div className="h-2 rounded-full bg-gray-100 overflow-hidden">
                  <div
                    className="h-2 bg-primary/70 rounded-full transition-all"
                    style={{ width: `${Math.min(100, (usage.used / Math.max(usage.limit, 1)) * 100)}%` }}
                  ></div>
                </div>
                <div className="flex items-center justify-between">
                  <span>Trial days remaining</span>
                  <span className="font-semibold text-gray-900">{currentSub?.days_remaining ?? '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Billing</span>
                  <span className="font-semibold text-gray-900">{currentPlan ? formatPrice(currentPlan) : '—'}</span>
                </div>
              </div>

              <div className="mt-6 flex flex-wrap gap-3">
                {canStartTrial && (
                  <button
                    type="button"
                    onClick={() => handleStartTrial(currentPlan)}
                    className="px-4 py-2 !rounded-button whitespace-nowrap border border-gray-200 text-gray-700 hover:bg-gray-50 transition-colors"
                  >
                    Start Free Trial
                  </button>
                )}
                {canCancel && (
                  <button
                    type="button"
                    onClick={handleCancel}
                    className="px-4 py-2 !rounded-button whitespace-nowrap border border-red-200 text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Cancel Subscription
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white/90 backdrop-blur p-6 shadow-lg">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                    <i className="ri-building-2-line"></i>
                  </div>
                  <div>
                    <p className="text-xs uppercase tracking-wide text-gray-500">Company</p>
                    <h4 className="text-lg font-semibold text-gray-900">
                      {currentSub?.company_name || '—'}
                    </h4>
                  </div>
                </div>
                <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
                  {currentSub?.status || 'inactive'}
                </span>
              </div>
              <div className="mt-5 grid gap-3 text-sm text-gray-600">
                <div className="flex items-center justify-between">
                  <span>Start date</span>
                  <span className="font-semibold text-gray-900">{currentSub?.start_date || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>End date</span>
                  <span className="font-semibold text-gray-900">{currentSub?.end_date || '—'}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span>Members usage</span>
                  <span className="font-semibold text-gray-900">{currentSub?.members_usage || '—'}</span>
                </div>
              </div>
              <div className="mt-4 flex items-center gap-2 text-xs text-gray-500">
                <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
                <span>{currentSub?.active ? 'Active subscription' : 'Inactive subscription'}</span>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-gray-100 bg-white/90 backdrop-blur p-6 shadow-lg">
            <div className="text-center mb-6">
              <p className="text-xs uppercase tracking-wide text-gray-500">Pricing</p>
              <h3 className="text-3xl font-bold text-gray-900 mt-2">Choose your Plan</h3>
              <p className="text-sm text-gray-600 mt-2">
                Explore our prices and pick the plan that best fits your team.
              </p>
            </div>
            <div className="flex items-center justify-center mb-8">
              <div className="flex items-center gap-2 rounded-full bg-gray-100 p-1">
                <button type="button" className="px-4 py-2 text-xs font-semibold rounded-full bg-white shadow text-gray-900">
                  Monthly
                </button>
                <button type="button" className="px-4 py-2 text-xs font-semibold rounded-full text-gray-500">
                  Yearly
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {plans.map((plan) => {
                const planFeatures = Array.isArray(plan.features) ? plan.features : []
                return (
                  <div
                    key={plan.id}
                    className={`rounded-2xl border p-6 transition-all flex flex-col ${
                      plan.id === currentPlanId
                        ? 'border-primary bg-primary/5 shadow-lg'
                        : 'border-gray-100 bg-gray-50 hover:shadow-md'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide">{plan.name} Plan</div>
                      {plan.id === currentPlanId && (
                        <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
                          Current
                        </span>
                      )}
                    </div>
                    {plan.id === currentPlanId ? (
                      <div className="mt-3 inline-flex rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                        {plan.user_limit ? `Up to ${plan.user_limit} users included` : 'Flexible plan for your team'}
                      </div>
                    ) : (
                      <p className="mt-3 text-xs text-gray-500">
                        {plan.user_limit ? `Up to ${plan.user_limit} users included.` : 'Flexible plan for your team.'}
                      </p>
                    )}
                    <div className="mt-4 text-4xl font-black text-gray-900">
                      {typeof plan.price_monthly === 'number' ? `$${plan.price_monthly.toLocaleString()}` : plan.price || '—'}
                    </div>
                    <p className="text-xs text-gray-500 mt-1">Billed monthly</p>

                    <div className="mt-5 space-y-2">
                      {planFeatures.length ? (
                        planFeatures.map((feature) => (
                          <div key={feature.code || feature.name} className="flex items-center gap-2 text-sm text-gray-600">
                            <span className={`w-5 h-5 rounded-full flex items-center justify-center text-xs ${feature.is_included ? 'bg-primary/10 text-primary' : 'bg-gray-100 text-gray-400'}`}>
                              {feature.is_included ? '✔' : '✖'}
                            </span>
                            <span className={feature.is_included ? 'text-gray-700' : 'text-gray-400'}>
                              {feature.name}
                            </span>
                          </div>
                        ))
                      ) : (
                        <div className="text-sm text-gray-500">Core features included</div>
                      )}
                    </div>

                    <div className="mt-auto pt-6 space-y-2">
                      <button
                        type="button"
                        onClick={() => handleStartTrial(plan)}
                        disabled={trialLoadingId === plan.id || hasUsedTrial || plan.has_used_trial}
                        className="w-full py-2 !rounded-button whitespace-nowrap border border-gray-200 text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors disabled:opacity-60"
                      >
                        {trialLoadingId === plan.id
                          ? 'Starting trial...'
                          : (hasUsedTrial || plan.has_used_trial
                            ? 'Trial Used'
                            : (plan.trial_days ? `Start ${plan.trial_days}-day Trial` : 'Trial Unavailable'))}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleSubscribe(plan)}
                        disabled={plan.id === currentPlanId}
                        className="w-full py-2 !rounded-button whitespace-nowrap bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                      >
                        {plan.id === currentPlanId ? 'Current Plan' : 'Get it now'}
                      </button>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {payModalOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="w-full max-w-lg mx-4 rounded-2xl bg-white shadow-2xl border border-gray-100">
                <div className="p-6 border-b border-gray-100">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-xl font-semibold text-gray-900">Subscribe & Pay</h3>
                      <p className="text-sm text-gray-500">Complete payment for {payPlan?.name || 'Plan'}</p>
                    </div>
                    <button
                      type="button"
                      onClick={() => setPayModalOpen(false)}
                      className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center"
                    >
                      <i className="ri-close-line ri-lg"></i>
                    </button>
                  </div>
                </div>
                <form onSubmit={handlePaySubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Payment Method</label>
                    <select
                      value={payForm.payment_method}
                      onChange={(e) => setPayForm((prev) => ({ ...prev, payment_method: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      required
                    >
                      <option value="">Select payment method</option>
                      {paymentMethods.map((method) => (
                        <option key={method.id} value={method.id}>{method.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Bank Account</label>
                    <select
                      value={payForm.bank_account}
                      onChange={(e) => setPayForm((prev) => ({ ...prev, bank_account: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      required
                    >
                      <option value="">Select bank account</option>
                      {bankAccounts.map((account) => (
                        <option key={account.id} value={account.id}>{account.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Transaction ID</label>
                    <input
                      value={payForm.transaction_id}
                      onChange={(e) => setPayForm((prev) => ({ ...prev, transaction_id: e.target.value }))}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                      placeholder="Enter transaction reference"
                      required
                    />
                  </div>
                  <div className="flex items-center justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => setPayModalOpen(false)}
                      className="px-4 py-2 !rounded-button whitespace-nowrap border border-gray-200 text-gray-700 text-sm"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={payLoading}
                      className="px-4 py-2 !rounded-button whitespace-nowrap bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60"
                    >
                      {payLoading ? 'Submitting...' : 'Submit Payment'}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  )
}
