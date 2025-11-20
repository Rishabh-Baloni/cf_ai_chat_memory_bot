import { buildPrompt } from "./prompt/buildPrompt";
export interface Env {
  CHAT_SESSIONS: DurableObjectNamespace;
  ASSETS: Fetcher;
  GROQ_API_KEY?: string;
  GROQ_MODEL?: string;
}
export default {
  async fetch(req: Request, env: Env) {
    const url = new URL(req.url);
    if (url.pathname === "/api/chat" && req.method === "POST") {
      const body = await req.json() as any;
      let sessionId = body.sessionId as string | undefined;
      if (!sessionId) sessionId = crypto.randomUUID();
      const id = env.CHAT_SESSIONS.idFromName(sessionId);
      const stub = env.CHAT_SESSIONS.get(id);
      const r = await stub.fetch("https://dobject/chat", { method: "POST", body: JSON.stringify({ message: body.message, system: body.system }) });
      const data = await r.json() as any;
      return new Response(JSON.stringify({ sessionId, assistant: data.assistant }), { headers: { "content-type": "application/json" } });
    }
    if (url.pathname === "/api/clear" && req.method === "POST") {
      const body = await req.json() as any;
      const sessionId = body.sessionId as string;
      const id = env.CHAT_SESSIONS.idFromName(sessionId);
      const stub = env.CHAT_SESSIONS.get(id);
      const r = await stub.fetch("https://dobject/clear", { method: "POST" });
      return new Response(await r.text());
    }
    if (url.pathname === "/api/state" && req.method === "GET") {
      const sessionId = url.searchParams.get("sessionId") || "";
      const id = env.CHAT_SESSIONS.idFromName(sessionId);
      const stub = env.CHAT_SESSIONS.get(id);
      const r = await stub.fetch("https://dobject/state", { method: "GET" });
      return new Response(await r.text(), { headers: { "content-type": "application/json" } });
    }
    return env.ASSETS.fetch(req);
  }
};
async function serveAsset(req: Request) {
  return new Response(null, { status: 404 });
}
export { ChatSession } from "./durable/ChatSession";