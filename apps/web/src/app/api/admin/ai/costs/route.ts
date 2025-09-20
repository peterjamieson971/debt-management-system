import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { canManageSystemSettings, hasPermission } from '@/types/users'
import { z } from 'zod'

const costQuerySchema = z.object({
  organization_id: z.string().uuid(),
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  model: z.string().optional(),
  interaction_type: z.string().optional(),
  group_by: z.enum(['day', 'week', 'month', 'model', 'type']).optional().default('day'),
  limit: z.string().optional().default('100')
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

    if (!hasPermission(userRole, 'canViewAICosts')) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams)
    const {
      organization_id,
      start_date,
      end_date,
      model,
      interaction_type,
      group_by,
      limit
    } = costQuerySchema.parse(queryParams)

    const supabase = await createServiceClient()

    // Set default date range (last 30 days if not specified)
    const endDate = end_date ? new Date(end_date) : new Date()
    const startDate = start_date ? new Date(start_date) : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)

    // Build query
    let query = supabase
      .from('ai_interactions')
      .select('*')
      .eq('organization_id', organization_id)
      .gte('created_at', startDate.toISOString())
      .lte('created_at', endDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(parseInt(limit))

    if (model) {
      query = query.eq('model_used', model)
    }

    if (interaction_type) {
      query = query.eq('interaction_type', interaction_type)
    }

    const { data: interactions, error } = await query

    if (error) {
      console.error('Failed to fetch AI interactions:', error)
      return NextResponse.json(
        { error: 'Failed to fetch cost data' },
        { status: 500 }
      )
    }

    // Get cost limits from settings
    const { data: costLimitsSetting } = await supabase
      .from('system_settings')
      .select('value')
      .eq('organization_id', organization_id)
      .eq('category', 'ai')
      .eq('key', 'cost_limits')
      .single()

    const costLimits = costLimitsSetting?.value || {
      monthly_limit_usd: 1000,
      daily_limit_usd: 50,
      alert_threshold_percent: 80
    }

    // Process and aggregate data
    const analytics = processInteractionData(interactions || [], group_by, startDate, endDate)

    // Calculate current usage vs limits
    const now = new Date()
    const currentMonth = interactions?.filter(i => {
      const interactionDate = new Date(i.created_at)
      return interactionDate.getMonth() === now.getMonth() &&
             interactionDate.getFullYear() === now.getFullYear()
    }) || []

    const currentDay = interactions?.filter(i => {
      const interactionDate = new Date(i.created_at)
      return interactionDate.toDateString() === now.toDateString()
    }) || []

    const monthlySpend = currentMonth.reduce((sum, i) => sum + (i.cost_usd || 0), 0)
    const dailySpend = currentDay.reduce((sum, i) => sum + (i.cost_usd || 0), 0)

    const usage = {
      monthly: {
        spent: Math.round(monthlySpend * 100) / 100,
        limit: costLimits.monthly_limit_usd,
        percentage: Math.round((monthlySpend / costLimits.monthly_limit_usd) * 10000) / 100,
        remaining: Math.round((costLimits.monthly_limit_usd - monthlySpend) * 100) / 100
      },
      daily: {
        spent: Math.round(dailySpend * 100) / 100,
        limit: costLimits.daily_limit_usd,
        percentage: Math.round((dailySpend / costLimits.daily_limit_usd) * 10000) / 100,
        remaining: Math.round((costLimits.daily_limit_usd - dailySpend) * 100) / 100
      },
      alert_threshold: costLimits.alert_threshold_percent
    }

    // Get model performance metrics
    const modelMetrics = calculateModelMetrics(interactions || [])

    return NextResponse.json({
      organization_id,
      period: {
        start: startDate.toISOString(),
        end: endDate.toISOString(),
        group_by
      },
      analytics,
      usage,
      model_metrics: modelMetrics,
      total_interactions: interactions?.length || 0,
      alerts: generateAlerts(usage, costLimits)
    })

  } catch (error) {
    console.error('AI costs GET error:', error)

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

function processInteractionData(interactions: any[], groupBy: string, startDate: Date, endDate: Date) {
  const grouped: any = {}

  interactions.forEach(interaction => {
    const date = new Date(interaction.created_at)
    let key: string

    switch (groupBy) {
      case 'day':
        key = date.toISOString().split('T')[0]
        break
      case 'week':
        const weekStart = new Date(date)
        weekStart.setDate(date.getDate() - date.getDay())
        key = weekStart.toISOString().split('T')[0]
        break
      case 'month':
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
        break
      case 'model':
        key = interaction.model_used || 'unknown'
        break
      case 'type':
        key = interaction.interaction_type || 'unknown'
        break
      default:
        key = date.toISOString().split('T')[0]
    }

    if (!grouped[key]) {
      grouped[key] = {
        key,
        cost: 0,
        interactions: 0,
        tokens: {
          prompt: 0,
          completion: 0,
          total: 0
        },
        models: {},
        types: {}
      }
    }

    grouped[key].cost += interaction.cost_usd || 0
    grouped[key].interactions += 1
    grouped[key].tokens.prompt += interaction.prompt_tokens || 0
    grouped[key].tokens.completion += interaction.completion_tokens || 0
    grouped[key].tokens.total += interaction.total_tokens || 0

    const model = interaction.model_used || 'unknown'
    const type = interaction.interaction_type || 'unknown'

    grouped[key].models[model] = (grouped[key].models[model] || 0) + 1
    grouped[key].types[type] = (grouped[key].types[type] || 0) + 1
  })

  // Convert to array and sort
  const result = Object.values(grouped).map((group: any) => ({
    ...group,
    cost: Math.round(group.cost * 100) / 100,
    avg_cost_per_interaction: group.interactions > 0
      ? Math.round((group.cost / group.interactions) * 100) / 100
      : 0
  }))

  return result.sort((a: any, b: any) => a.key.localeCompare(b.key))
}

function calculateModelMetrics(interactions: any[]) {
  const models = {}

  interactions.forEach(interaction => {
    const model = interaction.model_used || 'unknown'

    if (!models[model]) {
      models[model] = {
        name: model,
        total_cost: 0,
        total_interactions: 0,
        total_tokens: 0,
        avg_cost_per_interaction: 0,
        avg_cost_per_token: 0,
        performance_score: 0,
        last_used: null
      }
    }

    models[model].total_cost += interaction.cost_usd || 0
    models[model].total_interactions += 1
    models[model].total_tokens += interaction.total_tokens || 0

    const interactionDate = new Date(interaction.created_at)
    if (!models[model].last_used || interactionDate > new Date(models[model].last_used)) {
      models[model].last_used = interaction.created_at
    }
  })

  // Calculate averages and performance scores
  return Object.values(models).map((model: any) => {
    model.avg_cost_per_interaction = model.total_interactions > 0
      ? Math.round((model.total_cost / model.total_interactions) * 100) / 100
      : 0

    model.avg_cost_per_token = model.total_tokens > 0
      ? Math.round((model.total_cost / model.total_tokens) * 1000000) / 1000000 // Cost per token in micro-dollars
      : 0

    // Simple performance score based on cost efficiency
    model.performance_score = model.total_tokens > 0
      ? Math.max(0, 100 - (model.avg_cost_per_token * 100000)) // Arbitrary scoring
      : 0

    model.total_cost = Math.round(model.total_cost * 100) / 100

    return model
  }).sort((a, b) => b.total_cost - a.total_cost)
}

function generateAlerts(usage: any, limits: any) {
  const alerts = []

  // Monthly alerts
  if (usage.monthly.percentage >= limits.alert_threshold_percent) {
    alerts.push({
      type: 'warning',
      level: usage.monthly.percentage >= 95 ? 'high' : 'medium',
      message: `Monthly AI spend is at ${usage.monthly.percentage}% of limit ($${usage.monthly.spent}/$${usage.monthly.limit})`,
      category: 'monthly_limit'
    })
  }

  // Daily alerts
  if (usage.daily.percentage >= limits.alert_threshold_percent) {
    alerts.push({
      type: 'warning',
      level: usage.daily.percentage >= 95 ? 'high' : 'medium',
      message: `Daily AI spend is at ${usage.daily.percentage}% of limit ($${usage.daily.spent}/$${usage.daily.limit})`,
      category: 'daily_limit'
    })
  }

  // Budget exceeded alerts
  if (usage.monthly.percentage >= 100) {
    alerts.push({
      type: 'error',
      level: 'critical',
      message: `Monthly AI budget exceeded! $${usage.monthly.spent} spent (limit: $${usage.monthly.limit})`,
      category: 'budget_exceeded'
    })
  }

  if (usage.daily.percentage >= 100) {
    alerts.push({
      type: 'error',
      level: 'critical',
      message: `Daily AI budget exceeded! $${usage.daily.spent} spent (limit: $${usage.daily.limit})`,
      category: 'budget_exceeded'
    })
  }

  return alerts
}