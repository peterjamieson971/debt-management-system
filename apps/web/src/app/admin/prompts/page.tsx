'use client'

import { useState, useEffect } from 'react'
import { Card } from '@/components/ui/Card'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import {
  FileText,
  Plus,
  Edit,
  Trash2,
  Save,
  RefreshCw,
  Play,
  Copy,
  Eye,
  Filter,
  Search,
  Globe,
  Mail,
  MessageSquare,
  AlertTriangle
} from 'lucide-react'

interface PromptTemplate {
  id: string
  key: string
  name: string
  category: string
  template_type: string
  language: string
  subject_template?: string
  content_template: string
  variables: Array<{
    name: string
    description: string
    type: string
    required: boolean
    default_value?: any
  }>
  tone: string
  compliance_notes?: string
  cultural_context?: {
    region?: string
    business_hours?: boolean
    cultural_sensitivity?: string[]
  }
  is_active: boolean
  is_default: boolean
  created_at: string
  updated_at: string
  usage_stats?: {
    total_uses: number
    last_used: string | null
    success_rate: number
  }
}

interface TemplateCategory {
  value: string
  label: string
  description: string
}

const categories: TemplateCategory[] = [
  { value: 'initial_notice', label: 'Initial Notice', description: 'First communication to debtor' },
  { value: 'reminder', label: 'Payment Reminder', description: 'Follow-up reminders' },
  { value: 'escalation', label: 'Escalation Notice', description: 'More urgent communication' },
  { value: 'payment_plan', label: 'Payment Plan', description: 'Payment plan options' },
  { value: 'final_notice', label: 'Final Notice', description: 'Last warning before legal action' },
  { value: 'negotiation', label: 'Negotiation', description: 'Settlement communications' },
  { value: 'legal', label: 'Legal Notice', description: 'Legal action notices' },
  { value: 'custom', label: 'Custom', description: 'Custom templates' }
]

