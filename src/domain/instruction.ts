import reference from './instructions.json'
import { createNote, deleteNote, updateBody, updateTitle, type Note, type NoteError } from './note'

type ReferenceAction = {
  action: string
  arguments: readonly string[]
  optional?: readonly string[]
}

const actions: readonly ReferenceAction[] = reference.actions

export type Instruction =
  | { action: 'create'; title: string }
  | { action: 'update_title'; title: string; target?: string }
  | { action: 'update_body'; body: string; target?: string }
  | { action: 'delete'; target?: string }
  | { action: 'read_card'; target?: string }
  | { action: 'read_all' }
  | { action: 'count' }
  | { action: 'none' }

export type ReadResult =
  | { action: 'read_card'; title: string; body: string }
  | { action: 'read_all'; notes: { title: string; body: string }[] }
  | { action: 'count'; total: number }

export type PlannedStep = {
  id: string
  after: string[]
  instruction: Instruction
}

export type ApplyError =
  | NoteError
  | { code: 'note.selection.required' }
  | { code: 'note.target.missing' }
  | { code: 'note.step.blocked' }

export type ApplyResult =
  | { ok: true; notes: Note[]; selectedId: string | null; read?: ReadResult }
  | { ok: false; error: ApplyError; notes: Note[]; selectedId: string | null }

export type PlanResult = {
  notes: Note[]
  selectedId: string | null
  error: ApplyError | null
  changed: boolean
  focus: 'body' | 'list' | 'stay'
  reads: ReadResult[]
}

export function instructionSystemPrompt(): string {
  return [
    'You turn one speech into one JSON object {"steps":[...]}.',
    'Reply with the JSON object only.',
    `Each step has ${reference.step.join(', ')}, and one action.`,
    'after lists the step ids that must finish before this step starts.',
    'Steps that do not wait on each other start together.',
    'A step that edits a note created by an earlier step lists that step id in after and sets target to the note title.',
    'update_title, update_body, delete, and read_card use target when it is set, and the selected note when it is not.',
    'read_card returns that note title and body. read_all returns every title and body. count returns how many notes there are.',
    'Use a single none step when the speech is not a note command.',
    ...actions.map(example),
  ].join('\n')
}

function example(entry: ReferenceAction): string {
  const waits = (entry.optional ?? []).includes('target')
  const object: Record<string, unknown> = {
    id: '<id>',
    after: waits ? ['<id>'] : [],
    action: entry.action,
  }
  for (const name of entry.arguments) object[name] = '<words from the transcript>'
  for (const name of entry.optional ?? []) {
    if (name === 'target') object[name] = '<note title>'
  }
  return JSON.stringify(object)
}

export function parseInstruction(text: string): Instruction | null {
  const parsed = parseJson(text)
  if (parsed === null || Array.isArray(parsed)) return null
  return instructionFromUnknown(parsed)
}

export function parsePlan(text: string): PlannedStep[] | null {
  const parsed = parseJson(text)
  if (parsed === null) return null
  return planFromUnknown(parsed)
}

export function planFromUnknown(value: unknown): PlannedStep[] | null {
  if (Array.isArray(value)) return stepsFrom(value)
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  if (Array.isArray(record.steps)) return stepsFrom(record.steps)
  const instruction = instructionFromUnknown(record)
  if (!instruction) return null
  return [{ id: '1', after: [], instruction }]
}

export function instructionFromUnknown(value: unknown): Instruction | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (typeof record.action !== 'string') return null
  const listed = actions.find((entry) => entry.action === record.action)
  if (!listed) return null
  const args: Record<string, string> = {}
  for (const name of listed.arguments) {
    const arg = record[name]
    if (typeof arg !== 'string') return null
    args[name] = arg
  }
  for (const name of listed.optional ?? []) {
    if (!(name in record)) continue
    const arg = record[name]
    if (typeof arg !== 'string') return null
    args[name] = arg
  }
  return toInstruction(listed.action, args)
}

