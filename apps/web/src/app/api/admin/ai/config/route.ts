import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { canManageSystemSettings } from '@/types/users'
import { z } from 'zod'
import crypto from 'crypto'

const aiConfigSchema = z.object({
  organization_id: z.string().uuid(),
  model_routing: z.object({
    simple_max_tokens: z.number().min(100).max(10000),
    complex_min_tokens: z.number().min(100).max(10000),
    default_model: z.enum(['openai', 'google']).optional().default('openai'),
    fallback_enabled: z.boolean().optional().default(true)
  }).optional(),
  cost_limits: z.object({
    monthly_limit_usd: z.number().min(0).max(100000),
    daily_limit_usd: z.number().min(0).max(10000),
    alert_threshold_percent: z.number().min(0).max(100),
    auto_disable_at_limit: z.boolean().optional().default(false)
  }).optional(),
  api_keys: z.object({
    openai_api_key: z.string().optional(),
    google_ai_api_key: z.string().optional(),
    anthropic_api_key: z.string().optional()
  }).optional(),
  model_preferences: z.object({
    openai_model: z.enum(['gpt-4', 'gpt-4-turbo', 'gpt-3.5-turbo']).optional().default('gpt-4-turbo'),
    google_model: z.enum(['gemini-pro', 'gemini-2.5-flash']).optional().default('gemini-2.5-flash'),
    temperature: z.number().min(0).max(2).optional().default(0.7),
    max_tokens: z.number().min(100).max(4000).optional().default(2000)
  }).optional(),
  features: z.object({
    cost_tracking_enabled: z.boolean().optional().default(true),
    performance_monitoring: z.boolean().optional().default(true),
    auto_fallback: z.boolean().optional().default(true),
    conversation_memory: z.boolean().optional().default(true),
    sentiment_analysis: z.boolean().optional().default(true)
  }).optional()
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

    // TODO: Extract user role from JWT token
    const userRole = 'system_admin'

    if (!canManageSystemSettings(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const url = new URL(request.url)
    const organizationId = url.searchParams.get('organization_id')

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organization_id parameter is required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()

    // Get all AI-related settings
    const { data: aiSettings, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('category', 'ai')

    if (error) {
      console.error('Failed to fetch AI settings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch AI configuration' },
        { status: 500 }
      )
    }

    // Get AI cost statistics
    const { data: costStats, error: costError } = await supabase
      .from('ai_interactions')
      .select('cost_usd, created_at, model_used, interaction_type')
      .eq('organization_id', organizationId)
      .gte('created_at', new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()) // Last 30 days

    if (costError) {
      console.error('Failed to fetch cost stats:', costError)
    }

    // Process settings into structured config
    const config: any = {
      model_routing: {},
      cost_limits: {},
      api_keys: {},
      model_preferences: {},
      features: {}
    }

    const settingsMap = new Map(aiSettings?.map(s => [s.key, s]) || [])

    // Decrypt and structure settings
    for (const [key, setting] of settingsMap) {
      let value = setting.value

      if (setting.is_encrypted) {
        try {
          const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET!
          const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey)
          let decrypted = decipher.update(setting.value, 'hex', 'utf8')
          decrypted += decipher.final('utf8')
          value = JSON.parse(decrypted)
        } catch (error) {
          console.error(`Failed to decrypt setting ${key}:`, error)
          value = '[ENCRYPTED]'
        }
      }

      // Categorize settings
      if (key === 'model_routing_threshold') {
        config.model_routing = value
      } else if (key.includes('_api_key')) {
        config.api_keys[key] = setting.is_encrypted ? '[ENCRYPTED]' : value
      } else if (key.startsWith('cost_') || key.includes('limit')) {
        const subKey = key.replace('cost_', '').replace('_limit', '_limit')
        config.cost_limits[subKey] = value
      } else if (key.includes('model_') || key === 'temperature' || key === 'max_tokens') {
        config.model_preferences[key] = value
      } else {
        config.features[key] = value
      }
    }

    // Calculate cost statistics
    const costAnalytics = calculateCostAnalytics(costStats || [])

    return NextResponse.json({
      organization_id: organizationId,
      configuration: config,
      cost_analytics: costAnalytics,
      settings_count: aiSettings?.length || 0,
      last_updated: aiSettings?.length > 0
        ? Math.max(...aiSettings.map(s => new Date(s.updated_at).getTime()))
        : null
    })

  } catch (error) {
    console.error('AI config GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function PUT(request: NextRequest) {
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
    const configData = aiConfigSchema.parse(body)

    const supabase = await createServiceClient()

    const settingsToUpsert = []

    // Process model routing settings
    if (configData.model_routing) {
      settingsToUpsert.push({
        organization_id: configData.organization_id,
        category: 'ai',
        key: 'model_routing_threshold',
        value: configData.model_routing,
        is_encrypted: false,
        description: 'AI model routing configuration'
      })
    }

    // Process cost limits
    if (configData.cost_limits) {
      settingsToUpsert.push({
        organization_id: configData.organization_id,
        category: 'ai',
        key: 'cost_limits',
        value: configData.cost_limits,
        is_encrypted: false,
        description: 'AI cost limits and alerts'
      })
    }

    // Process API keys (encrypted)
    if (configData.api_keys) {
      const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET!

      for (const [keyName, keyValue] of Object.entries(configData.api_keys)) {
        if (keyValue && keyValue !== '[ENCRYPTED]') {
          const cipher = crypto.createCipher('aes-256-cbc', encryptionKey)
          let encrypted = cipher.update(JSON.stringify(keyValue), 'utf8', 'hex')
          encrypted += cipher.final('hex')

          settingsToUpsert.push({
            organization_id: configData.organization_id,
            category: 'ai',
            key: keyName,
            value: encrypted,
            is_encrypted: true,
            description: `Encrypted ${keyName.replace('_', ' ').toUpperCase()}`
          })
        }
      }
    }

    // Process model preferences
    if (configData.model_preferences) {
      settingsToUpsert.push({
        organization_id: configData.organization_id,
        category: 'ai',
        key: 'model_preferences',
        value: configData.model_preferences,
        is_encrypted: false,
        description: 'AI model preferences and parameters'
      })
    }

    // Process features
    if (configData.features) {
      settingsToUpsert.push({
        organization_id: configData.organization_id,
        category: 'ai',
        key: 'features',
        value: configData.features,
        is_encrypted: false,
        description: 'AI feature toggles and capabilities'
      })
    }

    // Upsert all settings
    const upsertPromises = settingsToUpsert.map(setting =>
      supabase
        .from('system_settings')
        .upsert({
          ...setting,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'organization_id,category,key'
        })
    )

    const results = await Promise.all(upsertPromises)

    // Check for errors
    const errors = results.filter(r => r.error)
    if (errors.length > 0) {
      console.error('Failed to update AI settings:', errors)
      return NextResponse.json(
        { error: 'Failed to update some AI settings' },
        { status: 500 }
      )
    }

    // Log the configuration change
    await supabase.from('analytics_events').insert({
      organization_id: configData.organization_id,
      event_type: 'ai_config_updated',
      entity_type: 'ai_configuration',
      entity_id: configData.organization_id,
      properties: {
        settings_updated: settingsToUpsert.length,
        categories: ['model_routing', 'cost_limits', 'api_keys', 'model_preferences', 'features']
          .filter(cat => configData[cat] !== undefined),
        updated_by: 'system_admin'
      }
    })

    return NextResponse.json({
      success: true,
      settings_updated: settingsToUpsert.length,
      organization_id: configData.organization_id
    })

  } catch (error) {
    console.error('AI config PUT error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid configuration', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

function calculateCostAnalytics(interactions: any[]) {
  const now = new Date()
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  const totalCost = interactions.reduce((sum, i) => sum + (i.cost_usd || 0), 0)
  const monthlyCost = interactions
    .filter(i => new Date(i.created_at) >= startOfMonth)
    .reduce((sum, i) => sum + (i.cost_usd || 0), 0)
  const dailyCost = interactions
    .filter(i => new Date(i.created_at) >= startOfDay)
    .reduce((sum, i) => sum + (i.cost_usd || 0), 0)

  const modelUsage = interactions.reduce((acc, i) => {
    const model = i.model_used || 'unknown'
    acc[model] = (acc[model] || 0) + (i.cost_usd || 0)
    return acc
  }, {})

  const interactionTypes = interactions.reduce((acc, i) => {
    const type = i.interaction_type || 'unknown'
    acc[type] = (acc[type] || 0) + 1
    return acc
  }, {})

  // Calculate daily costs for the last 30 days
  const dailyCosts = []
  for (let i = 29; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const dayStart = new Date(date.getFullYear(), date.getMonth(), date.getDate())
    const dayEnd = new Date(dayStart.getTime() + 24 * 60 * 60 * 1000)

    const dayCost = interactions
      .filter(interaction => {
        const interactionDate = new Date(interaction.created_at)
        return interactionDate >= dayStart && interactionDate < dayEnd
      })
      .reduce((sum, i) => sum + (i.cost_usd || 0), 0)

    dailyCosts.push({
      date: dayStart.toISOString().split('T')[0],
      cost: Math.round(dayCost * 100) / 100
    })
  }

  return {
    total_cost_usd: Math.round(totalCost * 100) / 100,
    monthly_cost_usd: Math.round(monthlyCost * 100) / 100,
    daily_cost_usd: Math.round(dailyCost * 100) / 100,
    total_interactions: interactions.length,
    model_usage: modelUsage,
    interaction_types: interactionTypes,
    daily_costs: dailyCosts,
    period: {
      start: interactions.length > 0 ? Math.min(...interactions.map(i => new Date(i.created_at).getTime())) : null,
      end: interactions.length > 0 ? Math.max(...interactions.map(i => new Date(i.created_at).getTime())) : null
    }
  }
}