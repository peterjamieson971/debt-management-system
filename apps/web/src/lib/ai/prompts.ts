export const PROMPTS = {
  initialNotice: {
    en: `
Generate a professional initial payment reminder for:
Company: {{company_name}}
Amount: {{amount}} {{currency}}
Days Overdue: {{days_overdue}}
Previous Relationship: {{relationship_history}}

Requirements:
- Tone: Friendly but professional
- Include: Payment options, contact information
- Avoid: Threatening language
- Reference: Our successful business relationship
- Cultural context: GCC business practices

Template should include:
1. Polite greeting with company name
2. Invoice details and amount
3. Payment options (bank transfer, online payment)
4. Contact information for questions
5. Professional closing
    `,
    ar: `
قم بإنشاء تذكير دفع أولي مهني لـ:
الشركة: {{company_name}}
المبلغ: {{amount}} {{currency}}
أيام التأخير: {{days_overdue}}
العلاقة السابقة: {{relationship_history}}

المتطلبات:
- النبرة: ودية ولكن مهنية
- تشمل: خيارات الدفع، معلومات الاتصال
- تجنب: اللغة التهديدية
- المرجع: علاقتنا التجارية الناجحة
- السياق الثقافي: ممارسات الأعمال في دول مجلس التعاون الخليجي
    `
  },

  responseAnalysis: `
Analyze this email response from a debtor:
"{{email_content}}"

Identify:
1. Intent (payment promise, dispute, request for information, etc.)
2. Sentiment (positive, neutral, negative) - scale 0.0 to 1.0
3. Urgency level (low, medium, high)
4. Payment likelihood (percentage)
5. Recommended next action

Consider GCC business culture:
- Relationship importance
- Face-saving considerations
- Religious/cultural holidays impact
- Business hierarchy respect

Return as JSON:
{
  "intent": "...",
  "sentiment": 0.0-1.0,
  "urgency": "low|medium|high",
  "payment_likelihood": 0-100,
  "recommended_action": "...",
  "cultural_notes": "..."
}
  `,

  negotiationResponse: `
The debtor has proposed: {{proposal}}
Original amount: {{original_amount}} {{currency}}
Company profile: {{company_profile}}
Payment history: {{payment_history}}
Cultural context: {{country}} - {{language_preference}}

Generate a response that:
1. Acknowledges their proposal respectfully
2. Provides a counter-offer if needed
3. Maintains relationship focus (important in GCC)
4. Includes clear next steps
5. Considers Islamic banking principles if in Saudi Arabia
6. Offers face-saving alternatives

Tone should be:
- Professional and respectful
- Solutions-oriented
- Culturally appropriate
- Maintains business relationship
  `,

  urgentEscalation: {
    en: `
Generate an urgent but respectful escalation notice for:
Company: {{company_name}}
Amount: {{amount}} {{currency}}
Days Overdue: {{days_overdue}}
Previous attempts: {{attempt_count}}
Country: {{country}}

Requirements:
- Tone: Firm but respectful
- Include: Escalation timeline, consequences
- Maintain: Professional relationship
- Consider: Local regulations and cultural sensitivities
- Offer: Final opportunity for resolution

Must comply with:
- UAE: Federal Decree-Law No. 15/2024
- Saudi Arabia: Sharia-compliant practices
- Regional business etiquette
    `,
    ar: `
قم بإنشاء إشعار تصعيد عاجل ولكن محترم لـ:
الشركة: {{company_name}}
المبلغ: {{amount}} {{currency}}
أيام التأخير: {{days_overdue}}
المحاولات السابقة: {{attempt_count}}
البلد: {{country}}

المتطلبات:
- النبرة: حازمة ولكن محترمة
- تشمل: الجدول الزمني للتصعيد، العواقب
- الحفاظ على: العلاقة المهنية
- النظر في: اللوائح المحلية والحساسيات الثقافية
- العرض: فرصة أخيرة للحل
    `
  },

  paymentPlan: `
Generate a payment plan proposal based on:
Total amount: {{total_amount}} {{currency}}
Debtor's financial situation: {{financial_status}}
Proposed monthly payment: {{proposed_payment}}
Country: {{country}}

Create a structured payment plan that:
1. Shows understanding of their situation
2. Offers flexible terms
3. Includes incentives for early completion
4. Maintains relationship
5. Complies with local regulations

For Saudi Arabia: Ensure Sharia compliance (no interest)
For UAE: Follow Federal Decree-Law requirements
For other GCC: Consider cultural business practices
  `,

  legalNotice: {
    en: `
Generate a pre-legal action notice for:
Company: {{company_name}}
Amount: {{amount}} {{currency}}
Country: {{country}}
Legal requirements: {{legal_requirements}}

Must include:
- Final demand for payment
- Legal action timeline
- Opportunity to avoid legal proceedings
- Compliance with local laws
- Professional and respectful tone
- Cultural sensitivity

Ensure compliance with:
- UAE: 20-day payment period after notice
- Saudi Arabia: Sharia-compliant collection practices
- Regional legal requirements
    `,
    ar: `
قم بإنشاء إشعار ما قبل الإجراء القانوني لـ:
الشركة: {{company_name}}
المبلغ: {{amount}} {{currency}}
البلد: {{country}}
المتطلبات القانونية: {{legal_requirements}}

يجب أن يشمل:
- طلب أخير للدفع
- الجدول الزمني للإجراء القانوني
- فرصة لتجنب الإجراءات القانونية
- الامتثال للقوانين المحلية
- نبرة مهنية ومحترمة
- الحساسية الثقافية
    `
  }
}

export function interpolateTemplate(template: string, variables: Record<string, any>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return variables[key] || match
  })
}