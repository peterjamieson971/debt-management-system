import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateWithSmartRouting } from '@/lib/ai/router'
import { PROMPTS } from '@/lib/ai/prompts'
import { z } from 'zod'
import crypto from 'crypto'

const webhookSchema = z.object({
  event: z.enum(['email.received', 'email.bounced', 'payment.received', 'email.sent']),
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

const paymentReceivedSchema = z.object({
  payment_id: z.string(),
  debtor_id: z.string(),
  amount: z.number(),
  currency: z.string(),
  reference: z.string(),
  method: z.string()
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

      case 'payment.received':
        return await handlePaymentReceived(data, supabase)

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

  // Find related collection case based on email thread or subject
  const { data: cases } = await supabase
    .from('collection_cases')
    .select(`
      *,
      debtors!inner(*)
    `)
    .eq('debtors.primary_contact_email', emailData.from)

  if (!cases || cases.length === 0) {
    return NextResponse.json({
      processed: false,
      reason: 'No matching case found'
    })
  }

  const collectionCase = cases[0]

  // Use AI to analyze the email response
  const analysisResult = await generateWithSmartRouting(
    'simple',
    PROMPTS.responseAnalysis.replace('{{email_content}}', emailData.body),
    {
      case: collectionCase,
      debtor: collectionCase.debtors
    }
  )

  let analysis = {}
  try {
    analysis = JSON.parse(analysisResult.content)
  } catch {
    analysis = { intent: 'unknown', sentiment: 0.5, urgency: 'medium' }
  }

  // Log the communication
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
    sentiment_score: analysis.sentiment || 0.5,
    intent_classification: analysis.intent || 'unknown',
    response_required: analysis.urgency !== 'low',
    metadata: {
      message_id: emailData.message_id,
      thread_id: emailData.thread_id,
      analysis
    }
  })

  // Update case based on analysis
  if (analysis.intent === 'payment_promise') {
    await supabase
      .from('collection_cases')
      .update({
        payment_promise_date: analysis.promised_date,
        status: 'promise_received',
        last_contact_date: new Date().toISOString()
      })
      .eq('id', collectionCase.id)
  }

  return NextResponse.json({
    processed: true,
    case_updated: true,
    analysis
  })
}

async function handlePaymentReceived(data: any, supabase: any) {
  const paymentData = paymentReceivedSchema.parse(data)

  // Create payment record
  const { data: payment } = await supabase
    .from('payments')
    .insert({
      organization_id: 'placeholder-org-id',
      debtor_id: paymentData.debtor_id,
      amount: paymentData.amount,
      currency: paymentData.currency,
      payment_method: paymentData.method,
      reference_number: paymentData.reference,
      status: 'completed',
      processed_at: new Date().toISOString()
    })
    .select()
    .single()

  // Update related cases
  const { data: cases } = await supabase
    .from('collection_cases')
    .select('*')
    .eq('debtor_id', paymentData.debtor_id)
    .eq('status', 'active')

  for (const case_ of cases || []) {
    const newOutstanding = Math.max(0, case_.outstanding_amount - paymentData.amount)
    const newStatus = newOutstanding === 0 ? 'resolved' : case_.status

    await supabase
      .from('collection_cases')
      .update({
        outstanding_amount: newOutstanding,
        status: newStatus
      })
      .eq('id', case_.id)
  }

  return NextResponse.json({
    processed: true,
    payment_id: payment?.id
  })
}

async function handleEmailBounced(data: any, supabase: any) {
  // Log bounced email
  await supabase.from('communication_logs').insert({
    organization_id: 'placeholder-org-id',
    channel: 'email',
    direction: 'outbound',
    status: 'bounced',
    metadata: data
  })

  return NextResponse.json({ processed: true })
}

async function handleEmailSent(data: any, supabase: any) {
  // Update communication log status
  if (data.zapier_task_id) {
    await supabase
      .from('communication_logs')
      .update({ status: 'sent' })
      .eq('zapier_task_id', data.zapier_task_id)
  }

  return NextResponse.json({ processed: true })
}