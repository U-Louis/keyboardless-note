import { describe, expect, it } from 'vitest'
import { encodeWav } from './wav'

describe('encodeWav', () => {
  it('writes a mono 16-bit wav with a duration', () => {
    const wav = encodeWav(new Float32Array([0, 1, -1]), 16_000)
    const view = new DataView(wav.buffer)
    expect(text(wav, 0, 4)).toBe('RIFF')
    expect(view.getUint32(4, true)).toBe(42)
    expect(text(wav, 8, 4)).toBe('WAVE')
    expect(view.getUint16(20, true)).toBe(1)
    expect(view.getUint16(22, true)).toBe(1)
    expect(view.getUint32(24, true)).toBe(16_000)
    expect(view.getUint32(40, true)).toBe(6)
    expect(view.getInt16(44, true)).toBe(0)
    expect(view.getInt16(46, true)).toBe(32_767)
    expect(view.getInt16(48, true)).toBe(-32_768)
    expect(view.getUint32(40, true) / view.getUint32(28, true)).toBeGreaterThan(0)
  })
})

function text(bytes: Uint8Array, offset: number, length: number): string {
  return String.fromCharCode(...bytes.subarray(offset, offset + length))
}
