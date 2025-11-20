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
        assistant = await groqChat(this.env.GROQ_API_KEY!, this.env.GROQ_MODEL || "mixtral-8x7b-32768", messages);
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
          const sText = await groqChat(this.env.GROQ_API_KEY!, this.env.GROQ_MODEL || "mixtral-8x7b-32768", sMessages);
          await this.state.storage.put("summary", sText);
        }
      }
      return new Response(JSON.stringify({ assistant }), { headers: { "content-type": "application/json" } });
    }
    if ((req.method === "POST" && url.pathname.startsWith("/stream")) || (req.method === "GET" && url.pathname === "/stream")) {
      const systemParam = url.searchParams.get("system") || "You are a helpful assistant.";
      let body: any = {};
      if (req.method === "POST") {
        try { body = await req.json() as any; } catch {}
      }
      const message = body.message || url.searchParams.get("message") || "";
      const turns: StoredTurn[] = (await this.state.storage.get<StoredTurn[]>("turns")) || [];
      const summary: string | undefined = await this.state.storage.get<string>("summary");
      const recent = turns.slice(-10).map(t => ({ role: t.role, content: t.content }));
      const messages = buildPrompt(systemParam, summary || null, recent, message);
      if (!this.env.GROQ_API_KEY) {
        const enc = new TextEncoder();
        const stream = new ReadableStream({
          start(controller) {
            controller.enqueue(enc.encode("data: {\"error\":\"Groq API key missing\"}\n\n"));
            controller.enqueue(enc.encode("data: [DONE]\n\n"));
            controller.close();
          }
        });
        return new Response(stream, { headers: { "content-type": "text/event-stream" } });
      }
      const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        headers: { "content-type": "application/json", authorization: `Bearer ${this.env.GROQ_API_KEY}` },
        body: JSON.stringify({ model: this.env.GROQ_MODEL || "mixtral-8x7b-32768", messages, stream: true })
      });
      if (!r.body) {
        return new Response("", { headers: { "content-type": "text/event-stream" } });
      }
      const [clientStream, storageStream] = r.body.tee();
      const dec = new TextDecoder();
      let acc = "";
      (async () => {
        const reader = storageStream.getReader();
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const text = dec.decode(value);
          const lines = text.split(/\r?\n/);
          for (const line of lines) {
            if (!line.startsWith("data: ")) continue;
            const payload = line.slice(6);
            if (payload === "[DONE]") continue;
            try {
              const obj = JSON.parse(payload);
              const delta = obj?.choices?.[0]?.delta?.content || obj?.choices?.[0]?.message?.content || "";
              if (delta) acc += delta;
            } catch {}
          }
        }
        const now = Date.now();
        const turnsLocal = (await this.state.storage.get<StoredTurn[]>("turns")) || [];
        turnsLocal.push({ role: "user", content: message, ts: now });
        turnsLocal.push({ role: "assistant", content: acc, ts: now });
        await this.state.storage.put("turns", turnsLocal);
        const sMessages = [{ role: "system", content: "Summarize the conversation so far concisely." }].concat(turnsLocal.slice(-20).map(t => ({ role: t.role, content: t.content })));
        const sText = await groqChat(this.env.GROQ_API_KEY!, this.env.GROQ_MODEL || "mixtral-8x7b-32768", sMessages);
        await this.state.storage.put("summary", sText);
      })();
      return new Response(clientStream, { headers: { "content-type": "text/event-stream" } });
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