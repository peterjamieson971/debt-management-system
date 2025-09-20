import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { workflowEngine } from '@/lib/workflows/debt-collection'
import { z } from 'zod'

const executeWorkflowSchema = z.object({
  case_id: z.string().uuid(),
  workflow_id: z.string().optional(),
  force_restart: z.boolean().default(false),
  test_mode: z.boolean().default(false)
})

const batchExecuteSchema = z.object({
  case_ids: z.array(z.string().uuid()),
  workflow_id: z.string().optional(),
  filters: z.object({
    status: z.string().optional(),
    priority: z.string().optional(),
    days_overdue_min: z.number().optional(),
    days_overdue_max: z.number().optional()
  }).optional()
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
    const url = new URL(request.url)
    const isBatch = url.searchParams.get('batch') === 'true'

    if (isBatch) {
      return await handleBatchExecution(body)
    } else {
      return await handleSingleExecution(body)
    }

  } catch (error) {
    console.error('Workflow execution error:', error)

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

async function handleSingleExecution(body: any) {
  const { case_id, workflow_id, force_restart, test_mode } = executeWorkflowSchema.parse(body)

  const supabase = await createServiceClient()

  // Check if case exists and is valid for workflow execution
  const { data: collectionCase, error } = await supabase
    .from('collection_cases')
    .select(`
      id,
      status,
      outstanding_amount,
      priority,
      created_at,
      organization_id,
      next_action_due
    `)
    .eq('id', case_id)
    .eq('organization_id', '550e8400-e29b-41d4-a716-446655440000')
    .single()

  if (error || !collectionCase) {
    return NextResponse.json(
      { error: 'Case not found' },
      { status: 404 }
    )
  }

  if (collectionCase.status === 'resolved' && !force_restart) {
    return NextResponse.json(
      { error: 'Case is already resolved. Use force_restart=true to execute anyway.' },
      { status: 400 }
    )
  }

  // Check if workflow is already running for this case
  if (!force_restart) {
    const { data: recentExecution } = await supabase
      .from('workflow_executions')
      .select('id, status, executed_at')
      .eq('case_id', case_id)
      .eq('status', 'running')
      .single()

    if (recentExecution) {
      return NextResponse.json(
        { error: 'Workflow is already running for this case' },
        { status: 409 }
      )
    }
  }

  try {
    // Execute workflow
    const result = await workflowEngine.executeWorkflow(case_id, workflow_id)

    // Log analytics event
    await supabase.from('analytics_events').insert({
      organization_id: collectionCase.organization_id,
      event_type: 'workflow_executed',
      entity_type: 'collection_case',
      entity_id: case_id,
      properties: {
        workflow_id: result.workflow_id,
        steps_executed: result.steps_executed,
        test_mode,
        manually_triggered: true
      }
    })

    return NextResponse.json({
      success: true,
      case_id,
      workflow_execution: result,
      test_mode
    })

  } catch (error) {
    console.error(`Workflow execution failed for case ${case_id}:`, error)

    return NextResponse.json(
      { error: 'Workflow execution failed', details: error.message },
      { status: 500 }
    )
  }
}

async function handleBatchExecution(body: any) {
  const { case_ids, workflow_id, filters } = batchExecuteSchema.parse(body)

  const supabase = await createServiceClient()

  // Get valid cases for execution
  let query = supabase
    .from('collection_cases')
    .select(`
      id,
      status,
      outstanding_amount,
      priority,
      created_at,
      organization_id
    `)
    .eq('organization_id', '550e8400-e29b-41d4-a716-446655440000')
    .in('id', case_ids)

  // Apply filters if provided
  if (filters) {
    if (filters.status) {
      query = query.eq('status', filters.status)
    }
    if (filters.priority) {
      query = query.eq('priority', filters.priority)
    }
    // Additional filters would be applied here
  }

  const { data: cases, error } = await query

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch cases' },
      { status: 500 }
    )
  }

  if (!cases || cases.length === 0) {
    return NextResponse.json(
      { error: 'No valid cases found for execution' },
      { status: 400 }
    )
  }

  // Execute workflows for each case
  const results = []
  const errors = []

  for (const caseData of cases) {
    try {
      const result = await workflowEngine.executeWorkflow(caseData.id, workflow_id)
      results.push({
        case_id: caseData.id,
        success: true,
        workflow_execution: result
      })

      // Log analytics event
      await supabase.from('analytics_events').insert({
        organization_id: caseData.organization_id,
        event_type: 'workflow_executed',
        entity_type: 'collection_case',
        entity_id: caseData.id,
        properties: {
          workflow_id: result.workflow_id,
          steps_executed: result.steps_executed,
          batch_execution: true,
          manually_triggered: true
        }
      })

    } catch (error) {
      console.error(`Workflow execution failed for case ${caseData.id}:`, error)
      errors.push({
        case_id: caseData.id,
        error: error.message
      })
    }
  }

  return NextResponse.json({
    success: true,
    batch_execution: true,
    total_cases: cases.length,
    successful_executions: results.length,
    failed_executions: errors.length,
    results,
    errors
  })
}

export async function GET(request: NextRequest) {
  try {
    const authHeader = request.headers.get('authorization')
    if (!authHeader?.startsWith('Bearer ')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createServiceClient()
    const url = new URL(request.url)
    const caseId = url.searchParams.get('case_id')

    if (caseId) {
      // Get workflow executions for specific case
      const { data: executions, error } = await supabase
        .from('workflow_executions')
        .select('*')
        .eq('case_id', caseId)
        .eq('organization_id', '550e8400-e29b-41d4-a716-446655440000')
        .order('executed_at', { ascending: false })

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch workflow executions' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        case_id: caseId,
        executions: executions || []
      })
    } else {
      // Get recent workflow executions
      const { data: executions, error } = await supabase
        .from('workflow_executions')
        .select(`
          *,
          collection_cases!inner(
            id,
            debtors!inner(company_name)
          )
        `)
        .eq('organization_id', '550e8400-e29b-41d4-a716-446655440000')
        .order('executed_at', { ascending: false })
        .limit(50)

      if (error) {
        return NextResponse.json(
          { error: 'Failed to fetch workflow executions' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        recent_executions: executions || []
      })
    }

  } catch (error) {
    console.error('Workflow status error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}