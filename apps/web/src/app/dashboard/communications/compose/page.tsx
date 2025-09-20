'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Mail, Send, Wand2, Building2, FileText, LogOut, Copy, Eye } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card'
import type { Tables } from '@/lib/supabase/database.types'

type Debtor = Tables<'debtors'>
type CollectionCase = Tables<'collection_cases'> & {
  debtors: Tables<'debtors'> | null
}

export default function ComposeEmailPage() {
  const [user, setUser] = useState<any>(null)
  const [debtors, setDebtors] = useState<Debtor[]>([])
  const [cases, setCases] = useState<CollectionCase[]>([])
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [emailData, setEmailData] = useState({
    recipient_type: 'debtor',
    debtor_id: '',
    case_id: '',
    recipient_email: '',
    subject: '',
    content: '',
    tone: 'professional',
    language: 'en',
    template_type: 'initial_contact'
  })
  const [generatedContent, setGeneratedContent] = useState({
    subject: '',
    content: ''
  })

  const router = useRouter()
  const supabase = createClient()

  useEffect(() => {
    checkUser()
    loadData()
  }, [])

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) {
      router.push('/login')
      return
    }
    setUser(user)
  }

  const loadData = async () => {
    try {
      // Load debtors
      const { data: debtorsData } = await supabase
        .from('debtors')
        .select('*')
        .order('company_name')

      // Load cases with debtor info
      const { data: casesData } = await supabase
        .from('collection_cases')
        .select(`
          *,
          debtors (*)
        `)
        .order('created_at', { ascending: false })

      setDebtors(debtorsData || [])
      setCases(casesData || [])
    } catch (error) {
      console.error('Error loading data:', error)
    } finally {
      setLoadingData(false)
    }
  }

  const handleLogout = async () => {
    await supabase.auth.signOut()
    router.push('/login')
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target
    setEmailData(prev => ({
      ...prev,
      [name]: value
    }))

    // Auto-populate recipient email when debtor is selected
    if (name === 'debtor_id' && value) {
      const selectedDebtor = debtors.find(d => d.id.toString() === value)
      if (selectedDebtor?.primary_contact_email) {
        setEmailData(prev => ({
          ...prev,
          recipient_email: selectedDebtor.primary_contact_email!
        }))
      }
    }
  }

  const generateAIContent = async () => {
    setLoading(true)
    try {
      // Get selected debtor and case info
      const selectedDebtor = debtors.find(d => d.id.toString() === emailData.debtor_id)
      const selectedCase = emailData.case_id ? cases.find(c => c.id.toString() === emailData.case_id) : null

      // Mock AI generation for now - in real implementation this would call the AI API
      const mockSubjects = {
        initial_contact: `Payment Request - Invoice ${selectedCase?.invoice_number || 'Pending'} - ${selectedDebtor?.company_name}`,
        follow_up: `Follow-up: Outstanding Payment - ${selectedDebtor?.company_name}`,
        reminder: `Payment Reminder - Immediate Attention Required - ${selectedDebtor?.company_name}`,
        final_notice: `FINAL NOTICE - Payment Required Within 7 Days - ${selectedDebtor?.company_name}`,
        payment_plan: `Payment Plan Proposal - ${selectedDebtor?.company_name}`
      }

      const mockContent = {
        initial_contact: `Dear ${selectedDebtor?.primary_contact_name || 'Sir/Madam'},

I hope this email finds you well.

We are writing to bring to your attention an outstanding payment of AED ${selectedCase?.outstanding_amount?.toLocaleString() || '0'} for ${selectedCase?.invoice_number ? `Invoice ${selectedCase.invoice_number}` : 'your account'}.

According to our records, this payment was due on ${selectedCase?.due_date ? new Date(selectedCase.due_date).toLocaleDateString() : 'the agreed date'}.

We understand that business circumstances can sometimes cause delays, and we are here to work with you to resolve this matter amicably.

Please arrange for payment at your earliest convenience, or contact us to discuss alternative arrangements if needed.

We value our business relationship and look forward to your prompt response.

Best regards,
Collection Department`,
        follow_up: `Dear ${selectedDebtor?.primary_contact_name || 'Sir/Madam'},

We hope you are doing well. This is a follow-up regarding our previous communication about the outstanding payment of AED ${selectedCase?.outstanding_amount?.toLocaleString() || '0'}.

We have not yet received payment or heard from you regarding this matter. We understand that business priorities can be demanding, but we kindly request your immediate attention to resolve this outstanding amount.

To maintain our positive business relationship, we encourage you to:
• Arrange immediate payment of the full amount
• Contact us to discuss a suitable payment plan
• Provide an update on your payment timeline

Please respond within the next 3 business days to avoid any further collection actions.

We appreciate your cooperation and look forward to resolving this matter quickly.

Best regards,
Collection Department`,
        reminder: `Dear ${selectedDebtor?.primary_contact_name || 'Sir/Madam'},

This is an important reminder regarding your outstanding balance of AED ${selectedCase?.outstanding_amount?.toLocaleString() || '0'}.

Despite our previous communications, this amount remains unpaid. We must emphasize the urgency of this matter and request immediate action.

IMMEDIATE ACTION REQUIRED:
• Payment is now significantly overdue
• Additional charges may apply for late payment
• This matter requires your immediate attention

Please contact us within 24 hours to discuss payment or arrange a suitable resolution.

We prefer to resolve this matter amicably and maintain our business relationship. However, further delays may result in additional collection measures.

Regards,
Collection Department`,
        final_notice: `FINAL NOTICE

Dear ${selectedDebtor?.primary_contact_name || 'Sir/Madam'},

This is our FINAL NOTICE regarding the outstanding amount of AED ${selectedCase?.outstanding_amount?.toLocaleString() || '0'}.

Despite multiple attempts to contact you and resolve this matter amicably, the payment remains outstanding.

FINAL OPPORTUNITY:
You have 7 days from the date of this notice to settle this account in full or contact us with acceptable payment arrangements.

FAILURE TO RESPOND will result in:
• Legal action to recover the debt
• Additional legal costs and fees
• Potential impact on your business credit rating

We strongly urge you to contact us immediately to avoid these consequences.

This is your final opportunity to resolve this matter before we proceed with legal action.

Collection Department
Legal Notice Served`,
        payment_plan: `Dear ${selectedDebtor?.primary_contact_name || 'Sir/Madam'},

Thank you for your communication regarding the outstanding balance of AED ${selectedCase?.outstanding_amount?.toLocaleString() || '0'}.

We understand your current situation and are pleased to offer a structured payment plan to help resolve this matter:

PROPOSED PAYMENT PLAN:
• Total Amount: AED ${selectedCase?.outstanding_amount?.toLocaleString() || '0'}
• Plan Duration: 3 months
• Monthly Payment: AED ${selectedCase?.outstanding_amount ? Math.ceil(selectedCase.outstanding_amount / 3).toLocaleString() : '0'}
• First Payment Due: Within 7 days of agreement

This arrangement demonstrates our commitment to maintaining our business relationship while ensuring debt recovery.

Please confirm your acceptance of this payment plan by return email. Upon confirmation, we will provide formal documentation and payment instructions.

We appreciate your cooperation and look forward to resolving this matter.

Best regards,
Collection Department`
      }

      setGeneratedContent({
        subject: mockSubjects[emailData.template_type as keyof typeof mockSubjects] || 'Payment Request',
        content: mockContent[emailData.template_type as keyof typeof mockContent] || 'Generated content will appear here.'
      })

      // Auto-populate the form with generated content
      setEmailData(prev => ({
        ...prev,
        subject: mockSubjects[emailData.template_type as keyof typeof mockSubjects] || 'Payment Request',
        content: mockContent[emailData.template_type as keyof typeof mockContent] || 'Generated content will appear here.'
      }))

    } catch (error) {
      console.error('Error generating AI content:', error)
      alert('Error generating content. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleSend = async () => {
    if (!emailData.recipient_email || !emailData.subject || !emailData.content) {
      alert('Please fill in all required fields')
      return
    }

    setLoading(true)
    try {
      // In a real implementation, this would send the email via API
      // For now, we'll just simulate success
      alert('Email sent successfully!')
      router.push('/dashboard')
    } catch (error) {
      console.error('Error sending email:', error)
      alert('Error sending email. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleCancel = () => {
    router.push('/dashboard')
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    alert('Copied to clipboard!')
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
                <a href="/dashboard" className="text-blue-600 hover:text-blue-800 font-medium">Dashboard</a>
                <a href="/cases" className="text-gray-600 hover:text-gray-800">Cases</a>
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
                <span className="ml-4 text-gray-500">Communications</span>
              </div>
            </li>
            <li>
              <div className="flex items-center">
                <svg className="flex-shrink-0 h-5 w-5 text-gray-300" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                </svg>
                <span className="ml-4 text-gray-500">Compose Email</span>
              </div>
            </li>
          </ol>
        </nav>
      </div>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center">
            <Button
              onClick={handleCancel}
              variant="outline"
              className="mr-4"
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">AI Email Composer</h2>
              <p className="text-gray-600">Generate personalized collection emails with AI</p>
            </div>
          </div>
        </div>

        {loadingData ? (
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="mt-2 text-gray-600">Loading data...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Configuration Panel */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Building2 className="h-5 w-5 mr-2" />
                    Recipient & Case Selection
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Select Debtor *
                    </label>
                    <select
                      name="debtor_id"
                      value={emailData.debtor_id}
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

                  {emailData.debtor_id && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Related Case (Optional)
                      </label>
                      <select
                        name="case_id"
                        value={emailData.case_id}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="">No specific case</option>
                        {cases
                          .filter(c => c.debtor_id.toString() === emailData.debtor_id)
                          .map((case_) => (
                            <option key={case_.id} value={case_.id}>
                              Case #{case_.id} - AED {case_.outstanding_amount.toLocaleString()}
                            </option>
                          ))}
                      </select>
                    </div>
                  )}

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Recipient Email *
                    </label>
                    <Input
                      name="recipient_email"
                      type="email"
                      value={emailData.recipient_email}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter recipient email"
                    />
                  </div>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center">
                    <Wand2 className="h-5 w-5 mr-2" />
                    AI Generation Settings
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Template Type
                    </label>
                    <select
                      name="template_type"
                      value={emailData.template_type}
                      onChange={handleInputChange}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                    >
                      <option value="initial_contact">Initial Contact</option>
                      <option value="follow_up">Follow-up</option>
                      <option value="reminder">Payment Reminder</option>
                      <option value="final_notice">Final Notice</option>
                      <option value="payment_plan">Payment Plan Offer</option>
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Tone
                      </label>
                      <select
                        name="tone"
                        value={emailData.tone}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="professional">Professional</option>
                        <option value="friendly">Friendly</option>
                        <option value="firm">Firm</option>
                        <option value="urgent">Urgent</option>
                      </select>
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Language
                      </label>
                      <select
                        name="language"
                        value={emailData.language}
                        onChange={handleInputChange}
                        className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                      >
                        <option value="en">English</option>
                        <option value="ar">Arabic</option>
                      </select>
                    </div>
                  </div>

                  <Button
                    onClick={generateAIContent}
                    disabled={!emailData.debtor_id || loading}
                    className="w-full bg-purple-600 hover:bg-purple-700"
                  >
                    {loading ? (
                      <div className="flex items-center">
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                        Generating...
                      </div>
                    ) : (
                      <div className="flex items-center">
                        <Wand2 className="h-4 w-4 mr-2" />
                        Generate AI Content
                      </div>
                    )}
                  </Button>
                </CardContent>
              </Card>
            </div>

            {/* Email Composer */}
            <div className="space-y-6">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center justify-between">
                    <div className="flex items-center">
                      <Mail className="h-5 w-5 mr-2" />
                      Email Composer
                    </div>
                    {emailData.subject && (
                      <Button
                        onClick={() => copyToClipboard(emailData.subject + '\n\n' + emailData.content)}
                        variant="outline"
                        size="sm"
                      >
                        <Copy className="h-4 w-4 mr-2" />
                        Copy All
                      </Button>
                    )}
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Subject Line *
                    </label>
                    <Input
                      name="subject"
                      value={emailData.subject}
                      onChange={handleInputChange}
                      required
                      placeholder="Enter email subject"
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Email Content *
                    </label>
                    <textarea
                      name="content"
                      value={emailData.content}
                      onChange={handleInputChange}
                      required
                      rows={16}
                      className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono text-sm"
                      placeholder="Email content will appear here after AI generation..."
                    />
                  </div>

                  <div className="flex items-center justify-end space-x-4 pt-4">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={handleCancel}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSend}
                      disabled={!emailData.recipient_email || !emailData.subject || !emailData.content || loading}
                      className="bg-blue-600 hover:bg-blue-700"
                    >
                      {loading ? (
                        <div className="flex items-center">
                          <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                          Sending...
                        </div>
                      ) : (
                        <div className="flex items-center">
                          <Send className="h-4 w-4 mr-2" />
                          Send Email
                        </div>
                      )}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}