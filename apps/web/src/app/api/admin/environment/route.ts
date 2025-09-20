import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { canManageSystemSettings } from '@/types/users'
import { z } from 'zod'
import crypto from 'crypto'

const envVarSchema = z.object({
  organization_id: z.string().uuid(),
  variables: z.record(z.string(), z.any())
})

const allowedOverrides = [
  // AI Configuration
  'OPENAI_API_KEY',
  'GOOGLE_AI_API_KEY',
  'ANTHROPIC_API_KEY',

  // Gmail Configuration
  'GMAIL_CLIENT_ID',
  'GMAIL_CLIENT_SECRET',

  // System Configuration
  'ENCRYPTION_KEY',
  'JWT_SECRET',
  'NEXT_PUBLIC_APP_URL',

  // Database
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',

  // Email Configuration
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',

  // Monitoring and Analytics
  'SENTRY_DSN',
  'ANALYTICS_TRACKING_ID',

  // Feature Flags
  'FEATURE_AI_ENABLED',
  'FEATURE_EMAIL_TRACKING',
  'FEATURE_ADVANCED_ANALYTICS',

  // Rate Limiting
  'RATE_LIMIT_WINDOW_MS',
  'RATE_LIMIT_MAX_REQUESTS',

  // File Upload
  'MAX_FILE_SIZE_MB',
  'ALLOWED_FILE_TYPES'
]

const sensitiveKeys = [
  'OPENAI_API_KEY',
  'GOOGLE_AI_API_KEY',
  'ANTHROPIC_API_KEY',
  'GMAIL_CLIENT_SECRET',
  'ENCRYPTION_KEY',
  'JWT_SECRET',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SMTP_PASSWORD',
  'SENTRY_DSN'
]

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
    const showValues = url.searchParams.get('show_values') === 'true'

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organization_id parameter is required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()

    // Get environment overrides from system settings
    const { data: envSettings, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('category', 'environment')

    if (error) {
      console.error('Failed to fetch environment settings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch environment configuration' },
        { status: 500 }
      )
    }

    // Process environment variables
    const variables = {}
    const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET!

    envSettings?.forEach(setting => {
      let value = setting.value

      if (setting.is_encrypted && showValues) {
        try {
          const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey)
          let decrypted = decipher.update(setting.value, 'hex', 'utf8')
          decrypted += decipher.final('utf8')
          value = decrypted
        } catch (error) {
          console.error(`Failed to decrypt ${setting.key}:`, error)
          value = '[DECRYPTION_ERROR]'
        }
      } else if (setting.is_encrypted) {
        value = '[ENCRYPTED]'
      }

      variables[setting.key] = {
        value,
        is_encrypted: setting.is_encrypted,
        description: setting.description,
        last_updated: setting.updated_at,
        is_override: true
      }
    })

    // Add current environment variables (without values for security)
    const envStatus = {}
    allowedOverrides.forEach(key => {
      const hasSystemValue = !!process.env[key]
      const hasOverride = !!variables[key]

      envStatus[key] = {
        has_system_value: hasSystemValue,
        has_override: hasOverride,
        is_sensitive: sensitiveKeys.includes(key),
        current_source: hasOverride ? 'override' : (hasSystemValue ? 'system' : 'none'),
        allowed_override: true
      }

      // If no override exists, show placeholder
      if (!hasOverride) {
        variables[key] = {
          value: showValues && hasSystemValue ?
            (sensitiveKeys.includes(key) ? '[SYSTEM_VALUE]' : process.env[key]) :
            '[NOT_SET]',
          is_encrypted: false,
          description: `System environment variable: ${key}`,
          last_updated: null,
          is_override: false
        }
      }
    })

    return NextResponse.json({
      organization_id: organizationId,
      variables,
      environment_status: envStatus,
      allowed_overrides: allowedOverrides,
      sensitive_keys: sensitiveKeys,
      total_overrides: envSettings?.length || 0,
      show_values: showValues
    })

  } catch (error) {
    console.error('Environment GET error:', error)
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
    const { organization_id, variables } = envVarSchema.parse(body)

    const supabase = await createServiceClient()

    // Validate that all variables are allowed overrides
    const invalidKeys = Object.keys(variables).filter(key => !allowedOverrides.includes(key))
    if (invalidKeys.length > 0) {
      return NextResponse.json(
        { error: 'Invalid environment variables', invalid_keys: invalidKeys },
        { status: 400 }
      )
    }

    const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET!
    const settingsToUpsert = []

    // Process each variable
    for (const [key, value] of Object.entries(variables)) {
      if (value === null || value === undefined || value === '') {
        // Delete the override (revert to system default)
        await supabase
          .from('system_settings')
          .delete()
          .eq('organization_id', organization_id)
          .eq('category', 'environment')
          .eq('key', key)
        continue
      }

      const isSensitive = sensitiveKeys.includes(key)
      let processedValue = value

      // Encrypt sensitive values
      if (isSensitive) {
        const cipher = crypto.createCipher('aes-256-cbc', encryptionKey)
        let encrypted = cipher.update(String(value), 'utf8', 'hex')
        encrypted += cipher.final('hex')
        processedValue = encrypted
      }

      settingsToUpsert.push({
        organization_id,
        category: 'environment',
        key,
        value: processedValue,
        is_encrypted: isSensitive,
        description: `Environment variable override: ${key}`,
        updated_at: new Date().toISOString()
      })
    }

    // Upsert settings
    if (settingsToUpsert.length > 0) {
      const { error: upsertError } = await supabase
        .from('system_settings')
        .upsert(settingsToUpsert, {
          onConflict: 'organization_id,category,key'
        })

      if (upsertError) {
        console.error('Failed to update environment variables:', upsertError)
        return NextResponse.json(
          { error: 'Failed to update environment variables' },
          { status: 500 }
        )
      }
    }

    // Log the change
    await supabase.from('analytics_events').insert({
      organization_id,
      event_type: 'environment_config_updated',
      entity_type: 'environment_configuration',
      entity_id: organization_id,
      properties: {
        variables_updated: Object.keys(variables),
        sensitive_variables: Object.keys(variables).filter(key => sensitiveKeys.includes(key)),
        updated_by: 'system_admin'
      }
    })

    return NextResponse.json({
      success: true,
      variables_updated: Object.keys(variables).length,
      organization_id
    })

  } catch (error) {
    console.error('Environment PUT error:', error)

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

export async function DELETE(request: NextRequest) {
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
    const variableKey = url.searchParams.get('key')

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organization_id parameter is required' },
        { status: 400 }
      )
    }

    if (!variableKey) {
      return NextResponse.json(
        { error: 'key parameter is required' },
        { status: 400 }
      )
    }

    if (!allowedOverrides.includes(variableKey)) {
      return NextResponse.json(
        { error: 'Variable is not allowed for override' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()

    // Delete the environment override
    const { error } = await supabase
      .from('system_settings')
      .delete()
      .eq('organization_id', organizationId)
      .eq('category', 'environment')
      .eq('key', variableKey)

    if (error) {
      console.error('Failed to delete environment variable:', error)
      return NextResponse.json(
        { error: 'Failed to delete environment variable override' },
        { status: 500 }
      )
    }

    // Log the deletion
    await supabase.from('analytics_events').insert({
      organization_id: organizationId,
      event_type: 'environment_override_deleted',
      entity_type: 'environment_variable',
      entity_id: variableKey,
      properties: {
        variable_key: variableKey,
        deleted_by: 'system_admin'
      }
    })

    return NextResponse.json({
      success: true,
      deleted_variable: variableKey,
      organization_id: organizationId
    })

  } catch (error) {
    console.error('Environment DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}