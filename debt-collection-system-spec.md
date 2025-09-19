# Automated Debt Collection System - Technical Specification
## For GCC Recruitment Agencies

### Project Overview
Build a comprehensive automated debt collection system for recruitment agencies operating in the GCC region, with initial focus on UAE and Saudi Arabia markets. The system automates email communications, uses AI for response generation and debtor profiling, provides real-time dashboards, and supports Phase 2 voice automation.

### Technology Stack
- **Database**: Supabase (PostgreSQL with real-time subscriptions)
- **Backend/Frontend**: Next.js 14+ (App Router) on Node.js
- **Hosting**: Vercel (with Edge Functions)
- **Automation**: Zapier (Gmail integration, webhook orchestration)
- **AI/LLM**: OpenAI GPT-4 Turbo (primary), Google Gemini 2.5 Flash (fallback)
- **Voice (Phase 2)**: ElevenLabs Conversational AI Platform
- **Email**: Gmail API via Zapier
- **Monitoring**: Vercel Analytics, Supabase Dashboard

---

## 1. Database Schema (Supabase)

### Core Tables

```sql
-- Organizations (Multi-tenant support)
CREATE TABLE organizations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    email VARCHAR(255) UNIQUE NOT NULL,
    settings JSONB DEFAULT '{}',
    subscription_tier VARCHAR(50) DEFAULT 'starter',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Users
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    email VARCHAR(255) UNIQUE NOT NULL,
    role VARCHAR(50) DEFAULT 'collector',
    full_name VARCHAR(255),
    preferences JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Debtors
CREATE TABLE debtors (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    company_name VARCHAR(255) NOT NULL,
    company_type VARCHAR(50), -- 'SME', 'Enterprise', 'Multinational'
    primary_contact_name VARCHAR(255),
    primary_contact_email VARCHAR(255),
    primary_contact_phone VARCHAR(50),
    secondary_contacts JSONB DEFAULT '[]',
    address JSONB,
    country VARCHAR(2), -- 'AE', 'SA', 'KW', 'QA', 'BH', 'OM'
    language_preference VARCHAR(10) DEFAULT 'en', -- 'en', 'ar'
    risk_profile VARCHAR(50) DEFAULT 'medium',
    behavioral_score DECIMAL(3,2) DEFAULT 0.50,
    tags TEXT[],
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Invoices
CREATE TABLE invoices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    debtor_id UUID REFERENCES debtors(id) ON DELETE CASCADE,
    invoice_number VARCHAR(100) UNIQUE NOT NULL,
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'AED',
    issue_date DATE NOT NULL,
    due_date DATE NOT NULL,
    description TEXT,
    line_items JSONB DEFAULT '[]',
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'overdue', 'partial', 'paid', 'disputed', 'written_off'
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collection Cases
CREATE TABLE collection_cases (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    debtor_id UUID REFERENCES debtors(id) ON DELETE CASCADE,
    invoice_ids UUID[] NOT NULL,
    total_amount DECIMAL(15,2) NOT NULL,
    outstanding_amount DECIMAL(15,2) NOT NULL,
    status VARCHAR(50) DEFAULT 'active', -- 'active', 'paused', 'resolved', 'escalated', 'legal'
    priority VARCHAR(20) DEFAULT 'medium', -- 'low', 'medium', 'high', 'critical'
    assigned_to UUID REFERENCES users(id),
    workflow_id UUID REFERENCES collection_workflows(id),
    current_stage INTEGER DEFAULT 1,
    ai_strategy JSONB DEFAULT '{}',
    payment_promise_date DATE,
    last_contact_date TIMESTAMPTZ,
    next_action_date TIMESTAMPTZ,
    escalation_date TIMESTAMPTZ,
    notes TEXT,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Collection Workflows
CREATE TABLE collection_workflows (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    debtor_segment VARCHAR(50), -- 'SME', 'Enterprise', 'Strategic', 'Transactional'
    stages JSONB NOT NULL, -- Array of stage definitions
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Communication Logs
CREATE TABLE communication_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    case_id UUID REFERENCES collection_cases(id) ON DELETE CASCADE,
    debtor_id UUID REFERENCES debtors(id) ON DELETE CASCADE,
    channel VARCHAR(50) NOT NULL, -- 'email', 'phone', 'sms', 'whatsapp', 'letter'
    direction VARCHAR(10) NOT NULL, -- 'inbound', 'outbound'
    status VARCHAR(50) DEFAULT 'sent', -- 'draft', 'sent', 'delivered', 'read', 'replied', 'bounced', 'failed'
    subject TEXT,
    content TEXT,
    ai_generated BOOLEAN DEFAULT false,
    sentiment_score DECIMAL(3,2),
    intent_classification VARCHAR(100),
    response_required BOOLEAN DEFAULT false,
    zapier_task_id VARCHAR(255),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Payments
CREATE TABLE payments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    case_id UUID REFERENCES collection_cases(id),
    debtor_id UUID REFERENCES debtors(id) ON DELETE CASCADE,
    invoice_ids UUID[],
    amount DECIMAL(15,2) NOT NULL,
    currency VARCHAR(3) DEFAULT 'AED',
    payment_method VARCHAR(50),
    reference_number VARCHAR(255),
    status VARCHAR(50) DEFAULT 'pending', -- 'pending', 'completed', 'failed', 'refunded'
    processed_at TIMESTAMPTZ,
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- AI Interactions
CREATE TABLE ai_interactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    case_id UUID REFERENCES collection_cases(id),
    interaction_type VARCHAR(50), -- 'email_generation', 'response_analysis', 'strategy_adjustment', 'voice_call'
    prompt TEXT,
    response TEXT,
    model_used VARCHAR(100),
    tokens_used INTEGER,
    cost DECIMAL(10,6),
    performance_metrics JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Analytics Events
CREATE TABLE analytics_events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
    event_type VARCHAR(100) NOT NULL,
    entity_type VARCHAR(50),
    entity_id UUID,
    properties JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for performance
CREATE INDEX idx_debtors_organization ON debtors(organization_id);
CREATE INDEX idx_invoices_debtor ON invoices(debtor_id);
CREATE INDEX idx_invoices_status ON invoices(status);
CREATE INDEX idx_cases_status ON collection_cases(status);
CREATE INDEX idx_cases_assigned ON collection_cases(assigned_to);
CREATE INDEX idx_communications_case ON communication_logs(case_id);
CREATE INDEX idx_payments_debtor ON payments(debtor_id);
CREATE INDEX idx_analytics_events_type ON analytics_events(event_type);
```

