import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { z } from 'zod'

const sendEmailSchema = z.object({
  organization_id: z.string().uuid(),
  case_id: z.string().uuid().optional(),
  debtor_id: z.string().uuid().optional(),
  to_email: z.string().email(),
  from_email: z.string().email().optional(),
  subject: z.string(),
  content: z.string(),
  reply_to_message_id: z.string().optional(),
  reply_to_thread_id: z.string().optional(),
  cc_emails: z.array(z.string().email()).optional(),
  bcc_emails: z.array(z.string().email()).optional(),
  attachments: z.array(z.object({
    filename: z.string(),
    content: z.string(),
    mimeType: z.string()
  })).optional()
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
    const {
      organization_id,
      case_id,
      debtor_id,
      to_email,
      from_email,
      subject,
      content,
      reply_to_message_id,
      reply_to_thread_id,
      cc_emails,
      bcc_emails,
      attachments
    } = sendEmailSchema.parse(body)

    const supabase = await createServiceClient()

    // Determine which Gmail account to use
    let senderEmail = from_email
    if (!senderEmail) {
      // Get the first available Gmail connection for the organization
      const { data: tokenData, error } = await supabase
        .from('oauth_tokens')
        .select('email')
        .eq('organization_id', organization_id)
        .eq('provider', 'gmail')
        .limit(1)
        .single()

      if (error || !tokenData) {
        return NextResponse.json(
          { error: 'No Gmail connection found for this organization' },
          { status: 404 }
        )
      }
      senderEmail = tokenData.email
    }

    // Get OAuth tokens for the sender
    const { data: tokenData, error: tokenError } = await supabase
      .from('oauth_tokens')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('provider', 'gmail')
      .eq('email', senderEmail)
      .single()

    if (tokenError || !tokenData) {
      return NextResponse.json(
        { error: `Gmail tokens not found for ${senderEmail}` },
        { status: 404 }
      )
    }

    // Check rate limits
    const rateLimitResult = await checkRateLimit(supabase, organization_id, senderEmail)
    if (!rateLimitResult.allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded', details: rateLimitResult },
        { status: 429 }
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

    // Build email message
    const emailMessage = buildEmailMessage({
      to: to_email,
      from: senderEmail,
      subject,
      content,
      cc: cc_emails,
      bcc: bcc_emails,
      replyToMessageId: reply_to_message_id,
      attachments
    })

    // Send email
    const sendParams: any = {
      userId: 'me',
      requestBody: {
        raw: emailMessage
      }
    }

    // If replying to a thread, include thread ID
    if (reply_to_thread_id) {
      sendParams.requestBody.threadId = reply_to_thread_id
    }

    const response = await gmail.users.messages.send(sendParams)

    // Log the sent email
    const communicationLog = await supabase
      .from('communication_logs')
      .insert({
        organization_id,
        case_id,
        debtor_id,
        type: 'email',
        direction: 'outbound',
        subject,
        content,
        from_email: senderEmail,
        to_email,
        cc_emails,
        bcc_emails,
        external_id: response.data.id,
        gmail_message_id: response.data.id,
        gmail_thread_id: response.data.threadId,
        metadata: {
          sent_via: 'gmail_api',
          rate_limit_status: rateLimitResult,
          attachments: attachments?.map(a => ({ filename: a.filename, size: a.content.length }))
        },
        sent_at: new Date().toISOString()
      })
      .select()
      .single()

    // Update rate limit tracking
    await updateRateLimit(supabase, organization_id, senderEmail)

    // If this is part of a case, update case activity
    if (case_id) {
      await supabase
        .from('collection_cases')
        .update({
          last_contact_date: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', case_id)
    }

    return NextResponse.json({
      success: true,
      message_id: response.data.id,
      thread_id: response.data.threadId,
      communication_log_id: communicationLog.data?.id,
      sent_from: senderEmail,
      sent_to: to_email,
      sent_at: new Date().toISOString()
    })

  } catch (error) {
    console.error('Gmail send error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    )

    // Handle specific Gmail API errors
    if (error.code === 403) {
      return NextResponse.json(
        { error: 'Gmail API permission denied. Check OAuth scopes.' },
        { status: 403 }
      )
    }

    if (error.code === 429) {
      return NextResponse.json(
        { error: 'Gmail API rate limit exceeded' },
        { status: 429 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to send email' },
      { status: 500 }
    )
  }
}

function buildEmailMessage(params: {
  to: string
  from: string
  subject: string
  content: string
  cc?: string[]
  bcc?: string[]
  replyToMessageId?: string
  attachments?: Array<{ filename: string; content: string; mimeType: string }>
}): string {
  const boundary = 'boundary_' + Math.random().toString(36).substr(2, 15)

  let message = [
    `To: ${params.to}`,
    `From: ${params.from}`,
    `Subject: ${params.subject}`,
    'MIME-Version: 1.0'
  ]

  if (params.cc && params.cc.length > 0) {
    message.push(`Cc: ${params.cc.join(', ')}`)
  }

  if (params.bcc && params.bcc.length > 0) {
    message.push(`Bcc: ${params.bcc.join(', ')}`)
  }

  if (params.replyToMessageId) {
    message.push(`In-Reply-To: ${params.replyToMessageId}`)
    message.push(`References: ${params.replyToMessageId}`)
  }

  if (params.attachments && params.attachments.length > 0) {
    message.push(`Content-Type: multipart/mixed; boundary="${boundary}"`)
    message.push('')
    message.push(`--${boundary}`)
    message.push('Content-Type: text/html; charset=UTF-8')
    message.push('Content-Transfer-Encoding: 7bit')
    message.push('')
    message.push(params.content)

    for (const attachment of params.attachments) {
      message.push(`--${boundary}`)
      message.push(`Content-Type: ${attachment.mimeType}`)
      message.push(`Content-Disposition: attachment; filename="${attachment.filename}"`)
      message.push('Content-Transfer-Encoding: base64')
      message.push('')
      message.push(attachment.content)
    }

    message.push(`--${boundary}--`)
  } else {
    message.push('Content-Type: text/html; charset=UTF-8')
    message.push('')
    message.push(params.content)
  }

  return Buffer.from(message.join('\n')).toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function checkRateLimit(supabase: any, organizationId: string, email: string) {
  // Get rate limit settings
  const { data: settings } = await supabase
    .from('system_settings')
    .select('value')
    .eq('organization_id', organizationId)
    .eq('category', 'email')
    .eq('key', 'send_rate_limit')
    .single()

  const limits = settings?.value || { emails_per_minute: 10, emails_per_hour: 100 }

  // Check recent sends
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
  const oneMinuteAgo = new Date(Date.now() - 60 * 1000).toISOString()

  const { count: hourlyCount } = await supabase
    .from('communication_logs')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('from_email', email)
    .eq('direction', 'outbound')
    .gte('sent_at', oneHourAgo)

  const { count: minutelyCount } = await supabase
    .from('communication_logs')
    .select('*', { count: 'exact', head: true })
    .eq('organization_id', organizationId)
    .eq('from_email', email)
    .eq('direction', 'outbound')
    .gte('sent_at', oneMinuteAgo)

  return {
    allowed: (hourlyCount || 0) < limits.emails_per_hour && (minutelyCount || 0) < limits.emails_per_minute,
    hourly_count: hourlyCount || 0,
    hourly_limit: limits.emails_per_hour,
    minute_count: minutelyCount || 0,
    minute_limit: limits.emails_per_minute
  }
}

async function updateRateLimit(supabase: any, organizationId: string, email: string) {
  // Store rate limit tracking in system settings
  const trackingKey = `rate_limit_tracking_${email.replace('@', '_')}`

  await supabase
    .from('system_settings')
    .upsert({
      organization_id: organizationId,
      category: 'email',
      key: trackingKey,
      value: {
        last_send: new Date().toISOString(),
        email: email
      },
      description: `Rate limit tracking for ${email}`
    }, {
      onConflict: 'organization_id,category,key'
    })
}