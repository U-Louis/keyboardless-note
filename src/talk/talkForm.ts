import type { TalkInput } from './handleTalk'

export async function parseTalkForm(
  request: Request,
): Promise<{ ok: true; input: TalkInput } | { ok: false; error: { code: string } }> {
  const type = request.headers.get('content-type') ?? ''
  if (!type.toLowerCase().includes('multipart/form-data')) {
    return { ok: false, error: { code: 'speech.unsupported_media' } }
  }
  const form = await request.formData()
  const speech = form.get('speech')
  if (!(speech instanceof File) || speech.size === 0) {
    return { ok: false, error: { code: 'speech.missing_file' } }
  }
  const titles = readTitles(form.get('titles'))
  if (!titles.ok) return titles
  return {
    ok: true,
    input: {
      file: speech,
      selectedTitle: readText(form.get('selectedTitle')),
      selectedBody: readText(form.get('selectedBody')),
      titles: titles.titles,
    },
  }
}

function readText(value: FormDataEntryValue | null): string {
  return typeof value === 'string' ? value : ''
}

function readTitles(
  value: FormDataEntryValue | null,
): { ok: true; titles: string[] } | { ok: false; error: { code: string } } {
  if (typeof value !== 'string' || value.length === 0) return { ok: true, titles: [] }
  try {
    const parsed: unknown = JSON.parse(value)
    if (!Array.isArray(parsed) || parsed.some((item) => typeof item !== 'string')) {
      return { ok: false, error: { code: 'speech.unsupported_media' } }
    }
    return { ok: true, titles: parsed }
  } catch {
    return { ok: false, error: { code: 'speech.unsupported_media' } }
  }
}
