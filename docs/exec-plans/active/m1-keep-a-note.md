# M1 plan

Blocked by: none.

Cut: key on the page, domain function, `localNotes`, `localStorage`, same page after reload.

## Steps

1. Write the failing domain tests from the frozen examples.
2. Write `createNote`, `updateTitle`, `updateBody`, and `deleteNote` until those tests pass.
3. Write `localNotes` and the domain-boundary check.
4. Write the failing Playwright journey.
5. Write the one page until the journey passes.
6. Run `npm test`, `npm run typecheck`, and `npx playwright test`.
7. Record evidence. Leave every `passes` value `false`.

## Files

- `src/domain/note.ts`
- `src/domain/note.test.ts`
- `src/domain-boundary.test.ts`
- `src/storage/localNotes.ts`
- `src/ui/App.tsx`
- `src/ui/app.css`
- `src/main.tsx`
- `e2e/keep-a-note.spec.ts`
- `index.html`
- `package.json`
- `tsconfig.json`
- `vite.config.ts`
- `playwright.config.ts`
- `init.sh`

## Reuse

No existing auth, logging, or error helper. This slice creates the one error shape and the one store.

## Checks

- `npm test`
- `npm run typecheck`
- `npx playwright test`

## Rollback

Revert the slice commit.
