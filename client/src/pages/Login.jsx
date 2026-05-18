import React, { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import toast from '../services/toastService'
import { useQueryClient } from '@tanstack/react-query'; 
import authService from '../services/authService'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import * as z from 'zod'
import { motion, AnimatePresence } from 'framer-motion'

const loginSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address'),
  password: z.string().min(1, 'Password is required')
})

const resendSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email address')
})

export default function Login() {
  const navigate = useNavigate()
  const { login, isAuthenticated, loading } = useAuth()
  const [resendOpen, setResendOpen] = useState(false)
  const [resendStatus, setResendStatus] = useState('')

  React.useEffect(() => {
    if (!loading && isAuthenticated) {
      navigate('/dashboard', { replace: true })
    }
  }, [loading, isAuthenticated, navigate])

  const {
    register: registerLogin,
    handleSubmit: handleLoginSubmit,
    formState: { errors: loginErrors, isSubmitting: isLoggingIn },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' }
  })

  const {
    register: registerResend,
    handleSubmit: handleResendSubmit,
    formState: { errors: resendErrors, isSubmitting: isResending },
    setValue: setResendValue
  } = useForm({
    resolver: zodResolver(resendSchema),
    defaultValues: { email: '' }
  })

// add queryClient
const queryClient = useQueryClient()

async function onLogin(data) {
  try {
    await login(data)

    queryClient.removeQueries({ queryKey: ['accessStatus'] })

    toast.success('Login successful')
  } catch (err) {
    toast.error('Login failed')
  }
}

  async function onResend(data) {
    setResendStatus('')
    try {
      await authService.resendActivation({ email: data.email })
      setResendStatus('Activation link sent. Check your inbox.')
    } catch (err) {
      toast.error('Failed to resend activation link')
    }
  }

  if (loading || isAuthenticated) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-6">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, ease: "easeOut" }}
        className="w-full max-w-lg"
      >
        <div className="bg-white/90 backdrop-blur border border-gray-100 shadow-2xl rounded-2xl p-8 md:p-10 overflow-hidden relative">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-3">
              <img src={`${import.meta.env.BASE_URL || '/'}logo.png`} alt="HabsifyLogo" className="w-12 h-12" />
            </div>
            <h1 className="text-3xl font-['Roboto'] font-black text-primary mb-2">Habsify</h1>
            <p className="text-gray-600 text-base">Sign in to continue to your workspace.</p>
          </div>

          <AnimatePresence mode="wait">
            {!resendOpen ? (
              <motion.form
                key="login-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleLoginSubmit(onLogin)}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Email</label>
                  <input
                    type="email"
                    disabled={isLoggingIn}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-lg disabled:bg-gray-100 disabled:cursor-not-allowed ${loginErrors.email ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="you@example.com"
                    {...registerLogin('email')}
                  />
                  {loginErrors.email && <p className="text-red-500 text-sm mt-1">{loginErrors.email.message}</p>}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Password</label>
                  <input
                    type="password"
                    disabled={isLoggingIn}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-lg disabled:bg-gray-100 disabled:cursor-not-allowed ${loginErrors.password ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="Enter your password"
                    {...registerLogin('password')}
                  />
                  {loginErrors.password && <p className="text-red-500 text-sm mt-1">{loginErrors.password.message}</p>}
                  <div className="mt-2 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => {
                        setResendStatus('')
                        setResendOpen(true)
                      }}
                      className="text-sm text-primary hover:text-primary/80 font-semibold transition-colors"
                    >
                      Resend activation link
                    </button>
                    <a href="/forgot-password" className="text-sm text-primary hover:text-primary/80 font-semibold transition-colors">Forgot password?</a>
                  </div>
                </div>
                <button
                  type="submit"
                  disabled={isLoggingIn}
                  className="w-full py-3 !rounded-button whitespace-nowrap bg-primary text-white text-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isLoggingIn ? 'Logging in...' : 'CONTINUE TO HABSIFY'}
                </button>
              </motion.form>
            ) : (
              <motion.form
                key="resend-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                onSubmit={handleResendSubmit(onResend)}
                className="space-y-6"
              >
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-3">Email</label>
                  <input
                    type="email"
                    disabled={isResending}
                    className={`w-full px-4 py-3 border rounded-xl focus:ring-2 focus:ring-primary/20 focus:border-primary text-lg disabled:bg-gray-100 disabled:cursor-not-allowed ${resendErrors.email ? 'border-red-500' : 'border-gray-300'}`}
                    placeholder="you@example.com"
                    {...registerResend('email')}
                  />
                  {resendErrors.email && <p className="text-red-500 text-sm mt-1">{resendErrors.email.message}</p>}
                </div>
                <button
                  type="submit"
                  disabled={isResending}
                  className="w-full py-3 !rounded-button whitespace-nowrap bg-primary text-white text-lg font-semibold hover:bg-primary/90 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {isResending ? 'Sending...' : 'Confirm & Send'}
                </button>
                {resendStatus && (
                  <p className="text-sm text-green-600 text-center font-medium bg-green-50 py-2 rounded-lg">{resendStatus}</p>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setResendOpen(false)
                    setResendStatus('')
                  }}
                  className="w-full py-3 !rounded-button whitespace-nowrap border border-gray-300 text-gray-700 text-lg font-semibold hover:bg-gray-50 transition-colors"
                >
                  Back to Login
                </button>
              </motion.form>
            )}
          </AnimatePresence>

          <div className="text-center mt-6">
            <p className="text-sm text-gray-600">
              Don&apos;t have an account?{' '}
              <a href="/signup" className="text-primary hover:text-primary/80 font-semibold transition-colors">Sign up</a>
            </p>
          </div>

          <div className="text-center mt-6">
            <p className="text-xs text-gray-500">
              By signing up, you agree to our{' '}
              <a href="#" className="text-primary hover:text-primary/80">Terms of Service</a>{' '}
              and{' '}
              <a href="#" className="text-primary hover:text-primary/80">Privacy Policy</a>
            </p>
          </div>
        </div>
      </motion.div>
    </div>
  )
}
