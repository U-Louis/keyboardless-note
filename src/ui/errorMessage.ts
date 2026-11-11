const messages: Record<string, string> = {
  'note.title.required': 'Enter a title.',
  'note.title.too_long': 'A title can be at most 80 characters.',
  'note.selection.required': 'Select a card first.',
  'note.target.missing': 'No card has that title.',
  'note.step.blocked': 'That step could not run.',
  'speech.whisper_key': 'Whisper has no API key. Add WHISPER_API_KEY to the environment or .env.',
  'speech.cursor_key': 'Cursor has no API key. Add CURSOR_API_KEY to the environment or .env.',
  'speech.cursor_sdk': 'The Cursor SDK is not installed.',
  'speech.cursor': 'Cursor could not answer.',
  'speech.model': 'The language model could not answer. For chat, set LLM_API_ORIGIN and LLM_MODEL.',
  'speech.mic':
    'The microphone is blocked. The browser inside the editor does not allow it. Open http://127.0.0.1:5173 in Chrome and allow the microphone.',
  'speech.empty': 'Nothing was recorded. Hold the button longer and speak.',
  'speech.instruction': 'That speech was not a note command.',
  'speech.internal': 'Something went wrong. Try again.',
  'speech.whisper': 'Whisper did not answer.',
  'speech.unauthorized': 'Whisper refused the API key.',
  'speech.payload_too_large': 'The recording is too large.',
  'speech.too_long': 'The recording is too long.',
  'speech.unreadable_audio': 'Whisper could not read the recording.',
  'speech.invalid_language': 'Whisper could not use that language.',
  'speech.missing_file': 'No recording was sent.',
  'speech.unsupported_media': 'That recording format is not supported.',
  'speech.busy': 'Whisper is busy. Try again in a moment.',
  'speech.not_ready': 'Whisper is not ready yet.',
}

export function errorMessage(code: string): string {
  return messages[code] ?? 'Something went wrong. Try again.'
}
