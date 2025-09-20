'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, FileText, Building2, DollarSign, Calendar, Save, LogOut, User } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { Tables } from '@/lib/supabase/database.types'

type Debtor = Tables<'debtors'>

export default function NewCasePage() {
  const [user, setUser] = useState<any>(null)
  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingDebtors, setLoadingDebtors] = useState(true)
  const [formData, setFormData] = useState({
    debtor_id: '',
    outstanding_amount: '',
    original_amount: '',
    due_date: '',
    invoice_number: '',
    description: '',
    status: 'active',
    priority: 'medium',
    workflow_id: 1,
    current_stage: 1,
    assigned_to: '',
    next_action_date: '',
    notes: ''
  })

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUser()
    loadDebtors()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUser(user)
  }

  const loadDebtors = async () => {
    try {
      const { data, error } = await supabase
        .from('debtors')
        .select('*')
        .order('company_name')

      if (error) {
        console.error('Error loading debtors:', error)
      } else {
        setDebtors(data || [])
      }
    } catch (error) {
      console.error('Error loading debtors:', error)
    } finally {
      setLoadingDebtors(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setFormData(prev => ({
      ...prev,
      [name]: value
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      // Convert numeric fields
      const caseData = {
        ...formData,
        debtor_id: parseInt(formData.debtor_id),
        outstanding_amount: parseFloat(formData.outstanding_amount),
        original_amount: formData.original_amount ? parseFloat(formData.original_amount) : parseFloat(formData.outstanding_amount),
        workflow_id: parseInt(formData.workflow_id.toString()),
        current_stage: parseInt(formData.current_stage.toString()),
        assigned_to: formData.assigned_to || null,
        due_date: formData.due_date || null,
        next_action_date: formData.next_action_date || null
      }

      const { data, error } = await supabase
        .from('collection_cases')
        .insert([caseData])
        .select()

      if (error) {
        console.error('Error creating case:', error)
        alert('Error creating case. Please try again.')
      } else {
        alert('Collection case created successfully!')
        router.push('/cases')
      }
    } catch (error) {
      console.error('Error creating case:', error)
      alert('Error creating case. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    router.push('/cases')
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
              {user && (
                <div className="flex items-center space-x-3">
                  <div className="text-right">
                    <div className="text-sm font-medium text-gray-900">{user.email}</div>
                    <div className="text-xs text-gray-500">User</div>
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
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
        <nav className="flex" aria-label="Breadcrumb">
          <ol className="flex items-center space-x-4">
            <li>
              <div>
                <a href="/dashboard" className="text-gray-400 hover:text-gray-500">
                  Dashboard
                </a>
              </div>
            </li>
            <li>
              <div className="flex items-center">
                <svg className="flex-shrink-0 h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <a href="/cases" className="ml-4 text-gray-400 hover:text-gray-500">
                  Cases
                </a>
              </div>
            </li>
            <li>
              <div className="flex items-center">
                <svg className="flex-shrink-0 h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <span className="ml-4 text-gray-500">New Case</span>
              </div>
            </li>
          </ol>
        </nav>
      </div>

      {/* Main Content */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Button
              onClick={handleCancel}
              variant="outline"
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Cases
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Create New Collection Case</h2>
              <p className="text-gray-600">Start a new debt collection process</p>
            </div>
          </div>
        </div>

        {loadingDebtors ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading debtors...</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-8">
            {/* Case Details */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <FileText className="h-5 w-5 mr-2" />
                  Case Details
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Debtor *
                    </label>
                    <select
                      name="debtor_id"
                      value={formData.debtor_id}
                      onChange={handleInputChange}
                      required
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="">Select a debtor</option>
                      {debtors.map((debtor) => (
                        <option key={debtor.id} value={debtor.id}>
                          {debtor.company_name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Invoice Number
                    </label>
                    <Input
                      name="invoice_number"
                      value={formData.invoice_number}
                      onChange={handleInputChange}
                      placeholder="Enter invoice number"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Outstanding Amount (AED) *
                    </label>
                    <Input
                      name="outstanding_amount"
                      type="number"
                      step="0.01"
                      value={formData.outstanding_amount}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter outstanding amount"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Original Amount (AED)
                    </label>
                    <Input
                      name="original_amount"
                      type="number"
                      step="0.01"
                      value={formData.original_amount}
                      onChange={handleInputChange}
                      placeholder="Enter original amount (if different)"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Due Date
                    </label>
                    <Input
                      name="due_date"
                      type="date"
                      value={formData.due_date}
                      onChange={handleInputChange}
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Next Action Date
                    </label>
                    <Input
                      name="next_action_date"
                      type="date"
                      value={formData.next_action_date}
                      onChange={handleInputChange}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Description
                  </label>
                  <textarea
                    name="description"
                    value={formData.description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter case description or details about the debt"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Case Settings */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center">
                  <User className="h-5 w-5 mr-2" />
                  Case Settings
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Status
                    </label>
                    <select
                      name="status"
                      value={formData.status}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="active">Active</option>
                      <option value="paused">Paused</option>
                      <option value="escalated">Escalated</option>
                      <option value="legal">Legal</option>
                      <option value="resolved">Resolved</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Priority
                    </label>
                    <select
                      name="priority"
                      value={formData.priority}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="critical">Critical</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Current Stage
                    </label>
                    <select
                      name="current_stage"
                      value={formData.current_stage}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="1">Stage 1 - Initial Contact</option>
                      <option value="2">Stage 2 - Follow-up</option>
                      <option value="3">Stage 3 - Negotiation</option>
                      <option value="4">Stage 4 - Legal Notice</option>
                      <option value="5">Stage 5 - Legal Action</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Assigned To
                  </label>
                  <Input
                    name="assigned_to"
                    value={formData.assigned_to}
                    onChange={handleInputChange}
                    placeholder="Enter collector name or ID (optional)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Notes
                  </label>
                  <textarea
                    name="notes"
                    value={formData.notes}
                    onChange={handleInputChange}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Enter any additional notes or special instructions for this case"
                  />
                </div>
              </CardContent>
            </Card>

            {/* Form Actions */}
            <div className="flex items-center justify-end space-x-4">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={loading}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {loading ? (
                  <div className="flex items-center">
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Creating...
                  </div>
                ) : (
                  <div className="flex items-center">
                    <Save className="h-4 w-4 mr-2" />
                    Create Case
                  </div>
                )}
              </Button>
            </div>
          </form>
        )}
      </main>
    </div>
  )
}