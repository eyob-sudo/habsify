import React, { useEffect, useMemo, useState } from 'react'
import toast from '../services/toastService'
import { getProfile, updateProfile, changePassword } from '../services/profileService'

const emptyProfile = {
  updated_at: '',
  avatar: '',
  user_email: '',
  user_username: '',
  user_first_name: '',
  user_last_name: '',
  role: '',
  phone_number: '',
  is_phone_verified: 'False',
  is_email_verified: 'False',
  joined_at: '',
  street_address: '',
  city: '',
  state: '',
  zip_code: '',
  country: ''
}

function toBoolFlag(value) {
  if (typeof value === 'boolean') return value
  return String(value).toLowerCase() === 'true'
}

export default function ProfileModal({ open, onClose }) {
  const [profile, setProfile] = useState(emptyProfile)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [passwordForm, setPasswordForm] = useState({
    old_password: '',
    new_password: '',
    confirm_password: ''
  })
  const [passwordSaving, setPasswordSaving] = useState(false)
  const [passwordOpen, setPasswordOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    let alive = true
    setLoading(true)
    setAvatarFile(null)
    setAvatarPreview('')
    setPasswordOpen(false)
    getProfile()
      .then((data) => {
        if (alive) setProfile(data || emptyProfile)
      })
      .catch(() => {
        if (alive) toast.error('Failed to load profile')
      })
      .finally(() => {
        if (alive) setLoading(false)
      })
    return () => {
      alive = false
    }
  }, [open])

  useEffect(() => {
    if (!avatarFile) return
    const previewUrl = URL.createObjectURL(avatarFile)
    setAvatarPreview(previewUrl)
    return () => {
      URL.revokeObjectURL(previewUrl)
    }
  }, [avatarFile])

  const initials = useMemo(() => {
    const first = profile.user_first_name?.[0] || ''
    const last = profile.user_last_name?.[0] || ''
    return `${first}${last}`.trim() || 'U'
  }, [profile.user_first_name, profile.user_last_name])

  const updateField = (key) => (e) => {
    setProfile((prev) => ({ ...prev, [key]: e.target.value }))
  }

  const updatePasswordField = (key) => (e) => {
    setPasswordForm((prev) => ({ ...prev, [key]: e.target.value }))
  }

  const handleSave = async () => {
    setSaving(true)
    try {
      const payload = {
        updated_at: profile.updated_at,
        avatar: profile.avatar,
        user_email: profile.user_email,
        user_username: profile.user_username,
        user_first_name: profile.user_first_name,
        user_last_name: profile.user_last_name,
        role: profile.role,
        phone_number: profile.phone_number,
        is_phone_verified: profile.is_phone_verified,
        is_email_verified: profile.is_email_verified,
        joined_at: profile.joined_at,
        street_address: profile.street_address,
        city: profile.city,
        state: profile.state,
        zip_code: profile.zip_code,
        country: profile.country,
        avatarFile
      }
      const updated = await updateProfile(payload)
      setProfile(updated || payload)
      toast.success('Profile updated')
      onClose()
    } catch (err) {
      toast.error('Failed to update profile')
    } finally {
      setSaving(false)
    }
  }

  const handleChangePassword = async (e) => {
    e.preventDefault()
    if (!passwordForm.old_password || !passwordForm.new_password || !passwordForm.confirm_password) {
      toast.error('All password fields are required')
      return
    }
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('New password and confirmation do not match')
      return
    }
    setPasswordSaving(true)
    try {
      await changePassword({
        old_password: passwordForm.old_password,
        new_password: passwordForm.new_password,
        confirm_password: passwordForm.confirm_password
      })
      toast.success('Password updated')
      setPasswordForm({ old_password: '', new_password: '', confirm_password: '' })
    } catch (err) {
      toast.error('Failed to update password')
    } finally {
      setPasswordSaving(false)
    }
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-gray-900">Profile Settings</h2>
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
            >
              <i className="ri-close-line ri-lg"></i>
            </button>
          </div>
          <p className="text-gray-600 mt-2">Manage your personal information and account preferences</p>
        </div>
        {loading ? (
          <div className="p-8 text-center text-sm text-gray-600">Loading profile...</div>
        ) : (
          <>
            <div className="p-6">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-1">
                  <div className="bg-gray-50 rounded-xl p-6 text-center">
                    <div className="relative inline-block mb-4">
                      {avatarPreview || profile.avatar ? (
                        <img
                          src={avatarPreview || profile.avatar}
                          alt="Profile"
                          className="w-24 h-24 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-24 h-24 bg-primary text-white rounded-full flex items-center justify-center text-3xl font-bold">
                          {initials}
                        </div>
                      )}
                      <label className="absolute -bottom-2 -right-2 w-8 h-8 bg-white border-2 border-gray-200 rounded-full flex items-center justify-center hover:bg-gray-50 transition-colors cursor-pointer">
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                        />
                        <i className="ri-camera-line text-gray-600"></i>
                      </label>
                    </div>
                    <h3 className="text-lg font-semibold text-gray-900">
                      {profile.user_first_name || 'User'} {profile.user_last_name || ''}
                    </h3>
                    <p className="text-sm text-gray-600">{profile.role || 'Member'}</p>
                    <p className="text-xs text-gray-500 mt-1">Member since {profile.joined_at || '-'}</p>
                  </div>
                  <div className="mt-6 space-y-3">
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <i className="ri-mail-line text-gray-400"></i>
                      </div>
                      <span className="text-gray-700">{profile.user_email || '-'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <i className="ri-phone-line text-gray-400"></i>
                      </div>
                      <span className="text-gray-700">{profile.phone_number || '-'}</span>
                    </div>
                    <div className="flex items-center gap-3 text-sm">
                      <div className="w-5 h-5 flex items-center justify-center">
                        <i className="ri-map-pin-line text-gray-400"></i>
                      </div>
                      <span className="text-gray-700">{profile.city || '-'}, {profile.country || '-'}</span>
                    </div>
                    <div className="flex items-center gap-2 text-xs mt-2">
                      <span className={`px-2 py-1 rounded-full ${toBoolFlag(profile.is_email_verified) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        Email {toBoolFlag(profile.is_email_verified) ? 'verified' : 'unverified'}
                      </span>
                      <span className={`px-2 py-1 rounded-full ${toBoolFlag(profile.is_phone_verified) ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'}`}>
                        Phone {toBoolFlag(profile.is_phone_verified) ? 'verified' : 'unverified'}
                      </span>
                    </div>
                  </div>
                </div>
                <div className="lg:col-span-2">
                  <div className="space-y-6">
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h4>
                      <form className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                            <input
                              type="text"
                              name="user_first_name"
                              value={profile.user_first_name}
                              onChange={updateField('user_first_name')}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                            <input
                              type="text"
                              name="user_last_name"
                              value={profile.user_last_name}
                              onChange={updateField('user_last_name')}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                              required
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                            <input
                              type="email"
                              name="user_email"
                              value={profile.user_email}
                              onChange={updateField('user_email')}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                            <input
                              type="tel"
                              name="phone_number"
                              value={profile.phone_number}
                              onChange={updateField('phone_number')}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                            />
                          </div>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                            <input
                              type="text"
                              name="user_username"
                              value={profile.user_username}
                              readOnly
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-sm"
                            />
                          </div>
                        </div>
                      </form>
                    </div>
                    <div>
                      <h4 className="text-lg font-semibold text-gray-900 mb-4">Address Information</h4>
                      <div className="space-y-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Street Address</label>
                          <input
                            type="text"
                            name="street_address"
                            value={profile.street_address}
                            onChange={updateField('street_address')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                          />
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">City</label>
                            <input
                              type="text"
                              name="city"
                              value={profile.city}
                              onChange={updateField('city')}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">State</label>
                            <input
                              type="text"
                              name="state"
                              value={profile.state}
                              onChange={updateField('state')}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">ZIP Code</label>
                            <input
                              type="text"
                              name="zip_code"
                              value={profile.zip_code}
                              onChange={updateField('zip_code')}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-2">Country</label>
                          <input
                            type="text"
                            name="country"
                            value={profile.country}
                            onChange={updateField('country')}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                          />
                        </div>
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h4 className="text-lg font-semibold text-gray-900">Security</h4>
                        <button
                          type="button"
                          onClick={() => setPasswordOpen((prev) => !prev)}
                          className="text-sm text-primary hover:text-primary/80 font-semibold flex items-center gap-2"
                          aria-expanded={passwordOpen}
                        >
                          {passwordOpen ? 'Hide' : 'Change Password'}
                          <i className={`ri-arrow-${passwordOpen ? 'up' : 'down'}-s-line`}></i>
                        </button>
                      </div>
                      {passwordOpen && (
                        <form className="space-y-4" onSubmit={handleChangePassword}>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Old Password</label>
                            <input
                              type="password"
                              name="old_password"
                              value={passwordForm.old_password}
                              onChange={updatePasswordField('old_password')}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">New Password</label>
                            <input
                              type="password"
                              name="new_password"
                              value={passwordForm.new_password}
                              onChange={updatePasswordField('new_password')}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                              required
                            />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                            <input
                              type="password"
                              name="confirm_password"
                              value={passwordForm.confirm_password}
                              onChange={updatePasswordField('confirm_password')}
                              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm"
                              required
                            />
                          </div>
                          <button
                            type="submit"
                            disabled={passwordSaving}
                            className="w-full md:w-auto px-4 py-2 !rounded-button whitespace-nowrap border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-60"
                          >
                            {passwordSaving ? 'Updating...' : 'Update Password'}
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="p-6 border-t border-gray-100 bg-gray-50">
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-6 py-2 !rounded-button whitespace-nowrap border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving}
                  className="px-6 py-2 !rounded-button whitespace-nowrap bg-primary text-white hover:bg-primary/90 transition-colors disabled:opacity-60"
                >
                  {saving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
