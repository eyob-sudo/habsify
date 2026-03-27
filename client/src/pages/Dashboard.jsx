import React, { useEffect, useRef, useState } from 'react'
import Header from '../components/Header'
import Sidebar from '../components/Sidebar'
import { getSuppliers, getItems, getWarehouses, createPurchase } from '../services/inventoryService';
import { getAccounts, createExpense } from '../services/financeService';
import { getCustomers, createSale } from '../services/salesService';
import { getUsers } from '../services/authService'
import {
  getBusinessKpis,
  getFinancialOverview,
  getTopProducts,
  getTopCustomers,
  getTopSuppliers,
  getTopProductsChart,
  getCustomerGrowth,
  getRecentActivity
} from "../services/dashboardService"
import { success as toastSuccess, error as toastError } from "../services/toastService"
import * as echarts from 'echarts';

const emptyDashboardData = {
  financialOverview: {},
  businessKPIs: {},
  topProducts: [],
  topCustomers: [],
  topSuppliers: [],
  analytics: { topProductsChart: [], customerGrowth: { labels: [], data: [] } },
  recentActivity: [],
  suppliers: [],
  customers: [],
  items: [],
  warehouses: [],
  accounts: [],
  user: null
}

export default function Dashboard() {
  const topProductsRef = useRef(null);
  const customerGrowthRef = useRef(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedType, setSelectedType] = useState(null);

  const [data, setData] = useState(emptyDashboardData);
  const [loading, setLoading] = useState(true);

  const [buyForm, setBuyForm] = useState({
    supplier: '',
    item: '',
    quantity: '',
    unit_price: '',
    warehouse: '',
    status: 'unpaid',
    payment_method: '',
    account: '',
    notes: ''
  });

  const [sellForm, setSellForm] = useState({
    customer: '',
    item: '',
    quantity: '',
    unit_price: '',
    warehouse: '',
    status: 'unpaid',
    payment_method: '',
    account: '',
    notes: ''
  });

  const [expenseForm, setExpenseForm] = useState({
    category: '',
    amount: '',
    description: '',
    payment_method: '',
    account: ''
  });

  const fetchAllData = async () => {
    try {
      setLoading(true);

      const [
        businessKpisRes,
        financialOverviewRes,
        topProductsRes,
        topCustomersRes,
        topSuppliersRes,
        topProductsChartRes,
        customerGrowthRes,
        recentActivityRes,
        suppliersRes,
        customersRes,
        itemsRes,
        warehousesRes,
        accountsRes,
        usersRes
      ] = await Promise.all([
        getBusinessKpis(),
        getFinancialOverview(),
        getTopProducts(),
        getTopCustomers(),
        getTopSuppliers(),
        getTopProductsChart(),
        getCustomerGrowth(),
        getRecentActivity(),
        getSuppliers(),
        getCustomers(),
        getItems(),
        getWarehouses(),
        getAccounts(),
        getUsers()
      ]);

      const toList = (res) => (
        Array.isArray(res)
          ? res
          : (Array.isArray(res?.data) ? res.data : res?.data?.results ?? [])
      );

      setData({
        financialOverview: financialOverviewRes?.data ?? {},
        businessKPIs: businessKpisRes?.data ?? {},
        topProducts: toList(topProductsRes),
        topCustomers: toList(topCustomersRes),
        topSuppliers: toList(topSuppliersRes),
        analytics: {
          topProductsChart: toList(topProductsChartRes),
          customerGrowth: customerGrowthRes?.data ?? { labels: [], data: [] }
        },
        recentActivity: toList(recentActivityRes),
        suppliers: toList(suppliersRes),
        customers: toList(customersRes),
        items: toList(itemsRes),
        warehouses: toList(warehousesRes),
        accounts: toList(accountsRes),
        user: (toList(usersRes)[0] ?? null)
      });
    } catch (error) {
      console.warn('⚠️ Backend fetch failed', error);
      setData(emptyDashboardData);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllData();
  }, []);

  // Render charts after data is loaded
  useEffect(() => {
    let topProductsChart;
    let customerGrowthChart;

    if (!loading && topProductsRef.current && data?.analytics?.topProductsChart?.length > 0) {
      topProductsChart = echarts.init(topProductsRef.current);
      const topProductsOption = {
        animation: false,
        grid: {top: 20, right: 20, bottom: 20, left: 20},
        tooltip: {
          trigger: 'item',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderColor: '#e5e7eb',
          textStyle: {color: '#1f2937'},
          formatter: '{b}: {c} units ({d}%)'
        },
        series: [{
          type: 'pie',
          radius: ['40%', '70%'],
          center: ['50%', '50%'],
          itemStyle: {borderRadius: 8},
          label: { show: true, fontSize: 11, color: '#1f2937' },
          data: data.analytics.topProductsChart.map((item, index) => ({
            value: toNumber(item.value),
            name: item.name,
            itemStyle: {color: chartPalette[index % chartPalette.length]}
          }))
        }]
      };
      topProductsChart.setOption(topProductsOption);
    }

    if (!loading && customerGrowthRef.current && data?.analytics?.customerGrowth?.labels?.length > 0) {
      customerGrowthChart = echarts.init(customerGrowthRef.current);
      const customerGrowthOption = {
        animation: false,
        grid: {top: 20, right: 20, bottom: 40, left: 50},
        tooltip: {
          trigger: 'axis',
          backgroundColor: 'rgba(255, 255, 255, 0.9)',
          borderColor: '#e5e7eb',
          textStyle: {color: '#1f2937'}
        },
        xAxis: {
          type: 'category',
          data: data.analytics.customerGrowth.labels,
          axisLine: {show: false},
          axisTick: {show: false},
          axisLabel: {color: '#6b7280', fontSize: 12}
        },
        yAxis: {
          type: 'value',
          axisLine: {show: false},
          axisTick: {show: false},
          axisLabel: {color: '#6b7280', fontSize: 12},
          splitLine: {lineStyle: {color: '#f3f4f6'}}
        },
        series: [{
          data: data.analytics.customerGrowth.data,
          type: 'bar',
          itemStyle: {
            color: 'rgba(141, 211, 199, 1)',
            borderRadius: [4, 4, 0, 0]
          },
          barWidth: '60%'
        }]
      };
      customerGrowthChart.setOption(customerGrowthOption);
    }

    const resizeHandler = () => {
      if (topProductsChart) topProductsChart.resize();
      if (customerGrowthChart) customerGrowthChart.resize();
    };

    window.addEventListener('resize', resizeHandler);

    return () => {
      window.removeEventListener('resize', resizeHandler);
      if (topProductsChart) topProductsChart.dispose();
      if (customerGrowthChart) customerGrowthChart.dispose();
    };
  }, [loading, data]);

  const getIconProps = (type) => {
    switch (type) {
      case 'order':
        return { bg: 'bg-green-100', icon: 'ri-check-line', color: 'text-green-600' };
      case 'alert':
        return { bg: 'bg-orange-100', icon: 'ri-alert-line', color: 'text-orange-600' };
      case 'user':
        return { bg: 'bg-blue-100', icon: 'ri-user-add-line', color: 'text-blue-600' };
      case 'shipment':
        return { bg: 'bg-primary/10', icon: 'ri-truck-line', color: 'text-primary' };
      default:
        return { bg: 'bg-gray-100', icon: 'ri-information-line', color: 'text-gray-600' };
    }
  };

  const asArray = (value) => (Array.isArray(value) ? value : value?.results ?? []);
  const toNumber = (value) => {
    const cleaned = String(value ?? '').replace(/[^0-9.-]+/g, '')
    const parsed = Number(cleaned)
    return Number.isFinite(parsed) ? parsed : 0
  }
  const chartPalette = [
    'rgba(87, 181, 231, 1)',
    'rgba(141, 211, 199, 1)',
    'rgba(251, 191, 114, 1)',
    'rgba(252, 141, 98, 1)',
    'rgba(166, 216, 84, 1)'
  ]

  if (loading) {
    return (
      <div className="min-h-screen bg-white pt-20">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6 md:p-8 md:ml-64">
            <div className="animate-pulse space-y-8">
              <div>
                <div className="h-8 w-56 bg-gray-200 rounded"></div>
                <div className="h-4 w-96 bg-gray-200 rounded mt-3"></div>
              </div>
              <div>
                <div className="h-5 w-48 bg-gray-200 rounded mb-4"></div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <div className="h-28 bg-gray-100 rounded-xl border border-gray-100"></div>
                  <div className="h-28 bg-gray-100 rounded-xl border border-gray-100"></div>
                  <div className="h-28 bg-gray-100 rounded-xl border border-gray-100"></div>
                  <div className="h-28 bg-gray-100 rounded-xl border border-gray-100"></div>
                </div>
              </div>
              <div>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <div className="h-28 bg-gray-100 rounded-xl border border-gray-100"></div>
                  <div className="h-28 bg-gray-100 rounded-xl border border-gray-100"></div>
                  <div className="h-28 bg-gray-100 rounded-xl border border-gray-100"></div>
                  <div className="h-28 bg-gray-100 rounded-xl border border-gray-100"></div>
                </div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="h-56 bg-gray-100 rounded-xl border border-gray-100"></div>
                <div className="h-56 bg-gray-100 rounded-xl border border-gray-100"></div>
                <div className="h-56 bg-gray-100 rounded-xl border border-gray-100"></div>
              </div>
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="h-72 bg-gray-100 rounded-xl border border-gray-100"></div>
                <div className="h-72 bg-gray-100 rounded-xl border border-gray-100"></div>
              </div>
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="p-6 border-b border-gray-100">
                  <div className="h-5 w-40 bg-gray-200 rounded"></div>
                </div>
                <div className="p-6 space-y-4">
                  <div className="h-12 bg-gray-100 rounded"></div>
                  <div className="h-12 bg-gray-100 rounded"></div>
                  <div className="h-12 bg-gray-100 rounded"></div>
                </div>
              </div>
            </div>
          </main>
        </div>
      </div>
    );
  }

  return (
      <div className="min-h-screen bg-white pt-20">
        <Header />
        <div className="flex">
          <Sidebar />
          <main className="flex-1 p-6 md:p-8 md:ml-64">
            <div id="dashboard-content">
              <div className="mb-8">
                <h2 className="text-3xl font-bold text-gray-900 mb-2">Dashboard</h2>
                <p className="text-gray-600">Welcome back, {data?.user?.username || 'there'}! Here's what's happening with your business today.</p>
              </div>
              {/* Financial KPIs */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Financial Overview</h3>
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs md:text-sm font-medium text-gray-600">Net Worth</p>
                        <p className="text-lg md:text-2xl font-bold text-gray-900">{data?.financialOverview?.netWorth ?? '$0'}</p>
                        <p className="text-xs md:text-sm text-green-600 mt-1">{data?.financialOverview?.netWorthChange ?? ''}</p>
                      </div>
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-green-50 rounded-lg flex items-center justify-center">
                        <i className="ri-trophy-line text-green-600 ri-lg md:ri-xl"></i>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs md:text-sm font-medium text-gray-600">Total Profit</p>
                        <p className="text-lg md:text-2xl font-bold text-gray-900">{data?.financialOverview?.totalProfit ?? '$0'}</p>
                        <p className="text-xs md:text-sm text-green-600 mt-1">{data?.financialOverview?.totalProfitChange ?? ''}</p>
                      </div>
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-primary/10 rounded-lg flex items-center justify-center">
                        <i className="ri-line-chart-line text-primary ri-lg md:ri-xl"></i>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs md:text-sm font-medium text-gray-600">Total Expenses</p>
                        <p className="text-lg md:text-2xl font-bold text-gray-900">{data?.financialOverview?.totalExpenses ?? '$0'}</p>
                        <p className="text-xs md:text-sm text-red-600 mt-1">{data?.financialOverview?.totalExpensesChange ?? ''}</p>
                      </div>
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-red-50 rounded-lg flex items-center justify-center">
                        <i className="ri-arrow-down-circle-line text-red-600 ri-lg md:ri-xl"></i>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs md:text-sm font-medium text-gray-600">Bank Balance</p>
                        <p className="text-lg md:text-2xl font-bold text-gray-900">{data?.financialOverview?.bankBalance ?? '$0'}</p>
                        <p className="text-xs md:text-sm text-blue-600 mt-1">{data?.financialOverview?.bankBalanceNote ?? ''}</p>
                      </div>
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-blue-50 rounded-lg flex items-center justify-center">
                        <i className="ri-bank-line text-blue-600 ri-lg md:ri-xl"></i>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Business KPIs */}
              <div className="mb-8">
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
                  <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs md:text-sm font-medium text-gray-600">Total Products</p>
                        <p className="text-lg md:text-2xl font-bold text-gray-900">{data?.businessKPIs?.totalProducts ?? '0'}</p>
                        <p className="text-xs md:text-sm text-orange-600 mt-1">{data?.businessKPIs?.lowStockItems ?? ''}</p>
                      </div>
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-orange-50 rounded-lg flex items-center justify-center">
                        <i className="ri-archive-line text-orange-600 ri-lg md:ri-xl"></i>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs md:text-sm font-medium text-gray-600">Total Customers</p>
                        <p className="text-lg md:text-2xl font-bold text-gray-900">{data?.businessKPIs?.totalCustomers ?? '0'}</p>
                        <p className="text-xs md:text-sm text-green-600 mt-1">{data?.businessKPIs?.customersGrowth ?? ''}</p>
                      </div>
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-green-50 rounded-lg flex items-center justify-center">
                        <i className="ri-user-heart-line text-green-600 ri-lg md:ri-xl"></i>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs md:text-sm font-medium text-gray-600">Receivables</p>
                        <p className="text-lg md:text-2xl font-bold text-gray-900">{data?.businessKPIs?.receivables ?? '$0'}</p>
                        <p className="text-xs md:text-sm text-amber-600 mt-1">{data?.businessKPIs?.overdueInvoices ?? ''}</p>
                      </div>
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-amber-50 rounded-lg flex items-center justify-center">
                        <i className="ri-arrow-right-up-line text-amber-600 ri-lg md:ri-xl"></i>
                      </div>
                    </div>
                  </div>
                  <div className="bg-white p-4 md:p-6 rounded-xl border border-gray-100 shadow-sm">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs md:text-sm font-medium text-gray-600">Payables</p>
                        <p className="text-lg md:text-2xl font-bold text-gray-900">{data?.businessKPIs?.payables ?? '$0'}</p>
                        <p className="text-xs md:text-sm text-purple-600 mt-1">{data?.businessKPIs?.payablesNote ?? ''}</p>
                      </div>
                      <div className="w-10 h-10 md:w-12 md:h-12 bg-purple-50 rounded-lg flex items-center justify-center">
                        <i className="ri-arrow-left-down-line text-purple-600 ri-lg md:ri-xl"></i>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Top Performance KPIs */}
              <div className="mb-8">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Top Selling Products</h4>
                    <div className="space-y-3">
                      {(data?.topProducts ?? []).slice(0, 3).map((product, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center">
                                <span className="text-primary font-semibold text-sm">{product?.rank ?? index + 1}</span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{product?.name ?? 'N/A'}</p>
                                <p className="text-xs text-gray-500">{(product?.units ?? 0).toLocaleString()} units sold</p>
                              </div>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">{product?.revenue ?? '$0'}</p>
                          </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Top Customers</h4>
                    <div className="space-y-3">
                      {(data?.topCustomers ?? []).map((customer, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                                <span className="text-green-600 font-semibold text-xs">{customer?.initials ?? 'N/A'}</span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{customer?.name ?? 'N/A'}</p>
                                <p className="text-xs text-gray-500">{customer?.orders ?? 0} orders this year</p>
                              </div>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">{customer?.revenue ?? '$0'}</p>
                          </div>
                      ))}
                    </div>
                  </div>

                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Top Suppliers</h4>
                    <div className="space-y-3">
                      {(data?.topSuppliers ?? []).map((supplier, index) => (
                          <div key={index} className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                                <span className="text-blue-600 font-semibold text-xs">{supplier?.initials ?? 'N/A'}</span>
                              </div>
                              <div>
                                <p className="text-sm font-medium text-gray-900">{supplier?.name ?? 'N/A'}</p>
                                <p className="text-xs text-gray-500">{supplier?.products ?? 0} products supplied</p>
                              </div>
                            </div>
                            <p className="text-sm font-semibold text-gray-900">{supplier?.value ?? '$0'}</p>
                          </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              {/* Analytics Section */}
              <div className="mb-8">
                <h3 className="text-xl font-semibold text-gray-900 mb-4">Analytics Dashboard</h3>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Top 5 Products Sold</h4>
                    <div id="top-products-chart" ref={topProductsRef} style={{ height: 300 }} />
                  </div>
                  <div className="bg-white p-6 rounded-xl border border-gray-100 shadow-sm">
                    <h4 className="text-lg font-semibold text-gray-900 mb-4">Customer Growth</h4>
                    <div id="customer-growth-chart" ref={customerGrowthRef} style={{ height: 300 }} />
                  </div>
                </div>
              </div>

              {/* Recent Activity */}
              <div className="bg-white rounded-xl border border-gray-100 shadow-sm">
                <div className="p-6 border-b border-gray-100">
                  <h3 className="text-lg font-semibold text-gray-900">Recent Activity</h3>
                </div>
                <div className="p-6">
                  <div className="space-y-4">
                    {(data?.recentActivity ?? []).map((activity, index) => {
                      const props = getIconProps(activity?.type);
                      return (
                          <div key={index} className="flex items-start gap-4">
                            <div className={`w-8 h-8 ${props.bg} rounded-full flex items-center justify-center flex-shrink-0`}>
                              <i className={`${props.icon} ${props.color}`}></i>
                            </div>
                            <div className="flex-1">
                              <p className="text-sm font-medium text-gray-900">{activity?.title ?? 'N/A'}</p>
                              <p className="text-sm text-gray-500">{activity?.description ?? ''}</p>
                              <p className="text-xs text-gray-400 mt-1">{activity?.time ?? ''}</p>
                            </div>
                          </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Floating Add Button */}
              <div className="fixed right-6 flex flex-col gap-3 z-30 bottom-[75px] md:bottom-6">
                <button
                    type="button"
                    aria-label="Add data"
                    title="Add data"
                    onClick={() => setIsModalOpen(true)}
                    className="w-16 h-16 bg-white hover:bg-white text-primary rounded-full shadow-lg hover:shadow-2xl transition-all duration-300 flex items-center justify-center group whitespace-nowrap border-2 border-primary/20 hover:border-primary/40 hover:scale-110 active:scale-95"
                >
                  <i className="ri-add-line ri-2x group-hover:rotate-180 transition-transform duration-300 font-bold"></i>
                </button>
              </div>
              {/* Add Data Modal */}
              <div
                  id="add-data-modal"
                  className={`fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 transition-all duration-300 ${
                      isModalOpen ? 'opacity-100 visible' : 'opacity-0 invisible'
                  }`}
                  onClick={() => setIsModalOpen(false)}
              >
                <div
                    className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto"
                    onClick={(e) => e.stopPropagation()}
                >
                  <div className="p-6 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <h2 className="text-2xl font-bold text-gray-900">Add New Data</h2>
                      <button
                          id="close-modal"
                          onClick={() => setIsModalOpen(false)}
                          className="w-8 h-8 flex items-center justify-center text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <i className="ri-close-line ri-lg"></i>
                      </button>
                    </div>
                    <p className="text-gray-600 mt-2">Choose what you'd like to add to your dashboard</p>
                  </div>
                  <div className="p-6">
                    <div className="mb-6">
                      <label className="block text-sm font-medium text-gray-700 mb-3">Data Type</label>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <button
                            type="button"
                            data-type="sell"
                            onClick={() => setSelectedType('sell')}
                            className={`data-type-btn !rounded-button whitespace-nowrap p-4 border-2 rounded-lg transition-all text-center ${
                              selectedType === 'sell'
                                ? 'border-primary bg-primary/5'
                                : 'border-gray-200 hover:border-primary hover:bg-primary/5'
                            }`}
                        >
                          <div className="w-8 h-8 mx-auto mb-2 flex items-center justify-center">
                            <i className="ri-shopping-cart-line ri-lg text-gray-600"></i>
                          </div>
                          <span className="text-sm font-medium text-gray-700">Sell</span>
                        </button>

                        <button
                            type="button"
                            data-type="buy"
                            onClick={() => setSelectedType('buy')}
                            className={`data-type-btn !rounded-button whitespace-nowrap p-4 border-2 rounded-lg transition-all text-center ${
                              selectedType === 'buy'
                                ? 'border-primary bg-primary/5'
                                : 'border-gray-200 hover:border-primary hover:bg-primary/5'
                            }`}
                        >
                          <div className="w-8 h-8 mx-auto mb-2 flex items-center justify-center">
                            <i className="ri-shopping-bag-line ri-lg text-gray-600"></i>
                          </div>
                          <span className="text-sm font-medium text-gray-700">Buy</span>
                        </button>

                        <button
                            type="button"
                            data-type="expense"
                            onClick={() => setSelectedType('expense')}
                            className={`data-type-btn !rounded-button whitespace-nowrap p-4 border-2 rounded-lg transition-all text-center ${
                              selectedType === 'expense'
                                ? 'border-primary bg-primary/5'
                                : 'border-gray-200 hover:border-primary hover:bg-primary/5'
                            }`}
                        >
                          <div className="w-8 h-8 mx-auto mb-2 flex items-center justify-center">
                            <i className="ri-receipt-line ri-lg text-gray-600"></i>
                          </div>
                          <span className="text-sm font-medium text-gray-700">Expense</span>
                        </button>
                      </div>
                    </div>

                    {/* Dynamic Form */}
                    <div id="dynamic-form-container">
                      {loading && (
                        <div className="animate-pulse space-y-5">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="h-10 bg-gray-100 rounded"></div>
                            <div className="h-10 bg-gray-100 rounded"></div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <div className="h-10 bg-gray-100 rounded"></div>
                            <div className="h-10 bg-gray-100 rounded"></div>
                            <div className="h-10 bg-gray-100 rounded"></div>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="h-10 bg-gray-100 rounded"></div>
                            <div className="h-10 bg-gray-100 rounded"></div>
                          </div>
                          <div className="h-20 bg-gray-100 rounded"></div>
                        </div>
                      )}
                      {!loading && selectedType === 'sell' && (
                          <div className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Customer</label>
                                <select
                                    value={sellForm.customer}
                                    onChange={(e) => setSellForm({ ...sellForm, customer: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary"
                                >
                                  <option value="">Select Customer</option>
                                  {(asArray(data?.customers)).map(c => (
                                      <option key={c.id} value={c.id}>{c.label ?? c.name}</option>
                                  ))}
                                </select>
                                {asArray(data?.customers).length === 0 && (
                                  <p className="text-xs text-gray-500 mt-2">No customers found.</p>
                                )}
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Item / Product</label>
                                <select
                                    value={sellForm.item}
                                    onChange={(e) => {
                                      const selectedItem = (data?.items ?? []).find(i => i.id === Number(e.target.value));
                                      setSellForm({
                                        ...sellForm,
                                        item: e.target.value,
                                        unit_price: selectedItem ? selectedItem.unit_price.toString() : ''
                                      });
                                    }}
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary"
                                >
                                  <option value="">Select Product</option>
                                  {(asArray(data?.items)).map(item => (
                                      <option key={item.id} value={item.id}>{item.name}</option>
                                  ))}
                                </select>
                                {asArray(data?.items).length === 0 && (
                                  <p className="text-xs text-gray-500 mt-2">No products found.</p>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                                <input type="number" value={sellForm.quantity} onChange={e => setSellForm({ ...sellForm, quantity: e.target.value })} className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary" placeholder="10" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
                                <input type="number" step="0.01" value={sellForm.unit_price} onChange={e => setSellForm({ ...sellForm, unit_price: e.target.value })} className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary" placeholder="99.99" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                                <div className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 font-semibold text-gray-900">
                                  ${((parseFloat(sellForm.quantity) || 0) * (parseFloat(sellForm.unit_price) || 0)).toFixed(2)}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
                                <select value={sellForm.warehouse} onChange={e => setSellForm({ ...sellForm, warehouse: e.target.value })} className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary">
                                  <option value="">Select Warehouse</option>
                                  {(asArray(data?.warehouses)).map(w => (
                                      <option key={w.id} value={w.id}>{w.name}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select value={sellForm.status} onChange={e => setSellForm({ ...sellForm, status: e.target.value, payment_method: '', account: '' })} className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary">
                                  <option value="unpaid">Unpaid</option>
                                  <option value="paid">Paid</option>
                                  <option value="partial">Partial</option>
                                  <option value="overpaid">Overpaid</option>
                                </select>
                              </div>
                            </div>

                            {(sellForm.status === 'paid' || sellForm.status === 'partial') && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                                    <select value={sellForm.payment_method} onChange={e => setSellForm({ ...sellForm, payment_method: e.target.value, account: '' })} className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary">
                                      <option value="">Select Method</option>
                                      <option value="cash">Cash</option>
                                      <option value="bank_transfer">Bank Transfer</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
                                    <select value={sellForm.account} onChange={e => setSellForm({ ...sellForm, account: e.target.value })} className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary" disabled={!sellForm.payment_method}>
                                      <option value="">Select Account</option>
                                      {(asArray(data?.accounts))
                                          .filter(a => !sellForm.payment_method ||
                                              (sellForm.payment_method === 'cash' && a.account_type === 'cash') ||
                                              (sellForm.payment_method === 'bank_transfer' && a.account_type === 'bank'))
                                          .map(a => (
                                              <option key={a.id} value={a.id}>
                                                {a.name} {a.account_number ? `(${a.account_number})` : ''}
                                              </option>
                                          ))}
                                    </select>
                                  </div>
                                </div>
                            )}

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                              <textarea value={sellForm.notes} onChange={e => setSellForm({ ...sellForm, notes: e.target.value })} className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary" rows="3" placeholder="Optional notes..."></textarea>
                            </div>
                          </div>
                      )}

                      {!loading && selectedType === 'buy' && (
                          <div className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
                                <select
                                    value={buyForm.supplier}
                                    onChange={(e) => setBuyForm({ ...buyForm, supplier: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary"
                                >
                                  <option value="">Select Supplier</option>
                                  {(asArray(data?.suppliers)).map(s => (
                                      <option key={s.id} value={s.id}>{s.name}</option>
                                  ))}
                                </select>
                                {asArray(data?.suppliers).length === 0 && (
                                  <p className="text-xs text-gray-500 mt-2">No suppliers found.</p>
                                )}
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Item / Product</label>
                                <select
                                    value={buyForm.item}
                                    onChange={(e) => {
                                      const selectedItem = (data?.items ?? []).find(i => i.id === Number(e.target.value));
                                      setBuyForm({
                                        ...buyForm,
                                        item: e.target.value,
                                        unit_price: selectedItem ? selectedItem.unit_price.toString() : ''
                                      });
                                    }}
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary"
                                >
                                  <option value="">Select Product</option>
                                  {(asArray(data?.items)).map(item => (
                                      <option key={item.id} value={item.id}>{item.name}</option>
                                  ))}
                                </select>
                                {asArray(data?.items).length === 0 && (
                                  <p className="text-xs text-gray-500 mt-2">No products found.</p>
                                )}
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Quantity</label>
                                <input type="number" value={buyForm.quantity} onChange={e => setBuyForm({ ...buyForm, quantity: e.target.value })} className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary" placeholder="10" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Unit Price</label>
                                <input type="number" step="0.01" value={buyForm.unit_price} onChange={e => setBuyForm({ ...buyForm, unit_price: e.target.value })} className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary" placeholder="99.99" />
                              </div>
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Total Amount</label>
                                <div className="w-full border border-gray-300 rounded-lg p-3 bg-gray-50 font-semibold text-gray-900">
                                  ${((parseFloat(buyForm.quantity) || 0) * (parseFloat(buyForm.unit_price) || 0)).toFixed(2)}
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Warehouse</label>
                                <select value={buyForm.warehouse} onChange={e => setBuyForm({ ...buyForm, warehouse: e.target.value })} className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary">
                                  <option value="">Select Warehouse</option>
                                  {(asArray(data?.warehouses)).map(w => (
                                      <option key={w.id} value={w.id}>{w.name}</option>
                                  ))}
                                </select>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                                <select value={buyForm.status} onChange={e => setBuyForm({ ...buyForm, status: e.target.value, payment_method: '', account: '' })} className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary">
                                  <option value="unpaid">Unpaid</option>
                                  <option value="paid">Paid</option>
                                  <option value="partial">Partial</option>
                                  <option value="overpaid">Overpaid</option>
                                </select>
                              </div>
                            </div>

                            {(buyForm.status === 'paid' || buyForm.status === 'partial') && (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 border-t pt-4">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                                    <select value={buyForm.payment_method} onChange={e => setBuyForm({ ...buyForm, payment_method: e.target.value, account: '' })} className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary">
                                      <option value="">Select Method</option>
                                      <option value="cash">Cash</option>
                                      <option value="bank_transfer">Bank Transfer</option>
                                    </select>
                                  </div>

                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
                                    <select value={buyForm.account} onChange={e => setBuyForm({ ...buyForm, account: e.target.value })} className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary" disabled={!buyForm.payment_method}>
                                      <option value="">Select Account</option>
                                      {(asArray(data?.accounts))
                                          .filter(a => !buyForm.payment_method ||
                                              (buyForm.payment_method === 'cash' && a.account_type === 'cash') ||
                                              (buyForm.payment_method === 'bank_transfer' && a.account_type === 'bank'))
                                          .map(a => (
                                              <option key={a.id} value={a.id}>
                                                {a.name} {a.account_number ? `(${a.account_number})` : ''}
                                              </option>
                                          ))}
                                    </select>
                                  </div>
                                </div>
                            )}

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                              <textarea value={buyForm.notes} onChange={e => setBuyForm({ ...buyForm, notes: e.target.value })} className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary" rows="3" placeholder="Optional notes..."></textarea>
                            </div>
                          </div>
                      )}

                      {!loading && selectedType === 'expense' && (
                          <div className="space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                                <select
                                    value={expenseForm.category}
                                    onChange={(e) => setExpenseForm({ ...expenseForm, category: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary"
                                >
                                  <option value="">Select category</option>
                                  <option value="rent">Rent</option>
                                  <option value="salary">Salary</option>
                                  <option value="marketing">Marketing</option>
                                  <option value="utilities">Utilities</option>
                                  <option value="other">Other</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Amount</label>
                                <input
                                    type="number"
                                    step="0.01"
                                    value={expenseForm.amount}
                                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                                    className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary"
                                    placeholder="450.00"
                                />
                              </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                                <select value={expenseForm.payment_method} onChange={e => setExpenseForm({ ...expenseForm, payment_method: e.target.value, account: '' })} className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary">
                                  <option value="">Select Method</option>
                                  <option value="cash">Cash</option>
                                  <option value="bank_transfer">Bank Transfer</option>
                                </select>
                              </div>

                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Account</label>
                                <select value={expenseForm.account} onChange={e => setExpenseForm({ ...expenseForm, account: e.target.value })} className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary" disabled={!expenseForm.payment_method}>
                                  <option value="">Select Account</option>
                                  {(asArray(data?.accounts))
                                      .filter(a => !expenseForm.payment_method ||
                                          (expenseForm.payment_method === 'cash' && a.account_type === 'cash') ||
                                          (expenseForm.payment_method === 'bank_transfer' && a.account_type === 'bank'))
                                      .map(a => (
                                          <option key={a.id} value={a.id}>
                                            {a.name} {a.account_number ? `(${a.account_number})` : ''}
                                          </option>
                                      ))}
                                </select>
                              </div>
                            </div>

                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                              <textarea
                                  value={expenseForm.description}
                                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                                  className="w-full border border-gray-300 rounded-lg p-3 focus:outline-none focus:border-primary"
                                  rows="3"
                                  placeholder="Monthly office rent..."
                              ></textarea>
                            </div>
                          </div>
                      )}
                    </div>
                  </div>

                  <div className="p-6 border-t border-gray-100 bg-gray-50">
                    <div className="flex justify-end gap-3">
                      <button
                          id="cancel-modal"
                          onClick={() => setIsModalOpen(false)}
                          className="px-6 py-2 !rounded-button whitespace-nowrap border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                          id="submit-form"
                          className={`px-6 py-2 !rounded-button whitespace-nowrap bg-primary text-white hover:bg-primary/90 transition-colors ${
                              !selectedType ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                          disabled={!selectedType}
                          onClick={async () => {
                            try {
                              if (selectedType === 'buy') {
                                const payload = {
                                  supplier: buyForm.supplier ? Number(buyForm.supplier) : null,
                                  item: buyForm.item ? Number(buyForm.item) : null,
                                  quantity: buyForm.quantity ? Number(buyForm.quantity) : null,
                                  unit_price: buyForm.unit_price ? Number(buyForm.unit_price) : null,
                                  notes: buyForm.notes || "",
                                  warehouse: buyForm.warehouse ? Number(buyForm.warehouse) : null,
                                  status: buyForm.status || null,
                                  payment_method: buyForm.payment_method || null,
                                  account: buyForm.account ? Number(buyForm.account) : null
                                };
                                await createPurchase(payload);
                                toastSuccess('Purchase created successfully.');
                                setBuyForm({
                                  supplier: '',
                                  item: '',
                                  quantity: '',
                                  unit_price: '',
                                  warehouse: '',
                                  status: 'unpaid',
                                  payment_method: '',
                                  account: '',
                                  notes: ''
                                });
                              } else if (selectedType === 'sell') {
                                const payload = {
                                  customer: sellForm.customer ? Number(sellForm.customer) : null,
                                  item: sellForm.item ? Number(sellForm.item) : null,
                                  quantity: sellForm.quantity ? Number(sellForm.quantity) : null,
                                  unit_price: sellForm.unit_price ? Number(sellForm.unit_price) : null,
                                  notes: sellForm.notes || "",
                                  warehouse: sellForm.warehouse ? Number(sellForm.warehouse) : null,
                                  status: sellForm.status || null,
                                  payment_method: sellForm.payment_method || null,
                                  account: sellForm.account ? Number(sellForm.account) : null
                                };
                                await createSale(payload);
                                toastSuccess('Sale created successfully.');
                                setSellForm({
                                  customer: '',
                                  item: '',
                                  quantity: '',
                                  unit_price: '',
                                  warehouse: '',
                                  status: 'unpaid',
                                  payment_method: '',
                                  account: '',
                                  notes: ''
                                });
                              } else if (selectedType === 'expense') {
                                const payload = {
                                  category: expenseForm.category || null,
                                  amount: expenseForm.amount ? Number(expenseForm.amount) : null,
                                  notes: expenseForm.description || "",
                                  payment_method: expenseForm.payment_method || null,
                                  account: expenseForm.account ? Number(expenseForm.account) : null
                                };
                                await createExpense(payload);
                                toastSuccess('Expense created successfully.');
                                setExpenseForm({
                                  category: '',
                                  amount: '',
                                  description: '',
                                  payment_method: '',
                                  account: ''
                                });
                              }

                              await fetchAllData();
                            } catch (err) {
                              toastError('Failed to create entry.');
                              console.error(err);
                            }
                          }}
                      >
                        Add Data
                      </button>
                    </div>
                  </div>
                </div>
              </div>

            </div>
          </main>
        </div>
      </div>
  )
}
