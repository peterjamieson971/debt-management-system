# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Primary Development Workflow
```bash
# Start development server (uses Turbo for monorepo orchestration)
npm run dev          # Starts all apps in development mode
turbo dev           # Alternative direct Turbo command

# Build and validation
npm run build       # Build all apps and packages
npm run lint        # Lint all packages
npm run type-check  # TypeScript type checking across monorepo
turbo clean         # Clean all build artifacts and cache
```

### Environment Setup
```bash
# Set up environment variables for the web app
cd apps/web
cp .env.example .env.local
# Fill in required API keys and database URLs

# Database setup (run SQL in Supabase dashboard)
cat supabase-schema.sql  # Contains complete schema with RLS policies
```

### Development Server
The dev server runs on available ports (3000-3003). Turbo handles port management automatically.

## Architecture Overview

### Monorepo Structure
- **Turbo-powered monorepo** with workspace orchestration
- **`apps/web`**: Next.js 14+ application (main debt collection interface)
- **`packages/`**: Shared libraries and utilities (currently empty, ready for extraction)

### Core Application Architecture (`apps/web`)

#### AI System (`src/lib/ai/`)
**Intelligent dual-model routing system:**
- **Primary**: OpenAI GPT-4 Turbo (complex negotiations, high-priority cases)
- **Secondary**: Google Gemini 2.5 Flash (simple tasks, cost optimization)
- **Smart Router** (`router.ts`): Automatically routes based on task complexity
- **Fallback Logic**: If primary model fails, automatically falls back to secondary
- **Cost Optimization**: Routes simple tasks to cheaper Gemini, complex to GPT-4

#### Database Integration (`src/lib/supabase/`)
- **Multi-tenant architecture** with Row Level Security (RLS)
- **Client/Server separation**: Different Supabase clients for browser vs server operations
- **Real-time subscriptions** for live updates
- **Service role client** for admin operations bypassing RLS

#### API Structure (`src/app/api/`)
**RESTful endpoints following Next.js App Router conventions:**
- **Authentication**: `/api/auth/login` (JWT-based with Supabase)
- **Core Entities**: `/api/debtors`, `/api/cases` (CRUD operations)
- **AI Generation**: `/api/ai/generate` (content generation with smart routing)
- **Webhooks**: `/api/webhooks/zapier` (external integration endpoint)

### Database Schema (Multi-tenant Design)
**Core entities with organization-based isolation:**
- **Organizations**: Multi-tenant root with subscription tiers
- **Users**: Role-based access (admin, manager, collector, viewer)
- **Debtors**: Company records with GCC-specific fields (country, language preferences)
- **Collection Cases**: Workflow-driven debt collection with AI strategy tracking
- **Communication Logs**: All interactions with sentiment analysis and AI flags
- **AI Interactions**: Cost and performance tracking for AI usage

### GCC-Specific Features
**Built for Gulf Cooperation Council markets:**
- **Compliance**: UAE Federal Decree-Law No. 15/2024, Saudi Sharia principles
- **Multi-language**: English/Arabic content generation
- **Cultural Context**: Business relationship-focused communication tone
- **Regional Workflows**: Country-specific collection processes

### External Integrations
- **Zapier Webhooks**: Email automation and Gmail integration
- **AI Models**: OpenAI + Google AI with automatic failover
- **Supabase**: Database, auth, and real-time subscriptions

## Key Development Patterns

### AI Content Generation
```typescript
// Smart routing based on task complexity
await generateWithSmartRouting(
  'negotiation',  // 'simple' | 'complex' | 'negotiation'
  prompt,
  { case, debtor, priority: 'high' },
  { language: 'ar', tone: 'formal' }
)
```

### Database Operations with RLS
All database operations automatically respect organization boundaries through RLS policies. API endpoints use `organization_id` from JWT context.

### Webhook Processing
Zapier webhooks are cryptographically verified and route to specific handlers based on event type (`email.received`, `payment.received`, etc.).

### Multi-tenant Security
Every API endpoint and database query is organization-scoped. RLS policies prevent cross-tenant data access.

## Environment Variables Required
See `apps/web/.env.example` for complete list. Critical variables:
- Supabase: Database URL and service keys
- AI: OpenAI and Google AI API keys
- Zapier: Webhook signature verification
- JWT: Secret for authentication tokens

## Deployment Notes
- **Production**: Vercel deployment (see DEPLOYMENT.md)
- **Database**: Supabase with RLS enabled
- **AI Costs**: Monitor usage through `ai_interactions` table
- **Compliance**: GCC-specific legal requirements built into workflows