export default function PromptsManagementPage() {
  const [templates, setTemplates] = useState<PromptTemplate[]>([])
  const [filteredTemplates, setFilteredTemplates] = useState<PromptTemplate[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCategory, setSelectedCategory] = useState('')
  const [selectedLanguage, setSelectedLanguage] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [showActiveOnly, setShowActiveOnly] = useState(true)
  const [editingTemplate, setEditingTemplate] = useState<PromptTemplate | null>(null)
  const [testingTemplate, setTestingTemplate] = useState<PromptTemplate | null>(null)
  const [testData, setTestData] = useState<Record<string, string>>({})

  // Mock organization ID
  const organizationId = '550e8400-e29b-41d4-a716-446655440000'

  useEffect(() => {
    fetchTemplates()
  }, [])

  useEffect(() => {
    filterTemplates()
  }, [templates, searchTerm, selectedCategory, selectedLanguage, selectedType, showActiveOnly])

  const fetchTemplates = async () => {
    try {
      setLoading(true)

      const params = new URLSearchParams({
        organization_id: organizationId,
        ...(selectedCategory && { category: selectedCategory }),
        ...(selectedType && { template_type: selectedType }),
        ...(selectedLanguage && { language: selectedLanguage }),
        ...(showActiveOnly && { is_active: 'true' })
      })

      const response = await fetch(`/api/admin/prompts?${params}`, {
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })

      if (response.ok) {
        const data = await response.json()
        setTemplates(data.templates || [])
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error)
    } finally {
      setLoading(false)
    }
  }

  const filterTemplates = () => {
    let filtered = templates

    if (searchTerm) {
      filtered = filtered.filter(template =>
        template.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        template.content_template.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }

    if (selectedCategory) {
      filtered = filtered.filter(template => template.category === selectedCategory)
    }

    if (selectedLanguage) {
      filtered = filtered.filter(template => template.language === selectedLanguage)
    }

    if (selectedType) {
      filtered = filtered.filter(template => template.template_type === selectedType)
    }

    if (showActiveOnly) {
      filtered = filtered.filter(template => template.is_active)
    }

    setFilteredTemplates(filtered)
  }

  const createTemplate = () => {
    const newTemplate: PromptTemplate = {
      id: '',
      key: '',
      name: '',
      category: 'custom',
      template_type: 'email',
      language: 'en',
      subject_template: '',
      content_template: '',
      variables: [],
      tone: 'professional',
      is_active: true,
      is_default: false,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
    setEditingTemplate(newTemplate)
  }

  const editTemplate = (template: PromptTemplate) => {
    setEditingTemplate({ ...template })
  }

  const saveTemplate = async () => {
    if (!editingTemplate) return

    try {
      const isNew = !editingTemplate.id
      const url = isNew ? '/api/admin/prompts' : `/api/admin/prompts/${editingTemplate.id}`
      const method = isNew ? 'POST' : 'PUT'

      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          organization_id: organizationId,
          ...editingTemplate
        })
      })

      if (response.ok) {
        setEditingTemplate(null)
        fetchTemplates()
      } else {
        alert('Failed to save template')
      }
    } catch (error) {
      console.error('Failed to save template:', error)
      alert('Failed to save template')
    }
  }

  const deleteTemplate = async (template: PromptTemplate) => {
    if (!confirm(`Are you sure you want to delete "${template.name}"?`)) return

    try {
      const response = await fetch(`/api/admin/prompts/${template.id}`, {
        method: 'DELETE',
        headers: {
          'Authorization': 'Bearer mock-token'
        }
      })

      if (response.ok) {
        fetchTemplates()
      } else {
        alert('Failed to delete template')
      }
    } catch (error) {
      console.error('Failed to delete template:', error)
      alert('Failed to delete template')
    }
  }

  const testTemplate = async () => {
    if (!testingTemplate) return

    try {
      const response = await fetch(`/api/admin/prompts/${testingTemplate.id}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer mock-token'
        },
        body: JSON.stringify({
          test_data: testData,
          output_format: 'preview'
        })
      })

      if (response.ok) {
        const result = await response.json()
        alert(`Preview:\nSubject: ${result.rendered.subject}\n\nContent:\n${result.rendered.content}`)
      } else {
        alert('Failed to test template')
      }
    } catch (error) {
      console.error('Failed to test template:', error)
      alert('Failed to test template')
    }
  }

  const duplicateTemplate = (template: PromptTemplate) => {
    const duplicated = {
      ...template,
      id: '',
      key: '',
      name: `${template.name} (Copy)`,
      is_default: false
    }
    setEditingTemplate(duplicated)
  }

  const addVariable = () => {
    if (!editingTemplate) return

    const newVariable = {
      name: '',
      description: '',
      type: 'string',
      required: true
    }

    setEditingTemplate({
      ...editingTemplate,
      variables: [...editingTemplate.variables, newVariable]
    })
  }

  const updateVariable = (index: number, field: string, value: any) => {
    if (!editingTemplate) return

    const variables = [...editingTemplate.variables]
    variables[index] = { ...variables[index], [field]: value }

    setEditingTemplate({
      ...editingTemplate,
      variables
    })
  }

  const removeVariable = (index: number) => {
    if (!editingTemplate) return

    const variables = [...editingTemplate.variables]
    variables.splice(index, 1)

    setEditingTemplate({
      ...editingTemplate,
      variables
    })
  }

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="h-4 w-4" />
      case 'sms':
        return <MessageSquare className="h-4 w-4" />
      case 'letter':
        return <FileText className="h-4 w-4" />
      default:
        return <FileText className="h-4 w-4" />
    }
  }

  const getLanguageIcon = (language: string) => {
    return <Globe className="h-4 w-4" />
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/4 mb-6"></div>
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {[...Array(6)].map((_, i) => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900">Prompt Templates</h1>
        <div className="flex space-x-3">
          <Button onClick={fetchTemplates} variant="outline">
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </Button>
          <Button onClick={createTemplate}>
            <Plus className="h-4 w-4 mr-2" />
            New Template
          </Button>
        </div>
      </div>

      {/* Filters */}
      <Card className="p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="h-4 w-4 absolute left-3 top-3 text-gray-400" />
              <Input
                placeholder="Search templates..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
            <select
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {categories.map((category) => (
                <option key={category.value} value={category.value}>
                  {category.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Types</option>
              <option value="email">Email</option>
              <option value="sms">SMS</option>
              <option value="letter">Letter</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
            >
              <option value="">All Languages</option>
              <option value="en">English</option>
              <option value="ar">Arabic</option>
            </select>
          </div>

          <div className="flex items-end">
            <label className="flex items-center">
              <input
                type="checkbox"
                checked={showActiveOnly}
                onChange={(e) => setShowActiveOnly(e.target.checked)}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
              />
              <span className="ml-2 text-sm text-gray-900">Active only</span>
            </label>
          </div>
        </div>
      </Card>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredTemplates.map((template) => (
          <Card key={template.id} className="p-6 hover:shadow-lg transition-shadow">
            <div className="flex justify-between items-start mb-4">
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{template.name}</h3>
                <div className="flex items-center space-x-2 mt-1">
                  {getTypeIcon(template.template_type)}
                  <span className="text-sm text-gray-600">{template.template_type}</span>
                  {getLanguageIcon(template.language)}
                  <span className="text-sm text-gray-600">{template.language.toUpperCase()}</span>
                </div>
              </div>
              <div className="flex items-center space-x-1">
                {template.is_default && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                    Default
                  </span>
                )}
                {!template.is_active && (
                  <span className="px-2 py-1 bg-gray-100 text-gray-800 text-xs rounded-full">
                    Inactive
                  </span>
                )}
              </div>
            </div>

            <div className="space-y-2 mb-4">
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Category:</span>
                <span className="font-medium">
                  {categories.find(c => c.value === template.category)?.label || template.category}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Tone:</span>
                <span className="font-medium">{template.tone}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-gray-600">Variables:</span>
                <span className="font-medium">{template.variables.length}</span>
              </div>
              {template.usage_stats && (
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Uses:</span>
                  <span className="font-medium">{template.usage_stats.total_uses}</span>
                </div>
              )}
            </div>

            <div className="text-sm text-gray-600 mb-4 line-clamp-3">
              {template.content_template.substring(0, 150)}...
            </div>

            <div className="flex justify-between">
              <div className="flex space-x-2">
                <Button
                  onClick={() => editTemplate(template)}
                  variant="outline"
                  size="sm"
                >
                  <Edit className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => duplicateTemplate(template)}
                  variant="outline"
                  size="sm"
                >
                  <Copy className="h-4 w-4" />
                </Button>
                <Button
                  onClick={() => {
                    setTestingTemplate(template)
                    setTestData(template.variables.reduce((acc, variable) => ({
                      ...acc,
                      [variable.name]: variable.default_value || ''
                    }), {}))
                  }}
                  variant="outline"
                  size="sm"
                >
                  <Play className="h-4 w-4" />
                </Button>
              </div>
              <Button
                onClick={() => deleteTemplate(template)}
                variant="outline"
                size="sm"
                className="text-red-600 hover:text-red-700"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </Card>
        ))}
      </div>

      {filteredTemplates.length === 0 && (
        <Card className="p-12 text-center">
          <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">No templates found</h3>
          <p className="text-gray-600 mb-4">
            {searchTerm || selectedCategory || selectedLanguage || selectedType
              ? 'Try adjusting your filters or search term.'
              : 'Create your first prompt template to get started.'}
          </p>
          <Button onClick={createTemplate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        </Card>
      )}

      {/* Edit Template Modal */}
      {editingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-4xl max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingTemplate.id ? 'Edit Template' : 'Create Template'}
              </h2>
              <Button
                onClick={() => setEditingTemplate(null)}
                variant="outline"
                size="sm"
              >
                Cancel
              </Button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Basic Info */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <Input
                    value={editingTemplate.name}
                    onChange={(e) => setEditingTemplate({...editingTemplate, name: e.target.value})}
                    placeholder="Template name"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <select
                      value={editingTemplate.category}
                      onChange={(e) => setEditingTemplate({...editingTemplate, category: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      {categories.map((category) => (
                        <option key={category.value} value={category.value}>
                          {category.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={editingTemplate.template_type}
                      onChange={(e) => setEditingTemplate({...editingTemplate, template_type: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="email">Email</option>
                      <option value="sms">SMS</option>
                      <option value="letter">Letter</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Language</label>
                    <select
                      value={editingTemplate.language}
                      onChange={(e) => setEditingTemplate({...editingTemplate, language: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="en">English</option>
                      <option value="ar">Arabic</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Tone</label>
                    <select
                      value={editingTemplate.tone}
                      onChange={(e) => setEditingTemplate({...editingTemplate, tone: e.target.value})}
                      className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                    >
                      <option value="professional">Professional</option>
                      <option value="firm">Firm</option>
                      <option value="urgent">Urgent</option>
                      <option value="diplomatic">Diplomatic</option>
                      <option value="friendly">Friendly</option>
                    </select>
                  </div>
                </div>

                <div className="flex space-x-4">
                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editingTemplate.is_active}
                      onChange={(e) => setEditingTemplate({...editingTemplate, is_active: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-900">Active</span>
                  </label>

                  <label className="flex items-center">
                    <input
                      type="checkbox"
                      checked={editingTemplate.is_default}
                      onChange={(e) => setEditingTemplate({...editingTemplate, is_default: e.target.checked})}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                    />
                    <span className="ml-2 text-sm text-gray-900">Default template</span>
                  </label>
                </div>
              </div>

              {/* Variables */}
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-medium text-gray-900">Variables</h3>
                  <Button onClick={addVariable} size="sm">
                    <Plus className="h-4 w-4 mr-2" />
                    Add Variable
                  </Button>
                </div>

                <div className="space-y-3 max-h-64 overflow-y-auto">
                  {editingTemplate.variables.map((variable, index) => (
                    <div key={index} className="border border-gray-200 rounded-lg p-3">
                      <div className="grid grid-cols-2 gap-2 mb-2">
                        <Input
                          placeholder="Variable name"
                          value={variable.name}
                          onChange={(e) => updateVariable(index, 'name', e.target.value)}
                        />
                        <select
                          value={variable.type}
                          onChange={(e) => updateVariable(index, 'type', e.target.value)}
                          className="rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                        >
                          <option value="string">String</option>
                          <option value="number">Number</option>
                          <option value="date">Date</option>
                          <option value="currency">Currency</option>
                          <option value="boolean">Boolean</option>
                        </select>
                      </div>
                      <Input
                        placeholder="Description"
                        value={variable.description}
                        onChange={(e) => updateVariable(index, 'description', e.target.value)}
                        className="mb-2"
                      />
                      <div className="flex justify-between items-center">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            checked={variable.required}
                            onChange={(e) => updateVariable(index, 'required', e.target.checked)}
                            className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                          />
                          <span className="ml-2 text-sm text-gray-900">Required</span>
                        </label>
                        <Button
                          onClick={() => removeVariable(index)}
                          variant="outline"
                          size="sm"
                          className="text-red-600"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Content */}
            <div className="mt-6 space-y-4">
              {editingTemplate.template_type === 'email' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Subject Template</label>
                  <Input
                    value={editingTemplate.subject_template || ''}
                    onChange={(e) => setEditingTemplate({...editingTemplate, subject_template: e.target.value})}
                    placeholder="Email subject with {{variables}}"
                  />
                </div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Content Template</label>
                <textarea
                  value={editingTemplate.content_template}
                  onChange={(e) => setEditingTemplate({...editingTemplate, content_template: e.target.value})}
                  rows={10}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Template content with {{variables}}"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Compliance Notes</label>
                <textarea
                  value={editingTemplate.compliance_notes || ''}
                  onChange={(e) => setEditingTemplate({...editingTemplate, compliance_notes: e.target.value})}
                  rows={3}
                  className="mt-1 block w-full rounded-md border-gray-300 shadow-sm focus:border-blue-500 focus:ring-blue-500"
                  placeholder="Legal compliance considerations"
                />
              </div>
            </div>

            <div className="flex justify-end space-x-3 mt-6">
              <Button
                onClick={() => setEditingTemplate(null)}
                variant="outline"
              >
                Cancel
              </Button>
              <Button onClick={saveTemplate}>
                <Save className="h-4 w-4 mr-2" />
                Save Template
              </Button>
            </div>
          </div>
        </div>
      )}

      {/* Test Template Modal */}
      {testingTemplate && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl">
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Test Template</h2>
              <Button
                onClick={() => setTestingTemplate(null)}
                variant="outline"
                size="sm"
              >
                Close
              </Button>
            </div>

            <div className="space-y-4">
              <div>
                <h3 className="text-lg font-medium text-gray-900 mb-4">{testingTemplate.name}</h3>
                <p className="text-sm text-gray-600 mb-4">
                  Enter test values for the template variables:
                </p>
              </div>

              {testingTemplate.variables.map((variable) => (
                <div key={variable.name}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {variable.name} ({variable.type})
                    {variable.required && <span className="text-red-500">*</span>}
                  </label>
                  <Input
                    value={testData[variable.name] || ''}
                    onChange={(e) => setTestData({...testData, [variable.name]: e.target.value})}
                    placeholder={variable.description}
                  />
                </div>
              ))}

              <div className="flex justify-end space-x-3 pt-4">
                <Button
                  onClick={() => setTestingTemplate(null)}
                  variant="outline"
                >
                  Cancel
                </Button>
                <Button onClick={testTemplate}>
                  <Play className="h-4 w-4 mr-2" />
                  Test Template
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}