### Row Level Security (RLS) Policies

```sql
-- Enable RLS on all tables
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE debtors ENABLE ROW LEVEL SECURITY;
ALTER TABLE invoices ENABLE ROW LEVEL SECURITY;
ALTER TABLE collection_cases ENABLE ROW LEVEL SECURITY;
ALTER TABLE communication_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- Example RLS Policy for debtors table
CREATE POLICY "Users can view their organization's debtors" ON debtors
    FOR SELECT
    USING (organization_id = auth.jwt()->>'organization_id');

CREATE POLICY "Users can insert debtors for their organization" ON debtors
    FOR INSERT
    WITH CHECK (organization_id = auth.jwt()->>'organization_id');

CREATE POLICY "Users can update their organization's debtors" ON debtors
    FOR UPDATE
    USING (organization_id = auth.jwt()->>'organization_id');
```

---

## 2. API Endpoints (Next.js App Router)

### Authentication Endpoints
```typescript
// app/api/auth/login/route.ts
POST /api/auth/login
Body: { email: string, password: string }
Response: { token: string, user: User }

// app/api/auth/logout/route.ts
POST /api/auth/logout
Headers: { Authorization: "Bearer <token>" }
Response: { success: boolean }

// app/api/auth/refresh/route.ts
POST /api/auth/refresh
Headers: { Authorization: "Bearer <refresh_token>" }
Response: { token: string, refreshToken: string }
```

### Debtor Management Endpoints
```typescript
// app/api/debtors/route.ts
GET /api/debtors
Query: { page: number, limit: number, search?: string, segment?: string }
Response: { debtors: Debtor[], total: number, page: number }

POST /api/debtors
Body: { company_name: string, contact_email: string, ... }
Response: { debtor: Debtor }

// app/api/debtors/[id]/route.ts
GET /api/debtors/:id
Response: { debtor: Debtor }

PATCH /api/debtors/:id
Body: { updates: Partial<Debtor> }
Response: { debtor: Debtor }

DELETE /api/debtors/:id
Response: { success: boolean }
```

