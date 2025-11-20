export interface StoredTurn {
  role: "user" | "assistant";
  content: string;
  ts: number;
}

export class ChatSession {
  state: DurableObjectState;
  env: Env;
  constructor(state: DurableObjectState, env: Env) {
    this.state = state;
    this.env = env;
  }
  async fetch(req: Request) {
    const url = new URL(req.url);
    if (req.method === "POST" && url.pathname === "/chat") {
      const body = await req.json() as any;
      const message: string = body.message || "";
      const system = body.system || "You are a helpful assistant.";
      const turns: StoredTurn[] = (await this.state.storage.get<StoredTurn[]>("turns")) || [];
      const summary: string | undefined = await this.state.storage.get<string>("summary");
      const recent = turns.slice(-10).map(t => ({ role: t.role, content: t.content }));
      const messages = buildPrompt(system, summary || null, recent, message);
      let assistant = "";
      if (this.env.GROQ_API_KEY) {
        assistant = await groqChat(this.env.GROQ_API_KEY!, this.env.GROQ_MODEL || "llama-3.1-8b-instruct", messages);
      } else {
        assistant = "Groq API key missing";
      }
      const now = Date.now();
      turns.push({ role: "user", content: message, ts: now });
      turns.push({ role: "assistant", content: assistant, ts: now });
      await this.state.storage.put("turns", turns);
      if (!summary || turns.length % 6 === 0) {
        const sMessages = [{ role: "system", content: "Summarize the conversation so far concisely." }].concat(turns.slice(-20).map(t => ({ role: t.role, content: t.content })));
        if (this.env.GROQ_API_KEY) {
          const sText = await groqChat(this.env.GROQ_API_KEY!, this.env.GROQ_MODEL || "llama-3.1-8b-instruct", sMessages);
          await this.state.storage.put("summary", sText);
        }
      }
      return new Response(JSON.stringify({ assistant }), { headers: { "content-type": "application/json" } });
    }
    if (req.method === "POST" && url.pathname === "/clear") {
      await this.state.storage.delete("turns");
      await this.state.storage.delete("summary");
      return new Response("ok");
    }
    if (req.method === "GET" && url.pathname === "/state") {
      const turns: StoredTurn[] = (await this.state.storage.get<StoredTurn[]>("turns")) || [];
      const summary: string | undefined = await this.state.storage.get<string>("summary");
      return new Response(JSON.stringify({ turns, summary }), { headers: { "content-type": "application/json" } });
    }
    return new Response("not found", { status: 404 });
  }
}

export interface Env {
  CHAT_SESSIONS: DurableObjectNamespace;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
}

import { buildPrompt } from "../prompt/buildPrompt";
import { groqChat } from "../external/groq";