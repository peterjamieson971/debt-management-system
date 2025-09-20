import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const recordPaymentSchema = z.object({
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  payment_method: z.enum(['bank_transfer', 'card', 'cash', 'check', 'other']),
  reference_number: z.string().optional(),
  payment_date: z.string().optional(), // ISO date string
  notes: z.string().optional(),
  external_transaction_id: z.string().optional(),
  partial_payment: z.boolean().default(true) // Whether this resolves the case completely
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

    const supabase = await createServiceClient()

    // Get case details
    const { data: collectionCase, error: caseError } = await supabase
      .from('collection_cases')
      .select(`
        id,
        debtor_id,
        total_amount,
        outstanding_amount,
        currency,
        status,
        last_payment_date,
        last_payment_amount,
        debtors!inner(
          company_name,
          primary_contact_name
        )
      `)
      .eq('id', params.id)
      .eq('organization_id', '550e8400-e29b-41d4-a716-446655440000')
      .single()

    if (caseError || !collectionCase) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      )
    }

    // Get payment history for this case
    const { data: payments, error: paymentsError } = await supabase
      .from('payments')
      .select(`
        id,
        amount,
        currency,
        payment_method,
        reference_number,
        payment_date,
        status,
        notes,
        processed_at
      `)
      .contains('case_ids', [params.id])
      .eq('organization_id', '550e8400-e29b-41d4-a716-446655440000')
      .order('payment_date', { ascending: false })

    if (paymentsError) {
      console.error('Failed to fetch payment history:', paymentsError)
      return NextResponse.json(
        { error: 'Failed to fetch payment history' },
        { status: 500 }
      )
    }

    // Calculate payment summary
    const totalPayments = payments?.reduce((sum, p) => sum + p.amount, 0) || 0
    const paymentCount = payments?.length || 0

    return NextResponse.json({
      case: {
        id: collectionCase.id,
        debtor_id: collectionCase.debtor_id,
        company_name: collectionCase.debtors.company_name,
        total_amount: collectionCase.total_amount,
        outstanding_amount: collectionCase.outstanding_amount,
        currency: collectionCase.currency || 'USD',
        status: collectionCase.status,
        last_payment_date: collectionCase.last_payment_date,
        last_payment_amount: collectionCase.last_payment_amount
      },
      payment_summary: {
        total_payments: totalPayments,
        payment_count: paymentCount,
        amount_paid: collectionCase.total_amount - collectionCase.outstanding_amount,
        percentage_paid: collectionCase.total_amount > 0 ?
          ((collectionCase.total_amount - collectionCase.outstanding_amount) / collectionCase.total_amount * 100) : 0
      },
      payment_history: payments || []
    })

  } catch (error) {
    console.error('Case payments GET error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

export async function POST(
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

    const body = await request.json()
    const paymentData = recordPaymentSchema.parse(body)

    const supabase = await createServiceClient()

    // Get case details
    const { data: collectionCase, error: caseError } = await supabase
      .from('collection_cases')
      .select(`
        *,
        debtors!inner(
          id,
          company_name,
          primary_contact_name,
          primary_contact_email
        )
      `)
      .eq('id', params.id)
      .eq('organization_id', '550e8400-e29b-41d4-a716-446655440000')
      .single()

    if (caseError || !collectionCase) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      )
    }

    if (collectionCase.status === 'resolved') {
      return NextResponse.json(
        { error: 'Cannot add payment to resolved case' },
        { status: 400 }
      )
    }

    if (paymentData.amount > collectionCase.outstanding_amount) {
      return NextResponse.json(
        { error: `Payment amount (${paymentData.amount}) exceeds outstanding amount (${collectionCase.outstanding_amount})` },
        { status: 400 }
      )
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        organization_id: collectionCase.organization_id,
        debtor_id: collectionCase.debtor_id,
        case_ids: [params.id],
        amount: paymentData.amount,
        currency: paymentData.currency,
        payment_method: paymentData.payment_method,
        reference_number: paymentData.reference_number,
        payment_date: paymentData.payment_date || new Date().toISOString(),
        notes: paymentData.notes,
        external_transaction_id: paymentData.external_transaction_id,
        status: 'completed',
        processed_at: new Date().toISOString()
      })
      .select()
      .single()

    if (paymentError) {
      console.error('Failed to create payment:', paymentError)
      return NextResponse.json(
        { error: 'Failed to record payment' },
        { status: 500 }
      )
    }

    // Update case
    const newOutstanding = collectionCase.outstanding_amount - paymentData.amount
    const newStatus = newOutstanding === 0 || !paymentData.partial_payment ? 'resolved' : collectionCase.status

    const { data: updatedCase, error: updateError } = await supabase
      .from('collection_cases')
      .update({
        outstanding_amount: newOutstanding,
        status: newStatus,
        last_payment_date: paymentData.payment_date || new Date().toISOString(),
        last_payment_amount: paymentData.amount,
        resolved_at: newStatus === 'resolved' ? new Date().toISOString() : null
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update case:', updateError)
      return NextResponse.json(
        { error: 'Payment recorded but failed to update case' },
        { status: 500 }
      )
    }

    // Log communication entry for payment received
    await supabase.from('communication_logs').insert({
      organization_id: collectionCase.organization_id,
      case_id: params.id,
      debtor_id: collectionCase.debtor_id,
      channel: 'system',
      direction: 'inbound',
      status: 'received',
      subject: 'Payment Received',
      content: `Payment of ${paymentData.amount} ${paymentData.currency} received via ${paymentData.payment_method}${paymentData.reference_number ? ` (Ref: ${paymentData.reference_number})` : ''}`,
      ai_generated: false,
      metadata: {
        payment_id: payment.id,
        amount: paymentData.amount,
        currency: paymentData.currency,
        method: paymentData.payment_method,
        reference: paymentData.reference_number,
        case_resolved: newStatus === 'resolved'
      }
    })

    // Log analytics event
    await supabase.from('analytics_events').insert({
      organization_id: collectionCase.organization_id,
      event_type: newStatus === 'resolved' ? 'case_resolved' : 'payment_received',
      entity_type: 'collection_case',
      entity_id: params.id,
      properties: {
        payment_id: payment.id,
        amount: paymentData.amount,
        currency: paymentData.currency,
        payment_method: paymentData.payment_method,
        outstanding_before: collectionCase.outstanding_amount,
        outstanding_after: newOutstanding,
        case_resolved: newStatus === 'resolved',
        debtor_id: collectionCase.debtor_id
      }
    })

    // If case is resolved, trigger thank you communication
    if (newStatus === 'resolved') {
      // This could trigger an automated thank you email workflow
      console.log(`Case ${params.id} resolved - consider sending thank you communication`)
    }

    return NextResponse.json({
      payment,
      case_update: {
        id: updatedCase.id,
        previous_outstanding: collectionCase.outstanding_amount,
        new_outstanding: newOutstanding,
        status: newStatus,
        resolved: newStatus === 'resolved'
      },
      payment_summary: {
        total_paid: collectionCase.total_amount - newOutstanding,
        percentage_paid: collectionCase.total_amount > 0 ?
          ((collectionCase.total_amount - newOutstanding) / collectionCase.total_amount * 100) : 0
      }
    }, { status: 201 })

  } catch (error) {
    console.error('Case payment creation error:', error)

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