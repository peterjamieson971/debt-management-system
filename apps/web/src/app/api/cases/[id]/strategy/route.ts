import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateWithSmartRouting } from '@/lib/ai/router'
import { z } from 'zod'

const generateStrategySchema = z.object({
  force_regenerate: z.boolean().optional().default(false),
  strategy_type: z.enum(['initial', 'escalation', 'negotiation', 'legal']).optional().default('initial'),
  context_notes: z.string().optional()
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

    // Get case with full details
    const { data: collectionCase, error } = await supabase
      .from('collection_cases')
      .select(`
        *,
        debtors!inner(
          id,
          company_name,
          company_type,
          primary_contact_name,
          primary_contact_email,
          country,
          language_preference,
          risk_profile,
          behavioral_score,
          metadata
        ),
        communication_logs(
          id,
          channel,
          direction,
          status,
          content,
          sentiment_score,
          intent_classification,
          created_at
        )
      `)
      .eq('id', params.id)
      .eq('organization_id', '550e8400-e29b-41d4-a716-446655440000')
      .single()

    if (error || !collectionCase) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      case: collectionCase,
      current_strategy: collectionCase.ai_strategy || {},
      strategy_generated_at: collectionCase.strategy_generated_at,
      next_action_due: collectionCase.next_action_due
    })

  } catch (error) {
    console.error('Strategy GET error:', error)
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
    const { force_regenerate, strategy_type, context_notes } = generateStrategySchema.parse(body)

    const supabase = await createServiceClient()

    // Get case with full details
    const { data: collectionCase, error } = await supabase
      .from('collection_cases')
      .select(`
        *,
        debtors!inner(
          id,
          company_name,
          company_type,
          primary_contact_name,
          primary_contact_email,
          country,
          language_preference,
          risk_profile,
          behavioral_score,
          metadata
        ),
        communication_logs(
          id,
          channel,
          direction,
          status,
          content,
          sentiment_score,
          intent_classification,
          response_required,
          created_at
        )
      `)
      .eq('id', params.id)
      .eq('organization_id', '550e8400-e29b-41d4-a716-446655440000')
      .single()

    if (error || !collectionCase) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      )
    }

    // Check if strategy already exists and force_regenerate is false
    if (collectionCase.ai_strategy && Object.keys(collectionCase.ai_strategy).length > 0 && !force_regenerate) {
      return NextResponse.json({
        strategy: collectionCase.ai_strategy,
        generated_at: collectionCase.strategy_generated_at,
        regenerated: false,
        message: 'Strategy already exists. Use force_regenerate=true to create new strategy.'
      })
    }

    // Build context for AI strategy generation
    const context = {
      case: collectionCase,
      debtor: collectionCase.debtors,
      communications: collectionCase.communication_logs,
      total_amount: collectionCase.total_amount,
      outstanding_amount: collectionCase.outstanding_amount,
      days_overdue: Math.floor((new Date().getTime() - new Date(collectionCase.created_at).getTime()) / (1000 * 60 * 60 * 24)),
      priority: collectionCase.priority
    }

    // Generate AI strategy based on type
    const strategyPrompt = buildStrategyPrompt(strategy_type, context, context_notes)

    const aiResult = await generateWithSmartRouting(
      strategy_type === 'negotiation' ? 'negotiation' : 'complex',
      strategyPrompt,
      context,
      {
        language: collectionCase.debtors.language_preference || 'en',
        tone: 'professional'
      }
    )

    let strategy = {}
    try {
      strategy = JSON.parse(aiResult.content)
    } catch (parseError) {
      console.error('Failed to parse AI strategy response:', parseError)
      strategy = {
        type: strategy_type,
        approach: 'conservative',
        next_steps: ['Manual review required - AI response could not be parsed'],
        timeline: '1-2 weeks',
        risk_assessment: 'medium',
        error: 'Failed to parse AI response'
      }
    }

    // Update case with new strategy
    const { data: updatedCase, error: updateError } = await supabase
      .from('collection_cases')
      .update({
        ai_strategy: strategy,
        strategy_generated_at: new Date().toISOString(),
        next_action_due: calculateNextActionDate(strategy)
      })
      .eq('id', params.id)
      .select()
      .single()

    if (updateError) {
      console.error('Failed to update case with strategy:', updateError)
      return NextResponse.json(
        { error: 'Failed to save strategy' },
        { status: 500 }
      )
    }

    // Log AI interaction for cost tracking
    await supabase.from('ai_interactions').insert({
      organization_id: collectionCase.organization_id,
      case_id: collectionCase.id,
      interaction_type: 'strategy_generation',
      model_used: aiResult.model,
      prompt_tokens: aiResult.usage?.prompt_tokens || 0,
      completion_tokens: aiResult.usage?.completion_tokens || 0,
      total_tokens: aiResult.usage?.total_tokens || 0,
      cost_usd: aiResult.cost || 0,
      metadata: {
        strategy_type,
        context_notes,
        regenerated: force_regenerate
      }
    })

    return NextResponse.json({
      strategy,
      generated_at: updatedCase.strategy_generated_at,
      next_action_due: updatedCase.next_action_due,
      regenerated: true,
      ai_cost: aiResult.cost,
      model_used: aiResult.model
    })

  } catch (error) {
    console.error('Strategy generation error:', error)

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

function buildStrategyPrompt(type: string, context: any, notes?: string): string {
  const { case: caseData, debtor, communications, days_overdue } = context

  const basePrompt = `
You are an expert debt collection strategist specializing in GCC (Gulf Cooperation Council) markets.
Generate a comprehensive collection strategy for this case:

CASE DETAILS:
- Company: ${debtor.company_name} (${debtor.company_type || 'Unknown'})
- Country: ${debtor.country || 'Unknown'}
- Contact: ${debtor.primary_contact_name} (${debtor.primary_contact_email})
- Language Preference: ${debtor.language_preference || 'en'}
- Total Amount: ${caseData.total_amount} ${caseData.currency || 'USD'}
- Outstanding: ${caseData.outstanding_amount} ${caseData.currency || 'USD'}
- Days Overdue: ${days_overdue}
- Risk Profile: ${debtor.risk_profile || 'medium'}
- Priority: ${caseData.priority}

COMMUNICATION HISTORY:
${communications.map((comm: any) =>
  `- ${comm.direction.toUpperCase()} ${comm.channel} (${comm.status}): Sentiment ${comm.sentiment_score || 'N/A'}, Intent: ${comm.intent_classification || 'N/A'}`
).join('\n') || 'No prior communications'}

STRATEGY TYPE: ${type.toUpperCase()}

${notes ? `ADDITIONAL CONTEXT: ${notes}` : ''}

Please provide a JSON response with this structure:
{
  "type": "${type}",
  "approach": "conservative|balanced|aggressive",
  "risk_assessment": "low|medium|high",
  "cultural_considerations": "GCC-specific cultural factors to consider",
  "next_steps": ["Specific actionable steps in order"],
  "timeline": "Expected timeline for resolution",
  "escalation_triggers": ["Conditions that would require escalation"],
  "communication_strategy": {
    "tone": "professional|firm|urgent",
    "language": "${debtor.language_preference || 'en'}",
    "frequency": "daily|weekly|biweekly",
    "channels": ["email", "phone", "letter"]
  },
  "success_probability": 0.0-1.0,
  "recommended_settlement": "percentage or amount if applicable",
  "legal_considerations": "Any legal compliance factors for ${debtor.country || 'GCC'}"
}

Ensure all recommendations comply with GCC debt collection regulations and maintain respectful business relationships.`

  return basePrompt
}

function calculateNextActionDate(strategy: any): string {
  // Default to 3 days from now if no specific timeline
  const daysToAdd = strategy.timeline?.includes('1-2 days') ? 2 :
                   strategy.timeline?.includes('week') ? 7 :
                   strategy.timeline?.includes('2 weeks') ? 14 : 3

  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + daysToAdd)
  return nextDate.toISOString()
}