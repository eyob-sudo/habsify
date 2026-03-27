import React, { useEffect, useMemo, useState } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import { getNotifications, getUnreadNotifications, markNotificationRead } from '../services/notificationService'
import toast from '../services/toastService'

const tabs = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'orders', label: 'Orders' },
  { id: 'inventory', label: 'Inventory' },
  { id: 'finance', label: 'Finance' },
  { id: 'system', label: 'System' }
]

const typeConfig = {
  low_stock: {
    category: 'inventory',
    icon: 'ri-alert-line',
    iconBg: 'bg-orange-100',
    iconColor: 'text-orange-600'
  },
  order: {
    category: 'orders',
    icon: 'ri-shopping-cart-line',
    iconBg: 'bg-green-100',
    iconColor: 'text-green-600'
  },
  finance: {
    category: 'finance',
    icon: 'ri-money-dollar-circle-line',
    iconBg: 'bg-blue-100',
    iconColor: 'text-blue-600'
  },
  system: {
    category: 'system',
    icon: 'ri-settings-3-line',
    iconBg: 'bg-purple-100',
    iconColor: 'text-purple-600'
  }
}

function formatTime(value) {
  if (!value) return ''
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return String(value)
  const yyyy = parsed.getFullYear()
  const mm = String(parsed.getMonth() + 1).padStart(2, '0')
  const dd = String(parsed.getDate()).padStart(2, '0')
  const hh = String(parsed.getHours()).padStart(2, '0')
  const min = String(parsed.getMinutes()).padStart(2, '0')
  return `${yyyy}/${mm}/${dd} ${hh}:${min}`
}

function mapNotification(item) {
  const config = typeConfig[item.type] || typeConfig.system
  return {
    id: item.id,
    category: config.category,
    unread: !item.is_read,
    title: item.type ? item.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()) : 'Notification',
    message: item.message,
    detail: '',
    time: formatTime(item.created_at),
    icon: config.icon,
    iconBg: config.iconBg,
    iconColor: config.iconColor
  }
}

