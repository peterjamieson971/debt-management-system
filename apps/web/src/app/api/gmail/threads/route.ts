import { NextRequest, NextResponse } from 'next/server'
import { OAuth2Client } from 'google-auth-library'
import { google } from 'googleapis'
import { createServiceClient } from '@/lib/supabase/server'
import crypto from 'crypto'
import { z } from 'zod'

const threadQuerySchema = z.object({
  organization_id: z.string().uuid(),
  case_id: z.string().uuid().optional(),
  debtor_email: z.string().email().optional(),
  thread_id: z.string().optional(),
  limit: z.string().optional().default('50')
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
    const { organization_id, case_id, debtor_email, thread_id, limit } = threadQuerySchema.parse(queryParams)

    const supabase = await createServiceClient()

    if (thread_id) {
      // Get specific thread details
      return await getThreadDetails(thread_id, organization_id, supabase)
    } else {
      // Get conversation threads for case or debtor
      return await getConversationThreads(organization_id, case_id, debtor_email, parseInt(limit), supabase)
    }

  } catch (error) {
    console.error('Thread query error:', error)

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Invalid query parameters', details: error.errors },
        { status: 400 }
      )
    }

    return NextResponse.json(
      { error: 'Failed to fetch threads' },
      { status: 500 }
    )
  }
}

async function getThreadDetails(threadId: string, organizationId: string, supabase: any) {
  // Get all communications in this thread
  const { data: threadCommunications, error } = await supabase
    .from('communication_logs')
    .select(`
      id,
      direction,
      type,
      subject,
      content,
      from_email,
      to_email,
      cc_emails,
      gmail_message_id,
      gmail_thread_id,
      ai_sentiment,
      ai_summary,
      ai_flags,
      delivery_status,
      sent_at,
      created_at,
      metadata,
      case_id,
      debtor_id,
      collection_cases!inner(
        id,
        status,
        amount_owed,
        currency
      ),
      debtors!inner(
        id,
        name,
        company_name,
        primary_contact_email
      )
    `)
    .eq('organization_id', organizationId)
    .eq('gmail_thread_id', threadId)
    .order('sent_at', { ascending: true })

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch thread details' },
      { status: 500 }
    )
  }

  // Analyze thread conversation patterns
  const threadAnalysis = analyzeThread(threadCommunications || [])

  return NextResponse.json({
    thread_id: threadId,
    messages: threadCommunications || [],
    message_count: threadCommunications?.length || 0,
    analysis: threadAnalysis
  })
}

async function getConversationThreads(
  organizationId: string,
  caseId?: string,
  debtorEmail?: string,
  limit: number = 50,
  supabase: any
) {
  // Build query for conversation threads
  let query = supabase
    .from('communication_logs')
    .select(`
      gmail_thread_id,
      case_id,
      debtor_id,
      subject,
      from_email,
      to_email,
      direction,
      ai_sentiment,
      delivery_status,
      sent_at,
      created_at,
      collection_cases!inner(
        id,
        status,
        amount_owed,
        currency
      ),
      debtors!inner(
        id,
        name,
        company_name,
        primary_contact_email
      )
    `)
    .eq('organization_id', organizationId)
    .not('gmail_thread_id', 'is', null)

  if (caseId) {
    query = query.eq('case_id', caseId)
  }

  if (debtorEmail) {
    query = query.or(`from_email.eq.${debtorEmail},to_email.eq.${debtorEmail}`)
  }

  const { data: communications, error } = await query
    .order('sent_at', { ascending: false })
    .limit(limit * 3) // Get more to group by thread

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch conversations' },
      { status: 500 }
    )
  }

  // Group by thread ID and get the latest message from each thread
  const threadMap = new Map()

  for (const comm of communications || []) {
    const threadId = comm.gmail_thread_id
    if (!threadMap.has(threadId)) {
      threadMap.set(threadId, {
        thread_id: threadId,
        case: comm.collection_cases,
        debtor: comm.debtors,
        latest_message: comm,
        message_count: 1,
        has_unread: false, // Could be enhanced with actual read status
        last_direction: comm.direction,
        sentiment_trend: [comm.ai_sentiment].filter(Boolean)
      })
    } else {
      const thread = threadMap.get(threadId)
      thread.message_count++
      thread.sentiment_trend.push(comm.ai_sentiment)

      // Keep the latest message as the thread representative
      if (new Date(comm.sent_at || comm.created_at) > new Date(thread.latest_message.sent_at || thread.latest_message.created_at)) {
        thread.latest_message = comm
        thread.last_direction = comm.direction
      }
    }
  }

  // Convert map to array and limit results
  const threads = Array.from(threadMap.values())
    .sort((a, b) => new Date(b.latest_message.sent_at || b.latest_message.created_at).getTime() -
                   new Date(a.latest_message.sent_at || a.latest_message.created_at).getTime())
    .slice(0, limit)

  // Add conversation health score
  threads.forEach(thread => {
    thread.conversation_health = calculateConversationHealth(thread)
  })

  return NextResponse.json({
    threads,
    total_threads: threads.length,
    filters_applied: {
      case_id: caseId,
      debtor_email: debtorEmail
    }
  })
}

