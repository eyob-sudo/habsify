import api from './api'

export function getBusinessKpis() {
  return api.get('/api/business-kpis/')
}

export function getFinancialOverview() {
  return api.get('/api/financial-overview/')
}

export function getTopProducts() {
  return api.get('/api/top-products/')
}

export function getTopCustomers() {
  return api.get('/api/top-customers/')
}

export function getTopSuppliers() {
  return api.get('/api/top-suppliers/')
}

export function getTopProductsChart() {
  return api.get('/api/top-products-chart/')
}

export function getCustomerGrowth() {
  return api.get('/api/customer-growth/')
}

export function getRecentActivity() {
  return api.get('/api/recent-activity/')
}

export function getProfileSettingsTitle() {
  return api.get('/api/profile-settings-title/')
}
