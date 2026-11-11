import { parsePlan, type PlannedStep } from '../domain/instruction'
import { TalkError } from './talkError'
import type { InstructInput } from './model'

export type TalkInput = {
  file: File
  selectedTitle: string
  selectedBody: string
  titles: string[]
}

export type TalkResult =
  | { ok: true; transcript: string; steps: PlannedStep[] }
  | { ok: false; error: { code: string }; transcript?: string }

export async function handleTalk(
  input: TalkInput,
  deps: {
    transcribe: (file: File) => Promise<string>
    instruct: (input: InstructInput) => Promise<string>
  },
): Promise<TalkResult> {
  let heard: string | null = null
  try {
    const transcript = await deps.transcribe(input.file)
    heard = transcript
    if (transcript.trim() === '') {
      return {
        ok: true,
        transcript,
        steps: [{ id: '1', after: [], instruction: { action: 'none' } }],
      }
    }
    const text = await deps.instruct({
      transcript,
      selectedTitle: input.selectedTitle,
      selectedBody: input.selectedBody,
      titles: input.titles,
    })
    const steps = parsePlan(text)
    if (!steps) return { ok: false, error: { code: 'speech.instruction' }, transcript }
    return { ok: true, transcript, steps }
  } catch (error) {
    if (error instanceof TalkError) {
      if (heard === null) return { ok: false, error: { code: error.code } }
      return { ok: false, error: { code: error.code }, transcript: heard }
    }
    throw error
  }
}
