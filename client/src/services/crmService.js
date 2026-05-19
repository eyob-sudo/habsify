import api from './api'

export async function getCustomers(options = {}) {
  const { page = 1, search = '', ordering = '' } = options
  const params = { page }
  if (search) params.search = search
  if (ordering) params.ordering = ordering
  const res = await api.get('/crm/customers/', { params })
  return res.data
}

export async function getCustomerTransactions(customerId, options = {}) {
  const { page = 1, search = '', ordering = '' } = options
  const params = { page }
  if (search) params.search = search
  if (ordering) params.ordering = ordering
  const res = await api.get(`/crm/customers/${customerId}/`, { params })
  return res.data
}

export async function createCustomer(payload) {
  const res = await api.post('/crm/customers/', payload)
  return res.data
}

export async function updateCustomer(id, payload) {
  const res = await api.patch(`/crm/customers/${id}/`, payload)
  return res.data
}

export async function deleteCustomer(id) {
  await api.delete(`/crm/customers/${id}/`)
}

export async function exportCustomerTransactions(id, format) {
  const res = await api.get(`/crm/customers/${id}/`, {
    params: { export: format },
    responseType: 'blob',
  })

  let filename = `customer-${id}-transactions.${format}`
  const disposition = res.headers?.['content-disposition'] || res.headers?.['Content-Disposition']
  if (disposition) {
    const match =
      /filename\*=UTF-8''([^;\n]+)/.exec(disposition) ||
      /filename="?([^";]+)"?/.exec(disposition)
    if (match) filename = decodeURIComponent(match[1])
  }

  const blob = new Blob([res.data], {
    type: format === 'pdf' ? 'application/pdf' : 'text/csv',
  })
  const url = window.URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.URL.revokeObjectURL(url)
  return filename
}