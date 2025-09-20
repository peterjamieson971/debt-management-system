'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Plus, Search, FileText, AlertCircle, Calendar, DollarSign, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { Tables } from '@/lib/supabase/database.types'

type CollectionCase = Tables<'collection_cases'> & {
  debtors: Tables<'debtors'> | null
  users: Tables<'users'> | null
}

export default function CasesPage() {
  const [cases, setCases] = useState<CollectionCase[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUser()
    loadCases()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
  }

  const loadCases = async () => {
    try {
      const { data, error } = await supabase
        .from('collection_cases')
        .select(`
          *,
          debtors (*),
          users (*)
        `)
        .order('created_at', { ascending: false })

      if (error) {
        console.error('Error loading cases:', error)
      } else {
        setCases(data || [])
      }
    } catch (error) {
      console.error('Error loading cases:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleNewCase = () => {
    router.push('/cases/new')
  }

  const filteredCases = cases.filter(case_ => {
    const matchesSearch = case_.debtors?.company_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         case_.notes?.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesStatus = statusFilter === 'all' || case_.status === statusFilter
    return matchesSearch && matchesStatus
  })

  const getStatusColor = (status: string | null) => {
    switch (status) {
      case 'active': return 'bg-green-100 text-green-800'
      case 'paused': return 'bg-yellow-100 text-yellow-800'
      case 'resolved': return 'bg-blue-100 text-blue-800'
      case 'escalated': return 'bg-orange-100 text-orange-800'
      case 'legal': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string | null) => {
    switch (priority) {
      case 'low': return 'bg-gray-100 text-gray-800'
      case 'medium': return 'bg-blue-100 text-blue-800'
      case 'high': return 'bg-orange-100 text-orange-800'
      case 'critical': return 'bg-red-100 text-red-800'
      default: return 'bg-gray-100 text-gray-800'
    }
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const getDaysOverdue = (createdAt: string) => {
    const created = new Date(createdAt)
    const now = new Date()
    const diffTime = Math.abs(now.getTime() - created.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    return diffDays
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading collection cases...</p>
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
                Debt Collection System
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <nav className="flex space-x-8">
                <a href="/dashboard" className="text-gray-600 hover:text-gray-800">Dashboard</a>
                <a href="/cases" className="text-blue-600 hover:text-blue-800 font-medium">Cases</a>
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
        {/* Page Header */}
        <div className="flex justify-between items-center mb-8">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Collection Cases</h2>
            <p className="text-gray-600">Manage active debt collection cases</p>
          </div>
          <Button onClick={handleNewCase} className="bg-blue-600 hover:bg-blue-700">
            <Plus className="h-4 w-4 mr-2" />
            New Case
          </Button>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
            <Input
              placeholder="Search by company name or notes..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            <option value="active">Active</option>
            <option value="paused">Paused</option>
            <option value="resolved">Resolved</option>
            <option value="escalated">Escalated</option>
            <option value="legal">Legal</option>
          </select>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <FileText className="h-8 w-8 text-blue-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Cases</p>
                  <p className="text-2xl font-bold text-gray-900">{cases.length}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <AlertCircle className="h-8 w-8 text-green-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Active Cases</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {cases.filter(c => c.status === 'active').length}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <DollarSign className="h-8 w-8 text-orange-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Total Outstanding</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {formatCurrency(cases.reduce((sum, c) => sum + c.outstanding_amount, 0))}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="p-6">
              <div className="flex items-center">
                <Calendar className="h-8 w-8 text-purple-600" />
                <div className="ml-4">
                  <p className="text-sm font-medium text-gray-600">Avg Days Open</p>
                  <p className="text-2xl font-bold text-gray-900">
                    {Math.round(cases.reduce((sum, c) => sum + getDaysOverdue(c.created_at!), 0) / cases.length) || 0}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Cases List */}
        <div className="space-y-4">
          {filteredCases.map((case_) => (
            <Card key={case_.id} className="hover:shadow-lg transition-shadow cursor-pointer">
              <CardContent className="p-6">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="flex items-center justify-between mb-2">
                      <h3 className="text-lg font-semibold text-gray-900">
                        {case_.debtors?.company_name}
                      </h3>
                      <div className="flex items-center space-x-2">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(case_.status)}`}>
                          {case_.status}
                        </span>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(case_.priority)}`}>
                          {case_.priority} priority
                        </span>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 text-sm text-gray-600">
                      <div>
                        <div className="flex items-center">
                          <DollarSign className="h-4 w-4 mr-1" />
                          <span className="font-medium">Outstanding:</span>
                        </div>
                        <div className="text-lg font-semibold text-gray-900">
                          {formatCurrency(case_.outstanding_amount)}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center">
                          <Calendar className="h-4 w-4 mr-1" />
                          <span className="font-medium">Created:</span>
                        </div>
                        <div className="text-gray-900">
                          {formatDate(case_.created_at!)} ({getDaysOverdue(case_.created_at!)} days ago)
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center">
                          <User className="h-4 w-4 mr-1" />
                          <span className="font-medium">Assigned to:</span>
                        </div>
                        <div className="text-gray-900">
                          {case_.users?.full_name || 'Unassigned'}
                        </div>
                      </div>

                      <div>
                        <div className="flex items-center">
                          <FileText className="h-4 w-4 mr-1" />
                          <span className="font-medium">Stage:</span>
                        </div>
                        <div className="text-gray-900">
                          Stage {case_.current_stage} of workflow
                        </div>
                      </div>
                    </div>

                    {case_.next_action_date && (
                      <div className="mt-3 p-3 bg-yellow-50 rounded-lg">
                        <div className="flex items-center text-yellow-800">
                          <AlertCircle className="h-4 w-4 mr-2" />
                          <span className="font-medium">Next Action:</span>
                          <span className="ml-2">{formatDate(case_.next_action_date)}</span>
                        </div>
                      </div>
                    )}

                    {case_.notes && (
                      <div className="mt-3 text-sm text-gray-600">
                        <span className="font-medium">Notes:</span> {case_.notes}
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredCases.length === 0 && (
          <div className="text-center py-12">
            <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No cases found</h3>
            <p className="text-gray-600 mb-4">
              {searchTerm || statusFilter !== 'all'
                ? 'Try adjusting your search terms or filters'
                : 'Get started by creating your first collection case'}
            </p>
            <Button onClick={handleNewCase} className="bg-blue-600 hover:bg-blue-700">
              <Plus className="h-4 w-4 mr-2" />
              New Case
            </Button>
          </div>
        )}
      </main>
    </div>
  )
}