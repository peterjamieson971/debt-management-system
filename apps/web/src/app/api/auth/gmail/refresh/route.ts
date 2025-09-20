import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { z } from 'zod'

const refreshTokenSchema = z.object({
  organization_id: z.string().uuid(),
  email: z.string().email().optional()
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
    const { organization_id, email } = refreshTokenSchema.parse(body)

    const supabase = await createServiceClient()

    // Get stored OAuth tokens
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

    // Initialize OAuth2 client
    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
    )

    // Set refresh token and get new access token
    oauth2Client.setCredentials({
      refresh_token: decryptedRefreshToken
    })

    const { credentials } = await oauth2Client.refreshAccessToken()

    if (!credentials.access_token) {
      return NextResponse.json(
        { error: 'Failed to refresh access token' },
        { status: 500 }
      )
    }

    // Update stored tokens
    const updateData: any = {
      access_token: credentials.access_token,
      updated_at: new Date().toISOString()
    }

    if (credentials.expiry_date) {
      updateData.expires_at = new Date(credentials.expiry_date).toISOString()
    }

    // If we got a new refresh token, encrypt and store it
    if (credentials.refresh_token) {
      const cipher = crypto.createCipher('aes-256-cbc', encryptionKey)
      let encryptedRefreshToken = cipher.update(credentials.refresh_token, 'utf8', 'hex')
      encryptedRefreshToken += cipher.final('hex')
      updateData.refresh_token = encryptedRefreshToken
    }

    const { error: updateError } = await supabase
      .from('oauth_tokens')
      .update(updateData)
      .eq('id', tokenData.id)

    if (updateError) {
      console.error('Failed to update tokens:', updateError)
      return NextResponse.json(
        { error: 'Failed to store refreshed tokens' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      access_token: credentials.access_token,
      expires_at: credentials.expiry_date ? new Date(credentials.expiry_date).toISOString() : null,
      refreshed_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Token refresh error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to refresh Gmail tokens' },
      { status: 500 }
    )
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

    const url = new URL(request.url)
    const organizationId = url.searchParams.get('organization_id')

    if (!organizationId) {
      return NextResponse.json(
        { error: 'organization_id parameter is required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()

    // Get all Gmail OAuth tokens for the organization
    const { data: tokens, error } = await supabase
      .from('oauth_tokens')
      .select('email, expires_at, created_at, updated_at, scope')
      .eq('organization_id', organizationId)
      .eq('provider', 'gmail')

    if (error) {
      console.error('Failed to fetch tokens:', error)
      return NextResponse.json(
        { error: 'Failed to fetch Gmail connections' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      organization_id: organizationId,
      gmail_connections: tokens || [],
      total_connections: tokens?.length || 0
    })

  } catch (error) {
    console.error('Get tokens error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}