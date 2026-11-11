# M2 plan

Blocked by: none. whisper-api is already up at `whisper-api.whisper-api.orb.local:8080`.

Cut: hold `v`, one sound file, `POST /v1/transcribe`, Cursor returns one instruction, the page applies it.

## Steps

1. Parse and apply the five instructions until the domain tests pass.
2. Post the sound file to the running whisper-api, then send the transcript to Cursor.
3. Hold `v` on the list and apply the instruction the route returns.
4. Run `npm test`, `npm run typecheck`, and `npx playwright test`.
5. Record evidence. Leave every `passes` value `false`.

## Files

- `src/domain/instruction.ts`
- `src/talk/**`
- `src/ui/App.tsx`
- `src/ui/speechSession.ts`
- `e2e/push-to-talk.spec.ts`
- `vite.config.ts`

## Checks

- `npm test`
- `npm run typecheck`
- `npx playwright test`

## Rollback

Revert the slice commit.
