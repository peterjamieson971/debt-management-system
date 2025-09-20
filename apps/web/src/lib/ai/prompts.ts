export const PROMPTS = {
  // Communication Generation Prompts
  communicationGeneration: {
    initial_notice: {
      en: `Generate a professional initial payment reminder as JSON with subject and content fields.
Company: {{company_name}}
Contact: {{contact_name}}
Amount: {{amount}} {{currency}}
Days Overdue: {{days_overdue}}
Invoice Details: {{invoice_details}}

Requirements:
- Tone: Friendly but professional
- Include: Payment options, contact information
- Avoid: Threatening language
- Reference: Our successful business relationship
- Cultural context: GCC business practices

Return format:
{
  "subject": "Professional subject line",
  "content": "Full email content with proper greetings, details, and professional closing",
  "call_to_action": "Clear next steps for the debtor",
  "deadline": "Payment deadline date",
  "escalation_level": 1
}`,
      ar: `قم بإنشاء تذكير دفع أولي مهني بصيغة JSON مع حقول الموضوع والمحتوى.
الشركة: {{company_name}}
المبلغ: {{amount}} {{currency}}
أيام التأخير: {{days_overdue}}

المتطلبات:
- النبرة: ودية ولكن مهنية
- تشمل: خيارات الدفع، معلومات الاتصال
- تجنب: اللغة التهديدية
- السياق الثقافي: ممارسات الأعمال في دول مجلس التعاون الخليجي`
    },
    reminder: {
      en: `Generate a follow-up payment reminder as JSON.
Company: {{company_name}}
Contact: {{contact_name}}
Amount: {{amount}} {{currency}}
Days Overdue: {{days_overdue}}
Previous Communications: {{previous_comms}}

Requirements:
- Tone: Professional but slightly more urgent
- Reference previous communications
- Maintain respectful approach
- Include consequences of continued delay
- Offer assistance with payment arrangements

Return JSON format with subject, content, call_to_action, deadline, escalation_level.`,
      ar: `قم بإنشاء تذكير دفع متابعة بصيغة JSON.
الشركة: {{company_name}}
المبلغ: {{amount}} {{currency}}
أيام التأخير: {{days_overdue}}

المتطلبات:
- النبرة: مهنية ولكن أكثر إلحاحاً
- الإشارة إلى الاتصالات السابقة
- الحفاظ على النهج المحترم`
    },
    escalation: {
      en: `Generate an escalation notice as JSON.
Company: {{company_name}}
Contact: {{contact_name}}
Amount: {{amount}} {{currency}}
Days Overdue: {{days_overdue}}
Previous Attempts: {{attempt_count}}
Country: {{country}}

Requirements:
- Tone: Firm but respectful
- Include escalation timeline and consequences
- Maintain professional relationship
- Consider local regulations and cultural sensitivities
- Offer final opportunity for resolution
- Comply with UAE Federal Decree-Law No. 15/2024 if applicable

Return JSON format with subject, content, call_to_action, deadline, escalation_level (3-4).`,
      ar: `قم بإنشاء إشعار تصعيد بصيغة JSON.
الشركة: {{company_name}}
المبلغ: {{amount}} {{currency}}
أيام التأخير: {{days_overdue}}

المتطلبات:
- النبرة: حازمة ولكن محترمة
- تشمل الجدول الزمني للتصعيد والعواقب`
    },
    payment_plan: {
      en: `Generate a payment plan proposal as JSON.
Company: {{company_name}}
Total Amount: {{total_amount}} {{currency}}
Suggested Terms: {{suggested_terms}}
Financial Situation: {{financial_status}}

Requirements:
- Show understanding of their situation
- Offer flexible, realistic terms
- Include incentives for early completion
- Maintain business relationship
- For Saudi Arabia: Ensure Sharia compliance (no interest)
- For UAE: Follow Federal Decree-Law requirements

Return JSON with subject, content, call_to_action, deadline, escalation_level (2).`,
      ar: `قم بإنشاء اقتراح خطة دفع بصيغة JSON.
الشركة: {{company_name}}
المبلغ الإجمالي: {{total_amount}} {{currency}}

المتطلبات:
- إظهار فهم لوضعهم
- تقديم شروط مرنة وواقعية
- الامتثال للشريعة الإسلامية في السعودية`
    },
    final_notice: {
      en: `Generate a final notice before legal action as JSON.
Company: {{company_name}}
Amount: {{amount}} {{currency}}
Country: {{country}}
Legal Requirements: {{legal_requirements}}

Requirements:
- Final demand for payment
- Legal action timeline (20 days for UAE)
- Opportunity to avoid legal proceedings
- Compliance with local laws
- Professional and respectful tone
- Cultural sensitivity

Return JSON with subject, content, call_to_action, deadline, escalation_level (5).`,
      ar: `قم بإنشاء إشعار أخير قبل الإجراء القانوني بصيغة JSON.
الشركة: {{company_name}}
المبلغ: {{amount}} {{currency}}
البلد: {{country}}

المتطلبات:
- طلب أخير للدفع
- الجدول الزمني للإجراء القانوني
- فرصة لتجنب الإجراءات القانونية`
    },
    custom: {
      en: `Generate a custom communication as JSON based on specific instructions.
Company: {{company_name}}
Contact: {{contact_name}}
Amount: {{amount}} {{currency}}
Custom Instructions: {{custom_instructions}}
Context: {{context}}

Requirements:
- Follow the custom instructions provided
- Maintain professional tone
- Consider GCC business culture
- Include appropriate call to action

Return JSON format with subject, content, call_to_action, deadline, escalation_level.`,
      ar: `قم بإنشاء اتصال مخصص بصيغة JSON بناءً على تعليمات محددة.
الشركة: {{company_name}}
المبلغ: {{amount}} {{currency}}
التعليمات المخصصة: {{custom_instructions}}

المتطلبات:
- اتباع التعليمات المخصصة المقدمة
- الحفاظ على النبرة المهنية`
    }
  },

  // Strategy Generation Prompts
  strategyGeneration: {
    initial: `Analyze this debt collection case and generate an initial collection strategy.
Case Details: {{case_details}}
Debtor Profile: {{debtor_profile}}
Amount: {{amount}} {{currency}}
Days Overdue: {{days_overdue}}
Country: {{country}}

Generate a comprehensive strategy considering:
1. Cultural factors specific to {{country}}
2. Risk assessment based on debtor profile
3. Optimal communication sequence
4. Timeline for escalation
5. Legal compliance requirements
6. Relationship preservation strategies

Return as JSON with strategy structure including approach, timeline, next_steps, risk_assessment, cultural_considerations.`,

    escalation: `Generate an escalation strategy for this overdue case.
Current Status: {{current_status}}
Previous Actions: {{previous_actions}}
Response History: {{response_history}}
Days Since Last Contact: {{days_since_contact}}

Consider:
1. Previous response patterns
2. Escalation triggers met
3. Legal action thresholds
4. Alternative resolution methods
5. Cost-benefit analysis

Return escalation strategy as JSON.`,

    negotiation: `Create a negotiation strategy based on debtor's proposal.
Original Amount: {{original_amount}}
Debtor Proposal: {{debtor_proposal}}
Payment History: {{payment_history}}
Financial Indicators: {{financial_indicators}}

Develop strategy for:
1. Counter-offer analysis
2. Settlement recommendations
3. Payment plan alternatives
4. Risk mitigation
5. Relationship preservation

Return negotiation strategy as JSON.`,

    legal: `Generate pre-legal action strategy.
Case Age: {{case_age}} days
Total Attempts: {{total_attempts}}
Last Response: {{last_response}}
Jurisdiction: {{country}}

Evaluate:
1. Legal action viability
2. Cost-benefit analysis
3. Alternative dispute resolution
4. Compliance requirements
5. Timeline for legal proceedings

Return legal strategy as JSON.`
  },

  // Response Analysis Prompt
  responseAnalysis: `
Analyze this email response from a debtor and provide detailed insights:
Email Content: "{{email_content}}"
Debtor Company: {{company_name}}
Country: {{country}}
Case Context: {{case_context}}

Analyze for:
1. Primary Intent (payment_promise, dispute, information_request, negotiation, refusal, acknowledgment)
2. Sentiment Score (0.0 = very negative, 1.0 = very positive)
3. Urgency Level (low, medium, high)
4. Payment Likelihood (0-100 percentage)
5. Emotional State (frustrated, cooperative, defensive, apologetic, professional)
6. Key Information Extracted (dates, amounts, commitments, concerns)
7. Cultural Context Indicators
8. Recommended Response Strategy

Consider GCC business culture:
- Relationship importance and face-saving
- Religious/cultural holidays impact
- Business hierarchy and respect
- Indirect communication styles
- Honor and reputation considerations

Return as JSON:
{
  "intent": "primary_intent_category",
  "intent_confidence": 0.0-1.0,
  "sentiment": 0.0-1.0,
  "urgency": "low|medium|high",
  "payment_likelihood": 0-100,
  "emotional_state": "detected_emotional_state",
  "key_information": {
    "promises": [],
    "concerns": [],
    "dates_mentioned": [],
    "amounts_mentioned": []
  },
  "cultural_indicators": "cultural_context_detected",
  "recommended_action": "specific_next_step",
  "response_priority": "low|medium|high|urgent",
  "escalation_recommended": true/false,
  "notes": "additional_insights"
}`,

  // Legacy prompts maintained for backward compatibility
  negotiationResponse: `
Generate a professional negotiation response based on debtor's proposal.
Debtor Proposal: {{proposal}}
Original Amount: {{original_amount}} {{currency}}
Company Profile: {{company_profile}}
Payment History: {{payment_history}}
Cultural Context: {{country}} - {{language_preference}}

Generate response that:
1. Acknowledges their proposal respectfully
2. Provides counter-offer analysis
3. Maintains relationship focus (critical in GCC)
4. Includes clear next steps and deadlines
5. Considers Islamic banking principles for Saudi Arabia
6. Offers face-saving alternatives
7. Shows flexibility while protecting interests

Return as JSON with subject, content, recommended_settlement, timeline, cultural_considerations.

Tone requirements:
- Professional and respectful
- Solutions-oriented
- Culturally appropriate for {{country}}
- Maintains long-term business relationship potential`
}

