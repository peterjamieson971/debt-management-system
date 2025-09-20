'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { ApiError, useErrorHandler } from '@/components/ui/ErrorBoundary'
import { PageLoading } from '@/components/ui/LoadingStates'
import {
  Mail,
  Send,
  Reply,
  Forward,
  Archive,
  Star,
  StarOff,
  Clock,
  User,
  Search,
  Filter,
  Plus,
  Paperclip,
  Phone,
  MessageSquare,
  MoreHorizontal,
  Eye,
  EyeOff,
  AlertCircle,
  CheckCircle,
  Calendar,
  ArrowRight
} from 'lucide-react'

interface EmailThread {
  id: string
  subject: string
  debtor_name: string
  debtor_email: string
  case_id: string
  case_reference: string
  status: 'open' | 'responded' | 'closed' | 'escalated'
  priority: 'low' | 'medium' | 'high' | 'urgent'
  last_activity: string
  unread_count: number
  total_messages: number
  created_at: string
  tags: string[]
  assigned_collector: string
  sentiment: 'positive' | 'neutral' | 'negative'
}

interface EmailMessage {
  id: string
  thread_id: string
  from_email: string
  from_name: string
  to_email: string
  to_name: string
  subject: string
  body: string
  html_body?: string
  is_outbound: boolean
  is_read: boolean
  is_starred: boolean
  sent_at: string
  attachments: EmailAttachment[]
  ai_generated: boolean
  ai_confidence?: number
  response_time_hours?: number
}

interface EmailAttachment {
  id: string
  filename: string
  size_bytes: number
  content_type: string
  download_url: string
}

