import api from './api'

export async function getSuppliers(options = {}) {
  const { page = 1, search = '', ordering = '' } = options
  const params = { page }
  if (search) params.search = search
  if (ordering) params.ordering = ordering
  const res = await api.get('/suppliers/supplier/', { params })
  return res.data
}

export async function getSupplierTransactions(supplierId, options = {}) {
  const { page = 1, search = '', ordering = '' } = options
  const params = { page }
  if (search) params.search = search
  if (ordering) params.ordering = ordering
  const res = await api.get(`/suppliers/supplier/${supplierId}/`, { params })
  return res.data
}

export async function createSupplier(payload) {
  const res = await api.post('/suppliers/supplier/', payload)
  return res.data
}

export async function updateSupplier(id, payload) {
  const res = await api.patch(`/suppliers/supplier/${id}/`, payload)
  return res.data
}

export async function deleteSupplier(id) {
  await api.delete(`/suppliers/supplier/${id}/`)
}

export async function exportSupplierTransactions(id, format) {
  const res = await api.get(`/suppliers/supplier/${id}/`, {
    params: { export: format },
    responseType: 'blob',
  })

  let filename = `supplier-${id}-transactions.${format}`
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