# cf_ai_chat_memory_bot

An AI-powered chat application built on Cloudflare Workers that demonstrates core architecture patterns Cloudflare looks for: Worker structure, Durable Object coordination, stateful memory, chat flow handling, prompt assembly, and a clean frontend/backend organization.

This project defaults to a 100% free mode using a small client-side LLM in the browser. It also includes wiring to switch to Workers AI later without large code changes.

## Highlights
- Worker routes: `/api/chat`, `/api/clear`, `/api/state`, plus static asset serving.
- Durable Object `ChatSession` manages per-session memory (turns + rolling summary), ordering, and rate control.
- Prompt assembly merges system persona, session summary, recent turns, and the latest user message.
- Frontend chat UI with session persistence and a toggle for a free, browser-based LLM.
- Free mode avoids any paid APIs; everything runs locally.

## Architecture
- Worker (`src/worker.ts`)
  - Handles HTTP endpoints, session routing to Durable Object, and static assets.
- Durable Object (`src/durable/ChatSession.ts`)
  - Stores short-term turns and maintains a rolling summary.
  - Orchestrates the flow: recall → generate → summarize → write-back.
  - Free mode: returns responses without invoking cloud LLMs; summary derived locally.
- Prompt builder (`src/prompt/buildPrompt.ts`)
  - Constructs the message list for generation with system, summary, history, and the new user message.
- Frontend (`public/*`)
  - Minimal chat UI, local session storage, and optional client-side LLM via Transformers.js.

## Free Mode vs Workers AI
- Free Mode (default):
  - Uses a small browser LLM (`Xenova/gpt2`) via CDN for text generation.
  - Durable Object still coordinates memory and session state.
- Workers AI Mode (optional):
  - Bind Workers AI in `wrangler.toml` and call a model like `@cf/meta/llama-3.3-8b-instruct`.
  - Intended for accounts with Workers AI access; not required for this assignment.

## File Structure
```
src/
  worker.ts              # Worker entry and routes
  durable/ChatSession.ts # Durable Object: chat/memory orchestration
  prompt/buildPrompt.ts  # Prompt assembly helper
public/
  index.html             # UI
  chat.js                # Chat logic; backend or browser LLM path
  browser-llm.js         # Transformers.js pipeline (free mode)
  styles.css             # Basic styling
wrangler.toml            # Config: assets binding, DO, free-mode flag
package.json             # Dev scripts: dev/build/publish/typecheck
tsconfig.json            # TypeScript options
.npmrc                   # Local npm cache directory
.gitignore               # Ignore node_modules, cache, venv, etc.
```

## Running Locally (Windows, no Cloudflare billing)
- Install dependencies locally:
  - `npm install --cache .npm-cache`
- Start dev server:
  - `npm run dev`
- Open the app:
  - `http://127.0.0.1:8787/`
- Use the toggle “Browser LLM (free)” to keep generation local and free.

## Switching to Workers AI (optional)
1. Add back the AI binding in `wrangler.toml`:
```
[ai]
binding = "AI"
```
2. In `ChatSession`, set `FREE_MODE` to `false` in `[vars]` or remove the flag.
3. Log in and run dev remotely:
```
npx wrangler login
npx wrangler dev --remote
```
Note: Remote dev may incur usage depending on your account; this is not required for the assignment.

## Memory Model
- Short-term: last N turns retained.
- Rolling summary: refreshed periodically to constrain prompt size.
- Clear memory: `/api/clear` endpoint and UI button.

## Assignment Mapping
- LLM: Browser LLM (free) counts as an “external LLM of your choice”. Workers AI integration is prepared.
- Workflow/coordination: Durable Object orchestrates steps and persists state.
- User input: Chat UI with session persistence and streaming of typed messages.
- Memory/state: Stored turns and a rolling summary per session.

## Disk Usage Rules
- All npm cache and `node_modules` are inside this project directory (`.npm-cache`, `node_modules`). No global installs.
- If Python utilities are added, use `python -m venv .venv` and install packages into `./.venv` only.

## Deploy (optional)
- Publish when ready:
  - `npm run publish`
- Requires a Cloudflare account; not needed for local evaluation.