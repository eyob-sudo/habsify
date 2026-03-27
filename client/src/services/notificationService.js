import api from './api'

const NOTIFICATIONS_URL = '/notifications/notifications/'
const UNREAD_URL = '/notifications/notifications/unread/'
const UNREAD_COUNT_URL = '/notifications/notifications/unread_count/'

export async function getNotifications(params = {}) {
  const res = await api.get(NOTIFICATIONS_URL, { params })
  return res?.data ?? res
}

export async function getUnreadNotifications(params = {}) {
  const res = await api.get(UNREAD_URL, { params })
  return res?.data ?? res
}

export async function getUnreadCount() {
  const res = await api.get(UNREAD_COUNT_URL)
  return res?.data ?? res
}

export async function markNotificationRead(id) {
  if (!id) throw new Error('Notification id is required')
  const res = await api.post(`${NOTIFICATIONS_URL}${id}/mark_read/`)
  return res?.data ?? res
}
