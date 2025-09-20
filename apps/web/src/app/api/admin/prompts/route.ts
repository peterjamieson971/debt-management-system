import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { canManageSystemSettings } from '@/types/users'
import { z } from 'zod'

const promptTemplateSchema = z.object({
  organization_id: z.string().uuid(),
  name: z.string().min(1).max(100),
  category: z.enum(['initial_notice', 'reminder', 'escalation', 'payment_plan', 'final_notice', 'negotiation', 'legal', 'custom']),
  template_type: z.enum(['email', 'sms', 'letter']),
  language: z.enum(['en', 'ar']).default('en'),
  subject_template: z.string().optional(),
  content_template: z.string().min(1),
  variables: z.array(z.object({
    name: z.string(),
    description: z.string(),
    type: z.enum(['string', 'number', 'date', 'currency', 'boolean']),
    required: z.boolean().default(true),
    default_value: z.any().optional()
  })).default([]),
  tone: z.enum(['professional', 'firm', 'urgent', 'diplomatic', 'friendly']).default('professional'),
  compliance_notes: z.string().optional(),
  cultural_context: z.object({
    region: z.string().optional(),
    business_hours: z.boolean().optional(),
    cultural_sensitivity: z.array(z.string()).optional()
  }).optional(),
  metadata: z.object({
    author: z.string().optional(),
    version: z.string().optional(),
    approved_by: z.string().optional(),
    approval_date: z.string().optional()
  }).optional(),
  is_active: z.boolean().default(true),
  is_default: z.boolean().default(false)
})

