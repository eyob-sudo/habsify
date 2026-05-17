import api from './api';

export const getAccounts = () => api.get('/finance/accounts/');
export const getFinanceStats = (options = {}) => {
  const { search = '' } = options || {}
  const params = {}
  if (search) params.search = search
  return api.get('/finance/stats/', { params })
}
export const getCashSummary = (options = {}) => {
  const { search = '', type = '' } = options || {}
  const params = {}
  if (search) params.search = search
  if (type) params.type = type
  return api.get('/finance/cash', { params })
}
export const createExpense = (payload) => api.post('/finance/expenses/', payload);
export const createAccount = (payload) => api.post('/finance/accounts/', payload);
export const updateAccount = (id, payload) => api.put(`/finance/accounts/${id}/`, payload);
export const createFinanceTransaction = (payload) => api.post('/finance/transactions/', payload);
export const getSaleDropdown = () => api.get('/sales-purchases/sale-dropdown/');
export const getPurchaseDropdown = () => api.get('/sales-purchases/purchase-dropdown/');
export const getTransactionTypes = () => api.get('/finance/transaction-types/');