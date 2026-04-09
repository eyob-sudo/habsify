import React, { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import toast from '../services/toastService'
import api from '../services/api'

export default function ActivateAccount() {
  const navigate = useNavigate()
  const { uid, token } = useParams()
  const [status, setStatus] = useState('loading')
  const [message, setMessage] = useState('')

  useEffect(() => {
    let isMounted = true
    async function activate() {
      if (!uid || !token) {
        if (!isMounted) return
        setStatus('error')
        setMessage('Missing activation token.')
        toast.error('Missing activation token.')
        return
      }
      try {
        await api.get(`/accounts/activate/${uid}/${token}/`)
        if (!isMounted) return
        setStatus('success')
        setMessage('Account successfully activated')
        toast.success('Account successfully activated')
        navigate('/login', { replace: true })
      } catch (err) {
        if (!isMounted) return
        const apiMessage = err?.response?.data?.detail || err?.response?.data?.message || 'Activation failed'
        setStatus('error')
        setMessage(apiMessage)
        toast.error(apiMessage)
      }
    }
    activate()
    return () => {
      isMounted = false
    }
  }, [navigate, token, uid])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-6">
      <div className="w-full max-w-lg">
        <div className="bg-white/90 backdrop-blur border border-gray-100 shadow-2xl rounded-2xl p-8 md:p-10">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-primary/10 mb-3">
              <img src="../../public/logo.png" alt="HabsifyLogo" className="w-12 h-12" />
            </div>
            <h1 className="text-3xl font-['Roboto'] font-black text-primary mb-2">Account Activation</h1>
            <p className="text-gray-600 text-base">
              {status === 'loading' ? 'Activating your account...' : 'Activation status'}
            </p>
          </div>

          <div className="text-center">
            {status === 'loading' && (
              <p className="text-sm text-gray-600">Please wait a moment.</p>
            )}
            {status !== 'loading' && (
              <p className={status === 'success' ? 'text-sm text-green-600' : 'text-sm text-red-600'}>
                {message}
              </p>
            )}
          </div>

          {status !== 'loading' && (
            <div className="mt-8">
              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full py-3 !rounded-button whitespace-nowrap border border-gray-300 text-gray-700 text-lg font-semibold hover:bg-gray-50 transition-colors"
              >
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

