import api from './api'

const PROFILE_URL = '/accounts/profile/me/'

export async function getProfile() {
  const res = await api.get(PROFILE_URL)
  return res?.data ?? res
}

export async function updateProfile(payload) {
  const hasFile = payload?.avatarFile instanceof File
  if (!hasFile) {
    const res = await api.patch(PROFILE_URL, payload)
    return res?.data ?? res
  }
  const formData = new FormData()
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined || value === null) return
    if (key === 'avatarFile') return
    formData.append(key, value)
  })
  formData.append('avatar', payload.avatarFile)
  const res = await api.patch(PROFILE_URL, formData, {
    headers: { 'Content-Type': 'multipart/form-data' }
  })
  return res?.data ?? res
}

export async function changePassword(payload) {
  const res = await api.post('/accounts/change-password/', payload)
  return res?.data ?? res
}
