'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Mail,
  Settings,
  Activity,
  AlertTriangle,
  CheckCircle,
  Save,
  RefreshCw,
  Eye,
  EyeOff,
  Plus,
  Trash2,
  BarChart3
} from 'lucide-react'

interface EmailConfig {
  gmail_settings: {
    client_id: string
    client_secret: string
    scopes: string[]
    auto_watch_enabled: boolean
    watch_labels: string[]
  }
  rate_limits: {
    emails_per_minute: number
    emails_per_hour: number
    emails_per_day: number
    burst_limit: number
  }
  sending_preferences: {
    default_sender_name: string
    default_signature: string
    auto_follow_up_enabled: boolean
    follow_up_delay_days: number
    business_hours_only: boolean
    business_hours: {
      start: string
      end: string
      timezone: string
      days: string[]
    }
  }
  bounce_handling: {
    auto_retry_soft_bounces: boolean
    max_retry_attempts: number
    retry_delay_hours: number
    mark_hard_bounces_invalid: boolean
    bounce_notification_emails: string[]
  }
  monitoring: {
    track_opens: boolean
    track_clicks: boolean
    delivery_tracking_enabled: boolean
    real_time_alerts: boolean
    alert_email: string
  }
}

interface OAuthConnection {
  email: string
  connected_at: string
  last_updated: string
  expires_at: string
  scopes: string[]
  status: 'active' | 'expired'
}

interface EmailAnalytics {
  total_emails: number
  sent_emails: number
  received_emails: number
  delivery_stats: {
    delivered: number
    bounced: number
    pending: number
    failed: number
  }
  connection_status: {
    total_connections: number
    active_connections: number
    expired_connections: number
  }
}

