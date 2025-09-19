# Debt Collection System - Deployment Guide

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- Supabase account
- OpenAI API key
- Google AI API key (Gemini)
- Zapier account (for automation)
- Vercel account (for deployment)

### 1. Environment Setup

Copy the environment template and fill in your values:

```bash
cd apps/web
cp .env.example .env.local
```

Fill in the following environment variables:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# AI/LLM Configuration
OPENAI_API_KEY=sk-your-openai-key
GEMINI_API_KEY=your-gemini-api-key

# Zapier Integration
ZAPIER_WEBHOOK_SECRET=your-webhook-secret

# Application Configuration
NEXT_PUBLIC_APP_URL=http://localhost:3000
JWT_SECRET=your-jwt-secret-minimum-32-characters

# Gmail Integration (Optional)
GMAIL_CLIENT_ID=your-gmail-client-id
GMAIL_CLIENT_SECRET=your-gmail-client-secret
```

### 2. Database Setup

1. **Create Supabase Project**
   - Go to [supabase.com](https://supabase.com)
   - Create a new project
   - Choose a region close to your GCC market (recommended: Singapore for lower latency)

2. **Run Database Schema**
   ```bash
   # In Supabase SQL editor, run the contents of:
   cat supabase-schema.sql
   ```

3. **Configure Row Level Security**
   - The schema includes RLS policies for multi-tenant security
   - Ensure RLS is enabled on all tables

### 3. Local Development

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The application will be available at `http://localhost:3000`

## 🌐 Production Deployment

### Option 1: Vercel (Recommended)

1. **Deploy to Vercel**
   ```bash
   # Connect to Vercel
   npx vercel

   # Add environment variables in Vercel dashboard
   # Deploy
   npx vercel --prod
   ```

2. **Configure Vercel Settings**
   - Add environment variables in Vercel dashboard
   - Set function timeout for AI endpoints (30 seconds)
   - Enable Edge Functions for better performance

### Option 2: Docker Deployment

```bash
# Build Docker image
docker build -t debt-collection-system .

# Run container
docker run -p 3000:3000 --env-file .env debt-collection-system
```

## 🔧 Configuration

### AI Model Configuration

The system uses intelligent routing between OpenAI GPT-4 Turbo and Google Gemini:

- **Simple tasks**: Routed to Gemini (cost-effective)
- **Complex negotiations**: Routed to GPT-4 Turbo (higher quality)
- **Automatic fallback**: If primary model fails, falls back to secondary

### Zapier Automation Setup