export function applyInstruction(
  notes: readonly Note[],
  selectedId: string | null,
  instruction: Instruction,
  id: string,
): ApplyResult {
  const current = notes.slice()
  if (instruction.action === 'none') {
    return { ok: true, notes: current, selectedId }
  }
  if (instruction.action === 'create') {
    const created = createNote(instruction.title, id)
    if (!created.ok) {
      return { ok: false, error: created.error, notes: current, selectedId }
    }
    return { ok: true, notes: [...current, created.note], selectedId: created.note.id }
  }
  if (instruction.action === 'read_all') {
    return {
      ok: true,
      notes: current,
      selectedId,
      read: {
        action: 'read_all',
        notes: current.map((note) => ({ title: note.title, body: note.body })),
      },
    }
  }
  if (instruction.action === 'count') {
    return { ok: true, notes: current, selectedId, read: { action: 'count', total: current.length } }
  }
  const selected = findTarget(current, selectedId, instruction)
  if (!selected) {
    const code = targetOf(instruction) === undefined ? 'note.selection.required' : 'note.target.missing'
    return { ok: false, error: { code }, notes: current, selectedId }
  }
  if (instruction.action === 'update_title') {
    const updated = updateTitle(selected, instruction.title)
    if (!updated.ok) {
      return { ok: false, error: updated.error, notes: current, selectedId }
    }
    return {
      ok: true,
      notes: current.map((note) => (note.id === selected.id ? updated.note : note)),
      selectedId,
    }
  }
  if (instruction.action === 'update_body') {
    const updated = updateBody(selected, instruction.body)
    return {
      ok: true,
      notes: current.map((note) => (note.id === selected.id ? updated : note)),
      selectedId,
    }
  }
  if (instruction.action === 'read_card') {
    return {
      ok: true,
      notes: current,
      selectedId: selected.id,
      read: { action: 'read_card', title: selected.title, body: selected.body },
    }
  }
  const index = current.findIndex((note) => note.id === selected.id)
  const next = deleteNote(current, selected.id)
  const neighbor = next[Math.min(index, next.length - 1)]
  return { ok: true, notes: next, selectedId: neighbor?.id ?? null }
}

export async function runPlan(
  notes: readonly Note[],
  selectedId: string | null,
  steps: readonly PlannedStep[],
  newId: () => string,
  listener: { onStart?: (id: string) => void; onFinish?: (id: string) => void } = {},
): Promise<PlanResult> {
  let pending = steps.slice()
  const done = new Set<string>()
  const failed = new Set<string>()
  let currentNotes = notes.slice()
  let currentSelected = selectedId
  let error: ApplyError | null = null
  let changed = false
  let focus: PlanResult['focus'] = 'stay'
  const reads: ReadResult[] = []

  while (pending.length > 0) {
    const ready = pending.filter((step) => step.after.every((id) => done.has(id)))
    const blocked = pending.filter((step) => step.after.some((id) => failed.has(id)))
    for (const step of blocked) failed.add(step.id)
    pending = pending.filter((step) => !ready.includes(step) && !blocked.includes(step))
    if (ready.length === 0) {
      if (pending.length > 0 && !error) error = { code: 'note.step.blocked' }
      break
    }
    const snapshotNotes = currentNotes
    const snapshotSelected = currentSelected
    const running = ready.map((step) => {
      listener.onStart?.(step.id)
      return {
        step,
        patch: patchOf(snapshotNotes, snapshotSelected, step.instruction, newId()),
      }
    })
    await Promise.all(
      running.map(
        (item) =>
          new Promise<void>((resolve) => {
            queueMicrotask(() => {
              listener.onFinish?.(item.step.id)
              resolve()
            })
          }),
      ),
    )
    for (const item of running) {
      if (!item.patch.ok) {
        failed.add(item.step.id)
        if (!error) error = item.patch.error
        continue
      }
      done.add(item.step.id)
      const folded = fold(currentNotes, currentSelected, item.patch)
      currentNotes = folded.notes
      currentSelected = folded.selectedId
      if (folded.changed) changed = true
      if (folded.focus !== 'stay') focus = folded.focus
      if (folded.read) reads.push(folded.read)
    }
  }

  return { notes: currentNotes, selectedId: currentSelected, error, changed, focus, reads }
}

