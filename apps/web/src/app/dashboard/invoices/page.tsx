'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Plus,
  Search,
  Filter,
  Download,
  Eye,
  Edit,
  Trash2,
  DollarSign,
  Calendar,
  Building,
  AlertTriangle,
  CheckCircle,
  Clock,
  MoreHorizontal,
  LogOut
} from 'lucide-react'

interface Invoice {
  id: string
  invoice_number: string
  debtor_id: string
  debtor_name: string
  debtor_company: string
  amount: number
  currency: string
  issue_date: string
  due_date: string
  status: 'draft' | 'sent' | 'overdue' | 'paid' | 'partially_paid' | 'cancelled'
  description: string
  payment_terms: string
  created_at: string
  updated_at: string
}

export default function InvoicesPage() {
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [dateFilter, setDateFilter] = useState<string>('all')
  const [user, setUser] = useState<any>(null)
  const router = useRouter()
  const supabase = createClient()

  // Mock organization ID - in production, get from auth context
  const organizationId = '550e8400-e29b-41d4-a716-446655440000'

  useEffect(() => {
    checkUser()
    fetchInvoices()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }

    // Get user details from the users table
    const { data: userData } = await supabase
      .from('users')
      .select('*')
      .eq('id', user.id)
      .single()

    setUser(userData || { email: user.email, full_name: 'User', role: 'viewer' })
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const fetchInvoices = async () => {
    try {
      setLoading(true)

      const response = await fetch(`/api/invoices?organization_id=${organizationId}`, {
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setInvoices(data.invoices)
      } else {
        // Mock data for demonstration
        setInvoices([
          {
            id: '1',
            invoice_number: 'INV-2024-001',
            debtor_id: 'debtor-1',
            debtor_name: 'Ahmed Al-Rashid',
            debtor_company: 'Al-Rashid Trading LLC',
            amount: 15000,
            currency: 'AED',
            issue_date: '2024-01-15',
            due_date: '2024-02-14',
            status: 'overdue',
            description: 'Professional services - Q4 2023',
            payment_terms: 'Net 30',
            created_at: '2024-01-15T10:00:00Z',
            updated_at: '2024-01-15T10:00:00Z'
          },
          {
            id: '2',
            invoice_number: 'INV-2024-002',
            debtor_id: 'debtor-2',
            debtor_name: 'Sarah Johnson',
            debtor_company: 'Johnson Consulting',
            amount: 8500,
            currency: 'AED',
            issue_date: '2024-01-20',
            due_date: '2024-02-19',
            status: 'sent',
            description: 'Software development services',
            payment_terms: 'Net 30',
            created_at: '2024-01-20T09:30:00Z',
            updated_at: '2024-01-20T09:30:00Z'
          },
          {
            id: '3',
            invoice_number: 'INV-2024-003',
            debtor_id: 'debtor-3',
            debtor_name: 'Mohammed Hassan',
            debtor_company: 'Hassan Industries',
            amount: 25000,
            currency: 'AED',
            issue_date: '2024-01-25',
            due_date: '2024-02-24',
            status: 'paid',
            description: 'Equipment rental - January 2024',
            payment_terms: 'Net 30',
            created_at: '2024-01-25T14:15:00Z',
            updated_at: '2024-02-20T11:45:00Z'
          },
          {
            id: '4',
            invoice_number: 'INV-2024-004',
            debtor_id: 'debtor-4',
            debtor_name: 'Fatima Al-Zahra',
            debtor_company: 'Al-Zahra Enterprises',
            amount: 12000,
            currency: 'AED',
            issue_date: '2024-02-01',
            due_date: '2024-03-02',
            status: 'partially_paid',
            description: 'Marketing campaign - February 2024',
            payment_terms: 'Net 30',
            created_at: '2024-02-01T16:20:00Z',
            updated_at: '2024-02-15T13:30:00Z'
          },
          {
            id: '5',
            invoice_number: 'INV-2024-005',
            debtor_id: 'debtor-5',
            debtor_name: 'Omar Abdullah',
            debtor_company: 'Abdullah Tech Solutions',
            amount: 18500,
            currency: 'AED',
            issue_date: '2024-02-10',
            due_date: '2024-03-11',
            status: 'draft',
            description: 'IT infrastructure setup',
            payment_terms: 'Net 30',
            created_at: '2024-02-10T08:45:00Z',
            updated_at: '2024-02-10T08:45:00Z'
          }
        ])
      }
    } catch (error) {
      console.error('Failed to fetch invoices:', error)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'paid':
        return 'bg-green-100 text-green-800'
      case 'partially_paid':
        return 'bg-yellow-100 text-yellow-800'
      case 'sent':
        return 'bg-blue-100 text-blue-800'
      case 'overdue':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      case 'draft':
        return 'bg-gray-100 text-gray-600'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'paid':
        return <CheckCircle className="h-4 w-4" />
      case 'partially_paid':
        return <Clock className="h-4 w-4" />
      case 'overdue':
        return <AlertTriangle className="h-4 w-4" />
      default:
        return null
    }
  }

  const formatCurrency = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency
    }).format(amount)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    })
  }

  const isOverdue = (dueDate: string, status: string) => {
    return status !== 'paid' && new Date(dueDate) < new Date()
  }

  const filteredInvoices = invoices.filter(invoice => {
    const matchesSearch = invoice.invoice_number.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.debtor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         invoice.debtor_company.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || invoice.status === statusFilter

    let matchesDate = true
    if (dateFilter === 'overdue') {
      matchesDate = isOverdue(invoice.due_date, invoice.status)
    } else if (dateFilter === 'this_month') {
      const now = new Date()
      const invoiceDate = new Date(invoice.issue_date)
      matchesDate = invoiceDate.getMonth() === now.getMonth() && invoiceDate.getFullYear() === now.getFullYear()
    }

    return matchesSearch && matchesStatus && matchesDate
  })

  const totalAmount = filteredInvoices.reduce((sum, invoice) => sum + invoice.amount, 0)
  const overdueAmount = filteredInvoices
    .filter(invoice => isOverdue(invoice.due_date, invoice.status))
    .reduce((sum, invoice) => sum + invoice.amount, 0)

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
          <p className="mt-2 text-gray-600">Loading invoices...</p>
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
                <a href="/cases" className="text-gray-600 hover:text-gray-800">Cases</a>
                <a href="/debtors" className="text-gray-600 hover:text-gray-800">Debtors</a>
                <a href="/analytics" className="text-gray-600 hover:text-gray-800">Analytics</a>
              </nav>
              {user && (
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{user.full_name}</div>
                    <div className="text-xs text-gray-500 capitalize">{user.role}</div>
                  </div>
                  <button
                    onClick={handleLogout}
                    className="flex items-center text-gray-600 hover:text-gray-800"
                  >
                    <LogOut className="h-4 w-4 mr-1" />
                    Logout
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Breadcrumbs */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-2 py-3 text-sm">
            <a href="/dashboard" className="text-gray-500 hover:text-gray-700">Dashboard</a>
            <span className="text-gray-400">/</span>
            <span className="text-gray-900 font-medium">Invoices</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Invoices</h1>
          <p className="text-gray-600">Manage and track your invoices and payments</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export
          </Button>
          <Link href="/dashboard/invoices/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Invoice
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <Card className="p-6">
          <div className="flex items-center">
            <DollarSign className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Value</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(totalAmount, 'AED')}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <AlertTriangle className="h-8 w-8 text-red-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Overdue</p>
              <p className="text-2xl font-bold text-gray-900">
                {formatCurrency(overdueAmount, 'AED')}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">This Month</p>
              <p className="text-2xl font-bold text-gray-900">
                {filteredInvoices.filter(inv => {
                  const now = new Date()
                  const invDate = new Date(inv.issue_date)
                  return invDate.getMonth() === now.getMonth() && invDate.getFullYear() === now.getFullYear()
                }).length}
              </p>
            </div>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center">
            <Building className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Invoices</p>
              <p className="text-2xl font-bold text-gray-900">{filteredInvoices.length}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4">
          <div className="flex-1">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search invoices..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>
          <div className="flex space-x-3">
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">All Status</option>
              <option value="draft">Draft</option>
              <option value="sent">Sent</option>
              <option value="paid">Paid</option>
              <option value="partially_paid">Partially Paid</option>
              <option value="overdue">Overdue</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="all">All Time</option>
              <option value="this_month">This Month</option>
              <option value="overdue">Overdue</option>
            </select>
          </div>
        </div>
      </Card>

      {/* Invoices Table */}
      <Card>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Invoice
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Debtor
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Date
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredInvoices.map((invoice) => (
                <tr key={invoice.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {invoice.invoice_number}
                      </div>
                      <div className="text-sm text-gray-500">
                        {formatDate(invoice.issue_date)}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div>
                      <div className="text-sm font-medium text-gray-900">
                        {invoice.debtor_name}
                      </div>
                      <div className="text-sm text-gray-500">
                        {invoice.debtor_company}
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm font-medium text-gray-900">
                      {formatCurrency(invoice.amount, invoice.currency)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className={`text-sm ${
                      isOverdue(invoice.due_date, invoice.status)
                        ? 'text-red-600 font-medium'
                        : 'text-gray-900'
                    }`}>
                      {formatDate(invoice.due_date)}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(invoice.status)}`}>
                      {getStatusIcon(invoice.status)}
                      <span className="ml-1 capitalize">{invoice.status.replace('_', ' ')}</span>
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                    <div className="flex justify-end space-x-2">
                      <Link href={`/dashboard/invoices/${invoice.id}`}>
                        <Button variant="outline" size="sm">
                          <Eye className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Link href={`/dashboard/invoices/${invoice.id}/edit`}>
                        <Button variant="outline" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          if (confirm('Are you sure you want to delete this invoice?')) {
                            // Handle delete
                          }
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredInvoices.length === 0 && (
          <div className="text-center py-12">
            <DollarSign className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No invoices found</h3>
            <p className="text-gray-500 mb-4">
              {searchTerm || statusFilter !== 'all' || dateFilter !== 'all'
                ? 'Try adjusting your search or filter criteria.'
                : 'Get started by creating your first invoice.'
              }
            </p>
            {!searchTerm && statusFilter === 'all' && dateFilter === 'all' && (
              <Link href="/dashboard/invoices/new">
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Create Your First Invoice
                </Button>
              </Link>
            )}
          </div>
        )}
      </Card>
    </div>
      </main>
    </div>
  )
}