1. **Create Zapier Account**
   - Sign up at [zapier.com](https://zapier.com)
   - Upgrade to a plan that supports webhooks

2. **Configure Gmail Integration**
   ```
   Trigger: New Email in Gmail (with label: debt-collection)
   Action: Webhook POST to your-app.com/api/webhooks/zapier
   ```

3. **Email Processing Workflow**
   ```
   1. Gmail receives email
   2. Zapier sends to webhook
   3. AI analyzes email content
   4. System updates case status
   5. Generate AI response if needed
   6. Send response via Gmail
   ```

## 📊 Monitoring & Analytics

### Performance Monitoring
- Vercel Analytics automatically tracks performance
- Supabase Dashboard shows database metrics
- Custom AI usage tracking in `ai_interactions` table

### Key Metrics to Monitor
- API response times (target: < 2 seconds)
- AI token usage and costs
- Email delivery rates
- Database query performance
- Webhook processing success rates

## 🔒 Security Considerations

### Authentication
- JWT-based authentication with Supabase
- Row Level Security (RLS) for multi-tenant isolation
- API key rotation every 90 days

### Data Protection
- PII encryption at rest (Supabase default)
- HTTPS enforcement
- Environment variable security
- Audit logging for all sensitive operations

### Compliance
- **UAE**: Federal Decree-Law No. 15/2024 compliance
- **Saudi Arabia**: Sharia-compliant practices (no interest)
- **GDPR**: EU national data protection
- **Audit Trail**: Complete action logging

## 🚨 Troubleshooting

### Common Issues

1. **Supabase Connection Errors**
   ```bash
   # Check environment variables
   echo $NEXT_PUBLIC_SUPABASE_URL
   echo $NEXT_PUBLIC_SUPABASE_ANON_KEY

   # Test connection
   npx supabase status
   ```

2. **AI API Failures**
   ```bash
   # Check API keys
   curl -H "Authorization: Bearer $OPENAI_API_KEY" https://api.openai.com/v1/models

   # Check rate limits and billing
   # OpenAI: https://platform.openai.com/usage
   # Google AI: https://console.cloud.google.com/
   ```

3. **Zapier Webhook Issues**
   ```bash
   # Test webhook endpoint
   curl -X POST https://your-app.com/api/webhooks/zapier \
        -H "Content-Type: application/json" \
        -H "X-Zapier-Signature: test" \
        -d '{"event":"test","data":{}}'
   ```

### Performance Optimization

1. **Database Optimization**
   - Ensure indexes are present (included in schema)
   - Monitor slow queries in Supabase
   - Use connection pooling for high traffic

2. **API Caching**
   - Implement Redis for frequently accessed data
   - Use Vercel Edge Caching for static responses
   - Cache AI responses for common scenarios

3. **AI Cost Optimization**
   - Monitor token usage in dashboard
   - Implement intelligent routing
   - Use cheaper models for simple tasks
   - Cache frequent AI responses

## 💰 Cost Management

### Monthly Cost Estimates (USD)

**Low Volume (< 1000 cases/month)**
- Vercel: $20
- Supabase: $25
- OpenAI: $100-300
- Gemini: $10-50
- Zapier: $20
- **Total**: ~$175-415

**Medium Volume (1000-5000 cases/month)**
- Vercel: $100
- Supabase: $100
- OpenAI: $500-1500
- Gemini: $50-200
- Zapier: $50
- **Total**: ~$800-1950

**High Volume (5000+ cases/month)**
- Vercel: $250
- Supabase: $300
- OpenAI: $2000-5000
- Gemini: $200-500
- Zapier: $100
- **Total**: ~$2850-6150

### Cost Optimization Tips
1. Use intelligent AI routing (Gemini for simple, GPT-4 for complex)
2. Implement response caching
3. Monitor and set usage alerts
4. Use Supabase edge functions for heavy processing
5. Optimize database queries

## 📈 Scaling Considerations

### Database Scaling
- Supabase automatically handles connection pooling
- Consider read replicas for analytics queries
- Implement archiving for old data

### Application Scaling
- Vercel automatically scales Edge Functions
- Use Redis for session management at scale
- Implement queue system for background processing

### AI Scaling
- Monitor rate limits (OpenAI: 60 RPM, Gemini: varies)
- Implement request queuing for high volume
- Consider dedicated AI infrastructure for enterprise

## 🎯 Go-Live Checklist

### Pre-Launch
- [ ] All environment variables configured
- [ ] Database schema deployed with sample data
- [ ] AI integration tested with both models
- [ ] Zapier workflows configured and tested
- [ ] Authentication system working
- [ ] RLS policies tested
- [ ] Performance testing completed
- [ ] Security audit conducted

### Launch Day
- [ ] Monitor error rates and performance
- [ ] Test all critical workflows
- [ ] Verify email delivery
- [ ] Check AI response quality
- [ ] Monitor cost usage
- [ ] Have rollback plan ready

### Post-Launch
- [ ] Set up monitoring alerts
- [ ] Schedule regular backups
- [ ] Plan user training sessions
- [ ] Create support documentation
- [ ] Schedule security reviews

## 📞 Support

For technical support:
- Check logs in Vercel dashboard
- Monitor Supabase metrics
- Review AI usage in admin panel
- Contact team leads for critical issues

## 🔄 Updates & Maintenance

### Regular Tasks
- Weekly: Review AI costs and performance
- Monthly: Security patches and dependency updates
- Quarterly: Performance optimization review
- Annually: Security audit and compliance review

---

**Last Updated**: January 2025
**Version**: 1.0.0
**Next Review**: February 2025