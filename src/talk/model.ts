import { instructionSystemPrompt } from '../domain/instruction'

export type InstructInput = {
  transcript: string
  selectedTitle: string
  selectedBody: string
  titles: string[]
}

/** Reads the transcript and returns text. It never receives the sound file. No tools. The credential stays out of the prompt and the reply. */
export type Orchestrator = (input: InstructInput) => Promise<string>

export function buildUserPrompt(input: InstructInput): string {
  return [
    `Transcript: ${input.transcript}`,
    `Selected title: ${input.selectedTitle}`,
    `Selected body: ${input.selectedBody}`,
    `Titles: ${input.titles.join('\n')}`,
  ].join('\n')
}

export function instructionPrompt(input: InstructInput): string {
  return `${instructionSystemPrompt()}\n\n${buildUserPrompt(input)}`
}

export function containsSecret(text: string, secret: string): boolean {
  return secret.length > 0 && text.includes(secret)
}

export function scrubSecret(error: unknown, secret: string): Error {
  const message = error instanceof Error ? error.message : 'speech.internal'
  if (secret.length === 0) return new Error(message)
  return new Error(message.split(secret).join('[redacted]'))
}
