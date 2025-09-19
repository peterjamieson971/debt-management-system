import { generateContent, Context, GenerationOptions, GeneratedContent } from './openai'
import { generateContentFallback } from './gemini'

export type TaskComplexity = 'simple' | 'complex' | 'negotiation'

export async function generateWithSmartRouting(
  type: TaskComplexity,
  prompt: string,
  context: Context,
  options: GenerationOptions = {}
): Promise<GeneratedContent> {
  // Route based on complexity to optimize cost
  // Use cheaper Gemini for simple tasks, GPT-4 for complex negotiations
  const useGemini = type === 'simple' ||
                     (type === 'complex' && context.priority === 'low')

  try {
    if (useGemini) {
      // Use cheaper Gemini for simple tasks
      return await generateContentFallback(prompt, context, options.language)
    } else {
      // Use GPT-4 Turbo for complex negotiations and high-priority cases
      return await generateContent(prompt, context, options)
    }
  } catch (error) {
    console.error(`Primary model failed (${useGemini ? 'Gemini' : 'OpenAI'}):`, error)

    // Fallback to the other model if primary fails
    try {
      if (useGemini) {
        return await generateContent(prompt, context, options)
      } else {
        return await generateContentFallback(prompt, context, options.language)
      }
    } catch (fallbackError) {
      console.error('Both AI models failed:', fallbackError)
      throw new Error('All AI services are currently unavailable')
    }
  }
}