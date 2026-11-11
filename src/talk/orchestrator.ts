import { instructWithChat } from './chatModel'
import { readServerEnv } from './env'
import { instructWithCursor } from './instruct'
import type { Orchestrator } from './model'
import { TalkError } from './talkError'

export function orchestratorFromEnv(): Orchestrator {
  const which = (readServerEnv('ORCHESTRATOR') || 'cursor').trim().toLowerCase()
  if (which === 'cursor') return instructWithCursor
  if (which === 'chat') return instructWithChat
  return async () => {
    throw new TalkError('speech.model')
  }
}
