import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, expect, it } from 'vitest'

describe('domain boundary', () => {
  it('does not mention react or localStorage', () => {
    const dir = join(process.cwd(), 'src/domain')
    const files = readdirSync(dir).filter(
      (name) => name.endsWith('.ts') && !name.endsWith('.test.ts'),
    )
    expect(files.length).toBeGreaterThan(0)
    for (const name of files) {
      const text = readFileSync(join(dir, name), 'utf8')
      expect(text.includes('react'), name).toBe(false)
      expect(text.includes('localStorage'), name).toBe(false)
    }
  })
})
