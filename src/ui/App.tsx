import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import { planFromUnknown, runPlan, type PlannedStep, type ReadResult } from '../domain/instruction'
import {
  createNote,
  deleteNote,
  updateBody,
  updateTitle,
  type Note,
} from '../domain/note'
import { loadNotes, saveNotes } from '../storage/localNotes'
import { errorMessage } from './errorMessage'
import { SpeechSession } from './speechSession'

type Editor = {
  notes: Note[]
  selectedId: string | null
  creating: boolean
  title: string
  body: string
  errorCode: string | null
}

function loadEditor(): Editor {
  const notes = loadNotes(window.localStorage)
  const selected = notes[0] ?? null
  return {
    notes,
    selectedId: selected?.id ?? null,
    creating: false,
    title: selected?.title ?? '',
    body: selected?.body ?? '',
    errorCode: null,
  }
}

export function App() {
  const [editor, setEditor] = useState<Editor>(loadEditor)
  const [speech, setSpeech] = useState<'idle' | 'recording' | 'sending'>('idle')
  const [hands, setHands] = useState(false)
  const [readout, setReadout] = useState<string | null>(null)
  const [transcript, setTranscript] = useState<string | null>(null)
  const editorRef = useRef(editor)
  const speechRef = useRef(speech)
  const handsRef = useRef(false)
  const sessionRef = useRef<SpeechSession | null>(null)
  const hold = useRef(0)
  const releasedHold = useRef(0)
  const pointerTalk = useRef(false)
  const finishRef = useRef<(token: number) => Promise<void>>(async () => {})
  editorRef.current = editor
  speechRef.current = speech
  handsRef.current = hands

  useEffect(() => {
    const list = document.getElementById('notes')
    if (document.activeElement === document.body && list instanceof HTMLElement) {
      list.focus()
    }
  }, [])

  useEffect(() => {
    if (hands) return
    function block(event: Event) {
      event.preventDefault()
      event.stopPropagation()
    }
    function blockPointer(event: Event) {
      const target = event.target
      if (target instanceof Element && target.closest('.talk, .tag')) return
      block(event)
    }
    const keys = ['keydown', 'keyup', 'keypress', 'beforeinput'] as const
    const pointers = [
      'pointerdown',
      'pointerup',
      'mousedown',
      'mouseup',
      'click',
      'dblclick',
      'auxclick',
      'contextmenu',
    ] as const
    for (const type of keys) window.addEventListener(type, block, true)
    for (const type of pointers) window.addEventListener(type, blockPointer, true)
    return () => {
      for (const type of keys) window.removeEventListener(type, block, true)
      for (const type of pointers) window.removeEventListener(type, blockPointer, true)
    }
  }, [hands])

  const selected = editor.notes.find((note) => note.id === editor.selectedId) ?? null

  function persist(notes: Note[], selectedId: string | null) {
    saveNotes(window.localStorage, notes)
    const next = notes.find((note) => note.id === selectedId) ?? null
    setEditor({
      notes,
      selectedId: next?.id ?? null,
      creating: false,
      title: next?.title ?? '',
      body: next?.body ?? '',
      errorCode: null,
    })
  }

  function focusList() {
    document.getElementById('notes')?.focus()
  }

  function stickDraft(current: Editor):
    | { ok: true; notes: Note[]; selectedId: string | null }
    | { ok: false; errorCode: string } {
    const created = createNote(current.title, crypto.randomUUID())
    if (!created.ok) return { ok: false, errorCode: created.error.code }
    const note = updateBody(created.note, current.body)
    const notes = [...current.notes, note]
    saveNotes(window.localStorage, notes)
    return { ok: true, notes, selectedId: note.id }
  }

  function startCreate() {
    if (!handsRef.current || speechRef.current !== 'idle') return
    const current = editorRef.current
    if (current.creating && current.title.trim() === '' && current.body === '') {
      queueMicrotask(() => document.getElementById('title')?.focus())
      return
    }
    if (current.creating) {
      const stuck = stickDraft(current)
      if (!stuck.ok) {
        setEditor({ ...current, errorCode: stuck.errorCode })
        queueMicrotask(() => document.getElementById('title')?.focus())
        return
      }
      setEditor({
        notes: stuck.notes,
        selectedId: stuck.selectedId,
        creating: true,
        title: '',
        body: '',
        errorCode: null,
      })
      queueMicrotask(() => document.getElementById('title')?.focus())
      return
    }
    setEditor({
      ...current,
      creating: true,
      title: '',
      body: '',
      errorCode: null,
    })
    queueMicrotask(() => document.getElementById('title')?.focus())
  }

  function selectNote(id: string) {
    if (!handsRef.current || speechRef.current !== 'idle') return
    const current = editorRef.current
    if (!current.creating && current.selectedId === id) return
    let notes = current.notes
    if (current.creating && (current.title.trim() !== '' || current.body !== '')) {
      const stuck = stickDraft(current)
      if (!stuck.ok) {
        setEditor({ ...current, errorCode: stuck.errorCode })
        return
      }
      notes = stuck.notes
    }
    const note = notes.find((item) => item.id === id)
    if (!note) return
    setEditor({
      notes,
      selectedId: note.id,
      creating: false,
      title: note.title,
      body: note.body,
      errorCode: null,
    })
    queueMicrotask(() => document.getElementById('title')?.focus())
  }

  function removeNote(id: string) {
    if (!handsRef.current || speechRef.current !== 'idle') return
    const current = editorRef.current
    const index = current.notes.findIndex((note) => note.id === id)
    const notes = deleteNote(current.notes, id)
    const selectedId =
      current.selectedId === id
        ? (notes[Math.min(index, notes.length - 1)]?.id ?? null)
        : current.selectedId
    persist(notes, selectedId)
    focusList()
  }

  function showError(code: string) {
    setEditor((current) => ({ ...current, errorCode: code }))
  }

  async function beginTalk() {
    if (speechRef.current !== 'idle') return
    const token = hold.current + 1
    hold.current = token
    releasedHold.current = 0
    setEditor((current) => ({ ...current, errorCode: null }))
    setReadout(null)
    setTranscript(null)
    const session = new SpeechSession()
    sessionRef.current = session
    try {
      await session.start(() => {
        void finishTalk(token)
      })
    } catch {
      if (hold.current !== token) return
      hold.current += 1
      speechRef.current = 'idle'
      setSpeech('idle')
      showError('speech.mic')
      return
    }
    if (hold.current !== token) {
      session.cancel()
      return
    }
    speechRef.current = 'recording'
    setSpeech('recording')
    if (releasedHold.current === token) void finishTalk(token)
  }

  function cancelTalk() {
    hold.current += 1
    speechRef.current = 'idle'
    sessionRef.current?.cancel()
    setSpeech('idle')
  }

  async function finishTalk(token: number) {
    if (hold.current !== token || speechRef.current !== 'recording') return
    hold.current += 1
    speechRef.current = 'sending'
    setSpeech('sending')
    const file = sessionRef.current ? await sessionRef.current.stop() : null
    if (!file) {
      speechRef.current = 'idle'
      setSpeech('idle')
      showError('speech.empty')
      return
    }
    try {
      await postTalk(file)
    } finally {
      speechRef.current = 'idle'
      setSpeech('idle')
    }
  }

  async function postTalk(file: File) {
    const current = editorRef.current
    const selectedNote = current.notes.find((note) => note.id === current.selectedId) ?? null
    const form = new FormData()
    form.append('speech', file, file.name)
    form.append('selectedTitle', selectedNote?.title ?? '')
    form.append('selectedBody', selectedNote?.body ?? '')
    form.append('titles', JSON.stringify(current.notes.map((note) => note.title)))
    let payload: unknown
    try {
      const response = await fetch('/api/talk', { method: 'POST', body: form })
      payload = await response.json()
    } catch {
      showError('speech.whisper')
      return
    }
    const heard = heardTranscript(payload)
    if (heard) setTranscript(heard)
    const read = readTalkPayload(payload)
    if (!read.ok) {
      showError(read.code)
      return
    }
    const applied = await runPlan(current.notes, current.selectedId, read.steps, () =>
      crypto.randomUUID(),
    )
    if (applied.error) showError(applied.error.code)
    setReadout(applied.reads.length === 0 ? null : applied.reads.map(formatRead).join('\n'))
    if (applied.changed) {
      persist(applied.notes, applied.selectedId)
    } else if (applied.selectedId !== current.selectedId) {
      const next = current.notes.find((note) => note.id === applied.selectedId) ?? null
      setEditor((editorState) => ({
        ...editorState,
        selectedId: next?.id ?? null,
        creating: false,
        title: next?.title ?? '',
        body: next?.body ?? '',
      }))
    }
    if (applied.focus === 'list') {
      queueMicrotask(() => document.getElementById('notes')?.focus())
    }
    if (applied.focus === 'body') {
      queueMicrotask(() => document.getElementById('body')?.focus())
    }
  }

  function onListKeyDown(event: KeyboardEvent<HTMLUListElement>) {
    if (!handsRef.current) {
      event.preventDefault()
      return
    }
    if (event.target !== event.currentTarget) return
    if (event.key === 'v') {
      event.preventDefault()
      if (!event.repeat) void beginTalk()
      return
    }
    if (speechRef.current !== 'idle') {
      event.preventDefault()
      if (event.key === 'Escape') cancelTalk()
      return
    }
    if (event.key === 'n') {
      event.preventDefault()
      startCreate()
      return
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      if (editor.notes.length === 0) return
      const index = Math.max(
        0,
        editor.notes.findIndex((note) => note.id === editor.selectedId),
      )
      const nextIndex =
        event.key === 'ArrowDown'
          ? Math.min(editor.notes.length - 1, index + 1)
          : Math.max(0, index - 1)
      const next = editor.notes[nextIndex]
      if (!next) return
      setEditor((current) => ({
        ...current,
        creating: false,
        selectedId: next.id,
        title: next.title,
        body: next.body,
        errorCode: null,
      }))
      return
    }
    if (event.key === 'Enter') {
      event.preventDefault()
      if (!selected) return
      document.getElementById('body')?.focus()
      return
    }
    if (event.key === 'd') {
      event.preventDefault()
      if (!editor.selectedId) return
      removeNote(editor.selectedId)
      return
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setEditor((current) => {
        const currentSelected =
          current.notes.find((note) => note.id === current.selectedId) ?? null
        return {
          ...current,
          creating: false,
          title: currentSelected?.title ?? '',
          body: currentSelected?.body ?? '',
          errorCode: null,
        }
      })
      focusList()
    }
  }

  function commitTitle() {
    if (editor.creating) {
      const result = createNote(editor.title, crypto.randomUUID())
      if (!result.ok) {
        setEditor((current) => ({ ...current, errorCode: result.error.code }))
        return
      }
      const note = updateBody(result.note, editor.body)
      const notes = [...editor.notes, note]
      persist(notes, note.id)
      queueMicrotask(() => document.getElementById('body')?.focus())
      return
    }
    if (!selected) return
    const result = updateTitle(selected, editor.title)
    if (!result.ok) {
      setEditor((current) => ({
        ...current,
        title: selected.title,
        errorCode: result.error.code,
      }))
      return
    }
    const notes = editor.notes.map((note) =>
      note.id === selected.id ? result.note : note,
    )
    persist(notes, selected.id)
    queueMicrotask(() => document.getElementById('body')?.focus())
  }

  function onTitleKeyDown(event: KeyboardEvent<HTMLInputElement>) {
    if (event.key === 'Enter') {
      event.preventDefault()
      commitTitle()
    }
    if (event.key === 'Escape') {
      event.preventDefault()
      setEditor((current) => {
        const currentSelected =
          current.notes.find((note) => note.id === current.selectedId) ?? null
        return {
          ...current,
          creating: false,
          title: currentSelected?.title ?? '',
          body: currentSelected?.body ?? '',
          errorCode: null,
        }
      })
      focusList()
    }
  }

  function onBodyChange(value: string) {
    if (!selected || editor.creating) {
      setEditor((current) => ({ ...current, body: value }))
      return
    }
    const updated = updateBody(selected, value)
    const notes = editor.notes.map((note) => (note.id === updated.id ? updated : note))
    saveNotes(window.localStorage, notes)
    setEditor((current) => ({ ...current, notes, body: value, errorCode: null }))
  }

  function onBodyKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      focusList()
    }
  }

  finishRef.current = finishTalk

  function onTalkPointerDown(event: PointerEvent<HTMLButtonElement>) {
    if (event.button !== 0 || speechRef.current !== 'idle') return
    pointerTalk.current = true
    event.currentTarget.setPointerCapture(event.pointerId)
    void beginTalk()
  }

  function onTalkPointerUp(event: PointerEvent<HTMLButtonElement>) {
    if (!pointerTalk.current) return
    pointerTalk.current = false
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId)
    }
    if (speechRef.current === 'recording') void finishTalk(hold.current)
    else releasedHold.current = hold.current
  }

  useEffect(() => {
    function onKeyUp(event: globalThis.KeyboardEvent) {
      if (event.key !== 'v') return
      if (speechRef.current === 'recording') void finishRef.current(hold.current)
      else releasedHold.current = hold.current
    }
    window.addEventListener('keyup', onKeyUp)
    return () => window.removeEventListener('keyup', onKeyUp)
  }, [])

  const talkLabel =
    speech === 'recording' ? 'Listening' : speech === 'sending' ? 'Thinking' : 'Hold to talk'

  return (
    <main data-hands={hands ? 'on' : 'off'} data-speech={speech === 'idle' ? undefined : speech}>
      <div className="bar">
        <button
          type="button"
          className="tag"
          aria-pressed={hands}
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => setHands((on) => !on)}
        >
          Input
        </button>
      </div>
      <p className="hint">
        n new, arrows move, enter opens the body, esc returns to the list, d deletes, hold v to
        talk.
      </p>
      <section className="board" aria-label="Board">
        <ul
          id="notes"
          className="cards"
          role="listbox"
          aria-label="Notes"
          aria-activedescendant={selected ? `note-${selected.id}` : undefined}
          tabIndex={0}
          autoFocus
          onKeyDown={onListKeyDown}
        >
          {editor.notes.map((note) => {
            const active = !editor.creating && note.id === editor.selectedId
            return (
              <li
                key={note.id}
                id={`note-${note.id}`}
                role="option"
                aria-label={note.title}
                aria-selected={note.id === editor.selectedId}
                onClick={() => selectNote(note.id)}
              >
                <article className="card">
                  {active && hands ? (
                    <CardFields
                      title={editor.title}
                      body={editor.body}
                      onTitleChange={(value) =>
                        setEditor((current) => ({ ...current, title: value }))
                      }
                      onTitleKeyDown={onTitleKeyDown}
                      onBodyChange={onBodyChange}
                      onBodyKeyDown={onBodyKeyDown}
                      deleteLabel={note.title}
                      onDelete={() => removeNote(note.id)}
                    />
                  ) : (
                    <>
                      <div className="card-head">
                        <h2 className="card-title">{note.title}</h2>
                        {hands ? (
                          <DeleteButton title={note.title} onDelete={() => removeNote(note.id)} />
                        ) : null}
                      </div>
                      <p className="card-body">{note.body}</p>
                    </>
                  )}
                </article>
              </li>
            )
          })}
          {editor.creating ? (
            <li role="none" className="draft">
              <article className="card card-draft">
                {hands ? (
                  <CardFields
                    title={editor.title}
                    body={editor.body}
                    onTitleChange={(value) =>
                      setEditor((current) => ({ ...current, title: value }))
                    }
                    onTitleKeyDown={onTitleKeyDown}
                    onBodyChange={onBodyChange}
                    onBodyKeyDown={onBodyKeyDown}
                  />
                ) : (
                  <>
                    <h2 className="card-title">{editor.title}</h2>
                    <p className="card-body">{editor.body}</p>
                  </>
                )}
              </article>
            </li>
          ) : null}
          {hands ? (
            <li role="none">
              <button type="button" className="add" aria-label="Add card" onClick={startCreate}>
                +
              </button>
            </li>
          ) : null}
        </ul>
      </section>
      {readout ? <p data-readout={readout}>{readout}</p> : null}
      {transcript ? (
        <p className="transcript">
          <span className="transcript-label">Whisper</span>
          <span data-transcript={transcript}>{transcript}</span>
        </p>
      ) : null}
      {editor.errorCode ? (
        <p data-error-code={editor.errorCode}>{errorMessage(editor.errorCode)}</p>
      ) : null}
      <button
        type="button"
        className="talk"
        aria-label="Push to talk"
        aria-pressed={speech === 'recording'}
        aria-busy={speech === 'sending'}
        onPointerDown={onTalkPointerDown}
        onPointerUp={onTalkPointerUp}
        onPointerCancel={onTalkPointerUp}
      >
        {speech === 'sending' ? <span className="spinner" aria-hidden="true" /> : null}
        {talkLabel}
      </button>
    </main>
  )
}

