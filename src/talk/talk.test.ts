import { existsSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'
import { readServerEnv, withoutProcessEnv } from './env'
import { handleTalk } from './handleTalk'
import { instructWithChat } from './chatModel'
import { instructWithCursor } from './instruct'
import { buildUserPrompt } from './model'
import { orchestratorFromEnv } from './orchestrator'
import { TalkError } from './talkError'
import { parseTalkForm } from './talkForm'
import { WHISPER_ORIGIN, transcribeSpeech } from './transcribe'

const clip = new File([Uint8Array.from([1, 2, 3, 4])], 'speech.webm', { type: 'audio/webm' })

describe('transcribeSpeech', () => {
  it('posts the sound file to the running whisper-api', async () => {
    let seen: { url: string; authorization: string | null; name: string | null } | null = null
    const fetchImpl: typeof fetch = async (input, init) => {
      const request = new Request(input, init)
      const form = await request.formData()
      const file = form.get('file')
      seen = {
        url: request.url,
        authorization: request.headers.get('authorization'),
        name: file instanceof File ? file.name : null,
      }
      return new Response(JSON.stringify({ text: 'new note Lamp', language: 'en' }), { status: 200 })
    }
    const text = await transcribeSpeech(clip, {
      fetch: fetchImpl,
      origin: WHISPER_ORIGIN,
      apiKey: 'whisper-secret',
    })
    expect(text).toBe('new note Lamp')
    expect(seen).toEqual({
      url: 'http://whisper-api.whisper-api.orb.local:8080/v1/transcribe',
      authorization: 'Bearer whisper-secret',
      name: 'speech.webm',
    })
  })

  it('returns the whisper error code', async () => {
    const fetchImpl: typeof fetch = async () =>
      new Response(JSON.stringify({ error: 'busy' }), { status: 429 })
    await expect(
      transcribeSpeech(clip, { fetch: fetchImpl, origin: WHISPER_ORIGIN, apiKey: 'k' }),
    ).rejects.toEqual(new TalkError('speech.busy'))
  })
})

describe('handleTalk', () => {
  it('sends the whisper text to cursor and returns the instruction', async () => {
    let prompt = ''
    const result = await handleTalk(
      { file: clip, selectedTitle: 'Lamp', selectedBody: '', titles: ['Lamp'] },
      {
        transcribe: async () => 'set the body to desk',
        instruct: async (input) => {
          prompt = buildUserPrompt(input)
          return '{"steps":[{"id":"1","action":"update_body","body":"desk"}]}'
        },
      },
    )
    expect(prompt).toContain('Transcript: set the body to desk')
    expect(prompt).toContain('Selected title: Lamp')
    expect(result).toEqual({
      ok: true,
      transcript: 'set the body to desk',
      steps: [{ id: '1', after: [], instruction: { action: 'update_body', body: 'desk' } }],
    })
  })

  it('returns none for a blank transcript and does not call cursor', async () => {
    let called = false
    const result = await handleTalk(
      { file: clip, selectedTitle: '', selectedBody: '', titles: [] },
      {
        transcribe: async () => '   ',
        instruct: async () => {
          called = true
          return '{"action":"delete"}'
        },
      },
    )
    expect(called).toBe(false)
    expect(result).toEqual({
      ok: true,
      transcript: '   ',
      steps: [{ id: '1', after: [], instruction: { action: 'none' } }],
    })
  })

  it('returns speech.instruction when cursor does not return an instruction', async () => {
    const result = await handleTalk(
      { file: clip, selectedTitle: '', selectedBody: '', titles: [] },
      {
        transcribe: async () => 'hello',
        instruct: async () => 'I am not sure',
      },
    )
    expect(result).toEqual({
      ok: false,
      error: { code: 'speech.instruction' },
      transcript: 'hello',
    })
  })

  it('keeps the whisper text when cursor fails', async () => {
    const result = await handleTalk(
      { file: clip, selectedTitle: '', selectedBody: '', titles: [] },
      {
        transcribe: async () => 'lights on the desk',
        instruct: async () => {
          throw new TalkError('speech.cursor_key')
        },
      },
    )
    expect(result).toEqual({
      ok: false,
      error: { code: 'speech.cursor_key' },
      transcript: 'lights on the desk',
    })
  })

  it('omits the transcript when whisper fails', async () => {
    const result = await handleTalk(
      { file: clip, selectedTitle: '', selectedBody: '', titles: [] },
      {
        transcribe: async () => {
          throw new TalkError('speech.unreadable_audio')
        },
        instruct: async () => '{"action":"none"}',
      },
    )
    expect(result).toEqual({ ok: false, error: { code: 'speech.unreadable_audio' } })
  })
})

describe('parseTalkForm', () => {
  it('reads the speech file and the note context', async () => {
    const form = new FormData()
    form.append('speech', clip, 'speech.webm')
    form.append('selectedTitle', 'Lamp')
    form.append('selectedBody', 'desk')
    form.append('titles', JSON.stringify(['Lamp']))
    const request = new Request('http://127.0.0.1:5173/api/talk', { method: 'POST', body: form })
    const parsed = await parseTalkForm(request)
    expect(parsed.ok).toBe(true)
    if (!parsed.ok) return
    expect(parsed.input.file.name).toBe('speech.webm')
    expect(parsed.input.selectedTitle).toBe('Lamp')
    expect(parsed.input.selectedBody).toBe('desk')
    expect(parsed.input.titles).toEqual(['Lamp'])
  })
})

const cursorSecret = 'cursor_test_key_9f3c2a7b'
const whisperSecret = 'whisper_test_key_9f3c2a7b'

async function withApiKeys(run: () => Promise<void>) {
  const previousCursor = process.env.CURSOR_API_KEY
  const previousWhisper = process.env.WHISPER_API_KEY
  process.env.CURSOR_API_KEY = cursorSecret
  process.env.WHISPER_API_KEY = whisperSecret
  try {
    await run()
  } finally {
    if (previousCursor === undefined) delete process.env.CURSOR_API_KEY
    else process.env.CURSOR_API_KEY = previousCursor
    if (previousWhisper === undefined) delete process.env.WHISPER_API_KEY
    else process.env.WHISPER_API_KEY = previousWhisper
  }
}

describe('instructWithCursor', () => {
  const input = {
    transcript: 'set the body to desk',
    selectedTitle: 'Lamp',
    selectedBody: '',
    titles: ['Lamp'],
  }

  it('passes the key only as the SDK credential', async () => {
    await withApiKeys(async () => {
      const seen = { message: '', apiKey: '', cwd: '', cursor: '', whisper: '' }
      const text = await instructWithCursor(input, async () => ({
        Agent: {
          prompt: async (message, options) => {
            seen.message = message
            seen.apiKey = options.apiKey
            seen.cwd = options.local.cwd
            seen.cursor = process.env.CURSOR_API_KEY ?? ''
            seen.whisper = process.env.WHISPER_API_KEY ?? ''
            return { status: 'finished', result: '{"steps":[{"id":"1","action":"none"}]}' }
          },
        },
        CursorAgentError: class extends Error {},
      }))
      expect(text).not.toContain(cursorSecret)
      expect(seen.message).toContain('Transcript: set the body to desk')
      expect(seen.message).toContain('"action":"update_body"')
      expect(seen.message).not.toContain(cursorSecret)
      expect(seen.apiKey).toBe(cursorSecret)
      expect(seen.cursor).toBe('')
      expect(seen.whisper).toBe('')
      expect(seen.cwd).not.toBe(process.cwd())
      expect(existsSync(join(seen.cwd, '.env'))).toBe(false)
      expect(process.env.CURSOR_API_KEY).toBe(cursorSecret)
      expect(process.env.WHISPER_API_KEY).toBe(whisperSecret)
    })
  })

  it('does not call Cursor when the prompt contains the key', async () => {
    await withApiKeys(async () => {
      let called = false
      await expect(
        instructWithCursor(
          { ...input, transcript: cursorSecret },
          async () => {
            called = true
            throw new Error('called')
          },
        ),
      ).rejects.toEqual(new TalkError('speech.cursor'))
      expect(called).toBe(false)
    })
  })

  it('refuses a reply that contains the key', async () => {
    await withApiKeys(async () => {
      await expect(
        instructWithCursor(input, async () => ({
          Agent: {
            prompt: async () => ({ status: 'finished', result: cursorSecret }),
          },
          CursorAgentError: class extends Error {},
        })),
      ).rejects.toEqual(new TalkError('speech.cursor'))
    })
  })

  it('strips the key from an error', async () => {
    await withApiKeys(async () => {
      const error = await instructWithCursor(input, async () => ({
        Agent: {
          prompt: async () => {
            throw new Error(`auth failed ${cursorSecret}`)
          },
        },
        CursorAgentError: class extends Error {},
      })).catch((caught: unknown) => caught)
      expect(error).toBeInstanceOf(Error)
      expect(error instanceof Error ? error.message : '').toBe('auth failed [redacted]')
      expect(process.env.CURSOR_API_KEY).toBe(cursorSecret)
    })
  })
})

describe('withoutProcessEnv', () => {
  it('keeps the key hidden until every call has finished', async () => {
    const previous = process.env.CURSOR_API_KEY
    process.env.CURSOR_API_KEY = cursorSecret
    try {
      let during = ''
      await Promise.all([
        withoutProcessEnv(['CURSOR_API_KEY'], async () => {
          await Promise.resolve()
          during += process.env.CURSOR_API_KEY ?? ''
        }),
        withoutProcessEnv(['CURSOR_API_KEY'], async () => {
          await Promise.resolve()
          during += process.env.CURSOR_API_KEY ?? ''
        }),
      ])
      expect(during).toBe('')
      expect(process.env.CURSOR_API_KEY).toBe(cursorSecret)
    } finally {
      if (previous === undefined) delete process.env.CURSOR_API_KEY
      else process.env.CURSOR_API_KEY = previous
    }
  })
})

const chatSecret = 'llm_test_key_9f3c2a7b'
const chatInput = {
  transcript: 'set the body to desk',
  selectedTitle: 'Lamp',
  selectedBody: '',
  titles: ['Lamp'],
}

async function withEnv(values: Record<string, string | undefined>, run: () => Promise<void>) {
  const previous = new Map<string, string | undefined>()
  for (const [name, value] of Object.entries(values)) {
    previous.set(name, process.env[name])
    if (value === undefined) delete process.env[name]
    else process.env[name] = value
  }
  try {
    await run()
  } finally {
    for (const [name, value] of previous) {
      if (value === undefined) delete process.env[name]
      else process.env[name] = value
    }
  }
}

describe('instructWithChat', () => {
  const chatEnv = {
    LLM_API_ORIGIN: 'http://models.local/v1/',
    LLM_MODEL: 'small',
    LLM_API_KEY: chatSecret,
  }

  it('posts the prompt to a chat-completions model with the key only as a bearer', async () => {
    await withEnv(chatEnv, async () => {
      let seen: { url: string; authorization: string | null; model: string } | null = null
      let tools: unknown = 'unset'
      let content = ''
      const text = await instructWithChat(chatInput, async (input, init) => {
        const request = new Request(input, init)
        const body = JSON.parse(await request.text()) as {
          model: string
          tools?: unknown
          messages: { content: string }[]
        }
        seen = {
          url: request.url,
          authorization: request.headers.get('authorization'),
          model: body.model,
        }
        tools = body.tools
        content = body.messages[0]?.content ?? ''
        return new Response(
          JSON.stringify({ choices: [{ message: { content: '{"steps":[]}' } }] }),
          { status: 200 },
        )
      })
      expect(text).toBe('{"steps":[]}')
      expect(seen).toEqual({
        url: 'http://models.local/v1/chat/completions',
        authorization: `Bearer ${chatSecret}`,
        model: 'small',
      })
      expect(tools).toBeUndefined()
      expect(content).toContain('Transcript: set the body to desk')
      expect(content).not.toContain(chatSecret)
    })
  })

  it('omits the bearer when the chat model has no key', async () => {
    await withEnv({ ...chatEnv, LLM_API_KEY: undefined }, async () => {
      let authorization: string | null = 'set'
      await instructWithChat(chatInput, async (input, init) => {
        authorization = new Request(input, init).headers.get('authorization')
        return new Response(JSON.stringify({ choices: [{ message: { content: 'ok' } }] }), {
          status: 200,
        })
      })
      expect(authorization).toBeNull()
    })
  })

  it('reads a reply split into text parts', async () => {
    await withEnv(chatEnv, async () => {
      const text = await instructWithChat(chatInput, async () =>
        new Response(
          JSON.stringify({
            choices: [{ message: { content: [{ text: '{"action":' }, { text: '"none"}' }] } }],
          }),
          { status: 200 },
        ),
      )
      expect(text).toBe('{"action":"none"}')
    })
  })

  it('does not call the model when the prompt contains the key', async () => {
    await withEnv(chatEnv, async () => {
      let called = false
      await expect(
        instructWithChat({ ...chatInput, transcript: chatSecret }, async () => {
          called = true
          throw new Error('called')
        }),
      ).rejects.toEqual(new TalkError('speech.model'))
      expect(called).toBe(false)
    })
  })

  it('refuses a reply that contains the key', async () => {
    await withEnv(chatEnv, async () => {
      await expect(
        instructWithChat(chatInput, async () =>
          new Response(JSON.stringify({ choices: [{ message: { content: chatSecret } }] }), {
            status: 200,
          }),
        ),
      ).rejects.toEqual(new TalkError('speech.model'))
    })
  })

  it('strips the key from an error', async () => {
    await withEnv(chatEnv, async () => {
      const error = await instructWithChat(chatInput, async () => {
        throw new Error(`auth failed ${chatSecret}`)
      }).catch((caught: unknown) => caught)
      expect(error).toBeInstanceOf(Error)
      expect(error instanceof Error ? error.message : '').toBe('auth failed [redacted]')
    })
  })

  it('refuses a chat model with no origin', async () => {
    await withEnv({ ...chatEnv, LLM_API_ORIGIN: undefined }, async () => {
      let called = false
      await expect(
        instructWithChat(chatInput, async () => {
          called = true
          return new Response('')
        }),
      ).rejects.toEqual(new TalkError('speech.model'))
      expect(called).toBe(false)
    })
  })
})

describe('orchestratorFromEnv', () => {
  it('uses cursor unless ORCHESTRATOR is chat', async () => {
    await withEnv({ ORCHESTRATOR: undefined }, async () => {
      expect(orchestratorFromEnv()).toBe(instructWithCursor)
    })
    await withEnv({ ORCHESTRATOR: 'Cursor' }, async () => {
      expect(orchestratorFromEnv()).toBe(instructWithCursor)
    })
    await withEnv({ ORCHESTRATOR: 'chat' }, async () => {
      expect(orchestratorFromEnv()).toBe(instructWithChat)
    })
  })

  it('returns speech.model for an unknown orchestrator name', async () => {
    await withEnv({ ORCHESTRATOR: 'other' }, async () => {
      await expect(orchestratorFromEnv()(chatInput)).rejects.toEqual(new TalkError('speech.model'))
    })
  })
})

describe('readServerEnv', () => {
  it('reads a key from a .env file when the process has none', () => {
    const dir = mkdtempSync(join(tmpdir(), 'notes-env-'))
    writeFileSync(join(dir, '.env'), 'WHISPER_API_KEY="clip-key"\n')
    const previous = process.env.WHISPER_API_KEY
    delete process.env.WHISPER_API_KEY
    try {
      expect(readServerEnv('WHISPER_API_KEY', dir)).toBe('clip-key')
    } finally {
      if (previous === undefined) delete process.env.WHISPER_API_KEY
      else process.env.WHISPER_API_KEY = previous
    }
  })
})
