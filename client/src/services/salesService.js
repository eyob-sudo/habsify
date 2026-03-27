import api from './api'

export const createSale = (payload) => api.post('/sales-purchases/sales/', payload)

export const getCustomers = () => api.get('/crm/customers-dropdown/')
