import type { Note } from '../domain/note'

export const NOTES_KEY = 'keyboardless-note'

export function loadNotes(storage: Pick<Storage, 'getItem'>): Note[] {
  const raw = storage.getItem(NOTES_KEY)
  if (raw === null) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter(isNote)
  } catch {
    return []
  }
}

export function saveNotes(storage: Pick<Storage, 'setItem'>, notes: readonly Note[]): void {
  storage.setItem(NOTES_KEY, JSON.stringify(notes))
}

function isNote(item: unknown): item is Note {
  if (typeof item !== 'object' || item === null) return false
  const note = item as Record<string, unknown>
  return (
    typeof note.id === 'string' &&
    typeof note.title === 'string' &&
    typeof note.body === 'string'
  )
}
