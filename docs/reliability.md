# Reliability

There is no retry and no queue. A talk that fails leaves the stored notes unchanged.

- whisper-api runs one transcription at a time. `429` `busy` and `503` `not_ready` come back as `speech.busy` and `speech.not_ready`.
- A clip over 5 MiB or longer than 30 seconds is refused by whisper-api. The page stops the microphone at 28 seconds.
- A blank transcript becomes `none` and the orchestrator is not called. Whisper-api has already run.
- The orchestrator is one prompt and no tools. `cursor` is one local agent prompt. `chat` is one chat-completions request. An unreadable reply is `speech.instruction` and the store stays. A missing chat origin or model name is `speech.model`.

- A missing key loads as an empty list.
- Unreadable JSON loads as an empty list. The bad value stays until the next successful save, which replaces the key.
- Save writes the whole array. A second save of the same array leaves the same JSON.
- Delete removes the note from the array and saves.

Latency bar: empty. There is no latency gate.

Timeouts, payload caps, and rate limits: the title cap is 80 characters. The body has no cap in this slice. `localStorage` itself is the browser's quota.
