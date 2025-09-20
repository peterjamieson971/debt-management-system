'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  Key,
  Eye,
  EyeOff,
  Save,
  RefreshCw,
  AlertTriangle,
  CheckCircle,
  Plus,
  Trash2,
  Copy,
  ExternalLink
} from 'lucide-react'

interface EnvironmentVariable {
  id: string
  key: string
  value: string
  category: 'database' | 'ai' | 'email' | 'auth' | 'webhooks' | 'general'
  description: string
  is_sensitive: boolean
  required: boolean
  last_updated: string
}

interface EnvironmentConfig {
  variables: EnvironmentVariable[]
  validation_status: {
    database_connected: boolean
    ai_models_accessible: boolean
    email_service_configured: boolean
    webhook_endpoints_valid: boolean
  }
}

export default function EnvironmentConfigurationPage() {
  const [config, setConfig] = useState<EnvironmentConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showSensitive, setShowSensitive] = useState<Record<string, boolean>>({})
  const [activeCategory, setActiveCategory] = useState<string>('all')
  const [searchTerm, setSearchTerm] = useState('')
  const [isEditing, setIsEditing] = useState(false)
  const [newVariable, setNewVariable] = useState({
    key: '',
    value: '',
    category: 'general' as const,
    description: '',
    is_sensitive: false,
    required: false
  })

  // Mock organization ID - in production, get from auth context
  const organizationId = '550e8400-e29b-41d4-a716-446655440000'

  useEffect(() => {
    fetchEnvironmentConfig()
  }, [])

  const fetchEnvironmentConfig = async () => {
    try {
      setLoading(true)

      const response = await fetch(`/api/admin/environment?organization_id=${organizationId}`, {
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setConfig(data)
      } else {
        // Set default config with common environment variables
        setConfig({
          variables: [
            {
              id: '1',
              key: 'SUPABASE_URL',
              value: 'https://xxx.supabase.co',
              category: 'database',
              description: 'Supabase project URL',
              is_sensitive: false,
              required: true,
              last_updated: new Date().toISOString()
            },
            {
              id: '2',
              key: 'SUPABASE_ANON_KEY',
              value: 'eyJ0eXAiOiJKV1QiLCJhbGciOiJIUzI1NiJ9...',
              category: 'database',
              description: 'Supabase anonymous key for client connections',
              is_sensitive: true,
              required: true,
              last_updated: new Date().toISOString()
            },
            {
              id: '3',
              key: 'OPENAI_API_KEY',
              value: 'sk-...',
              category: 'ai',
              description: 'OpenAI API key for GPT models',
              is_sensitive: true,
              required: true,
              last_updated: new Date().toISOString()
            },
            {
              id: '4',
              key: 'GOOGLE_AI_API_KEY',
              value: 'AIza...',
              category: 'ai',
              description: 'Google AI API key for Gemini models',
              is_sensitive: true,
              required: false,
              last_updated: new Date().toISOString()
            },
            {
              id: '5',
              key: 'GMAIL_CLIENT_ID',
              value: '123456789-abc.apps.googleusercontent.com',
              category: 'email',
              description: 'Gmail OAuth client ID',
              is_sensitive: false,
              required: true,
              last_updated: new Date().toISOString()
            },
            {
              id: '6',
              key: 'GMAIL_CLIENT_SECRET',
              value: 'GOCSPX-...',
              category: 'email',
              description: 'Gmail OAuth client secret',
              is_sensitive: true,
              required: true,
              last_updated: new Date().toISOString()
            },
            {
              id: '7',
              key: 'JWT_SECRET',
              value: 'your-super-secret-jwt-key-here',
              category: 'auth',
              description: 'Secret key for JWT token signing',
              is_sensitive: true,
              required: true,
              last_updated: new Date().toISOString()
            },
            {
              id: '8',
              key: 'ZAPIER_WEBHOOK_SECRET',
              value: 'webhook-secret-key',
              category: 'webhooks',
              description: 'Secret for validating Zapier webhook signatures',
              is_sensitive: true,
              required: false,
              last_updated: new Date().toISOString()
            }
          ],
          validation_status: {
            database_connected: true,
            ai_models_accessible: true,
            email_service_configured: false,
            webhook_endpoints_valid: true
          }
        })
      }
    } catch (error) {
      console.error('Failed to fetch environment config:', error)
    } finally {
      setLoading(false)
    }
  }

  const saveConfig = async () => {
    if (!config) return

    try {
      setSaving(true)

      const response = await fetch('/api/admin/environment', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          organization_id: organizationId,
          variables: config.variables
        })
      })

      if (response.ok) {
        alert('Environment configuration saved successfully!')
        setIsEditing(false)
      } else {
        throw new Error('Failed to save configuration')
      }
    } catch (error) {
      console.error('Failed to save environment config:', error)
      alert('Failed to save configuration. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const toggleSensitiveVisibility = (id: string) => {
    setShowSensitive(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const updateVariable = (id: string, field: keyof EnvironmentVariable, value: any) => {
    if (!config) return

    setConfig({
      ...config,
      variables: config.variables.map(variable =>
        variable.id === id
          ? { ...variable, [field]: value, last_updated: new Date().toISOString() }
          : variable
      )
    })
  }

  const addVariable = () => {
    if (!config || !newVariable.key.trim()) return

    const newVar: EnvironmentVariable = {
      id: Date.now().toString(),
      ...newVariable,
      last_updated: new Date().toISOString()
    }

    setConfig({
      ...config,
      variables: [...config.variables, newVar]
    })

    setNewVariable({
      key: '',
      value: '',
      category: 'general',
      description: '',
      is_sensitive: false,
      required: false
    })
  }

  const removeVariable = (id: string) => {
    if (!config) return

    if (confirm('Are you sure you want to remove this environment variable?')) {
      setConfig({
        ...config,
        variables: config.variables.filter(variable => variable.id !== id)
      })
    }
  }

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
    // In a real app, show a toast notification here
  }

  const categories = [
    { id: 'all', name: 'All Variables', count: config?.variables.length || 0 },
    { id: 'database', name: 'Database', count: config?.variables.filter(v => v.category === 'database').length || 0 },
    { id: 'ai', name: 'AI Services', count: config?.variables.filter(v => v.category === 'ai').length || 0 },
    { id: 'email', name: 'Email', count: config?.variables.filter(v => v.category === 'email').length || 0 },
    { id: 'auth', name: 'Authentication', count: config?.variables.filter(v => v.category === 'auth').length || 0 },
    { id: 'webhooks', name: 'Webhooks', count: config?.variables.filter(v => v.category === 'webhooks').length || 0 },
    { id: 'general', name: 'General', count: config?.variables.filter(v => v.category === 'general').length || 0 }
  ]

  const filteredVariables = config?.variables.filter(variable => {
    const matchesCategory = activeCategory === 'all' || variable.category === activeCategory
    const matchesSearch = variable.key.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         variable.description.toLowerCase().includes(searchTerm.toLowerCase())
    return matchesCategory && matchesSearch
  }) || []

  const getValidationIcon = (status: boolean) => {
    return status ? (
      <CheckCircle className="h-5 w-5 text-green-500" />
    ) : (
      <AlertTriangle className="h-5 w-5 text-red-500" />
    )
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="h-64 bg-gray-200 rounded-lg"></div>
            <div className="h-64 bg-gray-200 rounded-lg lg:col-span-2"></div>
          </div>
        </div>
      </div>
    )
  }

  if (!config) {
    return (
      <div className="text-center py-12">
        <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
        <h2 className="text-lg font-medium text-gray-900 mb-2">Failed to load environment configuration</h2>
        <Button onClick={fetchEnvironmentConfig}>
          <RefreshCw className="h-4 w-4 mr-2" />
          Retry
        </Button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Environment Configuration</h1>
        <div className="flex space-x-3">
          <Button onClick={fetchEnvironmentConfig} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button
            onClick={() => setIsEditing(!isEditing)}
            variant={isEditing ? "outline" : "default"}
          >
            {isEditing ? 'Cancel' : 'Edit'}
          </Button>
          {isEditing && (
            <Button onClick={saveConfig} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          )}
        </div>
      </div>

      {/* Validation Status */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">System Validation</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="flex items-center space-x-3">
            {getValidationIcon(config.validation_status.database_connected)}
            <span className="text-sm text-gray-700">Database Connection</span>
          </div>
          <div className="flex items-center space-x-3">
            {getValidationIcon(config.validation_status.ai_models_accessible)}
            <span className="text-sm text-gray-700">AI Models</span>
          </div>
          <div className="flex items-center space-x-3">
            {getValidationIcon(config.validation_status.email_service_configured)}
            <span className="text-sm text-gray-700">Email Service</span>
          </div>
          <div className="flex items-center space-x-3">
            {getValidationIcon(config.validation_status.webhook_endpoints_valid)}
            <span className="text-sm text-gray-700">Webhook Endpoints</span>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Categories Sidebar */}
        <Card className="p-4 h-fit">
          <h3 className="font-medium text-gray-900 mb-3">Categories</h3>
          <div className="space-y-1">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setActiveCategory(category.id)}
                className={`w-full text-left px-3 py-2 rounded-md text-sm ${
                  activeCategory === category.id
                    ? 'bg-blue-100 text-blue-700'
                    : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                }`}
              >
                <div className="flex justify-between items-center">
                  <span>{category.name}</span>
                  <span className="text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                    {category.count}
                  </span>
                </div>
              </button>
            ))}
          </div>
        </Card>

        {/* Variables List */}
        <div className="lg:col-span-3 space-y-4">
          {/* Search and Add */}
          <div className="flex space-x-4">
            <Input
              placeholder="Search variables..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="flex-1"
            />
            {isEditing && (
              <Button onClick={() => {
                const key = prompt('Enter variable key:')
                if (key) {
                  setNewVariable({ ...newVariable, key })
                }
              }}>
                <Plus className="h-4 w-4 mr-2" />
                Add Variable
              </Button>
            )}
          </div>

          {/* Add New Variable Form */}
          {isEditing && newVariable.key && (
            <Card className="p-4 border-2 border-dashed border-gray-300">
              <h4 className="font-medium text-gray-900 mb-3">New Variable</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  placeholder="Variable key"
                  value={newVariable.key}
                  onChange={(e) => setNewVariable({ ...newVariable, key: e.target.value })}
                />
                <select
                  value={newVariable.category}
                  onChange={(e) => setNewVariable({ ...newVariable, category: e.target.value as any })}
                  className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                >
                  <option value="general">General</option>
                  <option value="database">Database</option>
                  <option value="ai">AI Services</option>
                  <option value="email">Email</option>
                  <option value="auth">Authentication</option>
                  <option value="webhooks">Webhooks</option>
                </select>
                <Input
                  placeholder="Value"
                  value={newVariable.value}
                  onChange={(e) => setNewVariable({ ...newVariable, value: e.target.value })}
                  type={newVariable.is_sensitive ? 'password' : 'text'}
                />
                <Input
                  placeholder="Description"
                  value={newVariable.description}
                  onChange={(e) => setNewVariable({ ...newVariable, description: e.target.value })}
                />
                <div className="flex items-center space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newVariable.is_sensitive}
                      onChange={(e) => setNewVariable({ ...newVariable, is_sensitive: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Sensitive</span>
                  </label>
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={newVariable.required}
                      onChange={(e) => setNewVariable({ ...newVariable, required: e.target.checked })}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-700">Required</span>
                  </label>
                </div>
                <div className="flex space-x-2">
                  <Button onClick={addVariable} size="sm">Add</Button>
                  <Button
                    onClick={() => setNewVariable({ key: '', value: '', category: 'general', description: '', is_sensitive: false, required: false })}
                    variant="outline"
                    size="sm"
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            </Card>
          )}

          {/* Variables */}
          <div className="space-y-3">
            {filteredVariables.map(variable => (
              <Card key={variable.id} className="p-4">
                <div className="flex justify-between items-start">
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <code className="text-sm font-mono bg-gray-100 px-2 py-1 rounded">
                        {variable.key}
                      </code>
                      {variable.required && (
                        <span className="text-xs bg-red-100 text-red-800 px-2 py-0.5 rounded-full">
                          Required
                        </span>
                      )}
                      {variable.is_sensitive && (
                        <span className="text-xs bg-yellow-100 text-yellow-800 px-2 py-0.5 rounded-full">
                          Sensitive
                        </span>
                      )}
                      <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded-full">
                        {variable.category}
                      </span>
                    </div>
                    <p className="text-sm text-gray-600 mb-3">{variable.description}</p>
                    <div className="flex items-center space-x-2">
                      {isEditing ? (
                        <Input
                          value={variable.value}
                          onChange={(e) => updateVariable(variable.id, 'value', e.target.value)}
                          type={variable.is_sensitive && !showSensitive[variable.id] ? 'password' : 'text'}
                          className="font-mono text-sm"
                        />
                      ) : (
                        <code className="text-sm bg-gray-50 px-3 py-2 rounded border flex-1">
                          {variable.is_sensitive && !showSensitive[variable.id]
                            ? '••••••••••••••••'
                            : variable.value
                          }
                        </code>
                      )}
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Last updated: {new Date(variable.last_updated).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex items-center space-x-2 ml-4">
                    {variable.is_sensitive && (
                      <Button
                        onClick={() => toggleSensitiveVisibility(variable.id)}
                        variant="outline"
                        size="sm"
                      >
                        {showSensitive[variable.id] ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </Button>
                    )}
                    <Button
                      onClick={() => copyToClipboard(variable.value)}
                      variant="outline"
                      size="sm"
                    >
                      <Copy className="h-4 w-4" />
                    </Button>
                    {isEditing && (
                      <Button
                        onClick={() => removeVariable(variable.id)}
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:text-red-700"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              </Card>
            ))}
          </div>

          {filteredVariables.length === 0 && (
            <div className="text-center py-12">
              <Key className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">No variables found</h3>
              <p className="text-gray-500">
                {searchTerm || activeCategory !== 'all'
                  ? 'Try adjusting your search or filter criteria.'
                  : 'Get started by adding your first environment variable.'
                }
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Help Section */}
      <Card className="p-6 bg-blue-50 border-blue-200">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-blue-600 mt-0.5" />
          <div>
            <h3 className="text-sm font-medium text-blue-900 mb-1">Security Notice</h3>
            <p className="text-sm text-blue-700 mb-2">
              Environment variables marked as "sensitive" contain confidential information.
              Always use secure methods to store and transmit these values.
            </p>
            <div className="flex space-x-4 text-sm">
              <a href="#" className="text-blue-600 hover:text-blue-700 flex items-center">
                <ExternalLink className="h-3 w-3 mr-1" />
                Security Best Practices
              </a>
              <a href="#" className="text-blue-600 hover:text-blue-700 flex items-center">
                <ExternalLink className="h-3 w-3 mr-1" />
                Environment Setup Guide
              </a>
            </div>
          </div>
        </div>
      </Card>
    </div>
  )
}