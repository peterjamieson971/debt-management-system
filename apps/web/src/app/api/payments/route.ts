import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createPaymentSchema = z.object({
  debtor_id: z.string().uuid(),
  case_ids: z.array(z.string().uuid()).optional(), // Specific cases to apply payment to
  amount: z.number().positive(),
  currency: z.string().default('USD'),
  payment_method: z.enum(['bank_transfer', 'card', 'cash', 'check', 'other']),
  reference_number: z.string().optional(),
  payment_date: z.string().optional(), // ISO date string, defaults to now
  notes: z.string().optional(),
  external_transaction_id: z.string().optional()
})

const queryPaymentsSchema = z.object({
  debtor_id: z.string().uuid().optional(),
  case_id: z.string().uuid().optional(),
  status: z.string().optional(),
  payment_method: z.string().optional(),
  from_date: z.string().optional(),
  to_date: z.string().optional(),
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20')
})

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
    const queryParams = Object.fromEntries(url.searchParams)
    const {
      debtor_id,
      case_id,
      status,
      payment_method,
      from_date,
      to_date,
      page,
      limit
    } = queryPaymentsSchema.parse(queryParams)

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const offset = (pageNum - 1) * limitNum

    const supabase = await createServiceClient()

    let query = supabase
      .from('payments')
      .select(`
        *,
        debtors!inner(
          id,
          company_name,
          primary_contact_name,
          primary_contact_email
        )
      `, { count: 'exact' })
      .eq('organization_id', '550e8400-e29b-41d4-a716-446655440000')
      .order('payment_date', { ascending: false })
      .range(offset, offset + limitNum - 1)

    // Apply filters
    if (debtor_id) {
      query = query.eq('debtor_id', debtor_id)
    }

    if (case_id) {
      query = query.contains('case_ids', [case_id])
    }

    if (status) {
      query = query.eq('status', status)
    }

    if (payment_method) {
      query = query.eq('payment_method', payment_method)
    }

    if (from_date) {
      query = query.gte('payment_date', from_date)
    }

    if (to_date) {
      query = query.lte('payment_date', to_date)
    }

    const { data: payments, error, count } = await query

    if (error) {
      console.error('Failed to fetch payments:', error)
      return NextResponse.json(
        { error: 'Failed to fetch payments' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      payments: payments || [],
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((count || 0) / limitNum)
    })

  } catch (error) {
    console.error('Payments GET error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

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
    const paymentData = createPaymentSchema.parse(body)

    const supabase = await createServiceClient()

    // Verify debtor exists and get their active cases
    const { data: debtor, error: debtorError } = await supabase
      .from('debtors')
      .select(`
        id,
        company_name,
        collection_cases!inner(
          id,
          status,
          outstanding_amount,
          total_amount,
          currency
        )
      `)
      .eq('id', paymentData.debtor_id)
      .eq('organization_id', '550e8400-e29b-41d4-a716-446655440000')
      .single()

    if (debtorError || !debtor) {
      return NextResponse.json(
        { error: 'Debtor not found' },
        { status: 404 }
      )
    }

    // Get active cases for this debtor
    const activeCases = debtor.collection_cases.filter(c => c.status === 'active' && c.outstanding_amount > 0)

    if (activeCases.length === 0) {
      return NextResponse.json(
        { error: 'No active cases found for this debtor' },
        { status: 400 }
      )
    }

    // Determine which cases to apply payment to
    let casesToUpdate = activeCases
    if (paymentData.case_ids && paymentData.case_ids.length > 0) {
      casesToUpdate = activeCases.filter(c => paymentData.case_ids!.includes(c.id))
      if (casesToUpdate.length === 0) {
        return NextResponse.json(
          { error: 'Specified case IDs not found or not active' },
          { status: 400 }
        )
      }
    }

    // Create payment record
    const { data: payment, error: paymentError } = await supabase
      .from('payments')
      .insert({
        organization_id: '550e8400-e29b-41d4-a716-446655440000',
        debtor_id: paymentData.debtor_id,
        case_ids: casesToUpdate.map(c => c.id),
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
      .select(`
        *,
        debtors!inner(
          id,
          company_name,
          primary_contact_name,
          primary_contact_email
        )
      `)
      .single()

    if (paymentError) {
      console.error('Failed to create payment:', paymentError)
      return NextResponse.json(
        { error: 'Failed to create payment record' },
        { status: 500 }
      )
    }

    // Apply payment to cases using FIFO (First In, First Out) or specified cases
    let remainingAmount = paymentData.amount
    const caseUpdates = []

    // Sort cases by creation date (oldest first) for FIFO allocation
    const sortedCases = casesToUpdate.sort((a, b) =>
      new Date(a.created_at || '').getTime() - new Date(b.created_at || '').getTime()
    )

    for (const caseData of sortedCases) {
      if (remainingAmount <= 0) break

      const paymentToApply = Math.min(remainingAmount, caseData.outstanding_amount)
      const newOutstanding = caseData.outstanding_amount - paymentToApply
      const newStatus = newOutstanding === 0 ? 'resolved' : caseData.status

      // Update case
      const { error: updateError } = await supabase
        .from('collection_cases')
        .update({
          outstanding_amount: newOutstanding,
          status: newStatus,
          last_payment_date: paymentData.payment_date || new Date().toISOString(),
          last_payment_amount: paymentToApply
        })
        .eq('id', caseData.id)

      if (updateError) {
        console.error(`Failed to update case ${caseData.id}:`, updateError)
      } else {
        caseUpdates.push({
          case_id: caseData.id,
          payment_applied: paymentToApply,
          new_outstanding: newOutstanding,
          status: newStatus
        })
      }

      remainingAmount -= paymentToApply
    }

    // Log analytics event
    await supabase.from('analytics_events').insert({
      organization_id: '550e8400-e29b-41d4-a716-446655440000',
      event_type: 'payment_recorded',
      entity_type: 'payment',
      entity_id: payment.id,
      properties: {
        debtor_id: paymentData.debtor_id,
        amount: paymentData.amount,
        currency: paymentData.currency,
        payment_method: paymentData.payment_method,
        cases_updated: caseUpdates.length,
        cases_resolved: caseUpdates.filter(u => u.status === 'resolved').length
      }
    })

    // Create communication log for payment confirmation
    await supabase.from('communication_logs').insert({
      organization_id: '550e8400-e29b-41d4-a716-446655440000',
      debtor_id: paymentData.debtor_id,
      channel: 'system',
      direction: 'inbound',
      status: 'received',
      subject: 'Payment Received',
      content: `Payment of ${paymentData.amount} ${paymentData.currency} received via ${paymentData.payment_method}`,
      ai_generated: false,
      metadata: {
        payment_id: payment.id,
        amount: paymentData.amount,
        currency: paymentData.currency,
        reference: paymentData.reference_number,
        cases_updated: caseUpdates
      }
    })

    return NextResponse.json({
      payment,
      case_updates: caseUpdates,
      remaining_unallocated: remainingAmount,
      cases_resolved: caseUpdates.filter(u => u.status === 'resolved').length
    }, { status: 201 })

  } catch (error) {
    console.error('Payment creation error:', error)

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