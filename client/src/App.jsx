import React from 'react'
import { Routes, Route } from 'react-router-dom'
import Dashboard from './pages/Dashboard'
import CRM from './pages/CRM'
import CustomerProfile from './pages/CustomerProfile'
import Suppliers from './pages/Suppliers'
import SupplierProfile from './pages/SupplierProfile'
import Inventory from './pages/Inventory'
import InventoryTable from './pages/InventoryTable'
import InventoryItems from './pages/InventoryItems'
import InventoryStockMovements from './pages/InventoryStockMovements'
import InventoryCategories from './pages/InventoryCategories'
import Finance from './pages/Finance'
import FinanceTable from './pages/FinanceTable'
import Notifications from './pages/Notifications'
import Subscription from './pages/Subscription'
import Tasks from './pages/Tasks'
import Login from './pages/Login'
import Signup from './pages/Signup'
import OtpVerify from './pages/OtpVerify'
import ForgotPassword from './pages/ForgotPassword'
import ResetPassword from './pages/ResetPassword'
import ActivateAccount from './pages/ActivateAccount'
import Landing from './pages/Landing'
import NotFound from './pages/NotFound'
import ProtectedRoute from './components/ProtectedRoute'
import ChoosePlan from './pages/ChoosePlan'

export default function App() {
  return (
    <Routes>
      {/* ─── Public routes ─── */}
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route path="/otp-verify" element={<OtpVerify />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/accounts/activate/:uid/:token" element={<ActivateAccount />} />

      {/* ─── Protected routes ─── */}
      <Route element={<ProtectedRoute />}>
        <Route path="/choose-plan" element={<ChoosePlan />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/crm" element={<CRM />} />
        <Route path="/crm/customer/:id" element={<CustomerProfile />} />
        <Route path="/suppliers" element={<Suppliers />} />
        <Route path="/suppliers/supplier/:id" element={<SupplierProfile />} />
        <Route path="/inventory" element={<Inventory />} />
        <Route path="/inventory/items" element={<InventoryItems />} />
        <Route path="/inventory/stock-movements" element={<InventoryStockMovements />} />
        <Route path="/inventory/categories" element={<InventoryCategories />} />
        <Route path="/inventory/:id" element={<InventoryTable />} />
        <Route path="/finance" element={<Finance />} />
        <Route path="/finance/cash" element={<FinanceTable />} />
        <Route path="/notifications" element={<Notifications />} />
        <Route path="/tasks" element={<Tasks />} />
        <Route path="/subscription" element={<Subscription />} />
      </Route>

      <Route path="*" element={<NotFound />} />
    </Routes>
  )
}