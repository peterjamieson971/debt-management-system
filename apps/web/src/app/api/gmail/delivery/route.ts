import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { z } from 'zod'

const deliveryTrackingSchema = z.object({
  organization_id: z.string().uuid(),
  message_id: z.string(),
  check_type: z.enum(['delivery', 'bounce', 'read_receipt']).optional().default('delivery')
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
    const { organization_id, message_id, check_type } = deliveryTrackingSchema.parse(body)

    const supabase = await createServiceClient()

    // Get the communication log entry
    const { data: communicationLog, error: logError } = await supabase
      .from('communication_logs')
      .select('*, oauth_tokens!inner(email, access_token, refresh_token)')
      .eq('organization_id', organization_id)
      .eq('gmail_message_id', message_id)
      .single()

    if (logError || !communicationLog) {
      return NextResponse.json(
        { error: 'Communication log not found' },
        { status: 404 }
      )
    }

    // Get OAuth tokens
    const { data: tokenData, error: tokenError } = await supabase
      .from('oauth_tokens')
      .select('*')
      .eq('organization_id', organization_id)
      .eq('provider', 'gmail')
      .eq('email', communicationLog.from_email)
      .single()

    if (tokenError || !tokenData) {
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

    // Get message details
    const messageResponse = await gmail.users.messages.get({
      userId: 'me',
      id: message_id,
      format: 'full'
    })

    const message = messageResponse.data
    const headers = message.payload?.headers || []

    // Check for delivery status
    const deliveryStatus = await analyzeDeliveryStatus(gmail, message, communicationLog.to_email)

    // Update communication log with delivery information
    const updateData: any = {
      metadata: {
        ...communicationLog.metadata,
        delivery_status: deliveryStatus,
        last_delivery_check: new Date().toISOString()
      }
    }

    // Update status based on delivery results
    if (deliveryStatus.bounced) {
      updateData.status = 'bounced'
      updateData.delivery_status = 'bounced'
      updateData.bounce_reason = deliveryStatus.bounce_reason
    } else if (deliveryStatus.delivered) {
      updateData.status = 'delivered'
      updateData.delivery_status = 'delivered'
      updateData.delivered_at = deliveryStatus.delivered_at
    } else if (deliveryStatus.opened) {
      updateData.status = 'opened'
      updateData.delivery_status = 'opened'
      updateData.opened_at = deliveryStatus.opened_at
    }

    await supabase
      .from('communication_logs')
      .update(updateData)
      .eq('id', communicationLog.id)

    // If bounced, create a case note
    if (deliveryStatus.bounced) {
      await supabase.from('case_notes').insert({
        organization_id,
        case_id: communicationLog.case_id,
        user_id: null,
        note_type: 'bounce',
        content: `Email bounced: ${deliveryStatus.bounce_reason}. Consider alternative contact methods.`,
        metadata: {
          source: 'delivery_tracking',
          message_id: message_id,
          bounce_details: deliveryStatus
        }
      })

      // Update debtor's email status if it's a hard bounce
      if (deliveryStatus.bounce_type === 'hard') {
        await supabase
          .from('debtors')
          .update({
            email_status: 'invalid',
            last_contact_attempt: new Date().toISOString()
          })
          .eq('id', communicationLog.debtor_id)
      }
    }

    return NextResponse.json({
      success: true,
      message_id,
      delivery_status: deliveryStatus,
      communication_updated: true
    })

  } catch (error) {
    console.error('Delivery tracking error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to track delivery' },
      { status: 500 }
    )
  }
}

