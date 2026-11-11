# M2 Push to talk

## Outcome and actor

The person at this browser holds `v`, speaks, and the page runs one instruction from that speech.

## Done means

- Hold `v` on the list, then release. The page makes one sound file and posts it to this origin at `POST /api/talk`.
- The route posts that file to `http://whisper-api.whisper-api.orb.local:8080/v1/transcribe` as multipart field `file`, with `Authorization: Bearer` from `WHISPER_API_KEY`.
- The route sends the sound file to whisper-api. It sends the transcript, the selected title, the selected body, and the titles to the orchestrator. The default orchestrator is the Cursor API. The orchestrator has no tools. The reply is one JSON instruction.
- One speech returns a `steps` list. Each step is an action from `src/domain/instructions.json` plus `id` and `after`. A step starts when every id in `after` has finished. Steps that do not wait on each other start together. `target` names the note title. Update, delete, and read card use the selected note when `target` is absent.
- `read_card` shows that note's title and body. `read_all` shows every title and body. `count` shows how many notes there are. None of the three writes the store.
- `create` of `Lamp` shows `Lamp` with an empty body, and the stored title is `Lamp`.
- A blank transcript is `none`. The store is unchanged and Cursor is not called.
- An empty spoken title shows `data-error-code="note.title.required"` and the key is unchanged.
- `delete` on the selected note removes it, including after reload.
- A failed talk leaves the key unchanged.

## Non-goals

Accounts, a second notes store, a confirm dialog, choosing the Whisper model, and a Cursor agent that can edit files.

## Assumptions

- whisper-api is already running at `whisper-api.whisper-api.orb.local:8080`. Confirmed.
- The page does not call whisper-api. The dev server does. Confirmed by the route.
- `WHISPER_API_KEY` and `CURSOR_API_KEY` are in the environment or `.env`. `ORCHESTRATOR=chat` also needs `LLM_API_ORIGIN` and `LLM_MODEL`. `LLM_API_KEY` is optional for that orchestrator.

## Invariants this slice must not break

The M1 storage key, the title cap, and the keyboard for `n`, arrows, Enter, Escape, and `d`. `v` typed into the title or the body is a character.

## Data

Written and read: the same `{ id, title, body }` array. The sound file and the transcript are not stored.

## Security-critical paths

The API keys. The page must not receive them. The model prompt contains the transcript and the note text, and it does not contain `CURSOR_API_KEY` or `LLM_API_KEY`.

## Paths

Allowed: `src/**`, `e2e/**`, `docs/**`, `vite.config.ts`, `package.json`, `package-lock.json`, `.gitignore`, `AGENTS.md`.

Forbidden: a second origin, a second store, writing the sound file to disk.

## New dependencies

`@cursor/sdk`. It is imported when a clip is sent. This session could not reach the registry, so it is not in `package.json` yet. Until `npm install @cursor/sdk` succeeds, the route returns `speech.cursor_sdk`.

## Acceptance examples

- Given an empty store, when the talk route returns `create` / `Lamp`, the list shows `Lamp` and the stored title is `Lamp`.
- Given an empty store, when the instruction title is blank, `data-error-code` is `note.title.required` and the key is unchanged.
- Given `Lamp`, when the instruction is `delete`, reload shows an empty list.
- Given audio bytes, the whisper request URL is `http://whisper-api.whisper-api.orb.local:8080/v1/transcribe`, the bearer is the key, and the file part is named `file`.
- Given whisper text `set the body to desk` and selected title `Lamp`, the cursor prompt contains that transcript and that title, and `update_body` / `desk` is the instruction.

## Test seams

- Domain unit test. Catches parse and apply. Misses the microphone and both APIs.
- Talk unit test. Catches the whisper URL, the bearer, the file part, and that the transcript is what cursor is asked about. Misses a live whisper container and a live Cursor run.
- Journey, Playwright, fake microphone (`npx playwright test`). The journey stubs `POST /api/talk`. It catches the sound file leaving the page and the instruction changing the note. It misses the live APIs.

## Quality budgets

Unchanged, plus whisper-api's own caps: 5 MiB and 30 seconds. The page stops at 28 seconds.

## Risk class

The API keys, and note text leaving the machine through the Cursor prompt.

## Rollback

Revert the slice commit.

## Keyboard

- Hold `v` while the list is focused. Release sends the clip. Escape while listening discards it.
- `v` in the title or the body is a character.
