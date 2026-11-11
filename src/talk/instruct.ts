import { mkdirSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { readServerEnv, withoutProcessEnv } from './env'
import { containsSecret, instructionPrompt, scrubSecret, type InstructInput } from './model'
import { TalkError } from './talkError'

const secretEnv = ['CURSOR_API_KEY', 'WHISPER_API_KEY'] as const

type CursorSdk = {
  Agent: {
    prompt: (
      message: string,
      options: {
        apiKey: string
        model: { id: string }
        tools: []
        local: { cwd: string; settingSources: [] }
      },
    ) => Promise<{ status: string; result?: string }>
  }
  CursorAgentError: new (...args: never[]) => Error
}

async function loadCursorSdk(): Promise<CursorSdk> {
  const specifier: string = '@cursor/sdk'
  return import(specifier) as Promise<CursorSdk>
}

export async function instructWithCursor(
  input: InstructInput,
  loadSdk: () => Promise<CursorSdk> = loadCursorSdk,
): Promise<string> {
  const apiKey = readServerEnv('CURSOR_API_KEY')
  if (!apiKey) throw new TalkError('speech.cursor_key')
  const model = readServerEnv('CURSOR_MODEL') || 'composer-2.5'
  const message = instructionPrompt(input)
  if (containsSecret(message, apiKey)) {
    throw new TalkError('speech.cursor')
  }
  let sdk: CursorSdk
  try {
    sdk = await loadSdk()
  } catch (error) {
    if (isMissingModule(error)) throw new TalkError('speech.cursor_sdk')
    throw scrubSecret(error, apiKey)
  }
  try {
    const result = await withoutProcessEnv(secretEnv, () =>
      sdk.Agent.prompt(message, {
        apiKey,
        model: { id: model },
        tools: [],
        local: { cwd: agentCwd(), settingSources: [] },
      }),
    )
    if (
      result.status !== 'finished' ||
      typeof result.result !== 'string' ||
      result.result.trim() === '' ||
      containsSecret(result.result, apiKey)
    ) {
      throw new TalkError('speech.cursor')
    }
    return result.result
  } catch (error) {
    if (error instanceof TalkError) throw error
    if (error instanceof sdk.CursorAgentError) throw new TalkError('speech.cursor')
    throw scrubSecret(error, apiKey)
  }
}

function agentCwd(): string {
  const dir = join(tmpdir(), 'keyboardless-note-talk')
  mkdirSync(dir, { recursive: true })
  return dir
}

function isMissingModule(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code?: unknown }).code === 'ERR_MODULE_NOT_FOUND'
  )
}
