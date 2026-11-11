import { describe, expect, it } from 'vitest'
import { createNote, deleteNote, updateBody, updateTitle } from './note'

describe('createNote', () => {
  it('stores Lamp with an empty body and the frozen id note-1', () => {
    expect(createNote('Lamp', 'note-1')).toEqual({
      ok: true,
      note: { id: 'note-1', title: 'Lamp', body: '' },
    })
  })

  it('trims the title Lamp', () => {
    expect(createNote('  Lamp  ', 'note-1')).toEqual({
      ok: true,
      note: { id: 'note-1', title: 'Lamp', body: '' },
    })
  })

  it('refuses an empty title with note.title.required', () => {
    expect(createNote('   ', 'note-1')).toEqual({
      ok: false,
      error: { code: 'note.title.required' },
    })
  })

  it('refuses 81 characters with note.title.too_long', () => {
    expect(createNote('a'.repeat(81), 'note-1')).toEqual({
      ok: false,
      error: { code: 'note.title.too_long' },
    })
  })

  it('accepts a title of 80 characters', () => {
    const title = 'a'.repeat(80)
    expect(createNote(title, 'note-1')).toEqual({
      ok: true,
      note: { id: 'note-1', title, body: '' },
    })
  })
})

describe('updateTitle', () => {
  it('keeps the previous title when the new title is empty', () => {
    const created = createNote('Lamp', 'note-1')
    if (!created.ok) throw new Error('expected note')
    expect(updateTitle(created.note, '   ')).toEqual({
      ok: false,
      error: { code: 'note.title.required' },
    })
    expect(created.note).toEqual({ id: 'note-1', title: 'Lamp', body: '' })
  })

  it('keeps the previous title when the new title is 81 characters', () => {
    const created = createNote('Lamp', 'note-1')
    if (!created.ok) throw new Error('expected note')
    expect(updateTitle(created.note, 'a'.repeat(81))).toEqual({
      ok: false,
      error: { code: 'note.title.too_long' },
    })
    expect(created.note).toEqual({ id: 'note-1', title: 'Lamp', body: '' })
  })
})

describe('updateBody', () => {
  it('sets the body to desk', () => {
    const created = createNote('Lamp', 'note-1')
    if (!created.ok) throw new Error('expected note')
    expect(updateBody(created.note, 'desk')).toEqual({
      id: 'note-1',
      title: 'Lamp',
      body: 'desk',
    })
  })
})

describe('deleteNote', () => {
  it('removes note-1', () => {
    const created = createNote('Lamp', 'note-1')
    if (!created.ok) throw new Error('expected note')
    expect(deleteNote([created.note], 'note-1')).toEqual([])
  })
})
