import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateWithSmartRouting } from '@/lib/ai/router'
import { PROMPTS, interpolateTemplate, validateAIResponse } from '@/lib/ai/prompts'
import { z } from 'zod'

const analyzeEmailSchema = z.object({
  communication_log_id: z.string().uuid().optional(),
  email_content: z.string().min(1),
  case_id: z.string().uuid().optional(),
  debtor_id: z.string().uuid().optional(),
  context: z.object({
    company_name: z.string().optional(),
    country: z.string().optional(),
    case_context: z.string().optional()
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
    const { communication_log_id, email_content, case_id, debtor_id, context } = analyzeEmailSchema.parse(body)

    const supabase = await createServiceClient()

    let caseData = null
    let debtorData = null
    let communicationLog = null

    // Get context data if available
    if (communication_log_id) {
      const { data: log, error } = await supabase
        .from('communication_logs')
        .select(`
          *,
          collection_cases!inner(
            *,
            debtors!inner(*)
          )
        `)
        .eq('id', communication_log_id)
        .eq('organization_id', '550e8400-e29b-41d4-a716-446655440000')
        .single()

      if (error || !log) {
        return NextResponse.json(
          { error: 'Communication log not found' },
          { status: 404 }
        )
      }

      communicationLog = log
      caseData = log.collection_cases
      debtorData = log.collection_cases.debtors
    } else if (case_id) {
      const { data: caseInfo, error } = await supabase
        .from('collection_cases')
        .select(`
          *,
          debtors!inner(*)
        `)
        .eq('id', case_id)
        .eq('organization_id', '550e8400-e29b-41d4-a716-446655440000')
        .single()

      if (error || !caseInfo) {
        return NextResponse.json(
          { error: 'Case not found' },
          { status: 404 }
        )
      }

      caseData = caseInfo
      debtorData = caseInfo.debtors
    } else if (debtor_id) {
      const { data: debtor, error } = await supabase
        .from('debtors')
        .select('*')
        .eq('id', debtor_id)
        .eq('organization_id', '550e8400-e29b-41d4-a716-446655440000')
        .single()

      if (error || !debtor) {
        return NextResponse.json(
          { error: 'Debtor not found' },
          { status: 404 }
        )
      }

      debtorData = debtor
    }

    // Build analysis context
    const analysisContext = {
      email_content,
      company_name: context?.company_name || debtorData?.company_name || 'Unknown Company',
      country: context?.country || debtorData?.country || 'Unknown',
      case_context: context?.case_context || (caseData ? `Case ${caseData.id} - ${caseData.outstanding_amount} ${caseData.currency || 'USD'} outstanding` : 'No case context')
    }

    // Generate analysis prompt
    const analysisPrompt = interpolateTemplate(PROMPTS.responseAnalysis, analysisContext)

    // Use AI to analyze the email
    const aiResult = await generateWithSmartRouting(
      'simple', // Email analysis is typically a simple task
      analysisPrompt,
      {
        case: caseData,
        debtor: debtorData,
        email_content,
        analysis_type: 'email_response'
      },
      {
        language: debtorData?.language_preference || 'en',
        tone: 'analytical'
      }
    )

    // Parse and validate AI response
    const expectedFields = [
      'intent', 'intent_confidence', 'sentiment', 'urgency', 'payment_likelihood',
      'emotional_state', 'key_information', 'cultural_indicators', 'recommended_action',
      'response_priority', 'escalation_recommended', 'notes'
    ]

    let analysis = {}
    try {
      analysis = validateAIResponse(aiResult.content, expectedFields)
    } catch (error) {
      console.error('Failed to parse AI analysis:', error)
      return NextResponse.json(
        { error: 'AI analysis failed to parse properly' },
        { status: 500 }
      )
    }

    // Update communication log if provided
    if (communication_log_id && communicationLog) {
      await supabase
        .from('communication_logs')
        .update({
          sentiment_score: analysis.sentiment,
          intent_classification: analysis.intent,
          response_required: analysis.response_priority !== 'low',
          metadata: {
            ...communicationLog.metadata,
            ai_analysis: analysis,
            analysis_timestamp: new Date().toISOString()
          }
        })
        .eq('id', communication_log_id)
    }

    // Update case if analysis suggests important changes
    if (caseData && analysis.escalation_recommended) {
      const updates: any = {}

      if (analysis.intent === 'payment_promise' && analysis.key_information?.dates_mentioned?.length > 0) {
        updates.payment_promise_date = analysis.key_information.dates_mentioned[0]
        updates.status = 'promise_received'
      }

      if (analysis.urgency === 'high' || analysis.escalation_recommended) {
        updates.priority = 'high'
      }

      if (Object.keys(updates).length > 0) {
        await supabase
          .from('collection_cases')
          .update({
            ...updates,
            last_contact_date: new Date().toISOString()
          })
          .eq('id', caseData.id)
      }
    }

    // Log AI interaction for cost tracking
    await supabase.from('ai_interactions').insert({
      organization_id: caseData?.organization_id || debtorData?.organization_id || '550e8400-e29b-41d4-a716-446655440000',
      case_id: caseData?.id || null,
      interaction_type: 'email_analysis',
      model_used: aiResult.model,
      prompt_tokens: aiResult.usage?.prompt_tokens || 0,
      completion_tokens: aiResult.usage?.completion_tokens || 0,
      total_tokens: aiResult.usage?.total_tokens || 0,
      cost_usd: aiResult.cost || 0,
      metadata: {
        communication_log_id,
        analysis_type: 'response_analysis',
        intent_detected: analysis.intent,
        sentiment_score: analysis.sentiment,
        escalation_recommended: analysis.escalation_recommended
      }
    })

    // Generate recommended next actions based on analysis
    const nextActions = generateNextActions(analysis, caseData, debtorData)

    return NextResponse.json({
      analysis,
      context: {
        case_id: caseData?.id,
        debtor_id: debtorData?.id,
        communication_log_id
      },
      ai_model: aiResult.model,
      ai_cost: aiResult.cost,
      next_actions,
      case_updated: !!(caseData && analysis.escalation_recommended)
    })

  } catch (error) {
    console.error('Email analysis error:', error)

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

function generateNextActions(analysis: any, caseData: any, debtorData: any): string[] {
  const actions = []

  // Based on intent
  switch (analysis.intent) {
    case 'payment_promise':
      actions.push('Schedule follow-up for promised payment date')
      actions.push('Send payment confirmation with details')
      if (analysis.key_information?.dates_mentioned?.length > 0) {
        actions.push(`Set reminder for ${analysis.key_information.dates_mentioned[0]}`)
      }
      break

    case 'dispute':
      actions.push('Review and investigate disputed charges')
      actions.push('Prepare documentation for dispute resolution')
      actions.push('Schedule call to discuss dispute details')
      break

    case 'negotiation':
      actions.push('Review proposed payment terms')
      actions.push('Prepare counter-offer if needed')
      actions.push('Schedule negotiation call')
      break

    case 'information_request':
      actions.push('Provide requested information')
      actions.push('Send updated invoice or documentation')
      break

    case 'refusal':
      actions.push('Consider escalation options')
      actions.push('Review case for legal action threshold')
      break

    default:
      actions.push('Review email and determine appropriate response')
  }

  // Based on urgency
  if (analysis.urgency === 'high') {
    actions.unshift('URGENT: Respond within 24 hours')
  } else if (analysis.urgency === 'medium') {
    actions.push('Respond within 48 hours')
  }

  // Based on sentiment
  if (analysis.sentiment < 0.3) {
    actions.push('Use diplomatic approach in response')
    actions.push('Consider phone call to de-escalate')
  }

  // Based on escalation recommendation
  if (analysis.escalation_recommended) {
    actions.push('Escalate to manager for review')
    actions.push('Consider legal consultation')
  }

  // Based on payment likelihood
  if (analysis.payment_likelihood > 70) {
    actions.push('Offer payment plan options')
    actions.push('Provide multiple payment methods')
  } else if (analysis.payment_likelihood < 30) {
    actions.push('Consider collection agency referral')
    actions.push('Review account for write-off consideration')
  }

  return actions
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

    const url = new URL(request.url)
    const communicationId = url.searchParams.get('communication_id')

    if (!communicationId) {
      return NextResponse.json(
        { error: 'communication_id parameter is required' },
        { status: 400 }
      )
    }

    const supabase = await createServiceClient()

    // Get existing analysis from communication log
    const { data: communicationLog, error } = await supabase
      .from('communication_logs')
      .select(`
        id,
        sentiment_score,
        intent_classification,
        response_required,
        metadata,
        content,
        created_at
      `)
      .eq('id', communicationId)
      .eq('organization_id', '550e8400-e29b-41d4-a716-446655440000')
      .single()

    if (error || !communicationLog) {
      return NextResponse.json(
        { error: 'Communication log not found' },
        { status: 404 }
      )
    }

    const existingAnalysis = communicationLog.metadata?.ai_analysis

    return NextResponse.json({
      communication_id: communicationId,
      has_analysis: !!existingAnalysis,
      analysis: existingAnalysis || null,
      basic_metrics: {
        sentiment_score: communicationLog.sentiment_score,
        intent_classification: communicationLog.intent_classification,
        response_required: communicationLog.response_required
      },
      analyzed_at: communicationLog.metadata?.analysis_timestamp || null
    })

  } catch (error) {
    console.error('Get analysis error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}