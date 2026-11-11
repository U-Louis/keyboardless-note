export class TalkError extends Error {
  constructor(readonly code: string) {
    super(code)
  }
}