function CardFields({
  title,
  body,
  onTitleChange,
  onTitleKeyDown,
  onBodyChange,
  onBodyKeyDown,
  deleteLabel,
  onDelete,
}: {
  title: string
  body: string
  onTitleChange: (value: string) => void
  onTitleKeyDown: (event: KeyboardEvent<HTMLInputElement>) => void
  onBodyChange: (value: string) => void
  onBodyKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void
  deleteLabel?: string
  onDelete?: () => void
}) {
  return (
    <>
      <div className="card-head">
        <input
          id="title"
          aria-label="Title"
          value={title}
          autoComplete="off"
          onChange={(event) => onTitleChange(event.target.value)}
          onKeyDown={onTitleKeyDown}
        />
        {onDelete ? <DeleteButton title={deleteLabel ?? title} onDelete={onDelete} /> : null}
      </div>
      <textarea
        id="body"
        aria-label="Body"
        value={body}
        onChange={(event) => onBodyChange(event.target.value)}
        onKeyDown={onBodyKeyDown}
      />
    </>
  )
}

function DeleteButton({ title, onDelete }: { title: string; onDelete: () => void }) {
  return (
    <button
      type="button"
      className="delete"
      aria-label={`Delete ${title}`}
      tabIndex={-1}
      onClick={(event) => {
        event.stopPropagation()
        onDelete()
      }}
    >
      ×
    </button>
  )
}

function heardTranscript(payload: unknown): string | null {
  if (typeof payload !== 'object' || payload === null) return null
  const text = (payload as { transcript?: unknown }).transcript
  if (typeof text !== 'string') return null
  const trimmed = text.trim()
  return trimmed === '' ? null : trimmed
}

function formatRead(read: ReadResult): string {
  if (read.action === 'count') return String(read.total)
  if (read.action === 'read_card') return `${read.title}\n${read.body}`
  return read.notes.map((note) => `${note.title}\n${note.body}`).join('\n')
}

function readTalkPayload(
  payload: unknown,
): { ok: true; steps: PlannedStep[] } | { ok: false; code: string } {
  if (typeof payload !== 'object' || payload === null) return { ok: false, code: 'speech.whisper' }
  const body = payload as {
    ok?: unknown
    steps?: unknown
    instruction?: unknown
    error?: { code?: unknown }
  }
  if (body.ok === true) {
    const steps = planFromUnknown(body.steps ?? body.instruction)
    if (!steps) return { ok: false, code: 'speech.instruction' }
    return { ok: true, steps }
  }
  if (typeof body.error?.code === 'string') return { ok: false, code: body.error.code }
  return { ok: false, code: 'speech.whisper' }
}
