'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DollarSign, Users, TrendingUp, AlertCircle, LogOut } from 'lucide-react'
import type { Tables } from '@/lib/supabase/database.types'

type Organization = Tables<'organizations'>
type CollectionCase = Tables<'collection_cases'>
type Debtor = Tables<'debtors'>

export default function DashboardPage() {
  const [user, setUser] = useState<any>(null)
  const [organization, setOrganization] = useState<Organization | null>(null)
  const [stats, setStats] = useState({
    totalOutstanding: 0,
    activeCases: 0,
    collectionRate: 0,
    avgDaysToPay: 0
  })
  const [loading, setLoading] = useState(true)
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUser()
    loadDashboardData()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUser(user)
  }

  const loadDashboardData = async () => {
    try {
      // Load organization data
      const { data: orgData } = await supabase
        .from('organizations')
        .select('*')
        .single()

      if (orgData) {
        setOrganization(orgData)
      }

      // Load collection cases for stats
      const { data: casesData } = await supabase
        .from('collection_cases')
        .select(`
          *,
          debtors (*)
        `)

      if (casesData) {
        const totalOutstanding = casesData.reduce((sum, case_) => sum + case_.outstanding_amount, 0)
        const activeCases = casesData.filter(case_ => case_.status === 'active').length

        setStats({
          totalOutstanding,
          activeCases,
          collectionRate: 78, // Mock data for now
          avgDaysToPay: 42 // Mock data for now
        })
      }
    } catch (error) {
      console.error('Error loading dashboard data:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading dashboard...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                {organization?.name || 'Debt Collection System'}
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <nav className="flex space-x-8">
                <a href="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium">Dashboard</a>
                <a href="/cases" className="text-gray-600 hover:text-gray-800">Cases</a>
                <a href="/debtors" className="text-gray-600 hover:text-gray-800">Debtors</a>
                <a href="/analytics" className="text-gray-600 hover:text-gray-800">Analytics</a>
              </nav>
              <button
                onClick={handleLogout}
                className="flex items-center text-gray-600 hover:text-gray-800"
              >
                <LogOut className="h-4 w-4 mr-1" />
                Logout
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Welcome Section */}
        <div className="mb-8">
          <h2 className="text-2xl font-bold text-gray-900 mb-2">
            Welcome back!
          </h2>
          <p className="text-gray-600">
            Here's what's happening with your collections today
          </p>
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <DollarSign className="h-8 w-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Outstanding Amount</p>
                <p className="text-2xl font-semibold text-gray-900">
                  AED {stats.totalOutstanding.toLocaleString()}
                </p>
                <p className="text-sm text-green-600">Live data</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="h-8 w-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Collection Rate</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.collectionRate}%</p>
                <p className="text-sm text-green-600">↗ 5% from last month</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Users className="h-8 w-8 text-purple-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Cases</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.activeCases}</p>
                <p className="text-sm text-blue-600">Real-time count</p>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <AlertCircle className="h-8 w-8 text-orange-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Days to Pay</p>
                <p className="text-2xl font-semibold text-gray-900">{stats.avgDaysToPay} days</p>
                <p className="text-sm text-green-600">↘ 3 days improvement</p>
              </div>
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
            <div className="space-y-3">
              <button className="w-full text-left p-3 bg-blue-50 hover:bg-blue-100 rounded-lg transition-colors">
                <div className="font-medium text-blue-900">Create New Case</div>
                <div className="text-sm text-blue-700">Start a new collection case</div>
              </button>
              <button className="w-full text-left p-3 bg-green-50 hover:bg-green-100 rounded-lg transition-colors">
                <div className="font-medium text-green-900">Add Debtor</div>
                <div className="text-sm text-green-700">Register a new company</div>
              </button>
              <button className="w-full text-left p-3 bg-purple-50 hover:bg-purple-100 rounded-lg transition-colors">
                <div className="font-medium text-purple-900">Generate AI Email</div>
                <div className="text-sm text-purple-700">Create personalized collection email</div>
              </button>
            </div>
          </div>

          <div className="bg-white rounded-lg shadow p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">AI Insights</h3>
            <div className="space-y-4">
              <div className="p-4 bg-blue-50 rounded-lg">
                <p className="font-medium text-blue-900">Payment Prediction</p>
                <p className="text-sm text-blue-700">Dubai Tech Solutions has 85% likelihood to pay within 7 days</p>
              </div>
              <div className="p-4 bg-yellow-50 rounded-lg">
                <p className="font-medium text-yellow-900">Strategy Recommendation</p>
                <p className="text-sm text-yellow-700">Consider payment plan for Riyadh Engineering Corp (3 months)</p>
              </div>
              <div className="p-4 bg-green-50 rounded-lg">
                <p className="font-medium text-green-900">Best Time to Contact</p>
                <p className="text-sm text-green-700">UAE clients respond best on Sunday-Thursday, 10 AM - 2 PM</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}