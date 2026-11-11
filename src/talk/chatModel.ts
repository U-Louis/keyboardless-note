import { readServerEnv } from './env'
import { containsSecret, instructionPrompt, scrubSecret, type InstructInput } from './model'
import { TalkError } from './talkError'

export async function instructWithChat(
  input: InstructInput,
  fetchImpl: typeof fetch = fetch,
): Promise<string> {
  const origin = readServerEnv('LLM_API_ORIGIN')?.replace(/\/$/, '')
  const model = readServerEnv('LLM_MODEL')
  const apiKey = readServerEnv('LLM_API_KEY') ?? ''
  if (!origin || !model) throw new TalkError('speech.model')
  const message = instructionPrompt(input)
  if (containsSecret(message, apiKey)) throw new TalkError('speech.model')
  try {
    const response = await fetchImpl(`${origin}/chat/completions`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        ...(apiKey ? { authorization: `Bearer ${apiKey}` } : {}),
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'user', content: message }],
      }),
    })
    if (!response.ok) throw new TalkError('speech.model')
    const payload = await readJson(response)
    const text = completionText(payload)
    if (text === null || text.trim() === '' || containsSecret(text, apiKey)) {
      throw new TalkError('speech.model')
    }
    return text
  } catch (error) {
    if (error instanceof TalkError) throw error
    throw scrubSecret(error, apiKey)
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json()
  } catch {
    throw new TalkError('speech.model')
  }
}

function completionText(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const choices = (payload as { choices?: unknown }).choices
  if (!Array.isArray(choices)) return null
  const first = choices[0] as { message?: unknown } | undefined
  const message = first?.message
  if (typeof message !== 'object' || message === null) return null
  const content = (message as { content?: unknown }).content
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return null
  let text = ''
  for (const part of content) {
    if (typeof part === 'string') {
      text += part
      continue
    }
    if (typeof part !== 'object' || part === null) return null
    const piece = (part as { text?: unknown }).text
    if (typeof piece !== 'string') return null
    text += piece
  }
  return text
}