### Collection Case Endpoints
```typescript
// app/api/cases/route.ts
GET /api/cases
Query: { status?: string, priority?: string, assigned_to?: string }
Response: { cases: Case[], total: number }

POST /api/cases
Body: { debtor_id: string, invoice_ids: string[], workflow_id?: string }
Response: { case: Case }

// app/api/cases/[id]/route.ts
GET /api/cases/:id
Response: { case: Case, communications: Communication[], payments: Payment[] }

PATCH /api/cases/:id
Body: { updates: Partial<Case> }
Response: { case: Case }

// app/api/cases/[id]/actions/route.ts
POST /api/cases/:id/actions
Body: { action: 'pause' | 'resume' | 'escalate' | 'close' }
Response: { case: Case }
```

### Communication Endpoints
```typescript
// app/api/communications/route.ts
POST /api/communications/send
Body: { case_id: string, template_id?: string, custom_content?: string }
Response: { communication: Communication, zapier_task_id: string }

POST /api/communications/analyze
Body: { communication_id: string, content: string }
Response: { intent: string, sentiment: number, suggested_action: string }

// app/api/communications/templates/route.ts
GET /api/communications/templates
Query: { stage?: string, language?: string }
Response: { templates: Template[] }

POST /api/communications/templates
Body: { name: string, content: string, variables: string[] }
Response: { template: Template }
```

### AI/LLM Endpoints
```typescript
// app/api/ai/generate/route.ts
POST /api/ai/generate
Body: { 
  type: 'email' | 'sms' | 'script',
  context: { debtor: Debtor, case: Case, history: Communication[] },
  tone: 'friendly' | 'formal' | 'urgent',
  language: 'en' | 'ar'
}
Response: { content: string, tokens_used: number }

// app/api/ai/analyze/route.ts
POST /api/ai/analyze
Body: { 
  content: string,
  analysis_type: 'sentiment' | 'intent' | 'payment_likelihood'
}
Response: { 
  sentiment?: number,
  intent?: string,
  payment_probability?: number,
  recommended_actions: string[]
}

// app/api/ai/strategy/route.ts
POST /api/ai/strategy
Body: { case_id: string }
Response: { 
  recommended_strategy: string,
  next_actions: Action[],
  risk_assessment: RiskProfile
}
```

### Webhook Endpoints (Zapier Integration)
```typescript
// app/api/webhooks/zapier/route.ts
POST /api/webhooks/zapier
Headers: { 'X-Zapier-Signature': string }
Body: {
  event: 'email.received' | 'email.bounced' | 'payment.received',
  data: any
}
Response: { processed: boolean }

// app/api/webhooks/gmail/route.ts
POST /api/webhooks/gmail
Body: {
  message_id: string,
  thread_id: string,
  from: string,
  subject: string,
  body: string
}
Response: { processed: boolean, case_updated: boolean }
```

### Analytics Endpoints
```typescript
// app/api/analytics/dashboard/route.ts
GET /api/analytics/dashboard
Query: { period: 'day' | 'week' | 'month' | 'year' }
Response: {
  kpis: {
    total_outstanding: number,
    collection_rate: number,
    avg_days_to_pay: number,
    cases_resolved: number
  },
  charts: {
    collection_trend: ChartData,
    aging_analysis: ChartData,
    team_performance: ChartData
  }
}

// app/api/analytics/reports/route.ts
POST /api/analytics/reports/generate
Body: { 
  type: 'collection' | 'performance' | 'debtor',
  period: DateRange,
  format: 'pdf' | 'excel' | 'csv'
}
Response: { report_url: string }
```

---

## 3. Zapier Integration Specifications

### Zapier Workflows (Zaps)

#### 1. New Invoice to Collection Case
```yaml
Trigger: New row in Supabase (invoices table)
Actions:
  1. Check if overdue (Filter)
  2. Create/Update collection case (Supabase)
  3. Send initial notice (Gmail)
  4. Create follow-up task (Delay + Gmail)
  5. Log communication (Webhook to Vercel API)
```

#### 2. Email Response Processing
```yaml
Trigger: New email in Gmail (labeled 'debt-collection')
Actions:
  1. Extract email content (Gmail)
  2. Send to AI analysis (Webhook to Vercel API)
  3. Update case status (Supabase)
  4. Generate AI response (Webhook to Vercel API)
  5. Send response (Gmail)
  6. Update communication log (Supabase)
```

