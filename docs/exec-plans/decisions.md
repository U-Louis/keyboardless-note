# Decisions

## Stack

Confirmed by the steward: Vite, React, TypeScript, notes in `localStorage`.

Rejected: Laravel 12 with Inertia, a folder of files on disk, and memory that disappears on reload.

## One slice

F1–F4 ship together. The product is one screen. Later modules are out of scope until the intent changes.

## Versions installed

`react` 19.2.8, `react-dom` 19.2.8, `typescript` 5.9.3, `vite` 7.1.12, `vitest` 4.1.6, `@playwright/test` 1.56.1, `@types/react` 19.2.18, `@types/react-dom` 18.0.3, `@types/node` 22.20.1.

`@types/react-dom` 18.0.3 is the type package that was available here. `tsc --noEmit` passes with it against React 19 for `createRoot`.

## Plugin

The spec names `@vitejs/plugin-react`. It is not installed. The registry could not be reached while building this slice, and no local copy of the plugin was on disk. [vite.config.ts](../../vite.config.ts) sets esbuild `jsx: 'automatic'` instead. The page behavior does not depend on the plugin.

## Browser

Playwright is configured with `channel: 'chrome'` so the journey uses the installed Google Chrome. The Playwright browser download was not available. `npx playwright test` is still the journey command.

## Push to talk

whisper-api is already running. The talk route calls `http://whisper-api.whisper-api.orb.local:8080/v1/transcribe`. It does not start Whisper and it does not call `api.openai.com`.

The transcript goes to the Cursor API through `@cursor/sdk` `Agent.prompt`, local, with `tools: []`, so the reply is text and the agent is not offered file or shell tools. The instruction rules are in that same user message. A custom `systemPrompt` is refused for this account, and that refusal was `speech.cursor`. The model id is `CURSOR_MODEL` or `composer-2.5`. `CURSOR_API_KEY` is passed only as `apiKey`. During that call the process environment does not include `CURSOR_API_KEY` or `WHISPER_API_KEY`, and the agent working directory is `os.tmpdir()/keyboardless-note-talk`. A prompt or reply that contains the key is refused.

`npm install @cursor/sdk` could not reach the registry from this environment, the same limit as the Vite React plugin. The import is dynamic. Until the package is installed, the route returns `speech.cursor_sdk`.

## Text model

Speech to text stays whisper-api. The route then depends on `Orchestrator`: the transcript in, one reply of text out, no tools, and no sound file. `orchestratorFromEnv` reads `ORCHESTRATOR`. `cursor` (the default) is `instructWithCursor`. `chat` is `instructWithChat`, a chat-completions request to `LLM_API_ORIGIN` for `LLM_MODEL`. `LLM_API_KEY` is optional and travels only as a bearer token. Both implementations share `instructionPrompt`. An unknown name is `speech.model`.

## Boot

`init.sh` installs dependencies and runs Vite on `http://127.0.0.1:5173`. Playwright starts that same origin through `npm run dev`.
