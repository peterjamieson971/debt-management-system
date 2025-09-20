import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { canManageSystemSettings } from '@/types/users'
import { z } from 'zod'

const querySchema = z.object({
  organization_id: z.string().uuid()
})

interface SettingCategory {
  category: string
  display_name: string
  description: string
  icon: string
  settings_count: number
  is_encrypted: boolean
  last_updated: string
  available_keys: Array<{
    key: string
    description: string
    type: string
    default_value?: any
    required?: boolean
  }>
}

const CATEGORY_DEFINITIONS: Record<string, Omit<SettingCategory, 'settings_count' | 'is_encrypted' | 'last_updated'>> = {
  ai: {
    category: 'ai',
    display_name: 'AI Configuration',
    description: 'Settings for AI models, routing, and cost management',
    icon: 'brain',
    available_keys: [
      {
        key: 'model_routing_threshold',
        description: 'Token thresholds for routing between AI models',
        type: 'object',
        default_value: { simple_max_tokens: 1000, complex_min_tokens: 1001 },
        required: true
      },
      {
        key: 'openai_api_key',
        description: 'OpenAI API key for GPT models',
        type: 'string',
        required: false
      },
      {
        key: 'google_ai_api_key',
        description: 'Google AI API key for Gemini models',
        type: 'string',
        required: false
      },
      {
        key: 'cost_tracking_enabled',
        description: 'Enable AI cost tracking and analytics',
        type: 'boolean',
        default_value: true,
        required: false
      },
      {
        key: 'max_monthly_cost_usd',
        description: 'Maximum monthly AI spend limit in USD',
        type: 'number',
        default_value: 1000,
        required: false
      }
    ]
  },
  email: {
    category: 'email',
    display_name: 'Email Configuration',
    description: 'Settings for email sending, rate limits, and Gmail integration',
    icon: 'mail',
    available_keys: [
      {
        key: 'send_rate_limit',
        description: 'Rate limits for email sending to avoid spam detection',
        type: 'object',
        default_value: { emails_per_minute: 10, emails_per_hour: 100 },
        required: true
      },
      {
        key: 'gmail_client_id',
        description: 'Gmail OAuth client ID',
        type: 'string',
        required: false
      },
      {
        key: 'gmail_client_secret',
        description: 'Gmail OAuth client secret',
        type: 'string',
        required: false
      },
      {
        key: 'default_sender_name',
        description: 'Default sender name for outbound emails',
        type: 'string',
        default_value: 'Debt Collection Team',
        required: false
      },
      {
        key: 'bounce_handling_enabled',
        description: 'Enable automatic bounce detection and handling',
        type: 'boolean',
        default_value: true,
        required: false
      }
    ]
  },
  system: {
    category: 'system',
    display_name: 'System Settings',
    description: 'Core system configuration and feature flags',
    icon: 'settings',
    available_keys: [
      {
        key: 'timezone',
        description: 'Default timezone for the organization',
        type: 'string',
        default_value: 'Asia/Dubai',
        required: true
      },
      {
        key: 'date_format',
        description: 'Date format preference',
        type: 'string',
        default_value: 'DD/MM/YYYY',
        required: false
      },
      {
        key: 'currency_format',
        description: 'Currency display format',
        type: 'object',
        default_value: { symbol: 'AED', position: 'before' },
        required: false
      },
      {
        key: 'session_timeout_minutes',
        description: 'User session timeout in minutes',
        type: 'number',
        default_value: 480,
        required: false
      },
      {
        key: 'audit_logging_enabled',
        description: 'Enable detailed audit logging',
        type: 'boolean',
        default_value: true,
        required: false
      }
    ]
  },
  prompts: {
    category: 'prompts',
    display_name: 'AI Prompts',
    description: 'Custom AI prompt templates for different scenarios',
    icon: 'message-square',
    available_keys: [
      {
        key: 'initial_notice_template',
        description: 'Template for initial debt collection notices',
        type: 'string',
        required: false
      },
      {
        key: 'escalation_template',
        description: 'Template for escalation communications',
        type: 'string',
        required: false
      },
      {
        key: 'payment_reminder_template',
        description: 'Template for payment reminders',
        type: 'string',
        required: false
      },
      {
        key: 'negotiation_guidelines',
        description: 'AI guidelines for negotiation communications',
        type: 'string',
        required: false
      },
      {
        key: 'cultural_context_rules',
        description: 'Cultural context rules for GCC markets',
        type: 'object',
        default_value: {
          uae: { business_hours: '09:00-17:00', preferred_day: 'sunday-thursday' },
          saudi: { business_hours: '08:00-16:00', preferred_day: 'sunday-thursday' }
        },
        required: false
      }
    ]
  },
  compliance: {
    category: 'compliance',
    display_name: 'Compliance & Legal',
    description: 'Legal compliance settings for different regions',
    icon: 'shield',
    available_keys: [
      {
        key: 'default_region',
        description: 'Default GCC region for compliance rules',
        type: 'string',
        default_value: 'UAE',
        required: true
      },
      {
        key: 'data_retention_days',
        description: 'Data retention period in days',
        type: 'number',
        default_value: 2555, // 7 years
        required: true
      },
      {
        key: 'consent_required',
        description: 'Require explicit consent for communications',
        type: 'boolean',
        default_value: true,
        required: false
      },
      {
        key: 'working_hours_restriction',
        description: 'Restrict communications to business hours',
        type: 'boolean',
        default_value: true,
        required: false
      },
      {
        key: 'maximum_contact_attempts',
        description: 'Maximum contact attempts per debtor per month',
        type: 'number',
        default_value: 12,
        required: false
      }
    ]
  }
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // TODO: Extract user role from JWT token
    const userRole = 'system_admin'

    if (!canManageSystemSettings(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams)
    const { organization_id } = querySchema.parse(queryParams)

    const supabase = await createServiceClient()

    // Get current settings counts and metadata for each category
    const { data: settingsStats, error } = await supabase
      .from('system_settings')
      .select('category, is_encrypted, updated_at')
      .eq('organization_id', organization_id)

    if (error) {
      console.error('Failed to fetch settings stats:', error)
      return NextResponse.json(
        { error: 'Failed to fetch categories' },
        { status: 500 }
      )
    }

    // Process categories with current stats
    const categories: SettingCategory[] = Object.values(CATEGORY_DEFINITIONS).map(categoryDef => {
      const categorySettings = settingsStats?.filter(s => s.category === categoryDef.category) || []

      return {
        ...categoryDef,
        settings_count: categorySettings.length,
        is_encrypted: categorySettings.some(s => s.is_encrypted),
        last_updated: categorySettings.length > 0
          ? Math.max(...categorySettings.map(s => new Date(s.updated_at).getTime()))
          : new Date().toISOString()
      }
    })

    return NextResponse.json({
      categories,
      total_categories: categories.length,
      organization_id
    })

  } catch (error) {
    console.error('Categories GET error:', error)

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