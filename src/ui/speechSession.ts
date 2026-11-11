import { wavFile } from './wav'

const RECORD_MS = 28_000
const MIME_TYPES = ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4']

function recorderMime(): string | undefined {
  if (typeof MediaRecorder === 'undefined' || typeof MediaRecorder.isTypeSupported !== 'function') {
    return undefined
  }
  return MIME_TYPES.find((type) => MediaRecorder.isTypeSupported(type))
}

export class SpeechSession {
  private recorder: MediaRecorder | null = null
  private stream: MediaStream | null = null
  private chunks: Blob[] = []
  private active = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private onLimit: (() => void) | null = null

  async start(onLimit: () => void): Promise<void> {
    if (this.active) return
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
    try {
      this.chunks = []
      const mimeType = recorderMime()
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined)
      recorder.addEventListener('dataavailable', (event) => {
        if (event.data.size > 0) this.chunks.push(event.data)
      })
      try {
        recorder.start(200)
      } catch {
        recorder.start()
      }
      this.recorder = recorder
      this.stream = stream
      this.active = true
      this.onLimit = onLimit
      this.timer = setTimeout(() => this.onLimit?.(), RECORD_MS)
    } catch (error) {
      stream.getTracks().forEach((track) => track.stop())
      throw error
    }
  }

  async stop(): Promise<File | null> {
    this.clearTimer()
    const recorder = this.recorder
    if (!this.active || !recorder) return null
    this.active = false
    const blob = await new Promise<Blob>((resolve) => {
      if (recorder.state === 'inactive') {
        resolve(new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' }))
        return
      }
      recorder.addEventListener(
        'stop',
        () => resolve(new Blob(this.chunks, { type: recorder.mimeType || 'audio/webm' })),
        { once: true },
      )
      recorder.stop()
    })
    this.release()
    if (blob.size === 0) return null
    try {
      const wav = await wavFile(blob)
      if (wav) return wav
    } catch {
      // The container had no duration Whisper can probe. Keep the original clip.
    }
    const type = blob.type || 'audio/webm'
    const extension = type.includes('mp4') ? 'm4a' : type.includes('wav') ? 'wav' : 'webm'
    return new File([blob], `speech.${extension}`, { type })
  }

  cancel(): void {
    this.clearTimer()
    this.active = false
    if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop()
    this.release()
  }

  private clearTimer(): void {
    if (this.timer !== null) clearTimeout(this.timer)
    this.timer = null
    this.onLimit = null
  }

  private release(): void {
    this.stream?.getTracks().forEach((track) => track.stop())
    this.recorder = null
    this.stream = null
    this.chunks = []
  }
}