#### 3. Payment Promise Workflow
```yaml
Trigger: Webhook from Vercel (payment promise detected)
Actions:
  1. Update case with promise date (Supabase)
  2. Create calendar reminder (Google Calendar)
  3. Send confirmation email (Gmail)
  4. Schedule follow-up (Delay)
  5. Check payment status (Supabase)
  6. Escalate if not paid (Conditional)
```

#### 4. Escalation Workflow
```yaml
Trigger: Case escalation (Webhook from Vercel)
Actions:
  1. Update case priority (Supabase)
  2. Notify manager (Gmail/Slack)
  3. Generate formal notice (Webhook to Vercel API)
  4. Send via registered email (Gmail)
  5. Create legal review task (if applicable)
```

### Webhook Payload Structures

```typescript
// Email Received Webhook
{
  "event": "email.received",
  "timestamp": "2025-01-15T10:30:00Z",
  "data": {
    "message_id": "msg_123",
    "thread_id": "thread_456",
    "from": "john@company.com",
    "to": "collections@agency.com",
    "subject": "RE: Invoice #INV-2025-001",
    "body": "Email content...",
    "attachments": []
  }
}

// Payment Received Webhook
{
  "event": "payment.received",
  "timestamp": "2025-01-15T14:45:00Z",
  "data": {
    "payment_id": "pay_789",
    "debtor_id": "deb_123",
    "amount": 5000.00,
    "currency": "AED",
    "reference": "INV-2025-001",
    "method": "bank_transfer"
  }
}
```

---

## 4. AI/LLM Integration

### Primary: OpenAI GPT-4 Turbo
```typescript
// lib/ai/openai.ts
import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function generateContent(
  prompt: string,
  context: Context,
  options: GenerationOptions
): Promise<GeneratedContent> {
  const completion = await openai.chat.completions.create({
    model: "gpt-4-turbo",
    messages: [
      {
        role: "system",
        content: `
          You are a debt collection specialist for recruitment agencies in the GCC.
          Cultural considerations:
          - Maintain respectful, relationship-focused tone
          - Use formal Arabic greetings when appropriate
          - Avoid aggressive language
          - Reference mutual business interests
          - Be aware of Islamic banking principles (no interest in Saudi Arabia)
        `
      },
      {
        role: "user",
        content: prompt
      }
    ],
    temperature: options.temperature || 0.7,
    max_tokens: options.maxTokens || 1000
  });
  
  return {
    content: completion.choices[0].message.content,
    tokensUsed: completion.usage.total_tokens,
    model: "gpt-4-turbo"
  };
}
```

### Fallback: Google Gemini 2.5 Flash
```typescript
// lib/ai/gemini.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

export async function generateContentFallback(
  prompt: string,
  context: Context
): Promise<GeneratedContent> {
  const model = genAI.getGenerativeModel({ 
    model: "gemini-2.5-flash",
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 1000,
    }
  });
  
  // Include system prompt for GCC context
  const systemPrompt = `
    You are a debt collection specialist for recruitment agencies in the GCC.
    Cultural considerations: Maintain respectful tone, avoid aggressive language,
    reference mutual business interests, be aware of Islamic banking principles.
  `;
  
  const result = await model.generateContent(
    systemPrompt + "\n\n" + prompt
  );
  
  return {
    content: result.response.text(),
    tokensUsed: result.usage.totalTokens,
    model: "gemini-2.5-flash"
  };
}
```

### Intelligent Model Routing
```typescript
// lib/ai/router.ts
export async function generateWithSmartRouting(
  type: 'simple' | 'complex' | 'negotiation',
  prompt: string,
  context: Context,
  options?: GenerationOptions
): Promise<GeneratedContent> {
  // Route based on complexity to optimize cost
  const useGemini = type === 'simple' || 
                     (type === 'complex' && context.priority === 'low');
  
  try {
    if (useGemini) {
      // Use cheaper Gemini for simple tasks
      return await generateContentFallback(prompt, context);
    } else {
      // Use GPT-4 Turbo for complex negotiations and high-priority cases
      return await generateContent(prompt, context, options);
    }
  } catch (error) {
    // Fallback to the other model if primary fails
    if (useGemini) {
      return await generateContent(prompt, context, options);
    } else {
      return await generateContentFallback(prompt, context);
    }
  }
}
```

### Cost Considerations
- **OpenAI GPT-4 Turbo**: $10/$30 per 1M tokens (input/output)
- **Google Gemini 2.5 Flash**: $0.075/$0.30 per 1K tokens (significantly cheaper)
- Recommendation: Use intelligent routing - simple templates with Gemini, complex negotiations with GPT-4

