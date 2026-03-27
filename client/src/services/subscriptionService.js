import api from './api'

const PLANS_URL = '/subscriptions/plans/'
const SUBSCRIPTIONS_URL = '/subscriptions/subscriptions/'

export async function getSubscriptionPlans() {
  const res = await api.get(PLANS_URL)
  return res?.data ?? res
}

export async function getSubscriptions() {
  const res = await api.get(SUBSCRIPTIONS_URL)
  return res?.data ?? res
}

export async function startFreeTrial(planId) {
  if (!planId) throw new Error('Plan id is required')
  const res = await api.post('/subscriptions/subscriptions/free_trial/', { plan_id: planId })
  return res?.data ?? res
}

export async function cancelSubscription(uid) {
  if (!uid) throw new Error('Subscription uid is required')
  const res = await api.post(`/subscriptions/subscriptions/${uid}/cancel/`)
  return res?.data ?? res
}

export async function getPaymentMethods() {
  const res = await api.get('/subscriptions/paymentmethod-dropdown/')
  return res?.data ?? res
}

export async function getBankAccounts() {
  const res = await api.get('/subscriptions/bankaccount-dropdown/')
  return res?.data ?? res
}

export async function subscribeAndPay(payload) {
  const res = await api.post('/subscriptions/subscriptions/subscribe_and_pay/', payload)
  return res?.data ?? res
}
