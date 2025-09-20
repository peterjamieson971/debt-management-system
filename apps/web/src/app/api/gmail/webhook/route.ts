import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { z } from 'zod'

const pushNotificationSchema = z.object({
  message: z.object({
    data: z.string(),
    messageId: z.string(),
    publishTime: z.string()
  }),
  subscription: z.string()
})

export async function POST(request: NextRequest) {
  try {
    // Verify webhook authenticity (in production, verify with Google Cloud Pub/Sub)
    const body = await request.json()
    const { message, subscription } = pushNotificationSchema.parse(body)

    // Decode the message data
    const decodedData = JSON.parse(Buffer.from(message.data, 'base64').toString())
    const { emailAddress, historyId } = decodedData

    const supabase = await createServiceClient()

    // Find the organization and OAuth tokens for this email
    const { data: tokenData, error } = await supabase
      .from('oauth_tokens')
      .select('*, organizations(id, name)')
      .eq('provider', 'gmail')
      .eq('email', emailAddress)
      .single()

    if (error || !tokenData) {
      console.error('Gmail tokens not found for email:', emailAddress)
      return NextResponse.json({ success: true }) // Return success to avoid retries
    }

    // Get the last processed history ID from settings
    const { data: settingsData } = await supabase
      .from('system_settings')
      .select('value')
      .eq('organization_id', tokenData.organization_id)
      .eq('category', 'email')
      .eq('key', `gmail_watch_${emailAddress}`)
      .single()

    const lastHistoryId = settingsData?.value?.history_id || '1'

    // Only process if this is a new history ID
    if (parseInt(historyId) <= parseInt(lastHistoryId)) {
      return NextResponse.json({ success: true })
    }

    // Decrypt the refresh token
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

    // Get history since last processed ID
    const historyResponse = await gmail.users.history.list({
      userId: 'me',
      startHistoryId: lastHistoryId,
      historyTypes: ['messageAdded']
    })

    if (historyResponse.data.history) {
      for (const historyItem of historyResponse.data.history) {
        if (historyItem.messagesAdded) {
          for (const messageAdded of historyItem.messagesAdded) {
            await processNewEmail(
              gmail,
              messageAdded.message!.id!,
              tokenData.organization_id,
              emailAddress,
              supabase
            )
          }
        }
      }
    }

    // Update the last processed history ID
    await supabase
      .from('system_settings')
      .update({
        value: {
          ...settingsData?.value,
          history_id: historyId,
          last_processed: new Date().toISOString()
        }
      })
      .eq('organization_id', tokenData.organization_id)
      .eq('category', 'email')
      .eq('key', `gmail_watch_${emailAddress}`)

    return NextResponse.json({ success: true })

  } catch (error) {
    console.error('Gmail webhook processing error:', error)
    return NextResponse.json({ success: true }) // Return success to avoid retries
  }
}

async function processNewEmail(
  gmail: any,
  messageId: string,
  organizationId: string,
  emailAddress: string,
  supabase: any
) {
  try {
    // Get the full message
    const messageResponse = await gmail.users.messages.get({
      userId: 'me',
      id: messageId,
      format: 'full'
    })

    const message = messageResponse.data
    const headers = message.payload.headers

    // Extract email details
    const fromHeader = headers.find((h: any) => h.name === 'From')
    const toHeader = headers.find((h: any) => h.name === 'To')
    const subjectHeader = headers.find((h: any) => h.name === 'Subject')
    const dateHeader = headers.find((h: any) => h.name === 'Date')
    const messageIdHeader = headers.find((h: any) => h.name === 'Message-ID')

    const fromEmail = extractEmailAddress(fromHeader?.value || '')
    const toEmail = extractEmailAddress(toHeader?.value || '')
    const subject = subjectHeader?.value || ''
    const receivedDate = new Date(dateHeader?.value || message.internalDate)
    const externalMessageId = messageIdHeader?.value || ''

    // Get email body
    const body = extractEmailBody(message.payload)

    // Check if this is related to a debtor (by email or subject patterns)
    const { data: debtorData } = await supabase
      .from('debtors')
      .select('id, email, name, organization_id')
      .eq('organization_id', organizationId)
      .or(`email.eq.${fromEmail},contact_emails.cs.{${fromEmail}}`)
      .single()

    // Check if this is a reply to an existing case (by subject or thread)
    let caseId = null
    if (debtorData) {
      const { data: caseData } = await supabase
        .from('collection_cases')
        .select('id')
        .eq('debtor_id', debtorData.id)
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      caseId = caseData?.id
    }

    // Store the email as a communication log
    await supabase.from('communication_logs').insert({
      organization_id: organizationId,
      case_id: caseId,
      debtor_id: debtorData?.id,
      type: 'email',
      direction: 'inbound',
      subject,
      content: body,
      from_email: fromEmail,
      to_email: toEmail,
      external_id: externalMessageId,
      gmail_message_id: messageId,
      gmail_thread_id: message.threadId,
      metadata: {
        gmail_labels: message.labelIds,
        received_via: 'gmail_webhook',
        original_headers: headers.reduce((acc: any, h: any) => {
          acc[h.name] = h.value
          return acc
        }, {})
      },
      sent_at: receivedDate.toISOString()
    })

    // If this is from a debtor, analyze the sentiment and trigger workflows
    if (debtorData && caseId) {
      // Trigger AI analysis of the email content
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/ai/analyze-email`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${process.env.INTERNAL_API_KEY}`
        },
        body: JSON.stringify({
          organization_id: organizationId,
          case_id: caseId,
          email_content: body,
          subject,
          from_email: fromEmail
        })
      })
    }

    console.log(`Processed incoming email from ${fromEmail} for organization ${organizationId}`)

  } catch (error) {
    console.error('Error processing email:', error)
  }
}

function extractEmailAddress(headerValue: string): string {
  const match = headerValue.match(/<([^>]+)>/)
  return match ? match[1] : headerValue.split(' ')[0]
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
      if (part.mimeType === 'text/html' && part.body.data) {
        // Basic HTML to text conversion (in production, use a proper library)
        const html = Buffer.from(part.body.data, 'base64').toString()
        return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ')
      }
    }
  }

  return ''
}