const queryPromptsSchema = z.object({
  organization_id: z.string().uuid(),
  category: z.string().optional(),
  template_type: z.string().optional(),
  language: z.string().optional(),
  is_active: z.string().optional(),
  search: z.string().optional()
})

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userRole = 'system_admin'

    if (!canManageSystemSettings(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams)
    const {
      organization_id,
      category,
      template_type,
      language,
      is_active,
      search
    } = queryPromptsSchema.parse(queryParams)

    const supabase = await createServiceClient()

    // Get prompt templates from system settings
    let query = supabase
      .from('system_settings')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('category', 'prompts')
      .order('key')

    const { data: promptSettings, error } = await query

    if (error) {
      console.error('Failed to fetch prompt templates:', error)
      return NextResponse.json(
        { error: 'Failed to fetch prompt templates' },
        { status: 500 }
      )
    }

    // Process and filter prompt templates
    let templates = promptSettings?.map(setting => {
      const template = setting.value
      return {
        id: setting.id,
        key: setting.key,
        ...template,
        created_at: setting.created_at,
        updated_at: setting.updated_at
      }
    }) || []

    // Apply filters
    if (category) {
      templates = templates.filter(t => t.category === category)
    }

    if (template_type) {
      templates = templates.filter(t => t.template_type === template_type)
    }

    if (language) {
      templates = templates.filter(t => t.language === language)
    }

    if (is_active !== undefined) {
      const activeFilter = is_active === 'true'
      templates = templates.filter(t => t.is_active === activeFilter)
    }

    if (search) {
      const searchLower = search.toLowerCase()
      templates = templates.filter(t =>
        t.name.toLowerCase().includes(searchLower) ||
        t.content_template.toLowerCase().includes(searchLower) ||
        (t.subject_template && t.subject_template.toLowerCase().includes(searchLower))
      )
    }

    // Get usage statistics for each template
    const templateStats = await getTemplateUsageStats(supabase, organization_id, templates.map(t => t.key))

    // Enrich templates with stats
    const enrichedTemplates = templates.map(template => ({
      ...template,
      usage_stats: templateStats[template.key] || {
        total_uses: 0,
        last_used: null,
        success_rate: 0
      }
    }))

    // Group by category for better organization
    const groupedTemplates = enrichedTemplates.reduce((acc, template) => {
      if (!acc[template.category]) {
        acc[template.category] = []
      }
      acc[template.category].push(template)
      return acc
    }, {})

    return NextResponse.json({
      templates: enrichedTemplates,
      grouped_templates: groupedTemplates,
      total_count: enrichedTemplates.length,
      categories: getAvailableCategories(),
      template_types: ['email', 'sms', 'letter'],
      languages: ['en', 'ar'],
      filters_applied: {
        organization_id,
        category,
        template_type,
        language,
        is_active,
        search
      }
    })

  } catch (error) {
    console.error('Prompts GET error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const userRole = 'system_admin'

    if (!canManageSystemSettings(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const templateData = promptTemplateSchema.parse(body)

    const supabase = await createServiceClient()

    // Generate unique key for the template
    const templateKey = `${templateData.category}_${templateData.template_type}_${templateData.language}_${Date.now()}`

    // If this is set as default, unset other defaults in the same category/type/language
    if (templateData.is_default) {
      await unsetOtherDefaults(supabase, templateData.organization_id, templateData.category, templateData.template_type, templateData.language)
    }

    // Validate template syntax
    const validationResult = validateTemplateVariables(templateData.content_template, templateData.variables)
    if (!validationResult.valid) {
      return NextResponse.json(
        { error: 'Template validation failed', details: validationResult.errors },
        { status: 400 }
      )
    }

    // Create template
    const { data: template, error } = await supabase
      .from('system_settings')
      .insert({
        organization_id: templateData.organization_id,
        category: 'prompts',
        key: templateKey,
        value: {
          name: templateData.name,
          category: templateData.category,
          template_type: templateData.template_type,
          language: templateData.language,
          subject_template: templateData.subject_template,
          content_template: templateData.content_template,
          variables: templateData.variables,
          tone: templateData.tone,
          compliance_notes: templateData.compliance_notes,
          cultural_context: templateData.cultural_context,
          metadata: {
            ...templateData.metadata,
            created_by: 'system_admin', // TODO: Get from JWT
            version: '1.0'
          },
          is_active: templateData.is_active,
          is_default: templateData.is_default
        },
        description: `Prompt template: ${templateData.name} (${templateData.category}/${templateData.template_type}/${templateData.language})`
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create prompt template:', error)
      return NextResponse.json(
        { error: 'Failed to create prompt template' },
        { status: 500 }
      )
    }

    // Log the creation
    await supabase.from('analytics_events').insert({
      organization_id: templateData.organization_id,
      event_type: 'prompt_template_created',
      entity_type: 'prompt_template',
      entity_id: template.id,
      properties: {
        template_name: templateData.name,
        category: templateData.category,
        template_type: templateData.template_type,
        language: templateData.language,
        is_default: templateData.is_default,
        created_by: 'system_admin'
      }
    })

    return NextResponse.json({
      template: {
        id: template.id,
        key: templateKey,
        ...template.value,
        created_at: template.created_at,
        updated_at: template.updated_at
      },
      created: true
    }, { status: 201 })

  } catch (error) {
    console.error('Prompts POST error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

async function getTemplateUsageStats(supabase: any, organizationId: string, templateKeys: string[]) {
  const stats = {}

  // Get communication logs that used these templates
  const { data: usageData } = await supabase
    .from('communication_logs')
    .select('metadata, status, created_at')
    .eq('organization_id', organizationId)
    .eq('ai_generated', true)
    .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString()) // Last 90 days

  if (usageData) {
    usageData.forEach(log => {
      const templateKey = log.metadata?.template_key
      if (templateKey && templateKeys.includes(templateKey)) {
        if (!stats[templateKey]) {
          stats[templateKey] = {
            total_uses: 0,
            last_used: null,
            success_rate: 0,
            successful_sends: 0
          }
        }

        stats[templateKey].total_uses++

        if (!stats[templateKey].last_used || new Date(log.created_at) > new Date(stats[templateKey].last_used)) {
          stats[templateKey].last_used = log.created_at
        }

        if (log.status === 'sent' || log.status === 'delivered') {
          stats[templateKey].successful_sends++
        }
      }
    })

    // Calculate success rates
    Object.values(stats).forEach((stat: any) => {
      stat.success_rate = stat.total_uses > 0
        ? Math.round((stat.successful_sends / stat.total_uses) * 100)
        : 0
    })
  }

  return stats
}

function validateTemplateVariables(template: string, variables: any[]) {
  const errors = []
  const variableNames = variables.map(v => v.name)

  // Find all variable placeholders in template
  const placeholderRegex = /\{\{([^}]+)\}\}/g
  const templateVariables = []
  let match

  while ((match = placeholderRegex.exec(template)) !== null) {
    templateVariables.push(match[1].trim())
  }

  // Check for undefined variables in template
  const undefinedVars = templateVariables.filter(v => !variableNames.includes(v))
  if (undefinedVars.length > 0) {
    errors.push(`Undefined variables in template: ${undefinedVars.join(', ')}`)
  }

  // Check for unused variable definitions
  const unusedVars = variableNames.filter(v => !templateVariables.includes(v))
  if (unusedVars.length > 0) {
    errors.push(`Unused variable definitions: ${unusedVars.join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    template_variables: templateVariables,
    defined_variables: variableNames
  }
}

async function unsetOtherDefaults(supabase: any, organizationId: string, category: string, templateType: string, language: string) {
  // Get all templates in the same category/type/language
  const { data: existingTemplates } = await supabase
    .from('system_settings')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('category', 'prompts')

  if (existingTemplates) {
    const updatesNeeded = existingTemplates
      .filter(template => {
        const value = template.value
        return value.category === category &&
               value.template_type === templateType &&
               value.language === language &&
               value.is_default === true
      })
      .map(template => ({
        ...template,
        value: {
          ...template.value,
          is_default: false
        }
      }))

    // Update all matching templates to not be default
    for (const template of updatesNeeded) {
      await supabase
        .from('system_settings')
        .update({
          value: template.value,
          updated_at: new Date().toISOString()
        })
        .eq('id', template.id)
    }
  }
}

function getAvailableCategories() {
  return [
    {
      value: 'initial_notice',
      label: 'Initial Notice',
      description: 'First communication to debtor about outstanding debt'
    },
    {
      value: 'reminder',
      label: 'Payment Reminder',
      description: 'Follow-up reminders for overdue payments'
    },
    {
      value: 'escalation',
      label: 'Escalation Notice',
      description: 'More urgent communication as debt ages'
    },
    {
      value: 'payment_plan',
      label: 'Payment Plan',
      description: 'Offering payment plan options to debtors'
    },
    {
      value: 'final_notice',
      label: 'Final Notice',
      description: 'Last warning before legal action'
    },
    {
      value: 'negotiation',
      label: 'Negotiation',
      description: 'Settlement and negotiation communications'
    },
    {
      value: 'legal',
      label: 'Legal Notice',
      description: 'Legal action and formal notices'
    },
    {
      value: 'custom',
      label: 'Custom',
      description: 'Custom templates for specific scenarios'
    }
  ]
}