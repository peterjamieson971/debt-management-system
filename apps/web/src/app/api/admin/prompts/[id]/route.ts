import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { canManageSystemSettings } from '@/types/users'
import { z } from 'zod'

const updatePromptSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  subject_template: z.string().optional(),
  content_template: z.string().min(1).optional(),
  variables: z.array(z.object({
    name: z.string(),
    description: z.string(),
    type: z.enum(['string', 'number', 'date', 'currency', 'boolean']),
    required: z.boolean().default(true),
    default_value: z.any().optional()
  })).optional(),
  tone: z.enum(['professional', 'firm', 'urgent', 'diplomatic', 'friendly']).optional(),
  compliance_notes: z.string().optional(),
  cultural_context: z.object({
    region: z.string().optional(),
    business_hours: z.boolean().optional(),
    cultural_sensitivity: z.array(z.string()).optional()
  }).optional(),
  is_active: z.boolean().optional(),
  is_default: z.boolean().optional()
})

const testPromptSchema = z.object({
  test_data: z.record(z.string(), z.any()),
  output_format: z.enum(['preview', 'full']).default('preview')
})

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const supabase = await createServiceClient()

    const { data: template, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('id', params.id)
      .eq('category', 'prompts')
      .single()

    if (error || !template) {
      return NextResponse.json(
        { error: 'Prompt template not found' },
        { status: 404 }
      )
    }

    // Get usage statistics
    const { data: usageData } = await supabase
      .from('communication_logs')
      .select('status, created_at, metadata')
      .eq('organization_id', template.organization_id)
      .eq('ai_generated', true)
      .contains('metadata', { template_key: template.key })
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())

    const usageStats = {
      total_uses: usageData?.length || 0,
      last_used: usageData?.length > 0 ? Math.max(...usageData.map(u => new Date(u.created_at).getTime())) : null,
      success_rate: usageData?.length > 0
        ? Math.round((usageData.filter(u => u.status === 'sent' || u.status === 'delivered').length / usageData.length) * 100)
        : 0,
      daily_usage: calculateDailyUsage(usageData || [])
    }

    return NextResponse.json({
      template: {
        id: template.id,
        key: template.key,
        ...template.value,
        created_at: template.created_at,
        updated_at: template.updated_at
      },
      usage_stats: usageStats
    })

  } catch (error) {
    console.error('Prompt GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const updateData = updatePromptSchema.parse(body)

    const supabase = await createServiceClient()

    // Get current template
    const { data: currentTemplate, error: fetchError } = await supabase
      .from('system_settings')
      .select('*')
      .eq('id', params.id)
      .eq('category', 'prompts')
      .single()

    if (fetchError || !currentTemplate) {
      return NextResponse.json(
        { error: 'Prompt template not found' },
        { status: 404 }
      )
    }

    // Build updated template value
    const updatedValue = {
      ...currentTemplate.value,
      ...updateData,
      metadata: {
        ...currentTemplate.value.metadata,
        updated_by: 'system_admin', // TODO: Get from JWT
        version: incrementVersion(currentTemplate.value.metadata?.version || '1.0'),
        last_modified: new Date().toISOString()
      }
    }

    // Validate template if content changed
    if (updateData.content_template || updateData.variables) {
      const validationResult = validateTemplateVariables(
        updateData.content_template || currentTemplate.value.content_template,
        updateData.variables || currentTemplate.value.variables
      )

      if (!validationResult.valid) {
        return NextResponse.json(
          { error: 'Template validation failed', details: validationResult.errors },
          { status: 400 }
        )
      }
    }

    // If setting as default, unset other defaults
    if (updateData.is_default === true) {
      await unsetOtherDefaults(
        supabase,
        currentTemplate.organization_id,
        currentTemplate.value.category,
        currentTemplate.value.template_type,
        currentTemplate.value.language,
        currentTemplate.id
      )
    }

    // Update template
    const { data: updatedTemplate, error } = await supabase
      .from('system_settings')
      .update({
        value: updatedValue,
        updated_at: new Date().toISOString()
      })
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update prompt template:', error)
      return NextResponse.json(
        { error: 'Failed to update prompt template' },
        { status: 500 }
      )
    }

    // Log the update
    await supabase.from('analytics_events').insert({
      organization_id: currentTemplate.organization_id,
      event_type: 'prompt_template_updated',
      entity_type: 'prompt_template',
      entity_id: updatedTemplate.id,
      properties: {
        template_name: updatedValue.name,
        changes: Object.keys(updateData),
        new_version: updatedValue.metadata.version,
        updated_by: 'system_admin'
      }
    })

    return NextResponse.json({
      template: {
        id: updatedTemplate.id,
        key: updatedTemplate.key,
        ...updatedTemplate.value,
        created_at: updatedTemplate.created_at,
        updated_at: updatedTemplate.updated_at
      },
      updated: true
    })

  } catch (error) {
    console.error('Prompt PUT error:', error)

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

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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

    const supabase = await createServiceClient()

    // Get template details before deletion
    const { data: template, error: fetchError } = await supabase
      .from('system_settings')
      .select('*')
      .eq('id', params.id)
      .eq('category', 'prompts')
      .single()

    if (fetchError || !template) {
      return NextResponse.json(
        { error: 'Prompt template not found' },
        { status: 404 }
      )
    }

    // Check if template is in use
    const { data: usageCheck } = await supabase
      .from('communication_logs')
      .select('id')
      .eq('organization_id', template.organization_id)
      .contains('metadata', { template_key: template.key })
      .limit(1)

    if (usageCheck && usageCheck.length > 0) {
      // Don't delete if in use, just deactivate
      const { error: updateError } = await supabase
        .from('system_settings')
        .update({
          value: {
            ...template.value,
            is_active: false,
            metadata: {
              ...template.value.metadata,
              deactivated_by: 'system_admin',
              deactivated_at: new Date().toISOString()
            }
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', params.id)

      if (updateError) {
        console.error('Failed to deactivate template:', updateError)
        return NextResponse.json(
          { error: 'Failed to deactivate template' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        deactivated: true,
        message: 'Template has been deactivated instead of deleted because it is in use',
        template_id: params.id
      })
    }

    // Delete template if not in use
    const { error: deleteError } = await supabase
      .from('system_settings')
      .delete()
      .eq('id', params.id)

    if (deleteError) {
      console.error('Failed to delete template:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete template' },
        { status: 500 }
      )
    }

    // Log the deletion
    await supabase.from('analytics_events').insert({
      organization_id: template.organization_id,
      event_type: 'prompt_template_deleted',
      entity_type: 'prompt_template',
      entity_id: template.id,
      properties: {
        template_name: template.value.name,
        category: template.value.category,
        deleted_by: 'system_admin'
      }
    })

    return NextResponse.json({
      deleted: true,
      template_id: params.id
    })

  } catch (error) {
    console.error('Prompt DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// Test endpoint - POST to test a template with sample data
export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
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
    const { test_data, output_format } = testPromptSchema.parse(body)

    const supabase = await createServiceClient()

    const { data: template, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('id', params.id)
      .eq('category', 'prompts')
      .single()

    if (error || !template) {
      return NextResponse.json(
        { error: 'Prompt template not found' },
        { status: 404 }
      )
    }

    // Render template with test data
    const renderedResult = renderTemplate(template.value, test_data)

    return NextResponse.json({
      template_id: params.id,
      template_name: template.value.name,
      test_data,
      rendered: renderedResult,
      output_format
    })

  } catch (error) {
    console.error('Prompt test error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid test data', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function validateTemplateVariables(template: string, variables: any[]) {
  const errors = []
  const variableNames = variables.map(v => v.name)
  const placeholderRegex = /\{\{([^}]+)\}\}/g
  const templateVariables = []
  let match

  while ((match = placeholderRegex.exec(template)) !== null) {
    templateVariables.push(match[1].trim())
  }

  const undefinedVars = templateVariables.filter(v => !variableNames.includes(v))
  if (undefinedVars.length > 0) {
    errors.push(`Undefined variables: ${undefinedVars.join(', ')}`)
  }

  return {
    valid: errors.length === 0,
    errors,
    template_variables: templateVariables,
    defined_variables: variableNames
  }
}

async function unsetOtherDefaults(supabase: any, organizationId: string, category: string, templateType: string, language: string, excludeId: string) {
  const { data: templates } = await supabase
    .from('system_settings')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('category', 'prompts')
    .neq('id', excludeId)

  if (templates) {
    for (const template of templates) {
      const value = template.value
      if (value.category === category &&
          value.template_type === templateType &&
          value.language === language &&
          value.is_default) {

        await supabase
          .from('system_settings')
          .update({
            value: { ...value, is_default: false },
            updated_at: new Date().toISOString()
          })
          .eq('id', template.id)
      }
    }
  }
}

function incrementVersion(currentVersion: string): string {
  const parts = currentVersion.split('.')
  const minor = parseInt(parts[1] || '0') + 1
  return `${parts[0]}.${minor}`
}

function calculateDailyUsage(usageData: any[]) {
  const daily = {}

  usageData.forEach(usage => {
    const date = new Date(usage.created_at).toISOString().split('T')[0]
    daily[date] = (daily[date] || 0) + 1
  })

  return Object.entries(daily)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))
}

function renderTemplate(template: any, testData: any) {
  let renderedSubject = template.subject_template || ''
  let renderedContent = template.content_template

  // Replace variables in both subject and content
  template.variables.forEach(variable => {
    const placeholder = new RegExp(`\\{\\{${variable.name}\\}\\}`, 'g')
    const value = testData[variable.name] || variable.default_value || `[${variable.name}]`

    renderedSubject = renderedSubject.replace(placeholder, value)
    renderedContent = renderedContent.replace(placeholder, value)
  })

  return {
    subject: renderedSubject,
    content: renderedContent,
    variables_used: template.variables.map(v => ({
      name: v.name,
      value: testData[v.name] || v.default_value || '[NOT_PROVIDED]',
      type: v.type
    }))
  }
}