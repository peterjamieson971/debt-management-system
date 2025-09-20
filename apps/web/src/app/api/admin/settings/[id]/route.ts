import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { canManageSystemSettings } from '@/types/users'
import { z } from 'zod'
import crypto from 'crypto'

const updateSettingSchema = z.object({
  value: z.any().optional(),
  is_encrypted: z.boolean().optional(),
  description: z.string().optional()
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

    // TODO: Extract user role from JWT token
    const userRole = 'system_admin'

    if (!canManageSystemSettings(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const supabase = await createServiceClient()

    const { data: setting, error } = await supabase
      .from('system_settings')
      .select('*')
      .eq('id', params.id)
      .single()

    if (error || !setting) {
      return NextResponse.json(
        { error: 'Setting not found' },
        { status: 404 }
      )
    }

    // Decrypt if encrypted
    let processedSetting = { ...setting }
    if (setting.is_encrypted) {
      try {
        const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET!
        const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey)
        let decrypted = decipher.update(setting.value, 'hex', 'utf8')
        decrypted += decipher.final('utf8')
        processedSetting.value = JSON.parse(decrypted)
      } catch (error) {
        console.error('Failed to decrypt setting:', error)
        processedSetting.value = '[DECRYPTION_ERROR]'
      }
    }

    return NextResponse.json({
      setting: processedSetting
    })

  } catch (error) {
    console.error('Setting GET error:', error)
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

    // TODO: Extract user role from JWT token
    const userRole = 'system_admin'

    if (!canManageSystemSettings(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const updateData = updateSettingSchema.parse(body)

    const supabase = await createServiceClient()

    // Get current setting
    const { data: currentSetting, error: fetchError } = await supabase
      .from('system_settings')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !currentSetting) {
      return NextResponse.json(
        { error: 'Setting not found' },
        { status: 404 }
      )
    }

    // Build update object
    const updateObject: any = {
      updated_at: new Date().toISOString()
    }

    if (updateData.description !== undefined) {
      updateObject.description = updateData.description
    }

    if (updateData.is_encrypted !== undefined) {
      updateObject.is_encrypted = updateData.is_encrypted
    }

    if (updateData.value !== undefined) {
      // Handle encryption
      if (updateData.is_encrypted || currentSetting.is_encrypted) {
        const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET!
        const cipher = crypto.createCipher('aes-256-cbc', encryptionKey)
        let encrypted = cipher.update(JSON.stringify(updateData.value), 'utf8', 'hex')
        encrypted += cipher.final('hex')
        updateObject.value = encrypted
        updateObject.is_encrypted = true
      } else {
        updateObject.value = updateData.value
      }
    }

    // Update setting
    const { data: updatedSetting, error } = await supabase
      .from('system_settings')
      .update(updateObject)
      .eq('id', params.id)
      .select()
      .single()

    if (error) {
      console.error('Failed to update setting:', error)
      return NextResponse.json(
        { error: 'Failed to update setting' },
        { status: 500 }
      )
    }

    // Log the change
    await supabase.from('analytics_events').insert({
      organization_id: updatedSetting.organization_id,
      event_type: 'system_setting_changed',
      entity_type: 'system_setting',
      entity_id: updatedSetting.id,
      properties: {
        category: updatedSetting.category,
        key: updatedSetting.key,
        action: 'update',
        is_encrypted: updatedSetting.is_encrypted,
        changed_by: 'system_admin' // TODO: Get actual user ID from JWT
      }
    })

    return NextResponse.json({
      setting: {
        ...updatedSetting,
        value: updatedSetting.is_encrypted ? '[ENCRYPTED]' : updatedSetting.value
      },
      updated: true
    })

  } catch (error) {
    console.error('Setting PUT error:', error)

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

    // TODO: Extract user role from JWT token
    const userRole = 'system_admin'

    if (!canManageSystemSettings(userRole)) {
      return NextResponse.json(
        { error: 'Insufficient permissions' },
        { status: 403 }
      )
    }

    const supabase = await createServiceClient()

    // Get setting details before deletion for logging
    const { data: setting, error: fetchError } = await supabase
      .from('system_settings')
      .select('*')
      .eq('id', params.id)
      .single()

    if (fetchError || !setting) {
      return NextResponse.json(
        { error: 'Setting not found' },
        { status: 404 }
      )
    }

    // Delete setting
    const { error: deleteError } = await supabase
      .from('system_settings')
      .delete()
      .eq('id', params.id)

    if (deleteError) {
      console.error('Failed to delete setting:', deleteError)
      return NextResponse.json(
        { error: 'Failed to delete setting' },
        { status: 500 }
      )
    }

    // Log the deletion
    await supabase.from('analytics_events').insert({
      organization_id: setting.organization_id,
      event_type: 'system_setting_changed',
      entity_type: 'system_setting',
      entity_id: setting.id,
      properties: {
        category: setting.category,
        key: setting.key,
        action: 'delete',
        changed_by: 'system_admin' // TODO: Get actual user ID from JWT
      }
    })

    return NextResponse.json({
      deleted: true,
      setting_id: params.id
    })

  } catch (error) {
    console.error('Setting DELETE error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}