### Prompt Templates

```typescript
// lib/ai/prompts.ts
export const PROMPTS = {
  initialNotice: {
    en: `
      Generate a professional initial payment reminder for:
      Company: {{company_name}}
      Amount: {{amount}} {{currency}}
      Days Overdue: {{days_overdue}}
      Previous Relationship: {{relationship_history}}
      
      Tone: Friendly but professional
      Include: Payment options, contact information
      Avoid: Threatening language
    `,
    ar: `
      // Arabic version of the prompt
    `
  },
  
  responseAnalysis: `
    Analyze this email response from a debtor:
    "{{email_content}}"
    
    Identify:
    1. Intent (payment promise, dispute, request for information, etc.)
    2. Sentiment (positive, neutral, negative)
    3. Urgency level
    4. Recommended next action
    
    Return as JSON:
    {
      "intent": "...",
      "sentiment": 0.0-1.0,
      "urgency": "low|medium|high",
      "recommended_action": "..."
    }
  `,
  
  negotiationResponse: `
    The debtor has proposed: {{proposal}}
    Original amount: {{original_amount}}
    Company profile: {{company_profile}}
    Payment history: {{payment_history}}
    
    Generate a response that:
    1. Acknowledges their proposal
    2. Provides a counter-offer if needed
    3. Maintains relationship focus
    4. Includes clear next steps
  `
};
```

---

## 5. Frontend Components (React/Next.js)

### Core Dashboard Components

```typescript
// components/dashboard/CollectionDashboard.tsx
export default function CollectionDashboard() {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <KPICards />
      <CollectionTrend />
      <AgingAnalysis />
      <TeamPerformance />
      <ActiveCases />
      <RecentPayments />
    </div>
  );
}

// components/cases/CaseList.tsx
export default function CaseList() {
  const [filters, setFilters] = useState<Filters>({});
  const [sortBy, setSortBy] = useState<SortOption>('priority');
  
  return (
    <div>
      <CaseFilters onFilterChange={setFilters} />
      <DataTable
        columns={caseColumns}
        data={cases}
        sortBy={sortBy}
        onSort={setSortBy}
        actions={<CaseActions />}
      />
    </div>
  );
}

// components/communications/EmailComposer.tsx
export default function EmailComposer({ case, debtor }) {
  const [aiGenerated, setAiGenerated] = useState(false);
  const [content, setContent] = useState('');
  const [language, setLanguage] = useState('en');
  
  const generateEmail = async () => {
    const response = await fetch('/api/ai/generate', {
      method: 'POST',
      body: JSON.stringify({
        type: 'email',
        context: { case, debtor },
        language
      })
    });
    const data = await response.json();
    setContent(data.content);
    setAiGenerated(true);
  };
  
  return (
    <div className="space-y-4">
      <LanguageToggle value={language} onChange={setLanguage} />
      <Button onClick={generateEmail}>Generate with AI</Button>
      <RichTextEditor value={content} onChange={setContent} />
      <EmailPreview content={content} language={language} />
      <Button onClick={sendEmail}>Send Email</Button>
    </div>
  );
}

// components/analytics/KPICards.tsx
export default function KPICards() {
  const { data: kpis } = useQuery('kpis', fetchKPIs);
  
  return (
    <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <KPICard
        title="Outstanding Amount"
        value={formatCurrency(kpis?.totalOutstanding)}
        change={kpis?.outstandingChange}
        icon={<DollarSign />}
      />
      <KPICard
        title="Collection Rate"
        value={`${kpis?.collectionRate}%`}
        change={kpis?.rateChange}
        icon={<TrendingUp />}
        target={85}
      />
      <KPICard
        title="Avg Days to Pay"
        value={kpis?.avgDaysToPay}
        change={kpis?.daysChange}
        icon={<Calendar />}
        target={45}
      />
      <KPICard
        title="Active Cases"
        value={kpis?.activeCases}
        change={kpis?.casesChange}
        icon={<Briefcase />}
      />
    </div>
  );
}
```

### Real-time Updates (Supabase)

```typescript
// hooks/useRealtimeUpdates.ts
import { useEffect } from 'react';
import { supabase } from '@/lib/supabase';

export function useRealtimeCases(organizationId: string) {
  useEffect(() => {
    const channel = supabase
      .channel('cases-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'collection_cases',
          filter: `organization_id=eq.${organizationId}`
        },
        (payload) => {
          // Handle real-time updates
          console.log('Case update:', payload);
          // Update local state/cache
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [organizationId]);
}
```