export default function EmailConfigurationPage() {
  const [config, setConfig] = useState<EmailConfig | null>(null)
  const [connections, setConnections] = useState<OAuthConnection[]>([])
  const [analytics, setAnalytics] = useState<EmailAnalytics | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSecrets, setShowSecrets] = useState(false)
  const [activeTab, setActiveTab] = useState<'config' | 'connections' | 'analytics'>('config')

  // Mock organization ID
  const organizationId = '550e8400-e29b-41d4-a716-446655440000'

  useEffect(() => {
    fetchEmailConfig()
  }, [])

  const fetchEmailConfig = async () => {
    try {
      setLoading(true)

      const response = await fetch(`/api/admin/email/config?organization_id=${organizationId}`, {
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setConfig(data.configuration)
        setConnections(data.oauth_connections || [])
        setAnalytics(data.analytics)
      } else {
        // Set default config
        setConfig({
          gmail_settings: {
            client_id: '',
            client_secret: '',
            scopes: [
              'https://www.googleapis.com/auth/gmail.readonly',
              'https://www.googleapis.com/auth/gmail.send',
              'https://www.googleapis.com/auth/gmail.modify',
              'https://www.googleapis.com/auth/userinfo.email'
            ],
            auto_watch_enabled: true,
            watch_labels: ['INBOX']
          },
          rate_limits: {
            emails_per_minute: 10,
            emails_per_hour: 100,
            emails_per_day: 1000,
            burst_limit: 5
          },
          sending_preferences: {
            default_sender_name: 'Debt Collection Team',
            default_signature: '',
            auto_follow_up_enabled: false,
            follow_up_delay_days: 3,
            business_hours_only: true,
            business_hours: {
              start: '09:00',
              end: '17:00',
              timezone: 'Asia/Dubai',
              days: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
            }
          },
          bounce_handling: {
            auto_retry_soft_bounces: true,
            max_retry_attempts: 3,
            retry_delay_hours: 24,
            mark_hard_bounces_invalid: true,
            bounce_notification_emails: []
          },
          monitoring: {
            track_opens: false,
            track_clicks: false,
            delivery_tracking_enabled: true,
            real_time_alerts: true,
            alert_email: ''
          }
        })

        setAnalytics({
          total_emails: 0,
          sent_emails: 0,
          received_emails: 0,
          delivery_stats: { delivered: 0, bounced: 0, pending: 0, failed: 0 },
          connection_status: { total_connections: 0, active_connections: 0, expired_connections: 0 }
        })
      }
    } catch (error) {
      console.error('Failed to fetch email config:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    if (!config) return

    try {
      setSaving(true)

      const response = await fetch('/api/admin/email/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          organization_id: organizationId,
          ...config
        })
      })

      if (response.ok) {
        alert('Email configuration saved successfully!')
      } else {
        throw new Error('Failed to save configuration')
      }
    } catch (error) {
      console.error('Failed to save email config:', error)
      alert('Failed to save configuration. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const connectGmail = async () => {
    try {
      const response = await fetch(`/api/auth/gmail/authorize?organization_id=${organizationId}`, {
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })

      if (response.ok) {
        const data = await response.json()
        window.location.href = data.authorization_url
      } else {
        alert('Failed to initiate Gmail connection')
      }
    } catch (error) {
      console.error('Failed to connect Gmail:', error)
      alert('Failed to connect Gmail')
    }
  }

  const updateConfig = (section: keyof EmailConfig, field: string, value: any) => {
    if (!config) return

    setConfig({
      ...config,
      [section]: {
        ...config[section],
        [field]: value
      }
    })
  }

  const addBounceNotificationEmail = () => {
    if (!config) return

    const email = prompt('Enter email address for bounce notifications:')
    if (email) {
      updateConfig('bounce_handling', 'bounce_notification_emails', [
        ...config.bounce_handling.bounce_notification_emails,
        email
      ])
    }
  }

  const removeBounceNotificationEmail = (index: number) => {
    if (!config) return

    const emails = [...config.bounce_handling.bounce_notification_emails]
    emails.splice(index, 1)
    updateConfig('bounce_handling', 'bounce_notification_emails', emails)
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString()
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="h-64 bg-gray-200 rounded-lg"></div>
            <div className="h-64 bg-gray-200 rounded-lg"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="text-center py-12">
        <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-gray-900 mb-2">Failed to load email configuration</h2>
        <Button onClick={fetchEmailConfig}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Email Configuration</h1>
        <div className="flex space-x-3">
          <Button onClick={fetchEmailConfig} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={saveConfig} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? 'Saving...' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'config', name: 'Configuration', icon: Settings },
            { id: 'connections', name: 'Gmail Connections', icon: Mail },
            { id: 'analytics', name: 'Analytics', icon: BarChart3 }
          ].map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                } whitespace-nowrap py-2 px-1 border-b-2 font-medium text-sm flex items-center`}
              >
                <Icon className="h-4 w-4 mr-2" />
                {tab.name}
              </button>
            )
          })}
        </nav>
      </div>

      {/* Configuration Tab */}
      {activeTab === 'config' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gmail Settings */}
          <Card className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Gmail Settings</h2>
              <Button
                onClick={() => setShowSecrets(!showSecrets)}
                variant="outline"
                size="sm"
              >
                {showSecrets ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </Button>
            </div>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client ID
                </label>
                <Input
                  type={showSecrets ? 'text' : 'password'}
                  value={config.gmail_settings.client_id}
                  onChange={(e) => updateConfig('gmail_settings', 'client_id', e.target.value)}
                  placeholder="Google OAuth Client ID"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Client Secret
                </label>
                <Input
                  type={showSecrets ? 'text' : 'password'}
                  value={config.gmail_settings.client_secret}
                  onChange={(e) => updateConfig('gmail_settings', 'client_secret', e.target.value)}
                  placeholder="Google OAuth Client Secret"
                />
              </div>
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.gmail_settings.auto_watch_enabled}
                  onChange={(e) => updateConfig('gmail_settings', 'auto_watch_enabled', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Auto-enable email monitoring
                </label>
              </div>
            </div>
          </Card>

          {/* Rate Limits */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Rate Limits</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Emails per Minute
                </label>
                <Input
                  type="number"
                  value={config.rate_limits.emails_per_minute}
                  onChange={(e) => updateConfig('rate_limits', 'emails_per_minute', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Emails per Hour
                </label>
                <Input
                  type="number"
                  value={config.rate_limits.emails_per_hour}
                  onChange={(e) => updateConfig('rate_limits', 'emails_per_hour', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Emails per Day
                </label>
                <Input
                  type="number"
                  value={config.rate_limits.emails_per_day}
                  onChange={(e) => updateConfig('rate_limits', 'emails_per_day', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Burst Limit
                </label>
                <Input
                  type="number"
                  value={config.rate_limits.burst_limit}
                  onChange={(e) => updateConfig('rate_limits', 'burst_limit', parseInt(e.target.value))}
                />
              </div>
            </div>
          </Card>

          {/* Business Hours */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Business Hours</h2>
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.sending_preferences.business_hours_only}
                  onChange={(e) => updateConfig('sending_preferences', 'business_hours_only', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Restrict sending to business hours only
                </label>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Start Time</label>
                  <Input
                    type="time"
                    value={config.sending_preferences.business_hours.start}
                    onChange={(e) => updateConfig('sending_preferences', 'business_hours', {
                      ...config.sending_preferences.business_hours,
                      start: e.target.value
                    })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">End Time</label>
                  <Input
                    type="time"
                    value={config.sending_preferences.business_hours.end}
                    onChange={(e) => updateConfig('sending_preferences', 'business_hours', {
                      ...config.sending_preferences.business_hours,
                      end: e.target.value
                    })}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Timezone</label>
                <select
                  value={config.sending_preferences.business_hours.timezone}
                  onChange={(e) => updateConfig('sending_preferences', 'business_hours', {
                    ...config.sending_preferences.business_hours,
                    timezone: e.target.value
                  })}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="Asia/Dubai">Asia/Dubai (UAE)</option>
                  <option value="Asia/Riyadh">Asia/Riyadh (Saudi Arabia)</option>
                  <option value="Asia/Kuwait">Asia/Kuwait</option>
                  <option value="Asia/Qatar">Asia/Qatar</option>
                </select>
              </div>
            </div>
          </Card>

          {/* Bounce Handling */}
          <Card className="p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Bounce Handling</h2>
            <div className="space-y-4">
              <div className="flex items-center">
                <input
                  type="checkbox"
                  checked={config.bounce_handling.auto_retry_soft_bounces}
                  onChange={(e) => updateConfig('bounce_handling', 'auto_retry_soft_bounces', e.target.checked)}
                  className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                />
                <label className="ml-2 block text-sm text-gray-900">
                  Auto-retry soft bounces
                </label>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Max Retry Attempts
                </label>
                <Input
                  type="number"
                  value={config.bounce_handling.max_retry_attempts}
                  onChange={(e) => updateConfig('bounce_handling', 'max_retry_attempts', parseInt(e.target.value))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Bounce Notification Emails
                </label>
                <div className="space-y-2">
                  {config.bounce_handling.bounce_notification_emails.map((email, index) => (
                    <div key={index} className="flex items-center space-x-2">
                      <Input value={email} readOnly />
                      <Button
                        onClick={() => removeBounceNotificationEmail(index)}
                        variant="outline"
                        size="sm"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  ))}
                  <Button onClick={addBounceNotificationEmail} variant="outline" size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Email
                  </Button>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Connections Tab */}
      {activeTab === 'connections' && (
        <div className="space-y-6">
          <div className="flex justify-between items-center">
            <h2 className="text-lg font-semibold text-gray-900">Gmail Connections</h2>
            <Button onClick={connectGmail}>
              <Plus className="h-4 w-4 mr-2" />
              Connect Gmail Account
            </Button>
          </div>

          {/* Gmail Setup Instructions */}
          <Card className="p-6 border-blue-200 bg-blue-50">
            <div className="flex items-start">
              <Settings className="h-6 w-6 text-blue-600 mt-1 mr-3" />
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-blue-900 mb-3">Gmail OAuth Setup Instructions</h3>
                <div className="space-y-4 text-sm text-blue-800">
                  <div>
                    <h4 className="font-medium mb-2">1. Create Google Cloud Project</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Go to <a href="https://console.cloud.google.com/" target="_blank" rel="noopener noreferrer" className="underline hover:text-blue-600">Google Cloud Console</a></li>
                      <li>Create a new project or select existing one</li>
                      <li>Enable the Gmail API in the APIs & Services section</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">2. Configure OAuth Consent Screen</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Go to APIs & Services → OAuth consent screen</li>
                      <li>Choose "External" user type for production or "Internal" for organization use</li>
                      <li>Fill in application name: "Debt Management System"</li>
                      <li>Add authorized domains if required</li>
                      <li>Add scopes: Gmail read, send, and modify permissions</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">3. Create OAuth 2.0 Credentials</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Go to APIs & Services → Credentials</li>
                      <li>Click "Create Credentials" → "OAuth 2.0 Client IDs"</li>
                      <li>Application type: "Web application"</li>
                      <li>Add authorized redirect URI: <code className="bg-blue-100 px-1 rounded">https://your-domain.com/api/auth/gmail/callback</code></li>
                      <li>Copy the Client ID and Client Secret to the form above</li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="font-medium mb-2">4. Required OAuth Scopes</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li><code className="bg-blue-100 px-1 rounded">https://www.googleapis.com/auth/gmail.readonly</code> - Read emails</li>
                      <li><code className="bg-blue-100 px-1 rounded">https://www.googleapis.com/auth/gmail.send</code> - Send emails</li>
                      <li><code className="bg-blue-100 px-1 rounded">https://www.googleapis.com/auth/gmail.modify</code> - Mark as read/unread</li>
                      <li><code className="bg-blue-100 px-1 rounded">https://www.googleapis.com/auth/userinfo.email</code> - User email address</li>
                    </ul>
                  </div>

                  <div className="bg-blue-100 p-3 rounded border border-blue-200">
                    <h4 className="font-medium mb-2">🔒 Security Notes</h4>
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Store Client Secret securely - never expose in frontend code</li>
                      <li>Use HTTPS for all OAuth redirect URIs in production</li>
                      <li>Regularly rotate OAuth credentials for enhanced security</li>
                      <li>Monitor API usage in Google Cloud Console</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          {connections.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {connections.map((connection, index) => (
                <Card key={index} className="p-6">
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="text-lg font-medium text-gray-900">{connection.email}</h3>
                      <div className="mt-2 space-y-1 text-sm text-gray-600">
                        <p>Connected: {formatDate(connection.connected_at)}</p>
                        <p>Last Updated: {formatDate(connection.last_updated)}</p>
                        <p>Expires: {formatDate(connection.expires_at)}</p>
                        <p>Scopes: {connection.scopes.length} permissions</p>
                      </div>
                    </div>
                    <div className="flex items-center">
                      {connection.status === 'active' ? (
                        <CheckCircle className="h-5 w-5 text-green-500" />
                      ) : (
                        <AlertTriangle className="h-5 w-5 text-red-500" />
                      )}
                      <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${
                        connection.status === 'active'
                          ? 'bg-green-100 text-green-800'
                          : 'bg-red-100 text-red-800'
                      }`}>
                        {connection.status}
                      </span>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="p-12 text-center">
              <Mail className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No Gmail Connections</h3>
              <p className="text-gray-600 mb-4">Connect a Gmail account to start sending and receiving emails.</p>
              <Button onClick={connectGmail}>
                <Plus className="h-4 w-4 mr-2" />
                Connect Gmail Account
              </Button>
            </Card>
          )}
        </div>
      )}

      {/* Analytics Tab */}
      {activeTab === 'analytics' && analytics && (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <Card className="p-6">
            <div className="flex items-center">
              <Activity className="h-8 w-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total Emails</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.total_emails}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <Mail className="h-8 w-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Sent</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.sent_emails}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <CheckCircle className="h-8 w-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Delivered</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.delivery_stats.delivered}</p>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-center">
              <AlertTriangle className="h-8 w-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Bounced</p>
                <p className="text-2xl font-bold text-gray-900">{analytics.delivery_stats.bounced}</p>
              </div>
            </div>
          </Card>
        </div>
      )}
    </div>
  )
}