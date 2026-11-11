slice: M1
commit: none
spec: docs/product-specs/m1-keep-a-note.md
commands:
  - npm test (vitest 4.1.6, node v22.18.0) — pass, 10 tests
  - npm run typecheck (typescript 5.9.3) — pass
  - npx playwright test (1.56.1, channel chrome) — pass, 6 tests
results: pass
frozen-example: Given an empty store, when the user presses n and Enter without a title, data-error-code is note.title.required and the key is unchanged. Given createNote('   ', 'note-1'), the result is { ok: false, error: { code: 'note.title.required' } }.
rule-change: The empty-title check was removed from checkTitle, so an empty title became legal. `npm test -- src/domain/note.test.ts` exited 1. createNote('   ', 'note-1') returned { ok: true, note: { id: 'note-1', title: '', body: '' } } instead of note.title.required. The same miss failed updateTitle of Lamp with a blank title. The check was restored. `npm test` then passed 10 tests.
limitations: A second browser profile and a full disk were not exercised. Unreadable JSON is specified and was not driven in the journey.
risk-class: stored data shape
complexity-score: unset
diff-posture: read
human-read: no
blind-spot: A corrupt store is wiped on the next save.
