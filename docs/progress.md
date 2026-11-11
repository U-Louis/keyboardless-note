# Progress

## M1

- Slice: M1
- Commit: none. This session was not asked to commit.
- Passed: `npm test` (10), `npm run typecheck`, `npx playwright test` (6). Node v22.18.0, TypeScript 5.9.3, Vitest 4.1.6, Playwright 1.56.1.
- Failed: nothing left red. During the evidence check, making an empty title legal failed `note.title.required` on purpose, then the rule was restored.
- Dead ends: `npm install` could not reach registry.npmjs.org from this environment. Packages were taken from the local npm cache and from an existing install on this machine. `@vitejs/plugin-react` has no local copy, so the page uses Vite's built-in JSX transform. See `docs/exec-plans/decisions.md`.
- Next: a verifier may set `passes` after driving the page. Every `passes` value is still `false`.

## M2

- Slice: M2
- Commit: none. This session was not asked to commit.
- Passed: `npm test` (40), `npm run typecheck`. `npx playwright test` (9) was already green and was not re-run. Node v22.18.0, TypeScript 5.9.3, Vitest 4.1.6, Playwright 1.56.1.
- Failed: `npm install @cursor/sdk` made no progress. The registry was not reached. The route returns `speech.cursor_sdk` until that package is installed.
- Dead ends: the first browser hold released before `MediaRecorder` had started, so the clip was empty (`speech.empty`). Listening now begins after the recorder starts.
- Live whisper-api and a live Cursor run were not called.
- `CURSOR_API_KEY` stays in this process. The local agent does not inherit it, and its working directory is outside the repo.
- Next: install `@cursor/sdk` when the registry answers. Put `WHISPER_API_KEY` and `CURSOR_API_KEY` in the environment or `.env`. A verifier may set `passes`. Every `passes` value is still `false`.
