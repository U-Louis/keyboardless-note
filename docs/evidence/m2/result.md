slice: M2
commit: none
spec: docs/product-specs/m2-push-to-talk.md
commands:
  - npm test (vitest 4.1.6, node v22.18.0) — pass, 29 tests
  - npm run typecheck (typescript 5.9.3) — pass
  - npx playwright test (1.56.1, channel chrome) — pass, 9 tests
results: pass
frozen-example: Given audio bytes, the whisper request URL is http://whisper-api.whisper-api.orb.local:8080/v1/transcribe, the bearer is the key, and the file part is named file. Given an empty store, when the talk route returns create / Lamp, the list shows Lamp and the stored title is Lamp.
rule-change: none during the evidence check.
limitations: The journey stubs POST /api/talk. It does not call the running whisper-api and it does not call Cursor. @cursor/sdk is not installed. A second browser profile was not exercised.
risk-class: the API keys, and note text leaving the machine through the Cursor prompt
complexity-score: unset
diff-posture: read
human-read: no
blind-spot: A corrupt store is wiped on the next save.