---

## 6. Security & Compliance

### Authentication & Authorization
- JWT-based authentication with refresh tokens
- Role-based access control (RBAC): Admin, Manager, Collector, Viewer
- Multi-factor authentication (MFA) for sensitive operations
- Session management with automatic timeout

### Data Security
- End-to-end encryption for sensitive data
- PII masking in logs and analytics
- Secure API key management (environment variables)
- Regular security audits and penetration testing

### GCC Compliance Requirements
- **UAE**: Comply with Federal Decree-Law No. 15/2024
  - 10-day notification requirement
  - 20-day payment period
  - 5-year record retention
- **Saudi Arabia**: Sharia-compliant collection practices
  - No interest charges
  - Alternative incentive structures
- **Data Privacy**: GDPR-equivalent compliance for EU nationals
- **Communication Timing**: Respect for prayer times and religious holidays

### Audit Trail
```typescript
// lib/audit.ts
export async function logAuditEvent(
  action: string,
  entityType: string,
  entityId: string,
  userId: string,
  metadata?: any
) {
  await supabase.from('audit_logs').insert({
    action,
    entity_type: entityType,
    entity_id: entityId,
    user_id: userId,
    metadata,
    ip_address: getClientIP(),
    user_agent: getUserAgent(),
    created_at: new Date().toISOString()
  });
}
```

---

## 7. Testing Requirements

### Unit Tests
```typescript
// __tests__/api/ai/generate.test.ts
describe('AI Content Generation', () => {
  it('should generate email in English', async () => {
    const response = await generateContent(
      'initial_notice',
      mockContext,
      { language: 'en' }
    );
    expect(response.content).toContain('payment');
    expect(response.tokensUsed).toBeLessThan(1000);
  });
  
  it('should fallback to Gemini when OpenAI fails', async () => {
    // Mock OpenAI failure
    jest.spyOn(openai, 'generateContent').mockRejectedValue(new Error());
    
    const response = await generateWithFallback(
      'initial_notice',
      mockContext
    );
    expect(response.model).toBe('gemini-2.5-flash');
  });
});
```

### Integration Tests
- Zapier webhook processing
- Email sending via Gmail
- Supabase real-time subscriptions
- Payment processing workflows

### E2E Tests
```typescript
// cypress/e2e/collection-workflow.cy.ts
describe('Collection Workflow', () => {
  it('should create case and send initial notice', () => {
    cy.login('collector@agency.com');
    cy.visit('/cases/new');
    cy.fillCaseForm(mockDebtor);
    cy.contains('Create Case').click();
    cy.contains('Case created successfully');
    cy.contains('Initial notice sent');
  });
});
```

---

## 8. Deployment Configuration

### Environment Variables
```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-supabase-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-key

# AI/LLM
OPENAI_API_KEY=your-openai-key
GEMINI_API_KEY=your-gemini-key

# Zapier
ZAPIER_WEBHOOK_SECRET=your-webhook-secret

# Email
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_CLIENT_SECRET=your-gmail-client-secret

# Phase 2 - Voice
ELEVENLABS_API_KEY=your-elevenlabs-key
TWILIO_ACCOUNT_SID=your-twilio-sid
TWILIO_AUTH_TOKEN=your-twilio-token
```

### Vercel Configuration
```json
{
  "functions": {
    "app/api/ai/generate/route.ts": {
      "maxDuration": 30
    },
    "app/api/webhooks/zapier/route.ts": {
      "maxDuration": 10
    }
  },
  "env": {
    "NEXT_PUBLIC_APP_URL": "https://your-app.vercel.app"
  }
}
```

### Docker Configuration (for local development)
```dockerfile
FROM node:20-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 9. Performance Optimization

### Database Optimization
- Implement database indexes on frequently queried columns
- Use materialized views for complex analytics queries
- Implement connection pooling
- Regular VACUUM and ANALYZE operations

### API Optimization
- Implement response caching with Redis
- Use pagination for large datasets
- Implement request debouncing
- Rate limiting per organization

### Frontend Optimization
- Lazy loading for dashboard components
- Virtual scrolling for large lists
- Image optimization with Next.js Image component
- Code splitting with dynamic imports

---

## 10. Phase 2: Voice Automation (ElevenLabs)

### Voice Agent Configuration
```typescript
// lib/voice/elevenlabs.ts
import { ElevenLabsClient } from 'elevenlabs';

