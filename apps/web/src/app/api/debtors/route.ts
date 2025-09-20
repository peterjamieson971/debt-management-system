import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { z } from 'zod'

const createDebtorSchema = z.object({
  company_name: z.string().min(1),
  company_type: z.enum(['SME', 'Enterprise', 'Multinational']).optional(),
  primary_contact_name: z.string().optional(),
  primary_contact_email: z.string().email().optional(),
  primary_contact_phone: z.string().optional(),
  secondary_contacts: z.array(z.any()).optional().default([]),
  address: z.object({
    street: z.string().optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    postal_code: z.string().optional()
  }).optional(),
  country: z.enum(['AE', 'SA', 'KW', 'QA', 'BH', 'OM']).optional(),
  language_preference: z.enum(['en', 'ar']).optional().default('en'),
  risk_profile: z.enum(['low', 'medium', 'high']).optional().default('medium'),
  tags: z.array(z.string()).optional().default([]),
  metadata: z.record(z.any()).optional().default({})
})

const querySchema = z.object({
  page: z.string().optional().default('1'),
  limit: z.string().optional().default('20'),
  search: z.string().optional(),
  segment: z.string().optional(),
  country: z.string().optional(),
  risk_profile: z.string().optional()
})

export async function GET(request: NextRequest) {
  try {
    // Get user from auth header
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
      page,
      limit,
      search,
      segment,
      country,
      risk_profile
    } = querySchema.parse(queryParams)

    const pageNum = parseInt(page)
    const limitNum = parseInt(limit)
    const offset = (pageNum - 1) * limitNum

    const supabase = await createServiceClient()

    // Build query
    let query = supabase
      .from('debtors')
      .select(`
        *,
        collection_cases!inner(
          id,
          status,
          total_amount,
          outstanding_amount,
          created_at
        )
      `, { count: 'exact' })
      .range(offset, offset + limitNum - 1)
      .order('created_at', { ascending: false })

    // Apply filters
    if (search) {
      query = query.or(`company_name.ilike.%${search}%,primary_contact_email.ilike.%${search}%`)
    }

    if (segment) {
      query = query.eq('company_type', segment)
    }

    if (country) {
      query = query.eq('country', country)
    }

    if (risk_profile) {
      query = query.eq('risk_profile', risk_profile)
    }

    // Use the sample organization ID from our database
    query = query.eq('organization_id', '550e8400-e29b-41d4-a716-446655440000')

    const { data: debtors, error, count } = await query

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to fetch debtors' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      debtors: debtors || [],
      total: count || 0,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil((count || 0) / limitNum)
    })

  } catch (error) {
    console.error('Debtors GET error:', error)

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
    // Get user from auth header
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const debtorData = createDebtorSchema.parse(body)

    const supabase = await createServiceClient()

    // Use the sample organization ID from our database
    const { data: debtor, error } = await supabase
      .from('debtors')
      .insert({
        ...debtorData,
        organization_id: '550e8400-e29b-41d4-a716-446655440000'
      })
      .select()
      .single()

    if (error) {
      console.error('Database error:', error)
      return NextResponse.json(
        { error: 'Failed to create debtor' },
        { status: 500 }
      )
    }

    // Log analytics event
    await supabase.from('analytics_events').insert({
      organization_id: '550e8400-e29b-41d4-a716-446655440000',
      event_type: 'debtor_created',
      entity_type: 'debtor',
      entity_id: debtor.id,
      properties: {
        company_type: debtor.company_type,
        country: debtor.country,
        risk_profile: debtor.risk_profile
      }
    })

    return NextResponse.json({
      debtor
    }, { status: 201 })

  } catch (error) {
    console.error('Debtor creation error:', error)

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