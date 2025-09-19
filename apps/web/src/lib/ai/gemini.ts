import { GoogleGenerativeAI } from '@google/generative-ai'
import { Context, GeneratedContent } from './openai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function generateContentFallback(
  prompt: string,
  context: Context,
  language: 'en' | 'ar' = 'en'
): Promise<GeneratedContent> {
  try {
    const model = genAI.getGenerativeModel({
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 1000,
      }
    })

    const systemPrompt = `
      You are a debt collection specialist for recruitment agencies in the GCC region.

      Cultural considerations:
      - Maintain respectful, relationship-focused tone
      - ${language === 'ar' ? 'Respond in Arabic with proper formal tone' : 'Respond in English'}
      - Avoid aggressive language
      - Reference mutual business interests
      - Be aware of Islamic banking principles (no interest charges in Saudi Arabia)

      Context: ${JSON.stringify(context, null, 2)}
    `

    const result = await model.generateContent(
      systemPrompt + "\n\nUser Request: " + prompt
    )

    const response = await result.response
    const text = response.text()
    const tokensUsed = response.usageMetadata?.totalTokenCount || 0
    const cost = calculateGeminiCost(tokensUsed)

    return {
      content: text,
      tokensUsed,
      model: "gemini-2.5-flash",
      cost
    }
  } catch (error) {
    console.error('Gemini API Error:', error)
    throw new Error('Failed to generate content with Gemini')
  }
}

function calculateGeminiCost(tokens: number): number {
  // Gemini 2.5 Flash pricing: $0.075/$0.30 per 1K tokens
  const avgCostPer1K = (0.075 + 0.30) / 2
  return (tokens / 1000) * avgCostPer1K
}