function parseJson(text: string): unknown | null {
  const start = text.search(/[{[]/)
  const end = Math.max(text.lastIndexOf('}'), text.lastIndexOf(']'))
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

function stepsFrom(value: readonly unknown[]): PlannedStep[] | null {
  const steps: PlannedStep[] = []
  for (const item of value) {
    const step = stepFrom(item, steps.length + 1)
    if (!step) return null
    steps.push(step)
  }
  const ids = new Set(steps.map((step) => step.id))
  if (ids.size !== steps.length) return null
  if (steps.some((step) => step.after.some((id) => !ids.has(id)))) return null
  return steps
}

function stepFrom(value: unknown, index: number): PlannedStep | null {
  if (typeof value !== 'object' || value === null) return null
  const record = value as Record<string, unknown>
  const nested = record.instruction
  const source =
    typeof nested === 'object' && nested !== null && !Array.isArray(nested) ? nested : record
  const instruction = instructionFromUnknown(source)
  if (!instruction) return null
  const id = typeof record.id === 'string' && record.id.length > 0 ? record.id : String(index)
  if (!Array.isArray(record.after)) return { id, after: [], instruction }
  if (record.after.some((item) => typeof item !== 'string')) return null
  return { id, after: record.after, instruction }
}

function toInstruction(action: string, args: Record<string, string>): Instruction | null {
  const target = args.target
  if (action === 'create') {
    if (args.title === undefined) return null
    return { action, title: args.title }
  }
  if (action === 'update_title') {
    if (args.title === undefined) return null
    return target === undefined ? { action, title: args.title } : { action, title: args.title, target }
  }
  if (action === 'update_body') {
    if (args.body === undefined) return null
    return target === undefined ? { action, body: args.body } : { action, body: args.body, target }
  }
  if (action === 'delete') return target === undefined ? { action } : { action, target }
  if (action === 'read_card') return target === undefined ? { action } : { action, target }
  if (action === 'read_all' || action === 'count' || action === 'none') return { action }
  return null
}

function targetOf(instruction: Instruction): string | undefined {
  if (
    instruction.action === 'update_title' ||
    instruction.action === 'update_body' ||
    instruction.action === 'delete' ||
    instruction.action === 'read_card'
  ) {
    return instruction.target
  }
  return undefined
}

function findTarget(
  notes: readonly Note[],
  selectedId: string | null,
  instruction: Instruction,
): Note | null {
  const target = targetOf(instruction)
  if (target !== undefined) {
    const title = target.trim()
    if (title.length === 0) return null
    return notes.filter((note) => note.title === title).at(-1) ?? null
  }
  return notes.find((note) => note.id === selectedId) ?? null
}

type Patch =
  | { ok: true; kind: 'none' }
  | { ok: true; kind: 'create'; note: Note }
  | { ok: true; kind: 'replace'; note: Note; focus: 'body' | 'stay' }
  | { ok: true; kind: 'delete'; id: string }
  | {
      ok: true
      kind: 'read'
      selectedId?: string | null
      read: ReadResult
      focus: 'body' | 'stay'
    }
  | { ok: false; error: ApplyError }

function patchOf(
  notes: readonly Note[],
  selectedId: string | null,
  instruction: Instruction,
  id: string,
): Patch {
  const applied = applyInstruction(notes, selectedId, instruction, id)
  if (!applied.ok) return applied
  if (applied.read) {
    return {
      ok: true,
      kind: 'read',
      selectedId: applied.read.action === 'read_card' ? applied.selectedId : undefined,
      read: applied.read,
      focus: applied.read.action === 'read_card' ? 'body' : 'stay',
    }
  }
  if (instruction.action === 'none') return { ok: true, kind: 'none' }
  if (instruction.action === 'create') {
    const note = applied.notes.find((item) => item.id === id)
    if (!note) return { ok: false, error: { code: 'note.selection.required' } }
    return { ok: true, kind: 'create', note }
  }
  if (instruction.action === 'delete') {
    const target = findTarget(notes, selectedId, instruction)
    if (!target) return { ok: false, error: { code: 'note.selection.required' } }
    return { ok: true, kind: 'delete', id: target.id }
  }
  const target = findTarget(notes, selectedId, instruction)
  const note = applied.notes.find((item) => item.id === target?.id)
  if (!note) return { ok: false, error: { code: 'note.selection.required' } }
  return {
    ok: true,
    kind: 'replace',
    note,
    focus: instruction.action === 'update_title' ? 'body' : 'stay',
  }
}

function fold(
  notes: readonly Note[],
  selectedId: string | null,
  patch: Exclude<Patch, { ok: false }>,
): {
  notes: Note[]
  selectedId: string | null
  changed: boolean
  focus: PlanResult['focus']
  read?: ReadResult
} {
  if (patch.kind === 'read') {
    return {
      notes: notes.slice(),
      selectedId: patch.selectedId === undefined ? selectedId : patch.selectedId,
      changed: false,
      focus: patch.focus,
      read: patch.read,
    }
  }
  if (patch.kind === 'none') return { notes: notes.slice(), selectedId, changed: false, focus: 'stay' }
  if (patch.kind === 'create') {
    return {
      notes: [...notes, patch.note],
      selectedId: patch.note.id,
      changed: true,
      focus: 'body',
    }
  }
  if (patch.kind === 'replace') {
    return {
      notes: notes.map((note) => (note.id === patch.note.id ? patch.note : note)),
      selectedId: patch.note.id,
      changed: true,
      focus: patch.focus,
    }
  }
  const index = notes.findIndex((note) => note.id === patch.id)
  const next = notes.filter((note) => note.id !== patch.id)
  const neighbor = next[Math.min(index, next.length - 1)]
  return { notes: next, selectedId: neighbor?.id ?? null, changed: true, focus: 'list' }
}
