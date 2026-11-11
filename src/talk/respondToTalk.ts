import type { IncomingMessage } from 'node:http'
import { handleTalk } from './handleTalk'
import { readServerEnv } from './env'
import { orchestratorFromEnv } from './orchestrator'
import { parseTalkForm } from './talkForm'
import { WHISPER_ORIGIN, transcribeSpeech } from './transcribe'

export async function respondToTalk(req: IncomingMessage): Promise<{
  status: number
  body:
    | { ok: true; transcript: string; steps: unknown }
    | { ok: false; error: { code: string }; transcript?: string }
}> {
  const request = await nodeRequest(req)
  const parsed = await parseTalkForm(request)
  if (!parsed.ok) return { status: 400, body: parsed }
  const apiKey = readServerEnv('WHISPER_API_KEY') ?? ''
  const origin = readServerEnv('WHISPER_API_ORIGIN') || WHISPER_ORIGIN
  try {
    const result = await handleTalk(parsed.input, {
      transcribe: (file) => transcribeSpeech(file, { fetch, origin, apiKey }),
      instruct: orchestratorFromEnv(),
    })
    return { status: 200, body: result }
  } catch {
    return { status: 500, body: { ok: false, error: { code: 'speech.internal' } } }
  }
}

async function nodeRequest(req: IncomingMessage): Promise<Request> {
  const chunks: Buffer[] = []
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk))
  }
  const headers = new Headers()
  for (const [key, value] of Object.entries(req.headers)) {
    if (typeof value === 'string') headers.set(key, value)
    else if (Array.isArray(value)) value.forEach((item) => headers.append(key, item))
  }
  return new Request('http://127.0.0.1:5173/api/talk', {
    method: 'POST',
    headers,
    body: Buffer.concat(chunks),
  })
}
