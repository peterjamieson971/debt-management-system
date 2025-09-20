'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ApiError, useErrorHandler } from '@/components/ui/ErrorBoundary'
import { PageLoading } from '@/components/ui/LoadingStates'
import {
  Workflow,
  Play,
  Pause,
  StopCircle,
  Clock,
  CheckCircle,
  AlertTriangle,
  ArrowRight,
  Plus,
  Edit,
  Trash2,
  Settings,
  Eye,
  Calendar,
  Filter,
  Search,
  BarChart3,
  Users,
  FileText,
  Mail,
  Phone,
  MessageSquare,
  DollarSign,
  Target,
  TrendingUp,
  RefreshCw,
  MoreHorizontal
} from 'lucide-react'

interface WorkflowTemplate {
  id: string
  name: string
  description: string
  category: 'collection' | 'negotiation' | 'legal' | 'payment-plan'
  total_steps: number
  estimated_duration_days: number
  success_rate: number
  active_cases: number
  is_active: boolean
  created_at: string
  updated_at: string
}

interface WorkflowStep {
  id: string
  workflow_id: string
  step_number: number
  name: string
  description: string
  type: 'email' | 'call' | 'letter' | 'legal-action' | 'payment-request' | 'waiting' | 'decision'
  auto_execute: boolean
  delay_days: number
  conditions: string[]
  success_criteria: string[]
  ai_generated_content: boolean
}

interface ActiveWorkflow {
  id: string
  template_id: string
  template_name: string
  case_id: string
  case_reference: string
  debtor_name: string
  debtor_email: string
  current_step: number
  total_steps: number
  status: 'running' | 'paused' | 'completed' | 'failed' | 'cancelled'
  started_at: string
  last_activity: string
  next_action_due: string
  assigned_collector: string
  progress_percentage: number
  estimated_completion: string
}

interface WorkflowStats {
  total_active: number
  completed_today: number
  overdue_actions: number
  success_rate: number
  avg_completion_days: number
  total_revenue_collected: number
}

