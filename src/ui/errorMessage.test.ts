import { describe, expect, it } from 'vitest'
import { errorMessage } from './errorMessage'

const codes = [
  'note.title.required',
  'note.title.too_long',
  'note.selection.required',
  'note.target.missing',
  'note.step.blocked',
  'speech.whisper_key',
  'speech.cursor_key',
  'speech.cursor_sdk',
  'speech.cursor',
  'speech.model',
  'speech.mic',
  'speech.empty',
  'speech.instruction',
  'speech.internal',
  'speech.whisper',
  'speech.unauthorized',
  'speech.payload_too_large',
  'speech.too_long',
  'speech.unreadable_audio',
  'speech.invalid_language',
  'speech.missing_file',
  'speech.unsupported_media',
  'speech.busy',
  'speech.not_ready',
]

describe('errorMessage', () => {
  it('gives every known code a sentence', () => {
    for (const code of codes) {
      const message = errorMessage(code)
      expect(message).not.toBe(code)
      expect(message.endsWith('.')).toBe(true)
    }
  })

  it('gives an unknown code a sentence', () => {
    expect(errorMessage('speech.other')).toBe('Something went wrong. Try again.')
  })
})
