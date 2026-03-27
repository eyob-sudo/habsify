import api from './api'

export const getSuppliers = () => api.get('/suppliers/supplier/')
export const getItems = (options = {}) => {
  const { page = 1, search = '', ordering = '', categoryName = '' } = options || {}
  const params = { page }
  if (search) params.search = search
  if (ordering) params.ordering = ordering
  if (categoryName) params['category__name'] = categoryName
  return api.get('/inventory/items/', { params })
}

export const getCategories = (options = {}) => {
  const { page = 1, search = '', ordering = '' } = options || {}
  const params = { page }
  if (search) params.search = search
  if (ordering) params.ordering = ordering
  return api.get('/inventory/categories/', { params })
}

export const createCategory = (payload) => api.post('/inventory/categories/', payload)
export const updateCategory = (id, payload) => api.patch(`/inventory/categories/${id}/`, payload)
export const deleteCategory = (id) => api.delete(`/inventory/categories/${id}/`)

export const getWarehouses = (options = {}) => {
  const { search = '', ordering = '', name = '' } = options || {}
  const params = {}
  if (search) params.search = search
  // support pagination
  if (options.page) params.page = options.page
  if (ordering) params.ordering = ordering
  if (name) params.name = name
  return api.get('/inventory/warehouses/', { params })
}

export const createWarehouse = (payload) => api.post('/inventory/warehouses/', payload)
export const updateWarehouse = (id, payload) => api.patch(`/inventory/warehouses/${id}/`, payload)
export const deleteWarehouse = (id) => api.delete(`/inventory/warehouses/${id}/`)

export const getWarehouseProducts = (id, options = {}) => {
  const { inventory_search = '', category = '', inventory_ordering = '' } = options || {}
  const params = {}
  if (inventory_search) params.inventory_search = inventory_search
  if (category) params.category = category
  // support pagination
  if (options.page) params.page = options.page
  if (inventory_ordering) params.inventory_ordering = inventory_ordering
  return api.get(`/inventory/warehouses/${id}/`, { params })
}

// Future: Add POST, PUT, DELETE as needed
export const createPurchase = (payload) => api.post('/sales-purchases/purchases/', payload)
// export const createSale = (payload) => api.post('/inventory/sales/')
// export const updateStock = (id, data) => api.patch(`/inventory/items/${id}/`, data)

// Alias for backward compatibility: some components expect getInventoryDetail
export const getInventoryDetail = getWarehouseProducts
export const createItem = (payload) => api.post('/inventory/items/', payload)
export const updateItem = (id, payload) => api.patch(`/inventory/items/${id}/`, payload)
export const deleteItem = (id) => api.delete(`/inventory/items/${id}/`)

export const getStockMovements = (options = {}) => {
  const { page = 1, search = '', ordering = '' } = options || {}
  const params = { page }
  if (search) params.search = search
  if (ordering) params.ordering = ordering
  return api.get('/inventory/stock-movements/', { params })
}

export const getStockMovementDetail = (id) => api.get(`/inventory/stock-movements/${id}/`)
export const createStockMovement = (payload) => api.post('/inventory/stock-movements/', payload)
export const updateStockMovement = (id, payload) => api.patch(`/inventory/stock-movements/${id}/`, payload)
export const deleteStockMovement = (id) => api.delete(`/inventory/stock-movements/${id}/`)

export const getInventoryDropdown = (options = {}) => {
  const { search = '' } = options || {}
  const params = {}
  if (search) params.search = search
  return api.get('/inventory/inventory-dropdown/', { params })
}

export const getPurchaseDropdown = () => api.get('/sales-purchases/purchase-dropdown/')
export const getSaleDropdown = () => api.get('/sales-purchases/sale-dropdown/')
