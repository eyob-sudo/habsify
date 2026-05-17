import React, { useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import toast from '../services/toastService'
import { getProfile, updateProfile, changePassword } from '../services/profileService'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { X, Camera, Mail, Phone, MapPin, KeyRound, ShieldCheck, AlertTriangle } from 'lucide-react'
import api from '../services/api'

// PHASE 14: Strict Zod validation schemas for professional Profile forms
const profileSchema = z.object({
  user_first_name: z.string().min(1, 'First name is required'),
  user_last_name: z.string().min(1, 'Last name is required'),
  user_email: z.string().email('Invalid email address').nullish().or(z.literal('')),
  phone_number: z.string().nullish().or(z.literal('')),
  street_address: z.string().nullish().or(z.literal('')),
  city: z.string().nullish().or(z.literal('')),
  state: z.string().nullish().or(z.literal('')),
  zip_code: z.string().nullish().or(z.literal('')),
  country: z.string().nullish().or(z.literal(''))
})

const passwordSchema = z.object({
  old_password: z.string().min(1, 'Current password is required'),
  new_password: z.string().min(6, 'Password must be at least 6 characters'),
  confirm_password: z.string().min(1, 'Confirm password is required'),
}).refine(data => data.new_password === data.confirm_password, {
  message: "Passwords don't match",
  path: ["confirm_password"]
})

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

export default function ProfileModal({ open, onClose }) {
  const queryClient = useQueryClient()
  const [avatarFile, setAvatarFile] = useState(null)
  const [avatarPreview, setAvatarPreview] = useState('')
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [resetOpen, setResetOpen] = useState(false)
  const [confirmReset, setConfirmReset] = useState(false)

  // PHASE 15: Automating fetched Server State inside React Query
  const { data: profileQuery, isLoading: loading } = useQuery({
    queryKey: ['userProfile'],
    queryFn: async () => {
      const data = await getProfile()
      return data || emptyProfile
    },
    enabled: open,
    staleTime: 5 * 60 * 1000 // cache 5 min
  })

  // Set default form values dynamically when react-query hydrates
  const {
    register: registerProfile,
    handleSubmit: handleProfileSubmit,
    reset: resetProfileForm,
    formState: { errors: profileErrors, isDirty }
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: emptyProfile
  })

  useEffect(() => {
    if (profileQuery) {
      resetProfileForm(profileQuery)
    }
  }, [profileQuery, resetProfileForm])

  const {
    register: registerPassword,
    handleSubmit: handlePasswordSubmit,
    reset: resetPasswordForm,
    formState: { errors: passwordErrors }
  } = useForm({
    resolver: zodResolver(passwordSchema),
    defaultValues: { old_password: '', new_password: '', confirm_password: '' }
  })

  // Mutator for Profile Details
  const saveProfileMutator = useMutation({
    mutationFn: async (payload) => {
      // Create a clean payload to allow partial updates, excluding readonly fields backend rejects.
      const cleanPayload = { ...payload }
      delete cleanPayload.user_email // do not send email
      const fullPayload = { ...cleanPayload, avatarFile }
      return updateProfile(fullPayload)
    },
    onSuccess: (updated) => {
      queryClient.setQueryData(['userProfile'], updated)
      toast.success('Profile updated successfully')
      onClose()
    },
    onError: () => {
      toast.error('Failed to update profile')
    }
  })

  // Mutator for Password Change
  const savePasswordMutator = useMutation({
    mutationFn: async (data) => changePassword(data),
    onSuccess: () => {
      toast.success('Password updated securely')
      resetPasswordForm()
      setPasswordOpen(false)
    }
  })

  // Mutator for Reset Company Data
  const resetMutator = useMutation({
    mutationFn: async () => {
      const res = await api.post('/company/reset/', { confirm: true })
      return res.data
    },
    onSuccess: (data) => {
      toast.success(data.detail || 'Company data reset successfully')
      setTimeout(() => window.location.reload(), 1500)
    },
    onError: (err) => {
      toast.error(err.response?.data?.detail || 'Failed to reset company data')
    }
  })

  // Reset temporal states on open
  useEffect(() => {
    if (!open) {
      setAvatarFile(null)
      setAvatarPreview('')
      setPasswordOpen(false)
      setResetOpen(false)
      setConfirmReset(false)
      resetPasswordForm()
    }
  }, [open, resetPasswordForm])

  useEffect(() => {
    if (!avatarFile) return
    const previewUrl = URL.createObjectURL(avatarFile)
    setAvatarPreview(previewUrl)
    return () => {
      URL.revokeObjectURL(previewUrl)
    }
  }, [avatarFile])

  const initials = useMemo(() => {
    const first = profileQuery?.user_first_name?.[0] || ''
    const last = profileQuery?.user_last_name?.[0] || ''
    return `${first}${last}`.trim() || 'U'
  }, [profileQuery?.user_first_name, profileQuery?.user_last_name])

  const onProfileSave = (data) => saveProfileMutator.mutate(data)
  const onPasswordSave = (data) => savePasswordMutator.mutate(data)

  // Wait for framer-motion AnimatePresence to trigger exit animations correctly
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[100] p-4"
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.95, opacity: 0, y: 20 }}
            transition={{ type: "spring", duration: 0.5, bounce: 0.3 }}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl max-h-[90vh] overflow-hidden flex flex-col"
          >
            <div className="p-6 border-b border-gray-100 flex items-center justify-between bg-gray-50/50">
              <div>
                <h2 className="text-xl font-bold tracking-tight text-gray-900 flex items-center gap-2">
                  <ShieldCheck className="text-primary" size={24} />
                  Profile Settings
                </h2>
                <p className="text-gray-500 text-sm mt-1">Manage your personal info and security preferences.</p>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="w-10 h-10 flex items-center justify-center bg-white border border-gray-200 rounded-full text-gray-400 hover:text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
              >
                <X size={20} />
              </button>
            </div>

            <div className="overflow-y-auto custom-scrollbar flex-1 relative">
              {loading ? (
                <div className="p-12 flex flex-col items-center justify-center text-gray-400 space-y-4">
                  <div className="w-8 h-8 border-2 border-primary/30 border-t-primary rounded-full animate-spin"></div>
                  <span className="text-sm font-medium">Loading profile securely...</span>
                </div>
              ) : (
                <div className="p-6">
                  <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">

                    {/* Left Column: Avatar & Meta */}
                    <div className="lg:col-span-1">
                      <div className="bg-gray-50 rounded-2xl p-6 text-center border border-gray-100">
                        <div className="relative inline-block mb-4">
                          {avatarPreview || profileQuery?.avatar ? (
                            <img
                              src={avatarPreview || profileQuery?.avatar}
                              alt="Profile"
                              className="w-28 h-28 rounded-full object-cover shadow-sm bg-white border-4 border-white"
                            />
                          ) : (
                            <div className="w-28 h-28 bg-primary/10 text-primary rounded-full flex items-center justify-center text-3xl font-black shadow-sm border-4 border-white">
                              {initials}
                            </div>
                          )}
                          <label className="absolute bottom-0 right-0 w-9 h-9 bg-white border border-gray-200 rounded-full flex items-center justify-center shadow-sm cursor-pointer hover:bg-gray-50 transition-colors">
                            <input
                              type="file"
                              accept="image/*"
                              className="hidden"
                              onChange={(e) => setAvatarFile(e.target.files?.[0] || null)}
                            />
                            <Camera size={18} className="text-gray-600" />
                          </label>
                        </div>
                        <h3 className="text-lg font-bold text-gray-900 tracking-tight">
                          {profileQuery?.user_first_name || 'User'} {profileQuery?.user_last_name || ''}
                        </h3>
                        <p className="text-sm font-medium text-gray-500 capitalize">{profileQuery?.role?.replace('_', ' ') || 'Member'}</p>

                        <div className="mt-8 space-y-4 text-left border-t border-gray-200 pt-6">
                          <div className="flex items-center gap-3 text-sm">
                            <Mail size={16} className="text-gray-400" />
                            <span className="text-gray-700 truncate">{profileQuery?.user_email || '—'}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <Phone size={16} className="text-gray-400" />
                            <span className="text-gray-700 truncate">{profileQuery?.phone_number || '—'}</span>
                          </div>
                          <div className="flex items-center gap-3 text-sm">
                            <MapPin size={16} className="text-gray-400" />
                            <span className="text-gray-700 truncate">{profileQuery?.city || 'No Location Set'}</span>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Right Column: React Hook Form Editor */}
                    <div className="lg:col-span-2 space-y-8">
                      <form id="profile-form" onSubmit={handleProfileSubmit(onProfileSave)} className="space-y-6">
                        <div>
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">Personal Information</h4>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1.5">First Name</label>
                              <input
                                {...registerProfile('user_first_name')}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm ${profileErrors.user_first_name ? 'border-red-500' : 'border-gray-300'}`}
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1.5">Last Name</label>
                              <input
                                {...registerProfile('user_last_name')}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm ${profileErrors.user_last_name ? 'border-red-500' : 'border-gray-300'}`}
                              />
                            </div>
                          </div>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
                              <input
                                {...registerProfile('user_email')}
                                className={`w-full px-3 py-2 border rounded-lg bg-gray-50 text-gray-500 cursor-not-allowed text-sm ${profileErrors.user_email ? 'border-red-500' : 'border-gray-300'}`}
                                readOnly // Prevents react-hook-form from dropping standard validation while preventing user edit
                              />
                            </div>
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1.5">Phone</label>
                              <input
                                {...registerProfile('phone_number')}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm ${profileErrors.phone_number ? 'border-red-500' : 'border-gray-300'}`}
                              />
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-gray-100 pt-6">
                          <h4 className="text-lg font-semibold text-gray-900 mb-4">Address Information</h4>
                          <div className="space-y-4">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1.5">Street Address</label>
                              <input
                                {...registerProfile('street_address')}
                                className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm ${profileErrors.street_address ? 'border-red-500' : 'border-gray-300'}`}
                              />
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">City</label>
                                <input
                                  {...registerProfile('city')}
                                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm ${profileErrors.city ? 'border-red-500' : 'border-gray-300'}`}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">State</label>
                                <input
                                  {...registerProfile('state')}
                                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm ${profileErrors.state ? 'border-red-500' : 'border-gray-300'}`}
                                />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1.5">ZIP Code</label>
                                <input
                                  {...registerProfile('zip_code')}
                                  className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm ${profileErrors.zip_code ? 'border-red-500' : 'border-gray-300'}`}
                                />
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="border-t border-gray-100 pt-6 flex justify-end gap-3 flex-row-reverse border-b pb-6">
                            <button
                              type="submit"
                              disabled={saveProfileMutator.isPending}
                              className="px-6 py-2.5 !rounded-button whitespace-nowrap bg-primary font-medium text-white shadow-sm hover:bg-primary/90 transition-colors disabled:opacity-50 flex items-center justify-center min-w-[140px]"
                            >
                              {saveProfileMutator.isPending ? (
                                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                              ) : (
                                "Save Changes"
                              )}
                            </button>
                        </div>
                      </form>

                      {/* Security Tab (Accordian logic with Framer-motion) */}
                      <div className="pt-2 pb-6">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                             <KeyRound size={20} className="text-gray-500" />
                             Security
                          </h4>
                          <button
                            type="button"
                            onClick={() => setPasswordOpen(v => !v)}
                            className="px-4 py-2 !rounded-button whitespace-nowrap border border-gray-300 text-gray-700 text-sm font-medium hover:bg-gray-50 transition-colors shadow-sm"
                          >
                            {passwordOpen ? 'Cancel Change' : 'Change Password'}
                          </button>
                        </div>

                        <AnimatePresence>
                          {passwordOpen && (
                            <motion.form
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden space-y-4"
                              onSubmit={handlePasswordSubmit(onPasswordSave)}
                            >
                              <div className="bg-gray-50 p-5 rounded-xl border border-gray-100">
                                <div className="space-y-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1.5">Current Password</label>
                                    <input
                                      type="password"
                                      {...registerPassword('old_password')}
                                      className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm ${passwordErrors.old_password ? 'border-red-500' : 'border-gray-300'}`}
                                    />
                                    {passwordErrors.old_password && <p className="text-xs text-red-500 mt-1">{passwordErrors.old_password.message}</p>}
                                  </div>
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-gray-100 pt-4">
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1.5">New Password</label>
                                      <input
                                        type="password"
                                        {...registerPassword('new_password')}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm ${passwordErrors.new_password ? 'border-red-500' : 'border-gray-300'}`}
                                      />
                                      {passwordErrors.new_password && <p className="text-xs text-red-500 mt-1">{passwordErrors.new_password.message}</p>}
                                    </div>
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-1.5">Confirm New</label>
                                      <input
                                        type="password"
                                        {...registerPassword('confirm_password')}
                                        className={`w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary text-sm ${passwordErrors.confirm_password ? 'border-red-500' : 'border-gray-300'}`}
                                      />
                                      {passwordErrors.confirm_password && <p className="text-xs text-red-500 mt-1">{passwordErrors.confirm_password.message}</p>}
                                    </div>
                                  </div>
                                  <div className="flex justify-end pt-2">
                                    <button
                                      type="submit"
                                      disabled={savePasswordMutator.isPending}
                                      className="px-5 py-2 bg-gray-900 text-white !rounded-button text-sm font-medium hover:bg-black transition-colors disabled:opacity-50 flex items-center justify-center min-w-[160px]"
                                    >
                                      {savePasswordMutator.isPending ? 'Updating...' : 'Update Password Securely'}
                                    </button>
                                  </div>
                                </div>
                              </div>
                            </motion.form>
                          )}
                        </AnimatePresence>
                      </div>

                      {/* Danger Zone */}
                      <div className="pt-2 pb-6 border-t border-gray-100">
                        <div className="flex items-center justify-between mb-4">
                          <h4 className="text-lg font-semibold text-red-600 flex items-center gap-2">
                             <AlertTriangle size={20} className="text-red-600" />
                             Danger Zone
                          </h4>
                          <button
                            type="button"
                            onClick={() => { setResetOpen(v => !v); setConfirmReset(false); }}
                            className="px-4 py-2 !rounded-button whitespace-nowrap border border-red-200 text-red-600 text-sm font-medium hover:bg-red-50 transition-colors shadow-sm"
                          >
                            {resetOpen ? 'Cancel' : 'Reset All Data'}
                          </button>
                        </div>

                        <AnimatePresence>
                          {resetOpen && (
                            <motion.div
                              initial={{ height: 0, opacity: 0 }}
                              animate={{ height: "auto", opacity: 1 }}
                              exit={{ height: 0, opacity: 0 }}
                              className="overflow-hidden space-y-4"
                            >
                              <div className="bg-red-50 p-5 rounded-xl border border-red-100">
                                <h5 className="text-red-800 font-bold mb-2">Are you sure? This will delete ALL data permanently.</h5>
                                <p className="text-sm text-red-600 mb-4">
                                  This action cannot be undone. All financial transactions, accounts, sales, purchases, inventory data (items, categories, warehouses, movements), CRM customers, interactions, suppliers, tasks, and notifications will be permanently erased.
                                </p>

                                <label className="flex items-center gap-3 cursor-pointer mb-4">
                                  <input
                                    type="radio"
                                    checked={confirmReset}
                                    onClick={() => setConfirmReset(!confirmReset)}
                                    onChange={() => {}}
                                    className="w-4 h-4 text-red-600 focus:ring-red-500 border-red-300"
                                  />
                                  <span className="text-sm font-medium text-red-800">I confirm that I want to delete all company data.</span>
                                </label>

                                <div className="flex justify-end pt-2">
                                  <button
                                    type="button"
                                    disabled={!confirmReset || resetMutator.isPending}
                                    onClick={() => resetMutator.mutate()}
                                    className="px-5 py-2 bg-red-600 text-white !rounded-button text-sm font-medium hover:bg-red-700 transition-colors disabled:opacity-50 flex items-center justify-center min-w-[160px]"
                                  >
                                    {resetMutator.isPending ? 'Resetting...' : 'Permanently Delete Data'}
                                  </button>
                                </div>
                              </div>
                            </motion.div>
                          )}
                        </AnimatePresence>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
