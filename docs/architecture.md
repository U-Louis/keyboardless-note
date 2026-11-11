# Architecture

One Vite origin, `http://127.0.0.1:5173`. React renders one page. Notes live in `localStorage` under `keyboardless-note`.

```text
src/domain/     pure note rules; the instruction list is instructions.json
src/storage/    the one localStorage adapter
src/talk/       whisper-api for speech, then an orchestrator (`cursor` or `chat`)
src/ui/         the page
e2e/            the Playwright journey
```

Allowed edges:

- `src/domain` imports neither `react` nor `localStorage`.
- `src/storage` imports domain types only.
- `src/talk` imports the domain. It does not import `react` or `localStorage`. It is the only code that calls whisper-api or an orchestrator.
- `src/ui` calls domain functions, the storage adapter, and `POST /api/talk`.

The domain-boundary check reads production files in `src/domain` (it skips `*.test.ts`) and fails if those files mention `react` or `localStorage`.

The dev server exposes one route, `POST /api/talk`, on the same origin. It reads `WHISPER_API_KEY`, `CURSOR_API_KEY`, and the chat settings from the environment or `.env`. Those values stay in this process. Every sound file goes to whisper-api. `ORCHESTRATOR` selects who reads the transcript. `cursor` (the default) runs in a directory outside the repo and does not inherit the keys. `chat` posts one chat-completions request to `LLM_API_ORIGIN` for `LLM_MODEL`, with `LLM_API_KEY` as a bearer token when that key is set. The sound file is memory only.

Out of scope: a second origin, a component library, IndexedDB, and a file on disk.
