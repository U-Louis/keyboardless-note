# Security

Trust boundary: the browser profile for `http://127.0.0.1:5173`. Another person at this browser can read the notes. Another browser, or another port, has its own empty store.

Data classes:

- `title` and `body` are private to that profile.
- The app collects no password.
- `WHISPER_API_KEY`, `CURSOR_API_KEY`, and `LLM_API_KEY` stay in the environment or `.env`. The page never sees them. `.env` is not committed.

No authorization on the page. The browser profile is still the trust boundary for the notes.

## The model is a user

The orchestrator is a user of this route, with the same risks as any other user: a wrong reply, a hostile reply, or a prompt that tries to pull out a secret. Its good behavior is not a control. Speech to text is whisper-api. `ORCHESTRATOR` is `cursor` or `chat`, and that choice only covers who reads the transcript. Governance sits around the orchestrator, not in it.

Both implementations receive one prompt and return text. The prompt is the instruction rules, the transcript, the selected title, the selected body, and the list of titles. The sound file is not in it. No tools are offered. The domain parses the reply into one plan. The orchestrator does not write the store. A prompt or reply that contains that implementation's key is refused.

`cursor` is the Cursor agent. Its sandbox policy is the control.

- No secrets and no credentials. The agent does not receive `CURSOR_API_KEY` or `WHISPER_API_KEY`. `CURSOR_API_KEY` is passed only as the SDK `apiKey`. For that call both keys are removed from the process environment. The prompt does not contain the key. A reply that contains it is `speech.cursor`.
- The working directory is `os.tmpdir()/keyboardless-note-talk`, outside this repo, so the agent cannot read `.env`.
- No tools (`tools: []`) and no project settings (`settingSources: []`). The agent is not offered the file system or a shell.

`chat` is any server that speaks chat completions. `LLM_API_KEY` is sent only as `Authorization: Bearer`, and the header is omitted when the key is unset. The request body has no tools field. A failure is `speech.model`.

`POST /api/talk` sends the sound file to the local whisper-api at `whisper-api.whisper-api.orb.local:8080` with `Authorization: Bearer`. It then sends the transcript to the orchestrator. That prompt leaves the machine. The git repository does not contain the notes or the keys.

ASVS level: unset.