function analyzeThread(messages: any[]) {
  if (messages.length === 0) {
    return {
      conversation_health: 'unknown',
      response_pattern: 'no_data',
      engagement_level: 'none',
      sentiment_trend: 'neutral',
      requires_attention: false
    }
  }

  const sentiments = messages.map(m => m.ai_sentiment).filter(Boolean)
  const directions = messages.map(m => m.direction)

  // Calculate response times (for outbound messages)
  const responseTimes = []
  for (let i = 1; i < messages.length; i++) {
    if (messages[i].direction === 'outbound' && messages[i-1].direction === 'inbound') {
      const responseTime = new Date(messages[i].sent_at).getTime() - new Date(messages[i-1].sent_at).getTime()
      responseTimes.push(responseTime / (1000 * 60 * 60)) // hours
    }
  }

  // Analyze sentiment trend
  const sentimentScore = sentiments.length > 0 ?
    sentiments.reduce((acc, sentiment) => {
      const scores = { positive: 1, neutral: 0, negative: -1, hostile: -2 }
      return acc + (scores[sentiment] || 0)
    }, 0) / sentiments.length : 0

  // Determine engagement level
  const engagementLevel =
    messages.length >= 5 ? 'high' :
    messages.length >= 3 ? 'medium' :
    messages.length >= 1 ? 'low' : 'none'

  // Check if requires attention
  const requiresAttention =
    sentiments.includes('hostile') ||
    sentiments.includes('negative') ||
    messages.some(m => m.ai_flags?.length > 0) ||
    (messages[messages.length - 1]?.direction === 'inbound' &&
     new Date(messages[messages.length - 1].sent_at).getTime() < Date.now() - 24 * 60 * 60 * 1000)

  return {
    message_count: messages.length,
    conversation_health: sentimentScore > 0 ? 'good' : sentimentScore < -0.5 ? 'poor' : 'fair',
    response_pattern: calculateResponsePattern(directions),
    engagement_level: engagementLevel,
    sentiment_trend: sentimentScore > 0.5 ? 'positive' : sentimentScore < -0.5 ? 'negative' : 'neutral',
    average_response_time_hours: responseTimes.length > 0 ?
      responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length : null,
    requires_attention: requiresAttention,
    last_interaction: messages[messages.length - 1]?.sent_at,
    sentiment_distribution: {
      positive: sentiments.filter(s => s === 'positive').length,
      neutral: sentiments.filter(s => s === 'neutral').length,
      negative: sentiments.filter(s => s === 'negative').length,
      hostile: sentiments.filter(s => s === 'hostile').length
    }
  }
}

function calculateResponsePattern(directions: string[]): string {
  if (directions.length < 2) return 'insufficient_data'

  const inboundCount = directions.filter(d => d === 'inbound').length
  const outboundCount = directions.filter(d => d === 'outbound').length

  if (inboundCount === 0) return 'one_way_outbound'
  if (outboundCount === 0) return 'one_way_inbound'

  const ratio = inboundCount / outboundCount
  if (ratio > 1.5) return 'customer_heavy'
  if (ratio < 0.5) return 'business_heavy'
  return 'balanced'
}

function calculateConversationHealth(thread: any): string {
  const message = thread.latest_message
  const sentimentTrend = thread.sentiment_trend.filter(Boolean)

  // Recent negative sentiments are bad
  if (sentimentTrend.includes('hostile')) return 'poor'
  if (sentimentTrend.includes('negative') && thread.last_direction === 'inbound') return 'concerning'

  // No response to inbound messages is concerning
  if (thread.last_direction === 'inbound' &&
      new Date(message.sent_at).getTime() < Date.now() - 24 * 60 * 60 * 1000) {
    return 'needs_attention'
  }

  // Positive engagement is good
  if (sentimentTrend.includes('positive') && thread.message_count > 2) return 'good'

  return 'fair'
}