export default function Notifications() {
  const [activeTab, setActiveTab] = useState('all')
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [paging, setPaging] = useState({ next: null, previous: null, count: 0 })
  const [search, setSearch] = useState('')

  useEffect(() => {
    let alive = true
    setLoading(true)
    const isUnread = activeTab === 'unread'
    const fetcher = isUnread ? getUnreadNotifications : getNotifications
    const params = {
      page,
      ...(isUnread || activeTab === 'all' ? {} : { source: activeTab }),
      ...(search.trim() ? { search: search.trim() } : {})
    }
    fetcher(params)
      .then((data) => {
        if (!alive) return
        const results = Array.isArray(data?.results) ? data.results : []
        setItems(results.map(mapNotification))
        setPaging({ next: data?.next || null, previous: data?.previous || null, count: data?.count || 0 })
      })
      .catch(() => {
        if (alive) toast.error('Failed to load notifications')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [page, activeTab, search])

  const visibleItems = useMemo(() => {
    if (activeTab === 'all') return items
    if (activeTab === 'unread') return items
    return items
  }, [activeTab, items])

  const handleMarkRead = async (id) => {
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, unread: false } : item)))
    try {
      await markNotificationRead(id)
    } catch (err) {
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, unread: true } : item)))
      toast.error('Failed to mark as read')
    }
  }

  const handleAction = (id, action) => {
    if (action.type === 'markRead') {
      handleMarkRead(id)
      return
    }
    toast.info(`${action.label} clicked`)
  }

  const pageActions = (item) => {
    const actions = []
    if (item.category === 'inventory') {
      actions.push({ label: 'View Inventory', type: 'link', className: 'text-gray-600 bg-gray-100 hover:bg-gray-200' })
    }
    if (item.category === 'orders') {
      actions.push({ label: 'View Order', type: 'link', className: 'text-primary bg-primary/10 hover:bg-primary/20' })
    }
    if (item.category === 'finance') {
      actions.push({ label: 'View Details', type: 'link', className: 'text-blue-600 bg-blue-50 hover:bg-blue-100' })
    }
    if (item.unread) {
      actions.push({ label: 'Mark as Read', type: 'markRead', className: 'text-gray-600 bg-gray-100 hover:bg-gray-200' })
    }
    return actions
  }

  return (
    <div className="bg-white min-h-screen">
      <Header />
      <div className="flex">
        <Sidebar />
        <main className="flex-1 p-6 md:p-8 md:ml-64 pt-24">
          <div className="mb-8">
            <h2 className="text-3xl font-bold text-gray-900 mb-2">Notifications</h2>
            <p className="text-gray-600">
              Stay updated with your business activities and important alerts.
            </p>
          </div>

          <div className="mb-6">
            <div className="flex flex-wrap items-center gap-3 border-b border-gray-100 pb-3">
              <div className="flex flex-wrap gap-2">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => {
                      setPage(1)
                      setActiveTab(tab.id)
                    }}
                    className={`px-4 py-2 text-sm font-medium rounded-t-md whitespace-nowrap !rounded-button ${
                      activeTab === tab.id
                        ? 'text-primary border-b-2 border-primary bg-primary/5'
                        : 'text-gray-600 hover:text-primary hover:bg-gray-50'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="ml-auto flex items-center gap-2">
                <div className="relative">
                  <div className="absolute inset-y-0 left-3 flex items-center text-gray-400">
                    <i className="ri-search-line"></i>
                  </div>
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => {
                      setPage(1)
                      setSearch(e.target.value)
                    }}
                    placeholder="Search notifications"
                    className="pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary"
                  />
                </div>
                {search && (
                  <button
                    type="button"
                    onClick={() => setSearch('')}
                    className="text-xs text-gray-500 hover:text-gray-700"
                  >
                    Clear
                  </button>
                )}
              </div>
            </div>
          </div>

          {loading ? (
            <div className="text-sm text-gray-600">Loading notifications...</div>
          ) : (
            <div className="space-y-4">
              {visibleItems.map((item) => {
                const actions = pageActions(item)
                return (
                  <div
                    key={item.id}
                    className={`bg-white rounded-xl border border-gray-100 shadow-sm p-6 ${item.unread ? 'ring-1 ring-primary/10' : ''}`}
                  >
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 ${item.iconBg} rounded-full flex items-center justify-center flex-shrink-0`}>
                        <i className={`${item.icon} ${item.iconColor} ri-lg`}></i>
                      </div>
                      <div className="flex-1">
                        <div className="flex items-start justify-between">
                          <div>
                            <h3 className="text-sm font-semibold text-gray-900">{item.title}</h3>
                            <p className="text-sm text-gray-600 mt-1">{item.message}</p>
                            {item.detail && (
                              <p className="text-xs text-gray-500 mt-2">{item.detail}</p>
                            )}
                          </div>
                          <div className="flex items-center gap-2 ml-4">
                            {item.unread && <span className="w-2 h-2 bg-primary rounded-full"></span>}
                            <span className="text-xs text-gray-500">{item.time}</span>
                          </div>
                        </div>
                        {actions.length > 0 && (
                          <div className="flex items-center gap-2 mt-3">
                            {actions.map((action) => (
                              <button
                                key={action.label}
                                type="button"
                                onClick={() => handleAction(item.id, action)}
                                className={`${action.className} px-3 py-1 text-xs font-medium rounded-md whitespace-nowrap !rounded-button`}
                              >
                                {action.label}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
              {!visibleItems.length && (
                <div className="text-sm text-gray-500">No notifications to show.</div>
              )}
            </div>
          )}
          <div className="flex items-center justify-between mt-6">
            <p className="text-xs text-gray-500">Total: {paging.count}</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!paging.previous}
                onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={!paging.next}
                onClick={() => setPage((prev) => prev + 1)}
                className="px-3 py-1 text-xs font-medium text-gray-600 bg-gray-100 rounded-md hover:bg-gray-200 disabled:opacity-50"
              >
                Next
              </button>
            </div>
          </div>
        </main>
      </div>
    </div>
  )
}
