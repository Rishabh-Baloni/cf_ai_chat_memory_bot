export async function groqChat(apiKey: string, model: string, messages: { role: string; content: string }[]) {
  const r = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${apiKey}` },
    body: JSON.stringify({ model, messages })
  });
  if (!r.ok) return "";
  const data = await r.json() as any;
  const c = data.choices?.[0]?.message?.content || "";
  return c as string;
}