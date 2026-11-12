<p align="center">
  <img alt="lazy meat proxy" width="320" src="assets/logo-light.svg#gh-light-mode-only">
  <img alt="lazy meat proxy" width="320" src="assets/logo-dark.svg#gh-dark-mode-only">
</p>

# Keyboardless note


A simple note app you could build from any beginner tutorial. Except this one doesn't require a keyboard: you just tell it what to do.

It uses openai's [whisper](https://github.com/openai/whisper) ([wrapped](https://github.com/U-Louis/whisper-api) in a [fastapi](https://github.com/fastapi/fastapi)) for speech recognition.

Then, it passes the transcript to an LLM to pick actions from a structure list.

Issues tackled : 
- Why not just pass the speech to the llm? It allows to use any LLM model for the understanding part, while using a tool specifically designed and weighted for speech to text.
- How to secure the services? Basic API keys. IRL, i'd maybe add an ip whitelist.
- How to secure the LLM from doing nasty stuff? Treat it as a user. It only has access to a restricted set of actions. It doesn't have access to any secret. For the POC I tested with a cursor api key but IRL it should be a small model, sandboxed, with a strong harness.
- How to make the LLM do relevant stuff? It is probabilistic, so we use it for orchestration only. But it orchestrates deterministic tools, for accurate results. Not very obvious with a simple not app. Next stop : a CRM with a bit of domain-heavy features.
