import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { z } from 'zod'

const watchSchema = z.object({
  organization_id: z.string().uuid(),
  email: z.string().email().optional(),
  topic_name: z.string(),
  label_ids: z.array(z.string()).optional().default(['INBOX'])
})

export async function POST(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const { organization_id, email, topic_name, label_ids } = watchSchema.parse(body)

    const supabase = await createServiceClient()

    // Get OAuth tokens for the organization
    let query = supabase
      .from('oauth_tokens')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('provider', 'gmail')

    if (email) {
      query = query.eq('email', email)
    }

    const { data: tokenData, error } = await query.single()

    if (error || !tokenData) {
      return NextResponse.json(
        { error: 'Gmail tokens not found for this organization' },
        { status: 404 }
      )
    }

    // Decrypt the refresh token
    const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET!
    const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey)
    let decryptedRefreshToken = decipher.update(tokenData.refresh_token, 'hex', 'utf8')
    decryptedRefreshToken += decipher.final('utf8')

    // Initialize OAuth2 client and Gmail API
    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
    )

    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: decryptedRefreshToken
    })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // Set up Gmail watch
    const watchResponse = await gmail.users.watch({
      userId: 'me',
      requestBody: {
        topicName: topic_name,
        labelIds: label_ids,
        labelFilterAction: 'include'
      }
    })

    // Store watch information in system settings
    const watchData = {
      history_id: watchResponse.data.historyId,
      expiration: watchResponse.data.expiration,
      topic_name,
      label_ids,
      email: tokenData.email,
      created_at: new Date().toISOString()
    }

    await supabase
      .from('system_settings')
      .upsert({
        organization_id,
        category: 'email',
        key: `gmail_watch_${tokenData.email}`,
        value: watchData,
        description: `Gmail watch configuration for ${tokenData.email}`
      }, {
        onConflict: 'organization_id,category,key'
      })

    return NextResponse.json({
      success: true,
      watch: {
        history_id: watchResponse.data.historyId,
        expiration: watchResponse.data.expiration,
        email: tokenData.email,
        topic_name,
        label_ids
      }
    })

  } catch (error) {
    console.error('Gmail watch setup error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to set up Gmail watch' },
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

    const url = new URL(request.url)
    const organizationId = url.searchParams.get('organization_id')
    const email = url.searchParams.get('email')

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organization_id parameter is required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()

    // Get OAuth tokens
    let query = supabase
      .from('oauth_tokens')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('provider', 'gmail')

    if (email) {
      query = query.eq('email', email)
    }

    const { data: tokenData, error } = await query.single()

    if (error || !tokenData) {
      return NextResponse.json(
        { error: 'Gmail tokens not found' },
        { status: 404 }
      )
    }

    // Decrypt refresh token
    const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET!
    const decipher = crypto.createDecipher('aes-256-cbc', encryptionKey)
    let decryptedRefreshToken = decipher.update(tokenData.refresh_token, 'hex', 'utf8')
    decryptedRefreshToken += decipher.final('utf8')

    // Initialize Gmail API
    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
    )

    oauth2Client.setCredentials({
      access_token: tokenData.access_token,
      refresh_token: decryptedRefreshToken
    })

    const gmail = google.gmail({ version: 'v1', auth: oauth2Client })

    // Stop Gmail watch
    await gmail.users.stop({
      userId: 'me'
    })

    // Remove watch configuration from settings
    await supabase
      .from('system_settings')
      .delete()
      .eq('organization_id', organizationId)
      .eq('category', 'email')
      .eq('key', `gmail_watch_${tokenData.email}`)

    return NextResponse.json({
      success: true,
      message: `Gmail watch stopped for ${tokenData.email}`
    })

  } catch (error) {
    console.error('Gmail watch stop error:', error)
    return NextResponse.json(
      { error: 'Failed to stop Gmail watch' },
      { status: 500 }
    )
  }
}