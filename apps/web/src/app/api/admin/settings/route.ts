import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { canManageSystemSettings } from '@/types/users'
import { z } from 'zod'
import crypto from 'crypto'

const createSettingSchema = z.object({
  organization_id: z.string().uuid(),
  category: z.enum(['ai', 'email', 'system', 'prompts', 'compliance']),
  key: z.string().min(1).max(100),
  value: z.any(),
  is_encrypted: z.boolean().optional().default(false),
  description: z.string().optional()
})

const updateSettingSchema = z.object({
  value: z.any().optional(),
  is_encrypted: z.boolean().optional(),
  description: z.string().optional()
})

const querySettingsSchema = z.object({
  organization_id: z.string().uuid(),
  category: z.string().optional(),
  key: z.string().optional(),
  include_encrypted: z.string().optional().default('false')
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
    // For now, assuming system_admin role - in production, verify JWT
    const userRole = 'system_admin' // This should be extracted from JWT

    if (!canManageSystemSettings(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams)
    const { organization_id, category, key, include_encrypted } = querySettingsSchema.parse(queryParams)

    const supabase = await createServiceClient()

    // Build query
    let query = supabase
      .from('system_settings')
      .select('*')
      .eq('organization_id', organization_id)

    if (category) {
      query = query.eq('category', category)
    }

    if (key) {
      query = query.eq('key', key)
    }

    const { data: settings, error } = await query.order('category').order('key')

    if (error) {
      console.error('Failed to fetch settings:', error)
      return NextResponse.json(
        { error: 'Failed to fetch settings' },
        { status: 500 }
      )
    }

    // Process settings based on encryption and user permissions
    const processedSettings = settings?.map(setting => {
      const processed = { ...setting }

      // Handle encrypted values
      if (setting.is_encrypted && include_encrypted === 'false') {
        processed.value = '[ENCRYPTED]'
      } else if (setting.is_encrypted && include_encrypted === 'true') {
        try {
          const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET!
          const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey)
          let decrypted = decipher.update(setting.value, 'hex', 'utf8')
          decrypted += decipher.final('utf8')
          processed.value = JSON.parse(decrypted)
        } catch (error) {
          console.error('Failed to decrypt setting:', error)
          processed.value = '[DECRYPTION_ERROR]'
        }
      }

      return processed
    }) || []

    // Group by category for better organization
    const groupedSettings = processedSettings.reduce((acc, setting) => {
      if (!acc[setting.category]) {
        acc[setting.category] = []
      }
      acc[setting.category].push(setting)
      return acc
    }, {} as Record<string, any[]>)

    return NextResponse.json({
      settings: processedSettings,
      grouped_settings: groupedSettings,
      total_count: processedSettings.length,
      filters_applied: {
        organization_id,
        category,
        key,
        include_encrypted: include_encrypted === 'true'
      }
    })

  } catch (error) {
    console.error('Settings GET error:', error)

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

    // TODO: Extract user role from JWT token
    const userRole = 'system_admin'

    if (!canManageSystemSettings(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const settingData = createSettingSchema.parse(body)

    const supabase = await createServiceClient()

    // Process value (encrypt if needed)
    let processedValue = settingData.value
    if (settingData.is_encrypted) {
      const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET!
      const cipher = crypto.createCipher('aes-256-cbc', encryptionKey)
      let encrypted = cipher.update(JSON.stringify(settingData.value), 'utf8', 'hex')
      encrypted += cipher.final('hex')
      processedValue = encrypted
    }

    // Create or update setting
    const { data: setting, error } = await supabase
      .from('system_settings')
      .upsert({
        organization_id: settingData.organization_id,
        category: settingData.category,
        key: settingData.key,
        value: processedValue,
        is_encrypted: settingData.is_encrypted,
        description: settingData.description,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'organization_id,category,key'
      })
      .select()
      .single()

    if (error) {
      console.error('Failed to create/update setting:', error)
      return NextResponse.json(
        { error: 'Failed to save setting' },
        { status: 500 }
      )
    }

    // Log the change for audit purposes
    await supabase.from('analytics_events').insert({
      organization_id: settingData.organization_id,
      event_type: 'system_setting_changed',
      entity_type: 'system_setting',
      entity_id: setting.id,
      properties: {
        category: settingData.category,
        key: settingData.key,
        action: 'create_or_update',
        is_encrypted: settingData.is_encrypted,
        changed_by: 'system_admin' // TODO: Get actual user ID from JWT
      }
    })

    return NextResponse.json({
      setting: {
        ...setting,
        value: settingData.is_encrypted ? '[ENCRYPTED]' : setting.value
      },
      created: true
    }, { status: 201 })

  } catch (error) {
    console.error('Settings POST error:', error)

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