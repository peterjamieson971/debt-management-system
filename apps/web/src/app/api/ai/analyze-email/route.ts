import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { generateWithSmartRouting } from '@/lib/ai/router'
import { z } from 'zod'

const analyzeEmailSchema = z.object({
  organization_id: z.string().uuid(),
  case_id: z.string().uuid(),
  email_content: z.string(),
  subject: z.string(),
  from_email: z.string().email()
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
    const { organization_id, case_id, email_content, subject, from_email } = analyzeEmailSchema.parse(body)

    const supabase = await createServiceClient()

    // Get case details
    const { data: caseData, error: caseError } = await supabase
      .from('collection_cases')
      .select('*, debtors(*)')
      .eq('id', case_id)
      .single()

    if (caseError || !caseData) {
      return NextResponse.json(
        { error: 'Case not found' },
        { status: 404 }
      )
    }

    // Analyze email with AI
    const analysisPrompt = `
Analyze this email from a debtor in a debt collection case. Provide:

1. Sentiment (positive, neutral, negative, hostile)
2. Intent (payment_promise, dispute, request_info, complaint, acknowledgment, other)
3. Urgency level (low, medium, high, urgent)
4. Key points extracted
5. Recommended next action
6. Any payment commitments mentioned
7. Compliance concerns or red flags

Email Details:
- From: ${from_email}
- Subject: ${subject}
- Content: ${email_content}

Debtor Information:
- Name: ${caseData.debtors.name}
- Company: ${caseData.debtors.company_name}
- Amount Owed: ${caseData.amount_owed} ${caseData.currency}
- Case Status: ${caseData.status}

Respond in JSON format with these fields:
{
  "sentiment": "positive|neutral|negative|hostile",
  "intent": "payment_promise|dispute|request_info|complaint|acknowledgment|other",
  "urgency": "low|medium|high|urgent",
  "key_points": ["point1", "point2"],
  "recommended_action": "suggested next step",
  "payment_commitment": {
    "has_commitment": boolean,
    "amount": number|null,
    "date": "YYYY-MM-DD"|null,
    "details": "additional details"
  },
  "compliance_flags": ["flag1", "flag2"] or [],
  "confidence_score": 0.0-1.0
}
`

    const analysis = await generateWithSmartRouting(
      'simple',
      analysisPrompt,
      { case: caseData, debtor: caseData.debtors },
      {
        language: 'en',
        response_format: 'json'
      }
    )

    let analysisResult
    try {
      analysisResult = JSON.parse(analysis)
    } catch {
      // Fallback if AI doesn't return valid JSON
      analysisResult = {
        sentiment: 'neutral',
        intent: 'other',
        urgency: 'medium',
        key_points: ['Email received and logged'],
        recommended_action: 'Review email manually',
        payment_commitment: {
          has_commitment: false,
          amount: null,
          date: null,
          details: null
        },
        compliance_flags: [],
        confidence_score: 0.5
      }
    }

    // Update the communication log with AI analysis
    await supabase
      .from('communication_logs')
      .update({
        ai_sentiment: analysisResult.sentiment,
        ai_summary: analysisResult.key_points.join('; '),
        ai_flags: analysisResult.compliance_flags,
        metadata: {
          ai_analysis: analysisResult,
          analyzed_at: new Date().toISOString()
        }
      })
      .eq('case_id', case_id)
      .eq('from_email', from_email)
      .order('created_at', { ascending: false })
      .limit(1)

    // If there's a payment commitment, create a follow-up task
    if (analysisResult.payment_commitment.has_commitment) {
      await supabase.from('case_notes').insert({
        organization_id,
        case_id,
        user_id: null, // System generated
        note_type: 'payment_commitment',
        content: `Payment commitment detected: ${analysisResult.payment_commitment.details}. Amount: ${analysisResult.payment_commitment.amount}, Date: ${analysisResult.payment_commitment.date}`,
        metadata: {
          source: 'ai_email_analysis',
          commitment_details: analysisResult.payment_commitment
        }
      })
    }

    // If high urgency or compliance flags, create alerts
    if (analysisResult.urgency === 'urgent' || analysisResult.compliance_flags.length > 0) {
      await supabase.from('case_notes').insert({
        organization_id,
        case_id,
        user_id: null,
        note_type: 'alert',
        content: `Email analysis alert - Urgency: ${analysisResult.urgency}. Compliance flags: ${analysisResult.compliance_flags.join(', ')}`,
        metadata: {
          source: 'ai_email_analysis',
          urgency: analysisResult.urgency,
          flags: analysisResult.compliance_flags
        }
      })
    }

    // Trigger workflow if recommended action requires it
    if (analysisResult.recommended_action.includes('escalate') || analysisResult.urgency === 'urgent') {
      await fetch(`${process.env.NEXT_PUBLIC_APP_URL}/api/workflows/execute`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': authHeader
        },
        body: JSON.stringify({
          organization_id,
          case_ids: [case_id],
          workflow_type: 'email_response',
          trigger_reason: 'ai_email_analysis'
        })
      })
    }

    return NextResponse.json({
      success: true,
      analysis: analysisResult,
      case_id,
      actions_taken: {
        analysis_stored: true,
        payment_commitment_logged: analysisResult.payment_commitment.has_commitment,
        alert_created: analysisResult.urgency === 'urgent' || analysisResult.compliance_flags.length > 0,
        workflow_triggered: analysisResult.recommended_action.includes('escalate') || analysisResult.urgency === 'urgent'
      }
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
      { error: 'Failed to analyze email' },
      { status: 500 }
    )
  }
}