import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const code = url.searchParams.get('code')
    const state = url.searchParams.get('state')
    const error = url.searchParams.get('error')

    if (error) {
      console.error('OAuth error:', error)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=oauth_failed&reason=${encodeURIComponent(error)}`
      )
    }

    if (!code || !state) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=invalid_oauth_response`
      )
    }

    let stateData
    try {
      stateData = JSON.parse(state)
    } catch {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=invalid_state`
      )
    }

    const { organization_id, redirect_to = '/dashboard' } = stateData

    // Initialize OAuth2 client
    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
    )

    // Exchange code for tokens
    const { tokens } = await oauth2Client.getToken(code)

    if (!tokens.access_token || !tokens.refresh_token) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=token_exchange_failed`
      )
    }

    // Get user email from Google
    oauth2Client.setCredentials(tokens)
    const oauth2 = google.oauth2({ version: 'v2', auth: oauth2Client })
    const userInfo = await oauth2.userinfo.get()

    if (!userInfo.data.email) {
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=email_not_available`
      )
    }

    const supabase = await createServiceClient()

    // Encrypt the refresh token for storage
    const encryptionKey = process.env.ENCRYPTION_KEY || process.env.JWT_SECRET!
    const cipher = crypto.createCipher('aes-256-cbc', encryptionKey)
    let encryptedRefreshToken = cipher.update(tokens.refresh_token, 'utf8', 'hex')
    encryptedRefreshToken += cipher.final('hex')

    // Store OAuth tokens in database
    const { error: insertError } = await supabase
      .from('oauth_tokens')
      .upsert({
        organization_id,
        provider: 'gmail',
        email: userInfo.data.email,
        access_token: tokens.access_token,
        refresh_token: encryptedRefreshToken,
        expires_at: tokens.expiry_date ? new Date(tokens.expiry_date).toISOString() : null,
        scope: tokens.scope,
        token_type: tokens.token_type || 'Bearer',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'organization_id,provider,email'
      })

    if (insertError) {
      console.error('Database error storing tokens:', insertError)
      return NextResponse.redirect(
        `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=token_storage_failed`
      )
    }

    // Log analytics event
    await supabase.from('analytics_events').insert({
      organization_id,
      event_type: 'gmail_oauth_completed',
      entity_type: 'organization',
      entity_id: organization_id,
      properties: {
        email: userInfo.data.email,
        scopes: tokens.scope?.split(' ') || []
      }
    })

    // Redirect to success page
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}${redirect_to}?gmail_connected=true&email=${encodeURIComponent(userInfo.data.email)}`
    )

  } catch (error) {
    console.error('Gmail OAuth callback error:', error)
    return NextResponse.redirect(
      `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?error=oauth_callback_failed`
    )
  }
}

// Import google after OAuth2Client to avoid conflicts
import { google } from 'googleapis'