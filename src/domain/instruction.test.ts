import { describe, expect, it } from 'vitest'
import { createNote } from './note'
import {
  applyInstruction,
  instructionSystemPrompt,
  parseInstruction,
  parsePlan,
  planFromUnknown,
  runPlan,
} from './instruction'
import instructions from './instructions.json'

const lamp = (() => {
  const created = createNote('Lamp', 'note-1')
  if (!created.ok) throw new Error('expected note')
  return created.note
})()

describe('parseInstruction', () => {
  it('reads a create instruction', () => {
    expect(parseInstruction('{"action":"create","title":"Lamp"}')).toEqual({
      action: 'create',
      title: 'Lamp',
    })
  })

  it('reads update_title, update_body, delete, and none', () => {
    expect(parseInstruction('{"action":"update_title","title":"Desk"}')).toEqual({
      action: 'update_title',
      title: 'Desk',
    })
    expect(parseInstruction('{"action":"update_body","body":"desk"}')).toEqual({
      action: 'update_body',
      body: 'desk',
    })
    expect(parseInstruction('{"action":"delete"}')).toEqual({ action: 'delete' })
    expect(parseInstruction('{"action":"none"}')).toEqual({ action: 'none' })
  })

  it('reads the JSON object when the reply has surrounding text', () => {
    expect(parseInstruction('Here you go {"action":"create","title":"Lamp"} done')).toEqual({
      action: 'create',
      title: 'Lamp',
    })
  })

  it('refuses an unknown action and a create without a title', () => {
    expect(parseInstruction('{"action":"rename","title":"Lamp"}')).toBeNull()
    expect(parseInstruction('{"action":"create"}')).toBeNull()
    expect(parseInstruction('not json')).toBeNull()
  })
})

describe('instructionSystemPrompt', () => {
  it('lists every action from the reference file', () => {
    const prompt = instructionSystemPrompt()
    for (const entry of instructions.actions) {
      expect(prompt).toContain(`"action":"${entry.action}"`)
    }
    expect(prompt).toContain('"after"')
  })
})

describe('parsePlan', () => {
  it('reads a list of linked and unlinked steps from one speech', () => {
    const text = JSON.stringify({
      steps: [
        { id: '1', action: 'create', title: 'x' },
        { id: '2', after: ['1'], action: 'update_body', body: 'y', target: 'x' },
        { id: '3', action: 'create', title: 'z' },
        { id: '4', after: ['3'], action: 'update_body', body: 'xx', target: 'z' },
      ],
    })
    expect(parsePlan(text)).toEqual([
      { id: '1', after: [], instruction: { action: 'create', title: 'x' } },
      { id: '2', after: ['1'], instruction: { action: 'update_body', body: 'y', target: 'x' } },
      { id: '3', after: [], instruction: { action: 'create', title: 'z' } },
      { id: '4', after: ['3'], instruction: { action: 'update_body', body: 'xx', target: 'z' } },
    ])
  })

  it('refuses a step that waits for an unknown id', () => {
    expect(parsePlan('{"steps":[{"id":"1","after":["9"],"action":"delete"}]}')).toBeNull()
  })

  it('reads the nested steps the talk route returns', () => {
    const steps = [
      { id: '1', after: [], instruction: { action: 'create' as const, title: 'test' } },
      {
        id: '2',
        after: ['1'],
        instruction: { action: 'update_body' as const, body: 'Ceci est un test.', target: 'test' },
      },
    ]
    expect(planFromUnknown(steps)).toEqual(steps)
  })
})

