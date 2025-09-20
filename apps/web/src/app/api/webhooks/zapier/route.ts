import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'
import crypto from 'crypto'

const webhookSchema = z.object({
  event: z.enum(['email.received', 'email.bounced', 'email.sent']),
  data: z.any()
})

const emailReceivedSchema = z.object({
  message_id: z.string(),
  thread_id: z.string(),
  from: z.string().email(),
  to: z.string().email(),
  subject: z.string(),
  body: z.string(),
  attachments: z.array(z.any()).optional().default([])
})

function verifyZapierSignature(payload: string, signature: string): boolean {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.ZAPIER_WEBHOOK_SECRET!)
    .update(payload)
    .digest('hex')

  return crypto.timingSafeEqual(
    Buffer.from(`sha256=${expectedSignature}`),
    Buffer.from(signature)
  )
}

export async function POST(request: NextRequest) {
  try {
    const signature = request.headers.get('X-Zapier-Signature')
    const payload = await request.text()

    // Verify webhook signature
    if (!signature || !verifyZapierSignature(payload, signature)) {
      return NextResponse.json(
        { error: 'Invalid signature' },
        { status: 401 }
      )
    }

    const body = JSON.parse(payload)
    const { event, data } = webhookSchema.parse(body)

    const supabase = await createServiceClient()

    switch (event) {
      case 'email.received':
        return await handleEmailReceived(data, supabase)

      case 'email.bounced':
        return await handleEmailBounced(data, supabase)

      case 'email.sent':
        return await handleEmailSent(data, supabase)

      default:
        return NextResponse.json(
          { error: 'Unknown event type' },
          { status: 400 }
        )
    }

  } catch (error) {
    console.error('Webhook processing error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid webhook payload', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

async function handleEmailReceived(data: any, supabase: any) {
  const emailData = emailReceivedSchema.parse(data)

  // Find related collection case based on email address
  const { data: cases } = await supabase
    .from('collection_cases')
    .select(`
      *,
      debtors!inner(*)
    `)
    .eq('debtors.primary_contact_email', emailData.from)

  if (!cases || cases.length === 0) {
    // Log as unmatched email for review
    await supabase.from('communication_logs').insert({
      organization_id: null, // Will need to be handled by admin
      channel: 'email',
      direction: 'inbound',
      status: 'received',
      subject: emailData.subject,
      content: emailData.body,
      ai_generated: false,
      metadata: {
        message_id: emailData.message_id,
        thread_id: emailData.thread_id,
        from: emailData.from,
        unmatched: true
      }
    })

    return NextResponse.json({
      processed: true,
      matched: false,
      reason: 'No matching case found - logged for review'
    })
  }

  const collectionCase = cases[0]

  // Simply log the communication - no AI processing here
  await supabase.from('communication_logs').insert({
    organization_id: collectionCase.organization_id,
    case_id: collectionCase.id,
    debtor_id: collectionCase.debtor_id,
    channel: 'email',
    direction: 'inbound',
    status: 'received',
    subject: emailData.subject,
    content: emailData.body,
    ai_generated: false,
    metadata: {
      message_id: emailData.message_id,
      thread_id: emailData.thread_id,
      from: emailData.from
    }
  })

  // Update last contact date only
  await supabase
    .from('collection_cases')
    .update({
      last_contact_date: new Date().toISOString()
    })
    .eq('id', collectionCase.id)

  return NextResponse.json({
    processed: true,
    matched: true,
    case_id: collectionCase.id
  })
}

async function handleEmailBounced(data: any, supabase: any) {
  // Log bounced email - zapier_task_id helps link to original outbound message
  if (data.zapier_task_id) {
    await supabase
      .from('communication_logs')
      .update({
        status: 'bounced',
        metadata: { ...data, bounce_reason: data.reason }
      })
      .eq('zapier_task_id', data.zapier_task_id)
  } else {
    // Log as standalone bounce record
    await supabase.from('communication_logs').insert({
      channel: 'email',
      direction: 'outbound',
      status: 'bounced',
      metadata: data
    })
  }

  return NextResponse.json({ processed: true })
}

async function handleEmailSent(data: any, supabase: any) {
  // Update communication log status to confirm delivery
  if (data.zapier_task_id) {
    await supabase
      .from('communication_logs')
      .update({
        status: 'sent',
        sent_at: new Date().toISOString(),
        metadata: { ...data }
      })
      .eq('zapier_task_id', data.zapier_task_id)
  }

  return NextResponse.json({ processed: true })
}