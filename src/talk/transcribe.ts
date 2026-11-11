import { TalkError } from './talkError'

export const WHISPER_ORIGIN = 'http://whisper-api.whisper-api.orb.local:8080'
export const WHISPER_FILE_MAX = 5_242_880

const WHISPER_CODES = new Set([
  'unauthorized',
  'payload_too_large',
  'too_long',
  'unreadable_audio',
  'invalid_language',
  'missing_file',
  'unsupported_media',
  'busy',
  'not_ready',
  'internal',
])

export async function transcribeSpeech(
  file: File,
  options: { fetch: typeof fetch; origin: string; apiKey: string },
): Promise<string> {
  if (!options.apiKey) throw new TalkError('speech.whisper_key')
  if (file.size > WHISPER_FILE_MAX) throw new TalkError('speech.payload_too_large')
  const form = new FormData()
  form.append('file', file, file.name || 'speech.webm')
  const response = await options.fetch(`${options.origin}/v1/transcribe`, {
    method: 'POST',
    headers: { authorization: `Bearer ${options.apiKey}` },
    body: form,
  })
  if (!response.ok) throw new TalkError(`speech.${await whisperCode(response)}`)
  const payload: unknown = await response.json()
  if (typeof payload !== 'object' || payload === null) throw new TalkError('speech.whisper')
  const text = (payload as { text?: unknown }).text
  if (typeof text !== 'string') throw new TalkError('speech.whisper')
  return text
}

async function whisperCode(response: Response): Promise<string> {
  try {
    const payload: unknown = await response.json()
    const code =
      typeof payload === 'object' && payload !== null
        ? (payload as { error?: unknown }).error
        : undefined
    if (typeof code === 'string' && WHISPER_CODES.has(code)) return code
  } catch {
    return 'whisper'
  }
  return 'whisper'
}
