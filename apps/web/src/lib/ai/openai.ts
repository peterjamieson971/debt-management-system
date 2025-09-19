import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY!,
})

export interface Context {
  debtor?: any
  case?: any
  history?: any[]
  priority?: 'low' | 'medium' | 'high'
}

export interface GenerationOptions {
  temperature?: number
  maxTokens?: number
  language?: 'en' | 'ar'
  tone?: 'friendly' | 'formal' | 'urgent'
}

export interface GeneratedContent {
  content: string
  tokensUsed: number
  model: string
  cost?: number
}

export async function generateContent(
  prompt: string,
  context: Context,
  options: GenerationOptions = {}
): Promise<GeneratedContent> {
  const systemPrompt = `
    You are a debt collection specialist for recruitment agencies in the GCC region.

    Cultural considerations:
    - Maintain respectful, relationship-focused tone
    - Use formal Arabic greetings when appropriate (${options.language === 'ar' ? 'Arabic language required' : 'English preferred'})
    - Avoid aggressive language
    - Reference mutual business interests
    - Be aware of Islamic banking principles (no interest in Saudi Arabia)

    Context: ${JSON.stringify(context, null, 2)}

    Generate content with tone: ${options.tone || 'professional'}
  `

  try {
    const completion = await openai.chat.completions.create({
      model: "gpt-4-turbo",
      messages: [
        {
          role: "system",
          content: systemPrompt
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: options.temperature || 0.7,
      max_tokens: options.maxTokens || 1000
    })

    const tokensUsed = completion.usage?.total_tokens || 0
    const cost = calculateCost(tokensUsed, 'gpt-4-turbo')

    return {
      content: completion.choices[0].message.content || '',
      tokensUsed,
      model: "gpt-4-turbo",
      cost
    }
  } catch (error) {
    console.error('OpenAI API Error:', error)
    throw new Error('Failed to generate content with OpenAI')
  }
}

function calculateCost(tokens: number, model: string): number {
  const pricing = {
    'gpt-4-turbo': { input: 10, output: 30 }, // per 1M tokens in USD
    'gemini-2.5-flash': { input: 0.075, output: 0.30 } // per 1K tokens in USD
  }

  // Rough estimation - would need to track input/output tokens separately
  const avgCostPer1M = (pricing[model as keyof typeof pricing]?.input + pricing[model as keyof typeof pricing]?.output) / 2
  return (tokens / 1000000) * avgCostPer1M
}