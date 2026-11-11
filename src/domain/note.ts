export type Note = {
  id: string
  title: string
  body: string
}

export type NoteError = {
  code: 'note.title.required' | 'note.title.too_long'
}

export type NoteResult = { ok: true; note: Note } | { ok: false; error: NoteError }

const TITLE_MAX = 80

export function createNote(title: string, id: string): NoteResult {
  const checked = checkTitle(title)
  if (!checked.ok) return checked
  return { ok: true, note: { id, title: checked.title, body: '' } }
}

export function updateTitle(note: Note, title: string): NoteResult {
  const checked = checkTitle(title)
  if (!checked.ok) return checked
  return { ok: true, note: { ...note, title: checked.title } }
}

export function updateBody(note: Note, body: string): Note {
  return { ...note, body }
}

export function deleteNote(notes: readonly Note[], id: string): Note[] {
  return notes.filter((note) => note.id !== id)
}

function checkTitle(
  title: string,
): { ok: true; title: string } | { ok: false; error: NoteError } {
  const trimmed = title.trim()
  if (trimmed.length === 0) {
    return { ok: false, error: { code: 'note.title.required' } }
  }
  if (trimmed.length > TITLE_MAX) {
    return { ok: false, error: { code: 'note.title.too_long' } }
  }
  return { ok: true, title: trimmed }
}
