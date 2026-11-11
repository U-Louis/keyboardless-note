import { existsSync, readFileSync } from 'node:fs'
import { resolve } from 'node:path'

export function readServerEnv(name: string, cwd = process.cwd()): string | undefined {
  const fromProcess = process.env[name]
  if (fromProcess) return fromProcess
  const path = resolve(cwd, '.env')
  if (!existsSync(path)) return undefined
  for (const line of readFileSync(path, 'utf8').split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eq = trimmed.indexOf('=')
    if (eq < 0) continue
    if (trimmed.slice(0, eq).trim() !== name) continue
    let value = trimmed.slice(eq + 1).trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }
    return value || undefined
  }
  return undefined
}

const heldEnv = new Map<string, { value: string | undefined; depth: number }>()

export async function withoutProcessEnv<T>(
  names: readonly string[],
  run: () => Promise<T>,
): Promise<T> {
  for (const name of names) {
    const held = heldEnv.get(name)
    if (held) {
      held.depth += 1
      continue
    }
    heldEnv.set(name, { value: process.env[name], depth: 1 })
    delete process.env[name]
  }
  try {
    return await run()
  } finally {
    for (const name of names) {
      const held = heldEnv.get(name)
      if (!held) continue
      held.depth -= 1
      if (held.depth > 0) continue
      heldEnv.delete(name)
      if (held.value === undefined) delete process.env[name]
      else process.env[name] = held.value
    }
  }
}