export function interpolateTemplate(template: string, variables: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match
  })
}

// Helper function to get communication prompt based on type and language
export function getCommunicationPrompt(
  type: keyof typeof PROMPTS.communicationGeneration,
  language: 'en' | 'ar' = 'en'
): string {
  const prompts = PROMPTS.communicationGeneration[type]
  if (typeof prompts === 'object' && prompts[language]) {
    return prompts[language]
  }
  if (typeof prompts === 'object' && prompts.en) {
    return prompts.en // Fallback to English
  }
  return prompts as string // For types that don't have language variants
}

// Helper function to get strategy prompt based on type
export function getStrategyPrompt(type: keyof typeof PROMPTS.strategyGeneration): string {
  return PROMPTS.strategyGeneration[type]
}

// Helper function to build context variables for communication prompts
export function buildCommunicationContext(
  caseData: any,
  debtor: any,
  communicationType: string,
  additionalContext?: Record<string, any>
): Record<string, any> {
  const daysOverdue = Math.floor(
    (new Date().getTime() - new Date(caseData.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  return {
    company_name: debtor.company_name,
    contact_name: debtor.primary_contact_name,
    amount: caseData.outstanding_amount,
    currency: caseData.currency || 'USD',
    total_amount: caseData.total_amount,
    days_overdue: daysOverdue,
    country: debtor.country,
    language_preference: debtor.language_preference || 'en',
    risk_profile: debtor.risk_profile,
    communication_type: communicationType,
    case_priority: caseData.priority,
    invoice_details: `Invoice #${caseData.id.slice(0, 8)} dated ${new Date(caseData.created_at).toLocaleDateString()}`,
    ...additionalContext
  }
}

// Helper function to build context variables for strategy prompts
export function buildStrategyContext(
  caseData: any,
  debtor: any,
  communications: any[] = [],
  additionalContext?: Record<string, any>
): Record<string, any> {
  const daysOverdue = Math.floor(
    (new Date().getTime() - new Date(caseData.created_at).getTime()) / (1000 * 60 * 60 * 24)
  )

  const recentCommunications = communications
    .filter(c => c.created_at)
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    .slice(0, 5)

  return {
    case_details: {
      id: caseData.id,
      total_amount: caseData.total_amount,
      outstanding_amount: caseData.outstanding_amount,
      currency: caseData.currency || 'USD',
      status: caseData.status,
      priority: caseData.priority,
      created_at: caseData.created_at,
      current_stage: caseData.current_stage
    },
    debtor_profile: {
      company_name: debtor.company_name,
      company_type: debtor.company_type,
      country: debtor.country,
      language_preference: debtor.language_preference,
      risk_profile: debtor.risk_profile,
      behavioral_score: debtor.behavioral_score
    },
    amount: caseData.outstanding_amount,
    currency: caseData.currency || 'USD',
    days_overdue: daysOverdue,
    country: debtor.country,
    communication_history: recentCommunications.map(c => ({
      direction: c.direction,
      status: c.status,
      channel: c.channel,
      sentiment: c.sentiment_score,
      intent: c.intent_classification,
      date: c.created_at
    })),
    ...additionalContext
  }
}

// Validation helper for AI response parsing
export function validateAIResponse(response: string, expectedFields: string[]): any {
  try {
    const parsed = JSON.parse(response)

    // Check if all expected fields are present
    const missingFields = expectedFields.filter(field => !(field in parsed))

    if (missingFields.length > 0) {
      console.warn(`AI response missing fields: ${missingFields.join(', ')}`)
      // Add default values for missing fields
      missingFields.forEach(field => {
        switch (field) {
          case 'subject':
            parsed[field] = 'Payment Reminder'
            break
          case 'content':
            parsed[field] = 'Please contact us regarding your outstanding payment.'
            break
          case 'call_to_action':
            parsed[field] = 'Please make payment or contact us to discuss.'
            break
          case 'deadline':
            parsed[field] = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
            break
          case 'escalation_level':
            parsed[field] = 1
            break
          default:
            parsed[field] = null
        }
      })
    }

    return parsed
  } catch (error) {
    console.error('Failed to parse AI response as JSON:', error)
    throw new Error('Invalid AI response format')
  }
}