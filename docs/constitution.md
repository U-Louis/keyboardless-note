# Constitution

One person, this browser. They can create a note, read it after reload, change it, and delete it, using only the keyboard.

## Invariants

- Storage is one key, `localStorage['keyboardless-note']`, a JSON array of `{ id, title, body }`. One adapter, `src/storage/localNotes.ts`.
- Authorization: none. The browser profile is the trust boundary.
- Error shape: `{ code }`, rendered on one node as `data-error-code`. Codes: `note.title.required`, `note.title.too_long`, `note.selection.required`, `note.target.missing`, `note.step.blocked`, and `speech.*` for the talk route (`speech.whisper_key`, `speech.cursor_key`, `speech.cursor_sdk`, `speech.cursor`, `speech.model`, `speech.mic`, `speech.empty`, `speech.instruction`, `speech.internal`, plus the whisper-api code prefixed with `speech.`).
- Log shape: none. The talk route does not log the audio, the transcript, or the keys. `CURSOR_API_KEY` is the Cursor implementation's SDK credential only. `LLM_API_KEY` is the chat implementation's bearer token only, and only when it is set. A key stays out of the prompt, the page, and the model environment.
- Speech to text is whisper-api. The orchestrator is an untrusted user of the transcript. `ORCHESTRATOR` selects that implementation: `cursor` (default) or `chat`. The reply is text and the orchestrator is given no tools. Security does not depend on the orchestrator behaving well. See `docs/security.md`.
- `src/domain` imports neither `react` nor `localStorage`. `src/storage` imports domain types only. `src/talk` imports the domain and neither `react` nor `localStorage`. `src/ui` calls domain functions, the storage adapter, and `POST /api/talk`.
- Title is trimmed, then 1–80 characters. Body may be empty. This slice sets no body length cap.
- Unreadable JSON shows an empty list. The next successful save replaces the key.
- Delete is immediate. There is no confirm dialog.
- The page calls `fetch` only for `POST /api/talk` on this origin. That route posts the sound file to `http://whisper-api.whisper-api.orb.local:8080/v1/transcribe` and the transcript to the orchestrator. There is no second store.

## Choices

- `complexity-score`: unset. No reporter is installed. Neither score blocks.
- `diff-posture`: `read`.
- `instruction-model`: unset.
- Latency bar: empty. There is no latency gate.
- ASVS level: unset.

## Named blind spot

A corrupt store is wiped on the next save.
