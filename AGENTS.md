# Keyboardless note

Short map. The constitution stays in `docs/`. Read the files below before editing.

- `docs/constitution.md`
- `docs/architecture.md`
- `docs/security.md`
- `docs/reliability.md`
- `docs/product-specs/m1-keep-a-note.md`
- `docs/product-specs/m2-push-to-talk.md`
- `docs/features.json`
- `docs/progress.md`

Boot with `./init.sh`. It prints `origin http://127.0.0.1:5173` and serves that origin.

Checks: `npm test`, `npm run typecheck`, `npx playwright test`.

The implementer does not set `passes` and does not merge.
