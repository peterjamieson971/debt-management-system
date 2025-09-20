import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { canManageSystemSettings } from '@/types/users'
import { z } from 'zod'
import crypto from 'crypto'

const emailConfigSchema = z.object({
  organization_id: z.string().uuid(),
  gmail_settings: z.object({
    client_id: z.string().optional(),
    client_secret: z.string().optional(),
    scopes: z.array(z.string()).optional().default([
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email'
    ]),
    auto_watch_enabled: z.boolean().optional().default(true),
    watch_labels: z.array(z.string()).optional().default(['INBOX'])
  }).optional(),
  rate_limits: z.object({
    emails_per_minute: z.number().min(1).max(100),
    emails_per_hour: z.number().min(1).max(1000),
    emails_per_day: z.number().min(1).max(10000),
    burst_limit: z.number().min(1).max(50).optional().default(5)
  }).optional(),
  sending_preferences: z.object({
    default_sender_name: z.string().optional(),
    default_signature: z.string().optional(),
    auto_follow_up_enabled: z.boolean().optional().default(false),
    follow_up_delay_days: z.number().min(1).max(30).optional().default(3),
    business_hours_only: z.boolean().optional().default(true),
    business_hours: z.object({
      start: z.string().regex(/^\d{2}:\d{2}$/),
      end: z.string().regex(/^\d{2}:\d{2}$/),
      timezone: z.string().optional().default('Asia/Dubai'),
      days: z.array(z.enum(['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday']))
        .optional().default(['monday', 'tuesday', 'wednesday', 'thursday', 'friday'])
    }).optional()
  }).optional(),
  bounce_handling: z.object({
    auto_retry_soft_bounces: z.boolean().optional().default(true),
    max_retry_attempts: z.number().min(0).max(10).optional().default(3),
    retry_delay_hours: z.number().min(1).max(168).optional().default(24),
    mark_hard_bounces_invalid: z.boolean().optional().default(true),
    bounce_notification_emails: z.array(z.string().email()).optional().default([])
  }).optional(),
  monitoring: z.object({
    track_opens: z.boolean().optional().default(false), // Privacy compliance
    track_clicks: z.boolean().optional().default(false),
    delivery_tracking_enabled: z.boolean().optional().default(true),
    real_time_alerts: z.boolean().optional().default(true),
    alert_email: z.string().email().optional()
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

    // Get email-related settings
    const { data: emailSettings, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('category', 'email')

    if (error) {
      console.error('Failed to fetch email settings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch email configuration' },
        { status: 500 }
      )
    }

    // Get OAuth connections status
    const { data: oauthConnections, error: oauthError } = await supabase
      .from('oauth_tokens')
      .select('email, created_at, updated_at, expires_at, scope')
      .eq('organization_id', organizationId)
      .eq('provider', 'gmail')

    if (oauthError) {
      console.error('Failed to fetch OAuth connections:', oauthError)
    }

    // Get recent email statistics
    const { data: emailStats, error: statsError } = await supabase
      .from('communication_logs')
      .select('direction, status, sent_at, delivery_status')
      .eq('organization_id', organizationId)
      .eq('type', 'email')
      .gte('sent_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()) // Last 7 days

    if (statsError) {
      console.error('Failed to fetch email stats:', statsError)
    }

    // Process and structure configuration
    const config = processEmailSettings(emailSettings || [])

    // Calculate email analytics
    const analytics = calculateEmailAnalytics(emailStats || [], oauthConnections || [])

    return NextResponse.json({
      organization_id: organizationId,
      configuration: config,
      oauth_connections: (oauthConnections || []).map(conn => ({
        email: conn.email,
        connected_at: conn.created_at,
        last_updated: conn.updated_at,
        expires_at: conn.expires_at,
        scopes: conn.scope?.split(' ') || [],
        status: new Date(conn.expires_at) > new Date() ? 'active' : 'expired'
      })),
      analytics,
      settings_count: emailSettings?.length || 0
    })

  } catch (error) {
    console.error('Email config GET error:', error)
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
    const configData = emailConfigSchema.parse(body)

    const supabase = await createServiceClient()

    const settingsToUpsert = []

    // Process Gmail settings (with encryption for sensitive data)
    if (configData.gmail_settings) {
      const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET!

      // Handle client_id (encrypted)
      if (configData.gmail_settings.client_id) {
        const cipher = crypto.createCipher('aes-256-cbc', encryptionKey)
        let encrypted = cipher.update(configData.gmail_settings.client_id, 'utf8', 'hex')
        encrypted += cipher.final('hex')

        settingsToUpsert.push({
          organization_id: configData.organization_id,
          category: 'email',
          key: 'gmail_client_id',
          value: encrypted,
          is_encrypted: true,
          description: 'Encrypted Gmail OAuth client ID'
        })
      }

      // Handle client_secret (encrypted)
      if (configData.gmail_settings.client_secret) {
        const cipher = crypto.createCipher('aes-256-cbc', encryptionKey)
        let encrypted = cipher.update(configData.gmail_settings.client_secret, 'utf8', 'hex')
        encrypted += cipher.final('hex')

        settingsToUpsert.push({
          organization_id: configData.organization_id,
          category: 'email',
          key: 'gmail_client_secret',
          value: encrypted,
          is_encrypted: true,
          description: 'Encrypted Gmail OAuth client secret'
        })
      }

      // Handle other Gmail settings (not encrypted)
      const nonSensitiveGmailSettings = {
        scopes: configData.gmail_settings.scopes,
        auto_watch_enabled: configData.gmail_settings.auto_watch_enabled,
        watch_labels: configData.gmail_settings.watch_labels
      }

      settingsToUpsert.push({
        organization_id: configData.organization_id,
        category: 'email',
        key: 'gmail_config',
        value: nonSensitiveGmailSettings,
        is_encrypted: false,
        description: 'Gmail integration configuration'
      })
    }

    // Process rate limits
    if (configData.rate_limits) {
      settingsToUpsert.push({
        organization_id: configData.organization_id,
        category: 'email',
        key: 'send_rate_limit',
        value: configData.rate_limits,
        is_encrypted: false,
        description: 'Email sending rate limits'
      })
    }

    // Process sending preferences
    if (configData.sending_preferences) {
      settingsToUpsert.push({
        organization_id: configData.organization_id,
        category: 'email',
        key: 'sending_preferences',
        value: configData.sending_preferences,
        is_encrypted: false,
        description: 'Email sending preferences and business hours'
      })
    }

    // Process bounce handling
    if (configData.bounce_handling) {
      settingsToUpsert.push({
        organization_id: configData.organization_id,
        category: 'email',
        key: 'bounce_handling',
        value: configData.bounce_handling,
        is_encrypted: false,
        description: 'Email bounce detection and handling settings'
      })
    }

    // Process monitoring settings
    if (configData.monitoring) {
      settingsToUpsert.push({
        organization_id: configData.organization_id,
        category: 'email',
        key: 'monitoring',
        value: configData.monitoring,
        is_encrypted: false,
        description: 'Email monitoring and tracking settings'
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
      console.error('Failed to update email settings:', errors)
      return NextResponse.json(
        { error: 'Failed to update some email settings' },
        { status: 500 }
      )
    }

    // Log the configuration change
    await supabase.from('analytics_events').insert({
      organization_id: configData.organization_id,
      event_type: 'email_config_updated',
      entity_type: 'email_configuration',
      entity_id: configData.organization_id,
      properties: {
        settings_updated: settingsToUpsert.length,
        categories: Object.keys(configData).filter(key => key !== 'organization_id'),
        updated_by: 'system_admin'
      }
    })

    return NextResponse.json({
      success: true,
      settings_updated: settingsToUpsert.length,
      organization_id: configData.organization_id
    })

  } catch (error) {
    console.error('Email config PUT error:', error)

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

function processEmailSettings(settings: any[]) {
  const config: any = {
    gmail_settings: {},
    rate_limits: {},
    sending_preferences: {},
    bounce_handling: {},
    monitoring: {}
  }

  const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET!

  settings.forEach(setting => {
    let value = setting.value

    // Decrypt if encrypted
    if (setting.is_encrypted) {
      try {
        const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey)
        let decrypted = decipher.update(setting.value, 'hex', 'utf8')
        decrypted += decipher.final('utf8')
        value = decrypted
      } catch (error) {
        console.error(`Failed to decrypt setting ${setting.key}:`, error)
        value = '[ENCRYPTED]'
      }
    }

    // Categorize settings
    switch (setting.key) {
      case 'gmail_client_id':
      case 'gmail_client_secret':
        config.gmail_settings[setting.key.replace('gmail_', '')] = setting.is_encrypted ? '[ENCRYPTED]' : value
        break
      case 'gmail_config':
        Object.assign(config.gmail_settings, value)
        break
      case 'send_rate_limit':
        config.rate_limits = value
        break
      case 'sending_preferences':
        config.sending_preferences = value
        break
      case 'bounce_handling':
        config.bounce_handling = value
        break
      case 'monitoring':
        config.monitoring = value
        break
    }
  })

  return config
}

function calculateEmailAnalytics(emailStats: any[], oauthConnections: any[]) {
  const analytics = {
    total_emails: emailStats.length,
    sent_emails: emailStats.filter(e => e.direction === 'outbound').length,
    received_emails: emailStats.filter(e => e.direction === 'inbound').length,
    delivery_stats: {
      delivered: 0,
      bounced: 0,
      pending: 0,
      failed: 0
    },
    daily_volume: {},
    connection_status: {
      total_connections: oauthConnections.length,
      active_connections: oauthConnections.filter(c => new Date(c.expires_at) > new Date()).length,
      expired_connections: oauthConnections.filter(c => new Date(c.expires_at) <= new Date()).length
    }
  }

  // Calculate delivery stats
  emailStats.forEach(email => {
    if (email.direction === 'outbound') {
      switch (email.delivery_status || email.status) {
        case 'delivered':
        case 'sent':
          analytics.delivery_stats.delivered++
          break
        case 'bounced':
          analytics.delivery_stats.bounced++
          break
        case 'pending':
        case 'queued':
          analytics.delivery_stats.pending++
          break
        case 'failed':
          analytics.delivery_stats.failed++
          break
      }
    }
  })

  // Calculate daily volume for the last 7 days
  const now = new Date()
  for (let i = 6; i >= 0; i--) {
    const date = new Date(now.getTime() - i * 24 * 60 * 60 * 1000)
    const dateKey = date.toISOString().split('T')[0]

    const dayEmails = emailStats.filter(email => {
      const emailDate = new Date(email.sent_at || email.created_at)
      return emailDate.toDateString() === date.toDateString()
    })

    analytics.daily_volume[dateKey] = {
      total: dayEmails.length,
      sent: dayEmails.filter(e => e.direction === 'outbound').length,
      received: dayEmails.filter(e => e.direction === 'inbound').length
    }
  }

  return analytics
}