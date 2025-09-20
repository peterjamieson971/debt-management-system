import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import { createServiceClient } from '@/lib/supabase/server'

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

    // Verify organization exists
    const { data: organization, error } = await supabase
      .from('organizations')
      .select('id, name')
      .eq('id', organizationId)
      .single()

    if (error || !organization) {
      return NextResponse.json(
        { error: 'Organization not found' },
        { status: 404 }
      )
    }

    // Initialize OAuth2 client
    const oauth2Client = new OAuth2Client(
      process.env.GMAIL_CLIENT_ID,
      process.env.GMAIL_CLIENT_SECRET,
      `${process.env.NEXT_PUBLIC_APP_URL}/api/auth/gmail/callback`
    )

    // Generate authorization URL
    const scopes = [
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send',
      'https://www.googleapis.com/auth/gmail.modify',
      'https://www.googleapis.com/auth/userinfo.email'
    ]

    const authUrl = oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes,
      prompt: 'consent',
      state: JSON.stringify({
        organization_id: organizationId,
        redirect_to: url.searchParams.get('redirect_to') || '/dashboard'
      })
    })

    return NextResponse.json({
      authorization_url: authUrl,
      organization_id: organizationId,
      scopes
    })

  } catch (error) {
    console.error('Gmail OAuth authorization error:', error)
    return NextResponse.json(
      { error: 'Failed to generate authorization URL' },
      { status: 500 }
    )
  }
}