const client = new ElevenLabsClient({
  apiKey: process.env.ELEVENLABS_API_KEY
});

export async function createVoiceAgent(
  caseId: string,
  debtorProfile: DebtorProfile
) {
  const agent = await client.agents.create({
    name: `Collection Agent - ${caseId}`,
    voice: debtorProfile.language === 'ar' ? 'arabic-male' : 'english-female',
    firstMessage: generateGreeting(debtorProfile),
    systemPrompt: getCollectionPrompt(debtorProfile),
    responseTimeout: 5000,
    llmModel: 'gpt-4-turbo',
    tools: [
      {
        name: 'schedule_payment',
        description: 'Schedule a payment plan',
        parameters: paymentPlanSchema
      },
      {
        name: 'transfer_to_human',
        description: 'Transfer to human agent',
        parameters: {}
      }
    ]
  });
  
  return agent;
}
```

### Call Workflow
```typescript
// lib/voice/callWorkflow.ts
export async function initiateCall(
  phoneNumber: string,
  caseId: string
) {
  // Create voice agent
  const agent = await createVoiceAgent(caseId, debtorProfile);
  
  // Initiate call via Twilio
  const call = await twilioClient.calls.create({
    to: phoneNumber,
    from: process.env.TWILIO_PHONE_NUMBER,
    url: `${process.env.APP_URL}/api/voice/webhook`,
    statusCallback: `${process.env.APP_URL}/api/voice/status`,
    machineDetection: 'DetectMessageEnd',
    asyncAmd: true
  });
  
  // Log call initiation
  await logCallEvent(caseId, call.sid, 'initiated');
  
  return call;
}
```

---

## Implementation Notes

### Priority Order
1. **Week 1-2**: Database setup, authentication, basic CRUD APIs
2. **Week 3-4**: Zapier integration, email workflows
3. **Week 5-6**: AI/LLM integration, content generation
4. **Week 7-8**: Dashboard and analytics
5. **Week 9-10**: Testing, optimization, deployment
6. **Week 11-12**: Documentation, training, go-live

### Critical Success Factors
- Maintain sub-second response times for dashboard
- Achieve 95% email delivery rate
- Ensure 99.9% uptime for critical workflows
- Maintain full audit trail for compliance

### Monitoring & Alerts
- Set up Vercel Analytics for performance monitoring
- Configure Supabase alerts for database issues
- Implement custom alerts for:
  - Failed payment promises
  - High-value debt escalations
  - AI generation failures
  - Zapier webhook failures

---

## Appendix: Sample Workflow Configuration

```json
{
  "name": "Standard B2B Collection - SME",
  "stages": [
    {
      "stage": 1,
      "name": "Friendly Reminder",
      "delay_days": -5,
      "actions": [
        {
          "type": "email",
          "template": "friendly_reminder",
          "language": "auto"
        }
      ]
    },
    {
      "stage": 2,
      "name": "First Notice",
      "delay_days": 3,
      "actions": [
        {
          "type": "email",
          "template": "first_notice",
          "language": "auto"
        },
        {
          "type": "sms",
          "template": "payment_reminder"
        }
      ]
    },
    {
      "stage": 3,
      "name": "Second Notice",
      "delay_days": 14,
      "actions": [
        {
          "type": "email",
          "template": "second_notice",
          "language": "auto",
          "cc_finance": true
        },
        {
          "type": "task",
          "description": "Attempt phone contact"
        }
      ]
    },
    {
      "stage": 4,
      "name": "Final Notice",
      "delay_days": 30,
      "actions": [
        {
          "type": "email",
          "template": "final_notice",
          "language": "auto",
          "require_read_receipt": true
        },
        {
          "type": "escalate",
          "to": "manager"
        }
      ]
    },
    {
      "stage": 5,
      "name": "Legal Review",
      "delay_days": 60,
      "actions": [
        {
          "type": "legal_review",
          "require_approval": true
        }
      ]
    }
  ]
}
```

---

## Contact & Support

For implementation questions or support:
- Technical Lead: [Your Name]
- Project Repository: [GitHub URL]
- Documentation: [Confluence/Notion URL]
- Slack Channel: #debt-collection-system

---

*Last Updated: January 2025*
*Version: 1.0.0*