import React, { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import toast from '../services/toastService'
import authService from '../services/authService'

export default function Signup() {
  const navigate = useNavigate()
  const [form, setForm] = useState({
    email: '',
    first_name: '',
    last_name: '',
    username: '',
    password: '',
    re_password: '',
    phone: '',
    company: ''
  })
  const [submitting, setSubmitting] = useState(false)

  function updateField(e) {
    const { name, value } = e.target
    setForm(prev => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    if (!form.email && !form.phone) {
      toast.error('Email and phone are required')
      return
    }
    if (!form.password || !form.re_password) {
      toast.error('Password and confirm password are required')
      return
    }
    if (form.password !== form.re_password) {
      toast.error('Passwords do not match')
      return
    }

    setSubmitting(true)
    try {
      await authService.signup(form)
      authService.savePendingSignup({ email: form.email, phone: form.phone })
      toast.success('Signup successful. Verify OTP.')
      navigate('/otp-verify', { replace: true })
    } catch (err) {
      toast.error('Signup failed')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-2xl">
        <div className="bg-white/90 backdrop-blur border border-gray-100 shadow-2xl rounded-2xl p-8 md:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-3">
              <img src="/logo.png" alt="HabsifyLogo" className="w-12 h-12" />
            </div>
            <h1 className="text-3xl font-['Roboto'] font-black text-primary mb-2">Habsify</h1>
            <p className="text-gray-600 text-base">Create your account to continue.</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">First Name</label>
                <input name="first_name" value={form.first_name} onChange={updateField} className="w-full px-4 py-3 border border-gray-300 rounded-xl" placeholder="First name" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Last Name</label>
                <input name="last_name" value={form.last_name} onChange={updateField} className="w-full px-4 py-3 border border-gray-300 rounded-xl" placeholder="Last name" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Username</label>
                <input name="username" value={form.username} onChange={updateField} className="w-full px-4 py-3 border border-gray-300 rounded-xl" placeholder="Username" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Company</label>
                <input name="company" value={form.company} onChange={updateField} className="w-full px-4 py-3 border border-gray-300 rounded-xl" placeholder="Company" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Email</label>
                <input name="email" type="email" required value={form.email} onChange={updateField} className="w-full px-4 py-3 border border-gray-300 rounded-xl" placeholder="Email" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Phone</label>
                <input name="phone" required value={form.phone} onChange={updateField} className="w-full px-4 py-3 border border-gray-300 rounded-xl" placeholder="Phone" />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Password</label>
                <input name="password" type="password" required value={form.password} onChange={updateField} className="w-full px-4 py-3 border border-gray-300 rounded-xl" placeholder="Password" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Confirm Password</label>
                <input name="re_password" type="password" required value={form.re_password} onChange={updateField} className="w-full px-4 py-3 border border-gray-300 rounded-xl" placeholder="Confirm password" />
              </div>
            </div>

            <button type="submit" disabled={submitting} className="w-full py-3 !rounded-button whitespace-nowrap bg-primary text-white text-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60">
              {submitting ? 'Creating...' : 'Create Account'}
            </button>
          </form>

          <div className="text-center mt-6">
            <p className="text-sm text-gray-600">
              Already have an account?{' '}
              <Link to="/login" className="text-primary hover:text-primary/80 font-semibold">Sign in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

