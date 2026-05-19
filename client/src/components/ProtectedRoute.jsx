import React from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import api, { setGlobalAccessStatus } from '../services/api'
import { motion, AnimatePresence } from 'framer-motion'
import { useQuery } from '@tanstack/react-query'

export default function ProtectedRoute() {
  const { isAuthenticated, loading } = useAuth()
  const location = useLocation()

  const { data: access, isFetching: checkingAccess } = useQuery({
    queryKey: ['accessStatus'],
    queryFn: async () => {
      const res = await api.get('/subscriptions/me/access-status/')
      setGlobalAccessStatus(res.data)
      return res.data
    },
    enabled: isAuthenticated,
    staleTime: 2 * 60 * 1000,   
    gcTime: 5 * 60 * 1000,
    refetchOnMount: false,       
    refetchOnWindowFocus: false,
  })

  const isBlockingLoad = loading || (checkingAccess && !access)

  if (isBlockingLoad) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!isAuthenticated) return <Navigate to="/login" replace />

  if (access) {
    const { can_enter_app, action_required, subscription_status } = access
    const isRestricted = !can_enter_app || action_required === 'CHOOSE_PLAN' || subscription_status === 'NO_PLAN'

    if (isRestricted && location.pathname !== '/choose-plan') {
      return <Navigate to="/choose-plan" replace />
    }

    if (!isRestricted && location.pathname === '/choose-plan') {
      return <Navigate to="/dashboard" replace />
    }
  }

  return (
    <div className="flex flex-col min-h-screen">
      {access?.read_only && access?.subscription_status !== 'NO_PLAN' && (
        <div className="bg-yellow-50 border-b border-yellow-200 px-4 py-3 flex flex-wrap items-center justify-center sm:justify-between gap-3 sticky top-0 z-[100]">
          <div className="flex items-center gap-2 text-yellow-800">
            <i className="ri-error-warning-fill text-lg" />
            <span className="text-sm font-medium">
              Your subscription is currently{' '}
              <strong>{access.subscription_status.replace('_', ' ').toUpperCase()}</strong>.
              The app is in read-only mode.
            </span>
          </div>
          <a
            href="/subscription"
            className="px-4 py-1.5 bg-yellow-500 hover:bg-yellow-600 text-white text-sm font-semibold rounded-lg shadow-sm transition-colors"
          >
            {access.action_required === 'RENEW_SUBSCRIPTION' ? 'Renew Subscription' : 'Manage Subscription'}
          </a>
        </div>
      )}

      <AnimatePresence mode="wait">
        <motion.div
          key={location.pathname}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.25, ease: 'easeInOut' }}
          className="flex-1 flex flex-col h-full w-full"
        >
          <Outlet />
        </motion.div>
      </AnimatePresence>
    </div>
  )
}