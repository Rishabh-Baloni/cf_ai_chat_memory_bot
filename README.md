# cf_ai_chat_memory_bot

An AI chat app running on Cloudflare Workers with Durable Objects for stateful in‑session memory and Groq as the LLM provider. It streams responses over SSE, renders rich markdown on the client, and keeps per‑tab session lifecycles.

Groq provider is active by default. The bot identifies as this app’s AI assistant (not ChatGPT).

## Highlights
- Endpoints: `/api/stream` (SSE), `/api/chat` (fallback), `/api/clear`, `/api/state`, plus static assets.
- Durable Object `ChatSession` persists turns, summary, and session facts (e.g., name) per session.
- Prompt assembly includes system, summary, full turn history, new message, and facts.
- Client UI renders markdown (code blocks, lists, links, tables) and shows streaming tokens.
- Session scoped to the browser tab via `sessionStorage` (ends on tab close or Clear Memory).

## Architecture
- Worker (`src/worker.ts`)
  - Routes requests and proxies to the Durable Object; serves `public/*`.
- Durable Object (`src/durable/ChatSession.ts`)
  - Stores `turns`, `summary`, `facts` and orchestrates generate/summarize/write‑back.
  - Streams via Groq (`/stream`) and persists the final assistant message.
- Groq integration (`src/external/groq.ts`)
  - Helper for chat completions; supports default model `openai/gpt-oss-20b` with fallback to `mixtral-8x7b-32768`.
- Prompt builder (`src/prompt/buildPrompt.ts`)
  - Constructs the message list with system, summary, prior turns, current user message, and facts.
- Frontend (`public/*`)
  - Minimal chat UI that streams tokens, renders markdown, and manages session via `sessionStorage`.

## File Structure
```
src/
  worker.ts              
  durable/ChatSession.ts 
  prompt/buildPrompt.ts  
  external/groq.ts       
public/
  index.html             
  chat.js                
  styles.css             
wrangler.toml            
package.json             
tsconfig.json            
.npmrc                   
.gitignore               
.dev.vars                
```

## Running Locally (Windows)
- Install dependencies: `npm install`
- Set local dev vars (for dev only): `.dev.vars` with `GROQ_API_KEY=...`
- Start dev: `npm run dev`
- Open: `http://127.0.0.1:8787/`

## Configuration
- `wrangler.toml`
  - Assets binding: `ASSETS` → `public/`
  - Durable Object binding: `CHAT_SESSIONS`
  - Free plan migration (SQLite):
    ```toml
    [[migrations]]
    tag = "v1-sqlite"
    new_sqlite_classes = ["ChatSession"]
    ```
  - Vars:
    - `USE_GROQ = "true"`
    - `GROQ_MODEL = "openai/gpt-oss-20b"`

## Deployment (Cloudflare Workers, free)
- Login: `npx wrangler login`
- Set secret (once): `npx wrangler secret put GROQ_API_KEY`
- Deploy: `npx wrangler deploy`
- Default route: Workers.dev is enabled unless you set `workers_dev = false`.
- After deploy, open the service in Cloudflare → `Workers & Pages` to view the live URL and logs.

## Endpoints
- `GET /api/stream?sessionId=&message=&system=` → SSE streaming
- `POST /api/chat { sessionId, message, system? }` → non‑stream fallback
- `POST /api/clear { sessionId }` → clears `turns`, `summary`, `facts`
- `GET /api/state?sessionId=` → returns stored `turns`/`summary`

## Memory & Prompts
- Facts extraction: detects phrases like “my name is …” and stores `facts.name` for polite continuity.
- Summary refresh: recomputed periodically to keep prompt size bounded.
- Prompt inputs: `system`, `summary`, full history, new `message`, `facts`.
- Identity: the bot does not claim to be ChatGPT; it’s the app’s AI assistant.

## Notes
- Do not commit secrets; use `wrangler secret` in production and `.dev.vars` only for local development.
- Models: defaults to `openai/gpt-oss-20b`; streaming path falls back to `mixtral-8x7b-32768` when needed.