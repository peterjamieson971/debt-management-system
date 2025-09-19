import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateWithSmartRouting, TaskComplexity } from '@/lib/ai/router'
import { PROMPTS, interpolateTemplate } from '@/lib/ai/prompts'
import { z } from 'zod'

const generateSchema = z.object({
  type: z.enum(['email', 'sms', 'script', 'analysis', 'negotiation']),
  context: z.object({
    debtor: z.any().optional(),
    case: z.any().optional(),
    history: z.array(z.any()).optional(),
    priority: z.enum(['low', 'medium', 'high']).optional()
  }),
  tone: z.enum(['friendly', 'formal', 'urgent']).optional().default('formal'),
  language: z.enum(['en', 'ar']).optional().default('en'),
  template: z.string().optional(),
  variables: z.record(z.any()).optional()
})

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
    const {
      type,
      context,
      tone,
      language,
      template,
      variables = {}
    } = generateSchema.parse(body)

    // Determine task complexity for smart routing
    let complexity: TaskComplexity = 'simple'
    if (type === 'negotiation') {
      complexity = 'negotiation'
    } else if (type === 'email' && tone === 'urgent') {
      complexity = 'complex'
    }

    // Get appropriate prompt template
    let prompt = template
    if (!prompt) {
      switch (type) {
        case 'email':
          if (tone === 'urgent') {
            prompt = PROMPTS.urgentEscalation[language]
          } else {
            prompt = PROMPTS.initialNotice[language]
          }
          break
        case 'analysis':
          prompt = PROMPTS.responseAnalysis
          break
        case 'negotiation':
          prompt = PROMPTS.negotiationResponse
          break
        default:
          prompt = PROMPTS.initialNotice[language]
      }
    }

    // Interpolate variables into prompt
    const interpolatedPrompt = interpolateTemplate(prompt, {
      company_name: context.debtor?.company_name || 'Valued Client',
      amount: context.case?.outstanding_amount || 0,
      currency: context.case?.currency || 'AED',
      days_overdue: context.case?.days_overdue || 0,
      ...variables
    })

    // Generate content using AI
    const result = await generateWithSmartRouting(
      complexity,
      interpolatedPrompt,
      context,
      {
        tone,
        language,
        temperature: 0.7,
        maxTokens: 1000
      }
    )

    // Log AI interaction
    const supabase = await createServiceClient()

    // Get organization ID from user context (simplified for now)
    const organizationId = context.case?.organization_id || 'default'

    await supabase.from('ai_interactions').insert({
      organization_id: organizationId,
      case_id: context.case?.id,
      interaction_type: `${type}_generation`,
      prompt: interpolatedPrompt,
      response: result.content,
      model_used: result.model,
      tokens_used: result.tokensUsed,
      cost: result.cost,
      performance_metrics: {
        type,
        complexity,
        language,
        tone
      }
    })

    return NextResponse.json({
      content: result.content,
      tokensUsed: result.tokensUsed,
      model: result.model,
      cost: result.cost
    })

  } catch (error) {
    console.error('AI generation error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid input', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to generate content' },
      { status: 500 }
    )
  }
}