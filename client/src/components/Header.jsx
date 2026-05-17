import React, { useState, useRef, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { getUnreadCount } from '../services/notificationService'
import ProfileModal from './ProfileModal'
import api from '../services/api'
import { useQuery } from '@tanstack/react-query'

export default function Header() {
  const navigate = useNavigate()
  const { logout } = useAuth()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const buttonRef = useRef(null)
  const dropdownRef = useRef(null)

  const { data: unreadCount = 0 } = useQuery({
    queryKey: ['unreadCount'],
    queryFn: async () => {
      const data = await getUnreadCount()
      return Number(data?.unread_count || 0)
    },
    staleTime: 30 * 1000, // cache for 30s so it doesn't refetch on every page nav
    refetchInterval: 30000 // keeps polling but in a controlled manner
  })

  const { data: userRaw } = useQuery({
    queryKey: ['accountsUser'],
    queryFn: async () => {
      const res = await api.get('/accounts/user/')
      return Array.isArray(res?.data) ? res.data[0] : (res?.data ?? res)
    },
    staleTime: 5 * 60 * 1000 // cache for 5 min
  })

  const userInitial = useMemo(() => {
    if (!userRaw) return 'U'
    return (userRaw.username || userRaw.email || 'U').toString().trim()[0].toUpperCase()
  }, [userRaw])

  const avatarUrl = useMemo(() => {
    if (!userRaw?.avatar) return ''
    const base = api.defaults.baseURL?.replace(/\/$/, '') || ''
    return userRaw.avatar.startsWith('http') ? userRaw.avatar : `${base}/${userRaw.avatar}`
  }, [userRaw])

  useEffect(() => {
    function onDoc(e) {
      if (!buttonRef.current?.contains(e.target) && !dropdownRef.current?.contains(e.target)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener('click', onDoc)
    return () => document.removeEventListener('click', onDoc)
  }, [])

  const handleLogout = async () => {
    setDropdownOpen(false)
    try {
      await logout()
    } finally {
      navigate('/login', { replace: true })
    }
  }

  return (
    <header className="w-full bg-white border-b border-gray-100 px-6 py-4 fixed top-0 left-0 right-0 z-50">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <img src="/logo.png" alt="Habsify Logo" className="w-10 h-10 object-cover rounded-lg" />
          <div className="leading-tight">
            <h1 className="text-2xl font-['Roboto'] font-black text-primary tracking-wide transform hover:scale-105 transition-transform duration-200 cursor-pointer">Habsify</h1>
          </div>
        </div>
        <div className="flex items-center gap-4">
          <Link to="/tasks" className="w-10 h-10 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors">
            <i className="ri-task-line ri-lg"></i>
          </Link>
          <Link to="/notifications" className="w-10 h-10 bg-gray-100 text-gray-600 rounded-full flex items-center justify-center hover:bg-gray-200 transition-colors relative">
            <i className="ri-notification-3-line ri-lg"></i>
            {unreadCount > 0 && (
              <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-[10px] leading-[18px] text-center rounded-full">
                {unreadCount > 99 ? '99+' : unreadCount}
              </span>
            )}
          </Link>
          <div className="relative">
            <button
              ref={buttonRef}
              onClick={() => setDropdownOpen(v => !v)}
              className="w-10 h-10 bg-primary text-white rounded-full flex items-center justify-center font-medium text-lg hover:bg-primary/90 transition-colors overflow-hidden"
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt="User avatar" className="w-full h-full object-cover" />
              ) : (
                userInitial
              )}
            </button>
            <div ref={dropdownRef} className={`absolute right-0 top-12 w-48 bg-white rounded-lg shadow-lg border border-gray-100 py-2 z-50 transform transition-all duration-200 ${dropdownOpen ? 'opacity-100 visible scale-100' : 'opacity-0 invisible scale-95'}`}>
              <button
                type="button"
                onClick={() => {
                  setDropdownOpen(false)
                  setProfileOpen(true)
                }}
                className="w-full flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors"
              >
                <div className="w-5 h-5 flex items-center justify-center"><i className="ri-user-line"></i></div>
                <span>Profile</span>
              </button>
              {/*<a href="#" className="flex items-center gap-3 px-4 py-2 text-gray-700 hover:bg-gray-50 transition-colors">*/}
              {/*  <div className="w-5 h-5 flex items-center justify-center"><i className="ri-settings-line"></i></div>*/}
              {/*  <span>Settings</span>*/}
              {/*</a>*/}
              <hr className="my-2 border-gray-100" />
              <button
                type="button"
                onClick={handleLogout}
                className="w-full flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 transition-colors"
              >
                <div className="w-5 h-5 flex items-center justify-center"><i className="ri-logout-box-line"></i></div>
                <span>Sign Out</span>
              </button>
            </div>
          </div>
        </div>
      </div>
      <ProfileModal open={profileOpen} onClose={() => setProfileOpen(false)} />
    </header>
  )
}