async function analyzeDeliveryStatus(gmail: any, message: any, recipientEmail: string) {
  const deliveryStatus = {
    delivered: false,
    bounced: false,
    opened: false,
    bounce_reason: null,
    bounce_type: null,
    delivered_at: null,
    opened_at: null,
    recipient_email: recipientEmail
  }

  try {
    // Check for bounce messages by looking for delivery failure notifications
    // This would typically involve checking for messages with specific subjects or content
    const bounceCheckResponse = await gmail.users.messages.list({
      userId: 'me',
      q: `from:mailer-daemon OR from:postmaster OR subject:"delivery failed" OR subject:"undelivered mail" to:${recipientEmail}`,
      maxResults: 10
    })

    if (bounceCheckResponse.data.messages) {
      for (const bounceMessage of bounceCheckResponse.data.messages) {
        const bounceDetails = await gmail.users.messages.get({
          userId: 'me',
          id: bounceMessage.id,
          format: 'full'
        })

        // Check if this bounce relates to our message
        const bounceContent = extractEmailBody(bounceDetails.data.payload)
        if (bounceContent.includes(message.id) || bounceContent.includes(recipientEmail)) {
          deliveryStatus.bounced = true
          deliveryStatus.bounce_reason = extractBounceReason(bounceContent)
          deliveryStatus.bounce_type = determineBounceType(bounceContent)
          break
        }
      }
    }

    // Check for delivery confirmations (less common with Gmail)
    if (!deliveryStatus.bounced) {
      const deliveryCheckResponse = await gmail.users.messages.list({
        userId: 'me',
        q: `subject:"delivery notification" OR subject:"message delivered" to:${recipientEmail}`,
        maxResults: 5
      })

      if (deliveryCheckResponse.data.messages) {
        for (const deliveryMessage of deliveryCheckResponse.data.messages) {
          const deliveryDetails = await gmail.users.messages.get({
            userId: 'me',
            id: deliveryMessage.id,
            format: 'full'
          })

          const deliveryContent = extractEmailBody(deliveryDetails.data.payload)
          if (deliveryContent.includes(message.id) || deliveryContent.includes(recipientEmail)) {
            deliveryStatus.delivered = true
            deliveryStatus.delivered_at = new Date(parseInt(deliveryDetails.data.internalDate)).toISOString()
            break
          }
        }
      }
    }

    // Check for read receipts (if enabled)
    const readReceiptResponse = await gmail.users.messages.list({
      userId: 'me',
      q: `subject:"read receipt" OR subject:"message read" from:${recipientEmail}`,
      maxResults: 5
    })

    if (readReceiptResponse.data.messages) {
      for (const readMessage of readReceiptResponse.data.messages) {
        const readDetails = await gmail.users.messages.get({
          userId: 'me',
          id: readMessage.id,
          format: 'full'
        })

        const readContent = extractEmailBody(readDetails.data.payload)
        if (readContent.includes(message.id)) {
          deliveryStatus.opened = true
          deliveryStatus.opened_at = new Date(parseInt(readDetails.data.internalDate)).toISOString()
          break
        }
      }
    }

    // If no bounce found and message was sent more than 1 hour ago, assume delivered
    const messageDate = new Date(parseInt(message.internalDate))
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
    if (!deliveryStatus.bounced && messageDate < oneHourAgo) {
      deliveryStatus.delivered = true
      deliveryStatus.delivered_at = new Date(parseInt(message.internalDate) + 60000).toISOString() // Assume delivered 1 minute after send
    }

  } catch (error) {
    console.error('Error analyzing delivery status:', error)
  }

  return deliveryStatus
}

function extractEmailBody(payload: any): string {
  if (payload.body.data) {
    return Buffer.from(payload.body.data, 'base64').toString()
  }

  if (payload.parts) {
    for (const part of payload.parts) {
      if (part.mimeType === 'text/plain' && part.body.data) {
        return Buffer.from(part.body.data, 'base64').toString()
      }
    }
  }

  return ''
}

function extractBounceReason(bounceContent: string): string {
  const reasons = [
    { pattern: /user unknown|no such user|user not found/i, reason: 'User not found' },
    { pattern: /mailbox full|quota exceeded|mailbox quota/i, reason: 'Mailbox full' },
    { pattern: /domain not found|no mx record/i, reason: 'Domain not found' },
    { pattern: /spam|blocked|blacklisted/i, reason: 'Blocked as spam' },
    { pattern: /relay denied|relaying denied/i, reason: 'Relay denied' },
    { pattern: /timeout|timed out/i, reason: 'Connection timeout' }
  ]

  for (const reason of reasons) {
    if (reason.pattern.test(bounceContent)) {
      return reason.reason
    }
  }

  return 'Unknown bounce reason'
}

function determineBounceType(bounceContent: string): 'hard' | 'soft' {
  const hardBouncePatterns = [
    /user unknown/i,
    /no such user/i,
    /user not found/i,
    /domain not found/i,
    /no mx record/i,
    /invalid recipient/i
  ]

  for (const pattern of hardBouncePatterns) {
    if (pattern.test(bounceContent)) {
      return 'hard'
    }
  }

  return 'soft'
}