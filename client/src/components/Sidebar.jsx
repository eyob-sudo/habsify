import React, { useEffect, useState, useRef } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getSubscriptionPlans, getSubscriptions } from '../services/subscriptionService'
import { cn } from '../utils/cn'
import autoAnimate from '@formkit/auto-animate'
import {
  LayoutDashboard,
  Truck,
  Package,
  Users,
  CircleDollarSign,
  Menu,
  X
} from 'lucide-react'

export default function Sidebar() {
  const navigate = useNavigate()
  const [showPlans, setShowPlans] = useState(false)
  const [isOpen, setIsOpen] = useState(false)

  // PHASE 9: React Query Data Fetching Strategy Optimization
  const { data: subscriptionData, isFetching: loadingPlans } = useQuery({
    queryKey: ['sidebar-subscriptions'],
    queryFn: async () => {
      const [plansRes, subsRes] = await Promise.all([
        getSubscriptionPlans(),
        getSubscriptions()
      ])
      const plans = Array.isArray(plansRes) ? plansRes : []
      const subscriptions = Array.isArray(subsRes) ? subsRes : []
      const activeSub = subscriptions.find((sub) => sub.active) || subscriptions[0]
      const currentPlanId = activeSub?.plan?.id || null
      const trialDaysRemaining = activeSub?.days_remaining ?? 0
      const usageLimit = activeSub?.plan?.user_limit ?? 0
      const usageRaw = typeof activeSub?.members_usage === 'string' ? activeSub.members_usage : ''
      const usageMatch = usageRaw.match(/(\d+)\s*\/\s*(\d+)/)
      const usageUsed = usageMatch ? Number(usageMatch[1]) : 0
      const usageUnit = usageRaw.includes('member') ? 'members' : 'members'

      return {
        plans,
        currentPlanId,
        trialDaysRemaining,
        usage: { used: usageUsed, limit: usageLimit, unit: usageUnit }
      }
    },
    initialData: { plans: [], currentPlanId: null, trialDaysRemaining: 0, usage: { used: 0, limit: 0, unit: 'members' } },
    staleTime: 5 * 60 * 1000 // Cache for 5 mins
  })

  // Hook up Phase 4: Fluid DOM animations for the Sidebar links
  const menuRef = useRef(null)
  useEffect(() => {
    if (menuRef.current) {
      autoAnimate(menuRef.current)
    }
  }, [menuRef])

  const linkClass = ({ isActive }) => isActive
    ? 'w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg bg-primary text-white'
    : 'w-full flex items-center gap-3 px-4 py-3 text-left rounded-lg text-gray-700 hover:bg-gray-50 hover:text-primary'

  const currentPlan = subscriptionData.plans?.find((plan) => plan.id === subscriptionData.currentPlanId)

  const featureList = Array.from(
    new Map(
      subscriptionData.plans?.flatMap((plan) => {
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

  const isFeatureIncluded = (plan, featureKey) => {
    if (Array.isArray(plan.features)) {
      const match = plan.features.find((feature) => (feature.code || feature.name) === featureKey)
      return Boolean(match?.is_included)
    }
    if (plan.features && typeof plan.features === 'object') {
      return Boolean(plan.features[featureKey])
    }
    return false
  }

  const formatPrice = (plan) => {
    if (typeof plan.price_monthly === 'number') {
      return `${plan.price_monthly.toLocaleString()} / mo`
    }
    return plan.price || '—'
  }

  const closeSidebar = () => setIsOpen(false)

  return (
    <>
      {/* PHASE 10: Swapped to Lucide Icons */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="md:hidden fixed top-4 left-4 z-50 w-10 h-10 bg-white rounded-lg shadow-sm border border-gray-100 flex items-center justify-center text-gray-700"
      >
        {isOpen ? <X size={24} /> : <Menu size={24} />}
      </button>

      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-30 md:hidden"
          onClick={closeSidebar}
        ></div>
      )}

      <aside className={cn(
        "fixed left-0 top-0 h-screen w-64 bg-white border-r border-gray-100 z-40 transition-transform duration-300 ease-in-out flex flex-col",
        isOpen ? "translate-x-0" : "-translate-x-full md:translate-x-0"
      )}>
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-6 pt-20">
          <ul ref={menuRef} className="space-y-2">
            <li>
              <NavLink to="/dashboard" className={linkClass} onClick={closeSidebar} end>
                <div className="w-5 h-5 flex items-center justify-center"><LayoutDashboard size={20} /></div>
                <span>Dashboard</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/suppliers" className={linkClass} onClick={closeSidebar}>
                <div className="w-5 h-5 flex items-center justify-center"><Truck size={20} /></div>
                <span>Supplier</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/inventory" className={linkClass} onClick={closeSidebar}>
                <div className="w-5 h-5 flex items-center justify-center"><Package size={20} /></div>
                <span>Inventory</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/crm" className={linkClass} onClick={closeSidebar}>
                <div className="w-5 h-5 flex items-center justify-center"><Users size={20} /></div>
                <span>CRM</span>
              </NavLink>
            </li>
            <li>
              <NavLink to="/finance" className={linkClass} onClick={closeSidebar}>
                <div className="w-5 h-5 flex items-center justify-center"><CircleDollarSign size={20} /></div>
                <span>Finance</span>
              </NavLink>
            </li>
          </ul>

          <div className="mt-auto pt-6">
            <div className="rounded-xl border border-gray-100 bg-gray-50 p-3 text-xs">
              <div className="flex items-center justify-between">
                <span className="text-gray-500">Plan</span>
                <span className="font-semibold text-gray-900">{currentPlan?.name || '—'}</span>
              </div>
              <div className="mt-2 text-gray-600">
                <div>Usage: {subscriptionData.usage.used}/{subscriptionData.usage.limit} {subscriptionData.usage.unit}</div>
                <div>Trial: {subscriptionData.trialDaysRemaining} days left</div>
              </div>
              <button
                type="button"
                onClick={() => setShowPlans(true)}
                className="mt-3 w-full py-2 !rounded-button whitespace-nowrap bg-primary text-white text-xs font-semibold hover:bg-primary/90 transition-colors"
              >
                Manage / Upgrade
              </button>
            </div>
          </div>
        </div>
      </aside>

      {showPlans && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
          <div className="w-[820px] max-w-full rounded-2xl bg-white p-6 shadow-2xl border border-gray-100 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Subscription Plans</h3>
                <p className="text-sm text-gray-500">Choose the plan that fits your growth.</p>
              </div>
              <button
                type="button"
                onClick={() => setShowPlans(false)}
                className="w-9 h-9 rounded-full bg-gray-100 text-gray-500 hover:text-gray-700 hover:bg-gray-200 transition-colors flex items-center justify-center"
                aria-label="Close"
              >
                <X size={20} />
              </button>
            </div>

            <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-4">
              {subscriptionData.plans.map((plan) => (
                <div
                  key={plan.id}
                  className={`rounded-2xl border p-4 transition-all ${
                    plan.id === subscriptionData.currentPlanId
                      ? 'border-primary bg-gradient-to-br from-primary/10 via-white to-white shadow-lg'
                      : 'border-gray-100 bg-white hover:shadow-md'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-500">Plan</div>
                      <div className="text-base font-semibold text-gray-900">{plan.name}</div>
                    </div>
                    {plan.id === subscriptionData.currentPlanId && (
                      <span className="text-[11px] font-semibold px-2 py-1 rounded-full bg-primary/10 text-primary">
                        Current
                      </span>
                    )}
                  </div>
                  <div className="mt-2 text-sm text-gray-700">{formatPrice(plan)}</div>
                  <div className="mt-3 text-xs text-gray-500">
                    {featureList.slice(0, 2).map((feature) => feature.label).join(' • ')}
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-6">
              <div className="text-sm font-semibold text-gray-900">Features</div>
              <div className="mt-3 overflow-x-auto">
                <div className="min-w-[560px] grid grid-cols-1 gap-2 text-sm">
                  <div className="grid grid-cols-4 gap-2 text-gray-600 font-medium">
                    <span>Feature</span>
                    {subscriptionData.plans.map((plan) => (
                      <span key={`${plan.id}-head`} className="text-center">{plan.name}</span>
                    ))}
                  </div>
                  {featureList.map((feature) => (
                    <div key={feature.key} className="grid grid-cols-4 gap-2 items-center">
                      <span className="text-gray-700">{feature.label}</span>
                      {subscriptionData.plans.map((plan) => (
                        <span
                          key={`${plan.id}-${feature.key}`}
                          className={`text-center ${plan.id === subscriptionData.currentPlanId ? 'font-semibold text-primary' : 'text-gray-700'}`}
                        >
                          {isFeatureIncluded(plan, feature.key) ? '✔' : '✖'}
                        </span>
                      ))}
                    </div>
                  ))}
                </div>
              </div>
              {loadingPlans && (
                <p className="text-xs text-gray-500 mt-3">Refreshing plans...</p>
              )}
            </div>

            <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-4">
              <p className="text-xs text-gray-500">
                You can upgrade or downgrade anytime.
              </p>
              <button
                type="button"
                onClick={() => {
                  setShowPlans(false)
                  closeSidebar()
                  navigate('/subscription')
                }}
                className="px-4 py-2 w-full sm:w-auto !rounded-button whitespace-nowrap bg-primary text-white text-sm font-semibold hover:bg-primary/90 transition-colors"
              >
                Manage / Upgrade
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