export default function CommunicationsPage() {
  const [threads, setThreads] = useState<EmailThread[]>([])
  const [selectedThread, setSelectedThread] = useState<EmailThread | null>(null)
  const [messages, setMessages] = useState<EmailMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMessages, setLoadingMessages] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [priorityFilter, setPriorityFilter] = useState<string>('all')
  const [composing, setComposing] = useState(false)
  const [replyContent, setReplyContent] = useState('')
  const { error, resetError, handleError } = useErrorHandler()

  // Mock organization ID - in production, get from auth context
  const organizationId = '550e8400-e29b-41d4-a716-446655440000'

  useEffect(() => {
    fetchEmailThreads()
  }, [])

  useEffect(() => {
    if (selectedThread) {
      fetchThreadMessages(selectedThread.id)
    }
  }, [selectedThread])

  const fetchEmailThreads = async () => {
    try {
      setLoading(true)
      resetError()

      const response = await fetch(`/api/communications/threads?organization_id=${organizationId}`, {
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setThreads(data.threads)
      } else if (response.status === 500 || response.status === 404) {
        console.warn('Communications API endpoint not available, using mock data')

        // Mock email threads data
        setThreads([
          {
            id: '1',
            subject: 'Invoice #INV-2024-001 Payment Reminder',
            debtor_name: 'Ahmed Al-Mansouri',
            debtor_email: 'ahmed.mansouri@techcorp.ae',
            case_id: 'case-001',
            case_reference: 'TC-2024-001',
            status: 'responded',
            priority: 'high',
            last_activity: '2024-09-20T10:30:00Z',
            unread_count: 2,
            total_messages: 5,
            created_at: '2024-09-15T09:00:00Z',
            tags: ['payment-plan', 'responsive'],
            assigned_collector: 'Sarah Johnson',
            sentiment: 'positive'
          },
          {
            id: '2',
            subject: 'Outstanding Balance - Final Notice',
            debtor_name: 'Maria Santos',
            debtor_email: 'maria.santos@globaltrading.com',
            case_id: 'case-002',
            case_reference: 'GT-2024-002',
            status: 'open',
            priority: 'urgent',
            last_activity: '2024-09-19T16:45:00Z',
            unread_count: 0,
            total_messages: 8,
            created_at: '2024-09-10T14:20:00Z',
            tags: ['legal-action', 'unresponsive'],
            assigned_collector: 'Ahmed Al-Rashid',
            sentiment: 'negative'
          },
          {
            id: '3',
            subject: 'Payment Arrangement Discussion',
            debtor_name: 'Robert Wilson',
            debtor_email: 'r.wilson@constructionplus.co.uk',
            case_id: 'case-003',
            case_reference: 'CP-2024-003',
            status: 'responded',
            priority: 'medium',
            last_activity: '2024-09-18T11:15:00Z',
            unread_count: 1,
            total_messages: 3,
            created_at: '2024-09-16T08:30:00Z',
            tags: ['negotiation', 'cooperative'],
            assigned_collector: 'Sarah Johnson',
            sentiment: 'neutral'
          },
          {
            id: '4',
            subject: 'Contract Dispute Resolution',
            debtor_name: 'Fatima Al-Zahra',
            debtor_email: 'fatima.zahra@petrochemical.qa',
            case_id: 'case-004',
            case_reference: 'PC-2024-004',
            status: 'escalated',
            priority: 'high',
            last_activity: '2024-09-17T13:20:00Z',
            unread_count: 0,
            total_messages: 12,
            created_at: '2024-09-05T10:00:00Z',
            tags: ['dispute', 'legal-review'],
            assigned_collector: 'Manager Review',
            sentiment: 'negative'
          },
          {
            id: '5',
            subject: 'Invoice Clarification Request',
            debtor_name: 'John Mitchell',
            debtor_email: 'j.mitchell@retailgroup.com',
            case_id: 'case-005',
            case_reference: 'RG-2024-005',
            status: 'closed',
            priority: 'low',
            last_activity: '2024-09-12T09:45:00Z',
            unread_count: 0,
            total_messages: 4,
            created_at: '2024-09-08T15:10:00Z',
            tags: ['resolved', 'paid'],
            assigned_collector: 'Ahmed Al-Rashid',
            sentiment: 'positive'
          }
        ])
      } else {
        const errorText = await response.text()
        throw new Error(`Failed to load email threads: ${response.status} ${errorText}`)
      }
    } catch (error) {
      console.error('Failed to fetch email threads:', error)
      if (error instanceof Error) {
        handleError(error)
      } else {
        handleError(new Error('An unexpected error occurred while loading communications'))
      }
    } finally {
      setLoading(false)
    }
  }

  const fetchThreadMessages = async (threadId: string) => {
    try {
      setLoadingMessages(true)

      const response = await fetch(`/api/communications/threads/${threadId}/messages`, {
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setMessages(data.messages)
      } else if (response.status === 500 || response.status === 404) {
        console.warn('Thread messages API endpoint not available, using mock data')

        // Mock messages for the selected thread
        setMessages([
          {
            id: '1',
            thread_id: threadId,
            from_email: 'ahmed.mansouri@techcorp.ae',
            from_name: 'Ahmed Al-Mansouri',
            to_email: 'collections@gccrecruitment.com',
            to_name: 'Collections Team',
            subject: 'Re: Invoice #INV-2024-001 Payment Reminder',
            body: 'Dear Collections Team,\n\nI received your payment reminder regarding Invoice #INV-2024-001. I acknowledge the outstanding amount of AED 45,000.\n\nDue to some cash flow challenges, I would like to propose a payment plan to settle this amount over the next 3 months. Would this be acceptable?\n\nPlease let me know your terms.\n\nBest regards,\nAhmed Al-Mansouri',
            is_outbound: false,
            is_read: true,
            is_starred: false,
            sent_at: '2024-09-20T10:30:00Z',
            attachments: [],
            ai_generated: false,
            response_time_hours: 24
          },
          {
            id: '2',
            thread_id: threadId,
            from_email: 'sarah.johnson@gccrecruitment.com',
            from_name: 'Sarah Johnson',
            to_email: 'ahmed.mansouri@techcorp.ae',
            to_name: 'Ahmed Al-Mansouri',
            subject: 'Re: Invoice #INV-2024-001 Payment Reminder',
            body: 'Dear Mr. Al-Mansouri,\n\nThank you for your prompt response and for acknowledging the outstanding amount.\n\nWe appreciate your proactive approach in reaching out to discuss a payment arrangement. A 3-month payment plan is certainly something we can consider.\n\nHere are our proposed terms:\n- 3 equal monthly installments of AED 15,000\n- First payment due within 7 days\n- Subsequent payments on the same date each month\n- 2% late fee if payments are delayed beyond 5 days\n\nPlease confirm your acceptance of these terms, and we can formalize the arrangement.\n\nBest regards,\nSarah Johnson\nCollections Manager\nGCC Recruitment Services',
            is_outbound: true,
            is_read: true,
            is_starred: false,
            sent_at: '2024-09-20T14:15:00Z',
            attachments: [
              {
                id: 'att-1',
                filename: 'Payment_Plan_Agreement.pdf',
                size_bytes: 245760,
                content_type: 'application/pdf',
                download_url: '/api/attachments/att-1/download'
              }
            ],
            ai_generated: true,
            ai_confidence: 95
          },
          {
            id: '3',
            thread_id: threadId,
            from_email: 'ahmed.mansouri@techcorp.ae',
            from_name: 'Ahmed Al-Mansouri',
            to_email: 'sarah.johnson@gccrecruitment.com',
            to_name: 'Sarah Johnson',
            subject: 'Re: Invoice #INV-2024-001 Payment Reminder',
            body: 'Dear Ms. Johnson,\n\nThank you for the quick response and the reasonable payment plan proposal.\n\nI accept the terms as outlined:\n- 3 monthly installments of AED 15,000\n- First payment within 7 days\n- 2% late fee policy\n\nI will process the first payment of AED 15,000 by this Friday, September 22nd, 2024.\n\nPlease send me the formal payment plan agreement for my records.\n\nThank you for your understanding and professionalism.\n\nBest regards,\nAhmed Al-Mansouri\nCFO, TechCorp UAE',
            is_outbound: false,
            is_read: false,
            is_starred: true,
            sent_at: '2024-09-20T16:45:00Z',
            attachments: [],
            ai_generated: false,
            response_time_hours: 2.5
          }
        ])
      }
    } catch (error) {
      console.error('Failed to fetch thread messages:', error)
    } finally {
      setLoadingMessages(false)
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open':
        return 'bg-blue-100 text-blue-800'
      case 'responded':
        return 'bg-green-100 text-green-800'
      case 'closed':
        return 'bg-gray-100 text-gray-800'
      case 'escalated':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'low':
        return 'bg-green-100 text-green-800'
      case 'medium':
        return 'bg-yellow-100 text-yellow-800'
      case 'high':
        return 'bg-orange-100 text-orange-800'
      case 'urgent':
        return 'bg-red-100 text-red-800'
      default:
        return 'bg-gray-100 text-gray-800'
    }
  }

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'negative':
        return <AlertCircle className="h-4 w-4 text-red-600" />
      case 'neutral':
        return <MessageSquare className="h-4 w-4 text-gray-600" />
      default:
        return null
    }
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const filteredThreads = threads.filter(thread => {
    const matchesSearch =
      thread.subject.toLowerCase().includes(searchTerm.toLowerCase()) ||
      thread.debtor_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      thread.debtor_email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      thread.case_reference.toLowerCase().includes(searchTerm.toLowerCase())

    const matchesStatus = statusFilter === 'all' || thread.status === statusFilter
    const matchesPriority = priorityFilter === 'all' || thread.priority === priorityFilter

    return matchesSearch && matchesStatus && matchesPriority
  })

  if (loading) {
    return (
      <div className="space-y-6">
        <PageLoading
          title="Loading Communications"
          description="Please wait while we fetch email threads and messages..."
        />
      </div>
    )
  }

  return (
    <div className="h-screen flex flex-col">
      <div className="flex justify-between items-center p-6 border-b border-gray-200">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Communications</h1>
          <p className="text-gray-600">Email threads and debtor conversations</p>
        </div>
        <div className="flex space-x-3">
          <Button variant="outline">
            <Archive className="h-4 w-4 mr-2" />
            Archive
          </Button>
          <Button>
            <Plus className="h-4 w-4 mr-2" />
            Compose
          </Button>
        </div>
      </div>

      <ApiError
        error={error}
        onRetry={fetchEmailThreads}
        onDismiss={resetError}
        title="Communications Error"
      />

      <div className="flex flex-1 overflow-hidden">
        {/* Email Threads List */}
        <div className="w-1/3 border-r border-gray-200 flex flex-col">
          {/* Filters */}
          <div className="p-4 border-b border-gray-200 space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
              <Input
                placeholder="Search conversations..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            <div className="flex space-x-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Status</option>
                <option value="open">Open</option>
                <option value="responded">Responded</option>
                <option value="closed">Closed</option>
                <option value="escalated">Escalated</option>
              </select>
              <select
                value={priorityFilter}
                onChange={(e) => setPriorityFilter(e.target.value)}
                className="flex-1 rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500 text-sm"
              >
                <option value="all">All Priority</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
                <option value="urgent">Urgent</option>
              </select>
            </div>
          </div>

          {/* Threads List */}
          <div className="flex-1 overflow-y-auto">
            {filteredThreads.map((thread) => (
              <div
                key={thread.id}
                onClick={() => setSelectedThread(thread)}
                className={`p-4 border-b border-gray-200 cursor-pointer hover:bg-gray-50 ${
                  selectedThread?.id === thread.id ? 'bg-blue-50 border-l-4 border-l-blue-500' : ''
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <div className="flex items-center space-x-2">
                    <h3 className="font-medium text-gray-900 truncate">{thread.debtor_name}</h3>
                    {getSentimentIcon(thread.sentiment)}
                  </div>
                  <div className="flex items-center space-x-1">
                    {thread.unread_count > 0 && (
                      <span className="bg-blue-600 text-white text-xs rounded-full px-2 py-1">
                        {thread.unread_count}
                      </span>
                    )}
                    <span className="text-xs text-gray-500">{formatDate(thread.last_activity)}</span>
                  </div>
                </div>

                <p className="text-sm text-gray-600 truncate mb-2">{thread.subject}</p>

                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(thread.status)}`}>
                      {thread.status}
                    </span>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(thread.priority)}`}>
                      {thread.priority}
                    </span>
                  </div>
                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                    <MessageSquare className="h-3 w-3" />
                    <span>{thread.total_messages}</span>
                  </div>
                </div>

                <div className="mt-2 flex items-center justify-between">
                  <span className="text-xs text-gray-500">{thread.case_reference}</span>
                  <span className="text-xs text-gray-500">{thread.assigned_collector}</span>
                </div>
              </div>
            ))}

            {filteredThreads.length === 0 && (
              <div className="p-8 text-center">
                <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No conversations found</h3>
                <p className="text-gray-500">
                  {searchTerm || statusFilter !== 'all' || priorityFilter !== 'all'
                    ? 'Try adjusting your search or filter criteria.'
                    : 'Email conversations will appear here when available.'
                  }
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Email Messages View */}
        <div className="flex-1 flex flex-col">
          {selectedThread ? (
            <>
              {/* Thread Header */}
              <div className="p-4 border-b border-gray-200">
                <div className="flex justify-between items-start mb-2">
                  <div>
                    <h2 className="text-lg font-semibold text-gray-900">{selectedThread.subject}</h2>
                    <p className="text-sm text-gray-600">
                      {selectedThread.debtor_name} ({selectedThread.debtor_email})
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm">
                      <Archive className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <Star className="h-4 w-4" />
                    </Button>
                    <Button variant="outline" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>
                </div>

                <div className="flex items-center space-x-4 text-sm text-gray-600">
                  <span>Case: {selectedThread.case_reference}</span>
                  <span>Assigned: {selectedThread.assigned_collector}</span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(selectedThread.status)}`}>
                    {selectedThread.status}
                  </span>
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${getPriorityColor(selectedThread.priority)}`}>
                    {selectedThread.priority}
                  </span>
                </div>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {loadingMessages ? (
                  <div className="text-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
                    <p className="text-gray-600 mt-2">Loading messages...</p>
                  </div>
                ) : (
                  messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex ${message.is_outbound ? 'justify-end' : 'justify-start'}`}
                    >
                      <div className={`max-w-2xl ${message.is_outbound ? 'bg-blue-100' : 'bg-gray-100'} rounded-lg p-4`}>
                        <div className="flex items-center justify-between mb-2">
                          <div className="flex items-center space-x-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                              message.is_outbound ? 'bg-blue-600 text-white' : 'bg-gray-600 text-white'
                            }`}>
                              {message.from_name.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <p className="font-medium text-sm">{message.from_name}</p>
                              <p className="text-xs text-gray-600">{formatDate(message.sent_at)}</p>
                            </div>
                          </div>
                          <div className="flex items-center space-x-1">
                            {message.ai_generated && (
                              <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded">
                                AI {message.ai_confidence}%
                              </span>
                            )}
                            {!message.is_read && (
                              <div className="w-2 h-2 bg-blue-600 rounded-full"></div>
                            )}
                          </div>
                        </div>

                        <div className="text-sm text-gray-900 whitespace-pre-wrap mb-3">
                          {message.body}
                        </div>

                        {message.attachments.length > 0 && (
                          <div className="space-y-2">
                            {message.attachments.map((attachment) => (
                              <div key={attachment.id} className="flex items-center space-x-2 bg-white rounded p-2">
                                <Paperclip className="h-4 w-4 text-gray-400" />
                                <span className="text-sm text-gray-900">{attachment.filename}</span>
                                <span className="text-xs text-gray-500">({formatFileSize(attachment.size_bytes)})</span>
                                <Button variant="outline" size="sm">Download</Button>
                              </div>
                            ))}
                          </div>
                        )}

                        {message.response_time_hours && (
                          <div className="text-xs text-gray-500 mt-2">
                            Response time: {message.response_time_hours}h
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>

              {/* Reply Compose */}
              <div className="border-t border-gray-200 p-4">
                <div className="flex space-x-3">
                  <Button size="sm">
                    <Reply className="h-4 w-4 mr-2" />
                    Reply
                  </Button>
                  <Button variant="outline" size="sm">
                    <Forward className="h-4 w-4 mr-2" />
                    Forward
                  </Button>
                  <Button variant="outline" size="sm">
                    <Phone className="h-4 w-4 mr-2" />
                    Call
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center">
              <div className="text-center">
                <Mail className="h-16 w-16 text-gray-400 mx-auto mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">Select a conversation</h3>
                <p className="text-gray-500">Choose an email thread to view the conversation</p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}