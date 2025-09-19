import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createCaseSchema = z.object({
  debtor_id: z.string().uuid(),
  invoice_ids: z.array(z.string().uuid()),
  workflow_id: z.string().uuid().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional().default('medium'),
  assigned_to: z.string().uuid().optional(),
  notes: z.string().optional()
})

const querySchema = z.object({
  status: z.string().optional(),
  priority: z.string().optional(),
  assigned_to: z.string().optional(),
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
      status,
      priority,
      assigned_to,
      page,
      limit
    } = querySchema.parse(queryParams)

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const offset = (pageNum - 1) * limitNum

    const supabase = await createServiceClient()

    let query = supabase
      .from('collection_cases')
      .select(`
        *,
        debtors!inner(
          id,
          company_name,
          primary_contact_email,
          country,
          risk_profile
        ),
        users(
          id,
          full_name,
          email
        ),
        communication_logs(
          id,
          channel,
          direction,
          status,
          created_at
        )
      `, { count: 'exact' })
      .range(offset, offset + limitNum - 1)
      .order('created_at', { ascending: false })

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }

    if (priority) {
      query = query.eq('priority', priority)
    }

    if (assigned_to) {
      query = query.eq('assigned_to', assigned_to)
    }

    // For demo purposes, using placeholder organization_id
    query = query.eq('organization_id', 'placeholder-org-id')

    const { data: cases, error, count } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch cases' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      cases: cases || [],
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((count || 0) / limitNum)
    })

  } catch (error) {
    console.error('Cases GET error:', error)

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
    const caseData = createCaseSchema.parse(body)

    const supabase = await createServiceClient()

    // Get invoice details to calculate totals
    const { data: invoices, error: invoiceError } = await supabase
      .from('invoices')
      .select('amount, currency')
      .in('id', caseData.invoice_ids)

    if (invoiceError || !invoices.length) {
      return NextResponse.json(
        { error: 'Invalid invoice IDs' },
        { status: 400 }
      )
    }

    const totalAmount = invoices.reduce((sum, inv) => sum + inv.amount, 0)

    // Create collection case
    const { data: collectionCase, error } = await supabase
      .from('collection_cases')
      .insert({
        ...caseData,
        organization_id: 'placeholder-org-id',
        total_amount: totalAmount,
        outstanding_amount: totalAmount,
        status: 'active',
        current_stage: 1,
        ai_strategy: {},
        metadata: {}
      })
      .select(`
        *,
        debtors!inner(
          id,
          company_name,
          primary_contact_email,
          country
        )
      `)
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create case' },
        { status: 500 }
      )
    }

    // Log analytics event
    await supabase.from('analytics_events').insert({
      organization_id: 'placeholder-org-id',
      event_type: 'case_created',
      entity_type: 'collection_case',
      entity_id: collectionCase.id,
      properties: {
        debtor_id: caseData.debtor_id,
        total_amount: totalAmount,
        invoice_count: caseData.invoice_ids.length,
        priority: caseData.priority
      }
    })

    return NextResponse.json({
      case: collectionCase
    }, { status: 201 })

  } catch (error) {
    console.error('Case creation error:', error)

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