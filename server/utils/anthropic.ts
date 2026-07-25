import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  const config = useRuntimeConfig()
  if (!config.anthropicApiKey) {
    throw createError({
      statusCode: 503,
      statusMessage: 'ANTHROPIC_API_KEY is not configured on the server (see .env.example -> NUXT_ANTHROPIC_API_KEY).'
    })
  }
  if (!client) {
    client = new Anthropic({ apiKey: config.anthropicApiKey })
  }
  return client
}
