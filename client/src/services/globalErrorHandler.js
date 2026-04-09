import toast from './toastService'

const GENERIC_MESSAGE = 'Something went wrong'
const DEDUPE_WINDOW_MS = 2000
let lastToast = { message: '', ts: 0 }

function safeGetDetail(data) {
  if (!data) return ''

  const messages = []

  // Non-field / general errors
  if (data.detail) {
    if (typeof data.detail === 'string') messages.push(data.detail)
    else if (Array.isArray(data.detail)) messages.push(...data.detail)
    else if (typeof data.detail === 'object' && data.detail !== null) {
      Object.values(data.detail).forEach(val => {
        if (Array.isArray(val)) messages.push(...val)
        else if (typeof val === 'string') messages.push(val)
      })
    }
  }

  // Field-level errors
  if (typeof data === 'object') {
    Object.entries(data).forEach(([key, val]) => {
      if (key === 'detail') return
      if (Array.isArray(val)) messages.push(...val)
      else if (typeof val === 'string') messages.push(val)
    })
  }

  return messages.join(', ')
}
export function handleApiError(error, options = {}) {
  // If the request was blocked dynamically down at the axios level via ProtectedRoute:
  if (error?.isClientCancellation) {
    if (options.showToast !== false && !error.silent) {
      const now = Date.now()
      const isDuplicate = error.message === lastToast.message && (now - lastToast.ts) < DEDUPE_WINDOW_MS
      if (!isDuplicate) {
        toast.error(error.message)
        lastToast = { message: error.message, ts: now }
      }
    }
    return error.message
  }

  try {
    const { showToast = true } = options
    const detail = safeGetDetail(error?.response?.data)
    const message = detail || GENERIC_MESSAGE

    // Subscription checks
    const status = error?.response?.status
    const isSubscriptionError = status === 402 || status === 403 ||
      message.toLowerCase().includes('subscription') ||
      message.toLowerCase().includes('trial')

    if (isSubscriptionError) {
      if (showToast) {
        const now = Date.now()
        const dedupeMsg = 'Action restricted by subscription plan'
        const isDuplicate = dedupeMsg === lastToast.message && (now - lastToast.ts) < DEDUPE_WINDOW_MS
        if (!isDuplicate) {
          toast.error(message || dedupeMsg)
          lastToast = { message: dedupeMsg, ts: now }
        }
      }
      return message
    }

    if (showToast) {
      const now = Date.now()
      const isDuplicate = message === lastToast.message && (now - lastToast.ts) < DEDUPE_WINDOW_MS
      if (!isDuplicate) {
        toast.error(message)
        lastToast = { message, ts: now }
      }
    }
    return message
  } catch (err) {
    try {
      const now = Date.now()
      const isDuplicate = GENERIC_MESSAGE === lastToast.message && (now - lastToast.ts) < DEDUPE_WINDOW_MS
      if (!isDuplicate) {
        toast.error(GENERIC_MESSAGE)
        lastToast = { message: GENERIC_MESSAGE, ts: now }
      }
    } catch (noop) {
      // ignore toast failures
    }
    return GENERIC_MESSAGE
  }
}

export function attachGlobalErrorHandler(apiInstance) {
  if (!apiInstance?.interceptors?.response?.use) return apiInstance
  apiInstance.interceptors.response.use(
    (response) => response,
    (error) => {
      handleApiError(error)
      return Promise.reject(error)
    }
  )
  return apiInstance
}

export default {
  handleApiError,
  attachGlobalErrorHandler
}