describe('runPlan', () => {
  it('runs unlinked chains together and waits inside each chain', async () => {
    const log: string[] = []
    let n = 0
    const result = await runPlan(
      [],
      null,
      [
        { id: '1', after: [], instruction: { action: 'create', title: 'x' } },
        { id: '2', after: ['1'], instruction: { action: 'update_body', body: 'y', target: 'x' } },
        { id: '3', after: [], instruction: { action: 'create', title: 'z' } },
        { id: '4', after: ['3'], instruction: { action: 'update_body', body: 'xx', target: 'z' } },
      ],
      () => `note-${++n}`,
      {
        onStart: (id) => log.push(`start ${id}`),
        onFinish: (id) => log.push(`finish ${id}`),
      },
    )
    expect(result.notes).toEqual([
      { id: 'note-1', title: 'x', body: 'y' },
      { id: 'note-2', title: 'z', body: 'xx' },
    ])
    expect(result.error).toBeNull()
    expect(log).toEqual([
      'start 1',
      'start 3',
      'finish 1',
      'finish 3',
      'start 2',
      'start 4',
      'finish 2',
      'finish 4',
    ])
  })

  it('reads one card, every card, and the count without changing the store', async () => {
    const notes = [lamp, { id: 'note-2', title: 'Desk', body: 'wood' }]
    const result = await runPlan(
      notes,
      'note-2',
      [
        { id: '1', after: [], instruction: { action: 'read_card', target: 'Lamp' } },
        { id: '2', after: [], instruction: { action: 'read_all' } },
        { id: '3', after: [], instruction: { action: 'count' } },
      ],
      () => 'unused',
    )
    expect(result.changed).toBe(false)
    expect(result.notes).toEqual(notes)
    expect(result.selectedId).toBe('note-1')
    expect(result.reads).toEqual([
      { action: 'read_card', title: 'Lamp', body: '' },
      {
        action: 'read_all',
        notes: [
          { title: 'Lamp', body: '' },
          { title: 'Desk', body: 'wood' },
        ],
      },
      { action: 'count', total: 2 },
    ])
  })

  it('reads a card only after the create it waits on has finished', async () => {
    const log: string[] = []
    let n = 0
    const result = await runPlan(
      [],
      null,
      [
        { id: '1', after: [], instruction: { action: 'create', title: 'Lamp' } },
        { id: '2', after: ['1'], instruction: { action: 'read_card', target: 'Lamp' } },
      ],
      () => `note-${++n}`,
      {
        onStart: (id) => log.push(`start ${id}`),
        onFinish: (id) => log.push(`finish ${id}`),
      },
    )
    expect(result.reads).toEqual([{ action: 'read_card', title: 'Lamp', body: '' }])
    expect(log).toEqual(['start 1', 'finish 1', 'start 2', 'finish 2'])
  })

  it('does not start a body update when its create is refused', async () => {
    const log: string[] = []
    let n = 0
    const result = await runPlan(
      [],
      null,
      [
        { id: '1', after: [], instruction: { action: 'create', title: '   ' } },
        { id: '2', after: ['1'], instruction: { action: 'update_body', body: 'y', target: 'x' } },
        { id: '3', after: [], instruction: { action: 'create', title: 'Lamp' } },
      ],
      () => `note-${++n}`,
      {
        onStart: (id) => log.push(`start ${id}`),
        onFinish: (id) => log.push(`finish ${id}`),
      },
    )
    expect(result.error).toEqual({ code: 'note.title.required' })
    expect(result.notes).toEqual([{ id: 'note-2', title: 'Lamp', body: '' }])
    expect(log).toEqual(['start 1', 'start 3', 'finish 1', 'finish 3'])
  })
})

describe('applyInstruction', () => {
  it('creates Lamp and selects it', () => {
    expect(applyInstruction([], null, { action: 'create', title: 'Lamp' }, 'note-1')).toEqual({
      ok: true,
      notes: [lamp],
      selectedId: 'note-1',
    })
  })

  it('refuses an empty spoken title and leaves the list', () => {
    expect(applyInstruction([lamp], 'note-1', { action: 'create', title: '   ' }, 'note-2')).toEqual({
      ok: false,
      error: { code: 'note.title.required' },
      notes: [lamp],
      selectedId: 'note-1',
    })
  })

  it('renames the selected note', () => {
    expect(
      applyInstruction([lamp], 'note-1', { action: 'update_title', title: 'Desk' }, 'note-2'),
    ).toEqual({
      ok: true,
      notes: [{ id: 'note-1', title: 'Desk', body: '' }],
      selectedId: 'note-1',
    })
  })

  it('sets the selected body to desk', () => {
    expect(
      applyInstruction([lamp], 'note-1', { action: 'update_body', body: 'desk' }, 'note-2'),
    ).toEqual({
      ok: true,
      notes: [{ id: 'note-1', title: 'Lamp', body: 'desk' }],
      selectedId: 'note-1',
    })
  })

  it('deletes the selected note', () => {
    expect(applyInstruction([lamp], 'note-1', { action: 'delete' }, 'note-2')).toEqual({
      ok: true,
      notes: [],
      selectedId: null,
    })
  })

  it('refuses update and delete when nothing is selected', () => {
    expect(applyInstruction([], null, { action: 'delete' }, 'note-2')).toEqual({
      ok: false,
      error: { code: 'note.selection.required' },
      notes: [],
      selectedId: null,
    })
  })

  it('leaves the list unchanged for none', () => {
    expect(applyInstruction([lamp], 'note-1', { action: 'none' }, 'note-2')).toEqual({
      ok: true,
      notes: [lamp],
      selectedId: 'note-1',
    })
  })
})