export default function WorkflowsPage() {
  const [templates, setTemplates] = useState<WorkflowTemplate[]>([])
  const [activeWorkflows, setActiveWorkflows] = useState<ActiveWorkflow[]>([])
  const [selectedTemplate, setSelectedTemplate] = useState<WorkflowTemplate | null>(null)
  const [templateSteps, setTemplateSteps] = useState<WorkflowStep[]>([])
  const [stats, setStats] = useState<WorkflowStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'templates' | 'active' | 'analytics'>('active')
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const { error, resetError, handleError } = useErrorHandler()

  // Mock organization ID - in production, get from auth context
  const organizationId = '550e8400-e29b-41d4-a716-446655440000'

  useEffect(() => {
    fetchWorkflowData()
  }, [])

  useEffect(() => {
    if (selectedTemplate) {
      fetchTemplateSteps(selectedTemplate.id)
    }
  }, [selectedTemplate])

  const fetchWorkflowData = async () => {
    try {
      setLoading(true)
      resetError()

      const response = await fetch(`/api/workflows?organization_id=${organizationId}`, {
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates)
        setActiveWorkflows(data.active_workflows)
        setStats(data.stats)
      } else if (response.status === 500 || response.status === 404) {
        console.warn('Workflows API endpoint not available, using mock data')

        // Mock workflow templates
        setTemplates([
          {
            id: 'wf-001',
            name: 'Standard Collection Process',
            description: 'Standard 5-step collection process for unpaid invoices',
            category: 'collection',
            total_steps: 5,
            estimated_duration_days: 45,
            success_rate: 78.5,
            active_cases: 23,
            is_active: true,
            created_at: '2024-08-15T10:00:00Z',
            updated_at: '2024-09-10T14:30:00Z'
          },
          {
            id: 'wf-002',
            name: 'Payment Plan Negotiation',
            description: 'Structured approach to negotiating payment plans with cooperative debtors',
            category: 'negotiation',
            total_steps: 4,
            estimated_duration_days: 21,
            success_rate: 85.2,
            active_cases: 12,
            is_active: true,
            created_at: '2024-08-20T09:15:00Z',
            updated_at: '2024-09-05T11:20:00Z'
          },
          {
            id: 'wf-003',
            name: 'Legal Action Escalation',
            description: 'Escalation process for cases requiring legal intervention',
            category: 'legal',
            total_steps: 7,
            estimated_duration_days: 90,
            success_rate: 65.8,
            active_cases: 8,
            is_active: true,
            created_at: '2024-07-10T13:45:00Z',
            updated_at: '2024-09-01T16:00:00Z'
          },
          {
            id: 'wf-004',
            name: 'Express Settlement',
            description: 'Fast-track workflow for small amounts and cooperative debtors',
            category: 'collection',
            total_steps: 3,
            estimated_duration_days: 14,
            success_rate: 92.1,
            active_cases: 35,
            is_active: true,
            created_at: '2024-09-01T08:30:00Z',
            updated_at: '2024-09-18T10:15:00Z'
          }
        ])

        // Mock active workflows
        setActiveWorkflows([
          {
            id: 'aw-001',
            template_id: 'wf-001',
            template_name: 'Standard Collection Process',
            case_id: 'case-001',
            case_reference: 'TC-2024-001',
            debtor_name: 'Ahmed Al-Mansouri',
            debtor_email: 'ahmed.mansouri@techcorp.ae',
            current_step: 3,
            total_steps: 5,
            status: 'running',
            started_at: '2024-09-15T09:00:00Z',
            last_activity: '2024-09-20T10:30:00Z',
            next_action_due: '2024-09-22T09:00:00Z',
            assigned_collector: 'Sarah Johnson',
            progress_percentage: 60,
            estimated_completion: '2024-10-30T17:00:00Z'
          },
          {
            id: 'aw-002',
            template_id: 'wf-002',
            template_name: 'Payment Plan Negotiation',
            case_id: 'case-003',
            case_reference: 'CP-2024-003',
            debtor_name: 'Robert Wilson',
            debtor_email: 'r.wilson@constructionplus.co.uk',
            current_step: 2,
            total_steps: 4,
            status: 'running',
            started_at: '2024-09-16T08:30:00Z',
            last_activity: '2024-09-18T11:15:00Z',
            next_action_due: '2024-09-21T14:00:00Z',
            assigned_collector: 'Sarah Johnson',
            progress_percentage: 50,
            estimated_completion: '2024-10-07T17:00:00Z'
          },
          {
            id: 'aw-003',
            template_id: 'wf-003',
            template_name: 'Legal Action Escalation',
            case_id: 'case-002',
            case_reference: 'GT-2024-002',
            debtor_name: 'Maria Santos',
            debtor_email: 'maria.santos@globaltrading.com',
            current_step: 5,
            total_steps: 7,
            status: 'paused',
            started_at: '2024-09-10T14:20:00Z',
            last_activity: '2024-09-19T16:45:00Z',
            next_action_due: '2024-09-25T10:00:00Z',
            assigned_collector: 'Ahmed Al-Rashid',
            progress_percentage: 71,
            estimated_completion: '2024-12-08T17:00:00Z'
          },
          {
            id: 'aw-004',
            template_id: 'wf-004',
            template_name: 'Express Settlement',
            case_id: 'case-005',
            case_reference: 'RG-2024-005',
            debtor_name: 'John Mitchell',
            debtor_email: 'j.mitchell@retailgroup.com',
            current_step: 3,
            total_steps: 3,
            status: 'completed',
            started_at: '2024-09-08T15:10:00Z',
            last_activity: '2024-09-12T09:45:00Z',
            next_action_due: '',
            assigned_collector: 'Ahmed Al-Rashid',
            progress_percentage: 100,
            estimated_completion: '2024-09-12T09:45:00Z'
          }
        ])

        // Mock workflow stats
        setStats({
          total_active: 43,
          completed_today: 5,
          overdue_actions: 8,
          success_rate: 79.3,
          avg_completion_days: 32,
          total_revenue_collected: 2847500
        })
      } else {
        const errorText = await response.text()
        throw new Error(`Failed to load workflow data: ${response.status} ${errorText}`)
      }
    } catch (error) {
      console.error('Failed to fetch workflow data:', error)
      if (error instanceof Error) {
        handleError(error)
      } else {
        handleError(new Error('An unexpected error occurred while loading workflows'))
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchTemplateSteps = async (templateId: string) => {
    try {
      const response = await fetch(`/api/workflows/templates/${templateId}/steps`, {
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setTemplateSteps(data.steps)
      } else if (response.status === 500 || response.status === 404) {
        console.warn('Template steps API endpoint not available, using mock data')

        // Mock template steps
        setTemplateSteps([
          {
            id: 'step-001',
            workflow_id: templateId,
            step_number: 1,
            name: 'Initial Payment Reminder',
            description: 'Send friendly reminder email about overdue invoice',
            type: 'email',
            auto_execute: true,
            delay_days: 0,
            conditions: ['Invoice overdue > 7 days'],
            success_criteria: ['Payment received', 'Response received'],
            ai_generated_content: true
          },
          {
            id: 'step-002',
            workflow_id: templateId,
            step_number: 2,
            name: 'Follow-up Call',
            description: 'Phone call to discuss payment and understand any issues',
            type: 'call',
            auto_execute: false,
            delay_days: 7,
            conditions: ['No response to initial reminder'],
            success_criteria: ['Payment commitment received', 'Payment plan agreed'],
            ai_generated_content: false
          },
          {
            id: 'step-003',
            workflow_id: templateId,
            step_number: 3,
            name: 'Formal Demand Letter',
            description: 'Send formal demand letter with legal implications',
            type: 'letter',
            auto_execute: true,
            delay_days: 14,
            conditions: ['No payment or commitment received'],
            success_criteria: ['Payment received', 'Payment plan established'],
            ai_generated_content: true
          },
          {
            id: 'step-004',
            workflow_id: templateId,
            step_number: 4,
            name: 'Final Notice',
            description: 'Final notice before legal action',
            type: 'email',
            auto_execute: true,
            delay_days: 21,
            conditions: ['No response to demand letter'],
            success_criteria: ['Payment received', 'Contact established'],
            ai_generated_content: true
          },
          {
            id: 'step-005',
            workflow_id: templateId,
            step_number: 5,
            name: 'Legal Action Initiation',
            description: 'Begin legal proceedings for debt recovery',
            type: 'legal-action',
            auto_execute: false,
            delay_days: 35,
            conditions: ['All previous steps failed'],
            success_criteria: ['Case referred to legal team'],
            ai_generated_content: false
          }
        ])
      }
    } catch (error) {
      console.error('Failed to fetch template steps:', error)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'running':
        return 'bg-green-100 text-green-800'
      case 'paused':
        return 'bg-yellow-100 text-yellow-800'
      case 'completed':
        return 'bg-blue-100 text-blue-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'cancelled':
        return 'bg-gray-100 text-gray-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'running':
        return <Play className="h-4 w-4 text-green-600" />
      case 'paused':
        return <Pause className="h-4 w-4 text-yellow-600" />
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-blue-600" />
      case 'failed':
        return <AlertTriangle className="h-4 w-4 text-red-600" />
      case 'cancelled':
        return <StopCircle className="h-4 w-4 text-gray-600" />
      default:
        return null
    }
  }

  const getStepTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'call':
        return <Phone className="h-4 w-4" />
      case 'letter':
        return <FileText className="h-4 w-4" />
      case 'legal-action':
        return <AlertTriangle className="h-4 w-4" />
      case 'payment-request':
        return <DollarSign className="h-4 w-4" />
      case 'waiting':
        return <Clock className="h-4 w-4" />
      case 'decision':
        return <Target className="h-4 w-4" />
      default:
        return <MessageSquare className="h-4 w-4" />
    }
  }

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'collection':
        return 'bg-blue-100 text-blue-800'
      case 'negotiation':
        return 'bg-green-100 text-green-800'
      case 'legal':
        return 'bg-red-100 text-red-800'
      case 'payment-plan':
        return 'bg-purple-100 text-purple-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A'
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-AE', {
      style: 'currency',
      currency: 'AED'
    }).format(amount)
  }

  const filteredActiveWorkflows = activeWorkflows.filter(workflow => {
    const matchesSearch =
      workflow.debtor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workflow.case_reference.toLowerCase().includes(searchTerm.toLowerCase()) ||
      workflow.template_name.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || workflow.status === statusFilter

    return matchesSearch && matchesStatus
  })

  const filteredTemplates = templates.filter(template => {
    const matchesSearch =
      template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      template.description.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesCategory = categoryFilter === 'all' || template.category === categoryFilter

    return matchesSearch && matchesCategory
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <PageLoading
          title="Loading Workflows"
          description="Please wait while we fetch workflow data and analytics..."
        />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Workflow Management</h1>
          <p className="text-gray-600">Automate and track debt collection processes</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline" onClick={fetchWorkflowData}>
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Create Workflow
          </Button>
        </div>
      </div>

      <ApiError
        error={error}
        onRetry={fetchWorkflowData}
        onDismiss={resetError}
        title="Workflow Management Error"
      />

      {/* Workflow Statistics */}
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-6 gap-6">
          <Card className="p-6">
            <div className="flex items-center">
              <Workflow className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Active Workflows</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total_active}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Completed Today</p>
                <p className="text-2xl font-bold text-gray-900">{stats.completed_today}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Overdue Actions</p>
                <p className="text-2xl font-bold text-gray-900">{stats.overdue_actions}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <TrendingUp className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Success Rate</p>
                <p className="text-2xl font-bold text-gray-900">{stats.success_rate}%</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <Clock className="h-8 w-8 text-orange-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Avg Completion</p>
                <p className="text-2xl font-bold text-gray-900">{stats.avg_completion_days}d</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <DollarSign className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Revenue Collected</p>
                <p className="text-lg font-bold text-gray-900">{formatCurrency(stats.total_revenue_collected)}</p>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tabs */}
      <Card>
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            {[
              { key: 'active', label: 'Active Workflows', icon: Play },
              { key: 'templates', label: 'Workflow Templates', icon: Settings },
              { key: 'analytics', label: 'Analytics', icon: BarChart3 }
            ].map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => setActiveTab(key as any)}
                className={`py-4 px-1 border-b-2 font-medium text-sm flex items-center ${
                  activeTab === key
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {label}
              </button>
            ))}
          </nav>
        </div>

        <div className="p-6">
          {/* Filters */}
          <div className="flex flex-col md:flex-row md:items-center space-y-4 md:space-y-0 md:space-x-4 mb-6">
            <div className="flex-1">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                <Input
                  placeholder="Search workflows..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            <div className="flex space-x-3">
              {activeTab === 'active' && (
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">All Status</option>
                  <option value="running">Running</option>
                  <option value="paused">Paused</option>
                  <option value="completed">Completed</option>
                  <option value="failed">Failed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              )}
              {activeTab === 'templates' && (
                <select
                  value={categoryFilter}
                  onChange={(e) => setCategoryFilter(e.target.value)}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="all">All Categories</option>
                  <option value="collection">Collection</option>
                  <option value="negotiation">Negotiation</option>
                  <option value="legal">Legal</option>
                  <option value="payment-plan">Payment Plan</option>
                </select>
              )}
            </div>
          </div>

          {/* Active Workflows Tab */}
          {activeTab === 'active' && (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Case & Debtor
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Workflow
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Progress
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Next Action
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Assigned To
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredActiveWorkflows.map((workflow) => (
                    <tr key={workflow.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div>
                          <div className="text-sm font-medium text-gray-900">{workflow.debtor_name}</div>
                          <div className="text-sm text-gray-500">{workflow.case_reference}</div>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">{workflow.template_name}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          <div className="flex-1 bg-gray-200 rounded-full h-2 mr-3">
                            <div
                              className="bg-blue-600 h-2 rounded-full"
                              style={{ width: `${workflow.progress_percentage}%` }}
                            ></div>
                          </div>
                          <span className="text-sm text-gray-900">{workflow.current_step}/{workflow.total_steps}</span>
                        </div>
                        <div className="text-xs text-gray-500 mt-1">
                          {workflow.progress_percentage}% complete
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(workflow.status)}`}>
                          {getStatusIcon(workflow.status)}
                          <span className="ml-1">{workflow.status.charAt(0).toUpperCase() + workflow.status.slice(1)}</span>
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {workflow.next_action_due ? formatDate(workflow.next_action_due) : 'No pending actions'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {workflow.assigned_collector}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end space-x-2">
                          <Button variant="outline" size="sm">
                            <Eye className="h-4 w-4" />
                          </Button>
                          {workflow.status === 'running' ? (
                            <Button variant="outline" size="sm">
                              <Pause className="h-4 w-4" />
                            </Button>
                          ) : workflow.status === 'paused' ? (
                            <Button variant="outline" size="sm">
                              <Play className="h-4 w-4" />
                            </Button>
                          ) : null}
                          <Button variant="outline" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {filteredActiveWorkflows.length === 0 && (
                <div className="text-center py-12">
                  <Workflow className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No workflows found</h3>
                  <p className="text-gray-500">
                    {searchTerm || statusFilter !== 'all'
                      ? 'Try adjusting your search or filter criteria.'
                      : 'Start a workflow to begin automated debt collection processes.'
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Templates Tab */}
          {activeTab === 'templates' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {filteredTemplates.map((template) => (
                <Card key={template.id} className="p-6">
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                      <p className="text-sm text-gray-600 mt-1">{template.description}</p>
                    </div>
                    <div className="flex space-x-2">
                      <Button variant="outline" size="sm" onClick={() => setSelectedTemplate(template)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="outline" size="sm">
                        <Edit className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getCategoryColor(template.category)}`}>
                        {template.category}
                      </span>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${template.is_active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'}`}>
                        {template.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="text-gray-600">Steps:</span>
                        <span className="ml-2 font-medium">{template.total_steps}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Duration:</span>
                        <span className="ml-2 font-medium">{template.estimated_duration_days} days</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Success Rate:</span>
                        <span className="ml-2 font-medium">{template.success_rate}%</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Active Cases:</span>
                        <span className="ml-2 font-medium">{template.active_cases}</span>
                      </div>
                    </div>

                    <div className="flex space-x-2 pt-3">
                      <Button size="sm">
                        <Play className="h-4 w-4 mr-2" />
                        Start Workflow
                      </Button>
                      <Button variant="outline" size="sm">
                        <Settings className="h-4 w-4 mr-2" />
                        Configure
                      </Button>
                    </div>
                  </div>
                </Card>
              ))}

              {filteredTemplates.length === 0 && (
                <div className="col-span-2 text-center py-12">
                  <Settings className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
                  <p className="text-gray-500">
                    {searchTerm || categoryFilter !== 'all'
                      ? 'Try adjusting your search or filter criteria.'
                      : 'Create workflow templates to automate your collection processes.'
                    }
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Analytics Tab */}
          {activeTab === 'analytics' && (
            <div className="space-y-6">
              <div className="text-center py-12">
                <BarChart3 className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Workflow Analytics</h3>
                <p className="text-gray-500 mb-4">
                  Detailed analytics and reporting for workflow performance will be available here.
                </p>
                <Button variant="outline">
                  <TrendingUp className="h-4 w-4 mr-2" />
                  View Detailed Reports
                </Button>
              </div>
            </div>
          )}
        </div>
      </Card>

      {/* Template Steps Modal */}
      {selectedTemplate && (
        <Card className="fixed inset-0 z-50 overflow-y-auto bg-white bg-opacity-95 p-6">
          <div className="max-w-4xl mx-auto">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{selectedTemplate.name}</h2>
                <p className="text-gray-600">{selectedTemplate.description}</p>
              </div>
              <Button variant="outline" onClick={() => setSelectedTemplate(null)}>
                Close
              </Button>
            </div>

            <div className="space-y-4">
              {templateSteps.map((step, index) => (
                <div key={step.id} className="flex items-start space-x-4 p-4 border border-gray-200 rounded-lg">
                  <div className="flex-shrink-0">
                    <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                      <span className="text-sm font-medium text-blue-600">{step.step_number}</span>
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      {getStepTypeIcon(step.type)}
                      <h3 className="font-medium text-gray-900">{step.name}</h3>
                      {step.auto_execute && (
                        <span className="px-2 py-1 bg-green-100 text-green-800 text-xs rounded">Auto</span>
                      )}
                      {step.ai_generated_content && (
                        <span className="px-2 py-1 bg-purple-100 text-purple-800 text-xs rounded">AI</span>
                      )}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{step.description}</p>
                    <div className="text-xs text-gray-500">
                      <span>Delay: {step.delay_days} days</span>
                      {step.conditions.length > 0 && (
                        <span className="ml-4">Conditions: {step.conditions.join(', ')}</span>
                      )}
                    </div>
                  </div>
                  {index < templateSteps.length - 1 && (
                    <ArrowRight className="h-5 w-5 text-gray-400 mt-2" />
                  )}
                </div>
              ))}
            </div>
          </div>
        </Card>
      )}
    </div>
  )
}