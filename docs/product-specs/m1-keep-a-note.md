# M1 Keep a note

## Outcome and actor

The person at this browser can create a note, read it after reload, change its body, and delete it, using only the keyboard.

## Done means

- `Lamp` appears in the list with an empty body, and the stored title is `Lamp`.
- An empty title shows `data-error-code="note.title.required"` and the key is unchanged.
- A title of 81 characters shows `data-error-code="note.title.too_long"` and the key is unchanged.
- Clearing the title of an existing note is refused with `note.title.required`, and the previous title stays.
- The body `desk` is still there after reload.
- `d` while the list is focused removes the selected note, including after reload.

## Non-goals

Accounts, a server, sync, tags, search, folders, markdown, sharing, mouse-only actions, a confirm dialog on delete.

## Assumptions

- Vite, React, and TypeScript. Confirmed.
- One key, `localStorage['keyboardless-note']`, on `http://127.0.0.1:5173`. Confirmed.
- No backend. Confirmed.
- Delete is immediate. Confirmed.
- Unreadable JSON shows an empty list, and the next successful save replaces the key. Confirmed.

## Invariants this slice must not break

The constitution's storage key, error shape, title cap, and dependency edges.

## Data

Written and read: `id`, `title`, `body`. Sensitivity: private to the browser profile. No secrets.

## Security-critical paths

The stored data shape. No authentication path.

## Paths

Allowed:

- `AGENTS.md`
- `docs/**`
- `index.html`
- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.ts`
- `playwright.config.ts`
- `init.sh`
- `.gitignore`
- `src/**`
- `e2e/**`

Forbidden: a server, `fetch`, a second store, a component library, an account package.

## New dependencies

`react`, `react-dom`, `vite`, `@vitejs/plugin-react`, `typescript`, `vitest`, `@playwright/test`.

Type packages for those named dependencies, recorded in `docs/exec-plans/decisions.md`: `@types/react`, `@types/react-dom`, `@types/node`.

## Acceptance examples

- Given an empty store, when the user presses `n`, types `Lamp`, and presses Enter, the list shows `Lamp`, the body is empty, and the stored title is `Lamp`.
- Given an empty store, when the user presses `n` and Enter without a title, `data-error-code` is `note.title.required` and the key is unchanged.
- Given a title of 81 characters, the code is `note.title.too_long` and the key is unchanged.
- Given a note titled `Lamp`, when the title is cleared, the code is `note.title.required` and the stored title stays `Lamp`.
- Given `Lamp`, when the user types `desk` in the body and reloads, the body is `desk`.
- Given `Lamp`, when the user presses `d` and reloads, the list is empty.
- Given the title `  Lamp  ` and the id `note-1`, the stored title is `Lamp` and the id is `note-1`.

## Test seams

- Domain unit test (`npm test`). Catches the title rules, the frozen id `note-1`, and delete. Misses the keyboard and the reload.
- Journey, Playwright, keyboard only (`npx playwright test`). Catches F1–F4 on the booted page. Misses a second browser profile and a full disk.

## Quality budgets

Unchanged. Latency bar stays empty. Title bound: 80 characters.

## Risk class

Stored data shape.

## Rollback

Revert the slice commit.

## Keyboard

The journey drives the page with keys only.

- On load the list is focused, so `n` works without a click.
- `n` while the list is focused focuses a new title.
- Enter on a valid title creates the note, selects it, and focuses the body.
- Enter on an existing note's title, when the title is valid, saves the trimmed title and focuses the body.
- ArrowUp and ArrowDown move the selection and keep the list focused.
- Enter on a selected row focuses the body.
- Escape focuses the list. An uncommitted title edit is discarded.
- `d` while the list is focused deletes the selected note.
- `n` and `d` typed into the title or the body are characters, not commands.
