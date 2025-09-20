import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateWithSmartRouting } from '@/lib/ai/router'
import { z } from 'zod'

const generateCommunicationSchema = z.object({
  type: z.enum(['initial_notice', 'reminder', 'escalation', 'payment_plan', 'final_notice', 'custom']),
  channel: z.enum(['email', 'letter', 'sms']).default('email'),
  language: z.enum(['en', 'ar']).optional(),
  tone: z.enum(['professional', 'firm', 'urgent', 'diplomatic']).default('professional'),
  custom_instructions: z.string().optional(),
  send_immediately: z.boolean().default(false),
  scheduled_send_at: z.string().optional()
})

const queryCommunicationsSchema = z.object({
  limit: z.string().optional().default('20'),
  offset: z.string().optional().default('0'),
  status: z.string().optional(),
  channel: z.string().optional()
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

    const url = new URL(request.url)
    const queryParams = Object.fromEntries(url.searchParams)
    const { limit, offset, status, channel } = queryCommunicationsSchema.parse(queryParams)

    const supabase = await createServiceClient()

    // Build query for communications
    let query = supabase
      .from('communication_logs')
      .select(`
        id,
        channel,
        direction,
        status,
        subject,
        content,
        ai_generated,
        sentiment_score,
        intent_classification,
        response_required,
        sent_at,
        created_at,
        metadata
      `)
      .eq('case_id', params.id)
      .eq('organization_id', '550e8400-e29b-41d4-a716-446655440000')
      .order('created_at', { ascending: false })
      .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1)

    // Apply filters
    if (status) {
      query = query.eq('status', status)
    }
    if (channel) {
      query = query.eq('channel', channel)
    }

    const { data: communications, error } = await query

    if (error) {
      console.error('Failed to fetch communications:', error)
      return NextResponse.json(
        { error: 'Failed to fetch communications' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      communications: communications || [],
      total: communications?.length || 0
    })

  } catch (error) {
    console.error('Communications GET error:', error)

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
    const communicationData = generateCommunicationSchema.parse(body)

    const supabase = await createServiceClient()

    // Get case with full details
    const { data: collectionCase, error: caseError } = await supabase
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
          behavioral_score
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

    // Get communication history for context
    const { data: recentCommunications } = await supabase
      .from('communication_logs')
      .select('direction, status, subject, content, created_at, sentiment_score')
      .eq('case_id', params.id)
      .order('created_at', { ascending: false })
      .limit(5)

    // Determine language
    const language = communicationData.language || collectionCase.debtors.language_preference || 'en'

    // Build context for AI generation
    const context = {
      case: collectionCase,
      debtor: collectionCase.debtors,
      recent_communications: recentCommunications || [],
      communication_type: communicationData.type,
      tone: communicationData.tone
    }

    // Generate communication content using AI
    const contentPrompt = buildCommunicationPrompt(communicationData, context, language)

    const aiResult = await generateWithSmartRouting(
      communicationData.type === 'escalation' || communicationData.type === 'final_notice' ? 'complex' : 'simple',
      contentPrompt,
      context,
      {
        language,
        tone: communicationData.tone
      }
    )

    let generatedContent = {}
    try {
      generatedContent = JSON.parse(aiResult.content)
    } catch (parseError) {
      console.error('Failed to parse AI content:', parseError)
      return NextResponse.json(
        { error: 'AI content generation failed' },
        { status: 500 }
      )
    }

    // Generate communication ID for tracking
    const communicationId = `comm_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Create communication log entry
    const { data: communicationLog, error: logError } = await supabase
      .from('communication_logs')
      .insert({
        organization_id: collectionCase.organization_id,
        case_id: collectionCase.id,
        debtor_id: collectionCase.debtor_id,
        channel: communicationData.channel,
        direction: 'outbound',
        status: communicationData.send_immediately ? 'queued' : 'draft',
        subject: (generatedContent as any).subject,
        content: (generatedContent as any).content,
        ai_generated: true,
        external_id: communicationId,
        scheduled_send_at: communicationData.scheduled_send_at || (communicationData.send_immediately ? new Date().toISOString() : null),
        metadata: {
          communication_type: communicationData.type,
          tone: communicationData.tone,
          language,
          custom_instructions: communicationData.custom_instructions,
          ai_model: aiResult.model,
          generated_content: generatedContent
        }
      })
      .select()
      .single()

    if (logError) {
      console.error('Failed to create communication log:', logError)
      return NextResponse.json(
        { error: 'Failed to create communication' },
        { status: 500 }
      )
    }

    // Log AI interaction for cost tracking
    await supabase.from('ai_interactions').insert({
      organization_id: collectionCase.organization_id,
      case_id: collectionCase.id,
      interaction_type: 'communication_generation',
      model_used: aiResult.model,
      prompt_tokens: aiResult.usage?.prompt_tokens || 0,
      completion_tokens: aiResult.usage?.completion_tokens || 0,
      total_tokens: aiResult.usage?.total_tokens || 0,
      cost_usd: aiResult.cost || 0,
      metadata: {
        communication_type: communicationData.type,
        channel: communicationData.channel,
        language,
        tone: communicationData.tone
      }
    })

    // If sending immediately, use Gmail API directly
    let sendResponse = null
    if (communicationData.send_immediately && communicationData.channel === 'email') {
      sendResponse = await sendViaGmail(communicationLog, collectionCase.debtors, authHeader)
    }

    // Update case last action date
    await supabase
      .from('collection_cases')
      .update({
        last_contact_date: new Date().toISOString(),
        next_action_due: calculateNextActionDate(communicationData.type)
      })
      .eq('id', params.id)

    return NextResponse.json({
      communication: communicationLog,
      generated_content: generatedContent,
      ai_cost: aiResult.cost,
      model_used: aiResult.model,
      gmail_sent: !!sendResponse,
      gmail_message_id: sendResponse?.message_id
    }, { status: 201 })

  } catch (error) {
    console.error('Communication generation error:', error)

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

function buildCommunicationPrompt(
  communicationData: any,
  context: any,
  language: string
): string {
  const { case: caseData, debtor, recent_communications, communication_type, tone } = context

  const basePrompt = `
You are an expert debt collection communication specialist for the GCC market.
Generate a ${communication_type} communication in ${language === 'ar' ? 'Arabic' : 'English'}.

CASE CONTEXT:
- Company: ${debtor.company_name} (${debtor.company_type || 'Unknown'})
- Contact: ${debtor.primary_contact_name}
- Email: ${debtor.primary_contact_email}
- Country: ${debtor.country}
- Outstanding Amount: ${caseData.outstanding_amount} ${caseData.currency || 'USD'}
- Days Overdue: ${Math.floor((new Date().getTime() - new Date(caseData.created_at).getTime()) / (1000 * 60 * 60 * 24))}

COMMUNICATION TYPE: ${communication_type.toUpperCase()}
TONE: ${tone.toUpperCase()}

RECENT COMMUNICATIONS:
${recent_communications.map((comm: any) =>
  `- ${comm.direction} (${comm.status}): "${comm.subject}" - Sentiment: ${comm.sentiment_score || 'N/A'}`
).join('\n') || 'No recent communications'}

${communicationData.custom_instructions ? `SPECIAL INSTRUCTIONS: ${communicationData.custom_instructions}` : ''}

REQUIREMENTS:
- Maintain cultural sensitivity for GCC business practices
- Use appropriate business etiquette for ${debtor.country}
- Include clear call-to-action
- Be professional yet ${tone}
- Reference specific amounts and deadlines
- Comply with local debt collection regulations

Please provide a JSON response with this structure:
{
  "subject": "Email subject line",
  "content": "Full email content with proper formatting",
  "call_to_action": "Specific action requested from debtor",
  "deadline": "Response deadline if applicable",
  "follow_up_date": "Suggested follow-up date",
  "escalation_level": 1-5,
  "compliance_notes": "Any regulatory compliance considerations"
}

The content should be in ${language === 'ar' ? 'Arabic' : 'English'} and follow GCC business communication standards.`

  return basePrompt
}

async function sendViaGmail(communicationLog: any, debtor: any, authHeader: string) {
  try {
    const response = await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/gmail/send`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': authHeader
      },
      body: JSON.stringify({
        organization_id: communicationLog.organization_id,
        case_id: communicationLog.case_id,
        debtor_id: communicationLog.debtor_id,
        to_email: debtor.primary_contact_email,
        subject: communicationLog.subject,
        content: communicationLog.content
      })
    })

    if (response.ok) {
      const result = await response.json()

      // Update communication log with Gmail details
      const supabase = await createServiceClient()
      await supabase
        .from('communication_logs')
        .update({
          status: 'sent',
          external_id: result.message_id,
          gmail_message_id: result.message_id,
          gmail_thread_id: result.thread_id,
          sent_at: new Date().toISOString()
        })
        .eq('id', communicationLog.id)

      return result
    }

    return null
  } catch (error) {
    console.error('Failed to send email via Gmail:', error)
    return null
  }
}

function calculateNextActionDate(communicationType: string): string {
  const daysToAdd = {
    'initial_notice': 7,
    'reminder': 5,
    'escalation': 3,
    'payment_plan': 14,
    'final_notice': 10,
    'custom': 7
  }[communicationType] || 7

  const nextDate = new Date()
  nextDate.setDate(nextDate.getDate() + daysToAdd)
  return nextDate.toISOString()
}