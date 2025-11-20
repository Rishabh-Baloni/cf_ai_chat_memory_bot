export function buildPrompt(
  system: string,
  summary: string | null,
  history: { role: "user" | "assistant"; content: string }[],
  userMessage: string,
  facts?: Record<string, string> | null
) {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];
  messages.push({ role: "system", content: system });
  if (facts && Object.keys(facts).length > 0) {
    const parts: string[] = [];
    for (const k of Object.keys(facts)) {
      parts.push(`${k}: ${facts[k]}`);
    }
    messages.push({ role: "system", content: "Session facts: " + parts.join("; ") });
  }
  if (summary && summary.trim().length > 0) {
    messages.push({ role: "system", content: "Conversation summary: " + summary });
  }
  for (const m of history) {
    messages.push(m);
  }
  messages.push({ role: "user", content: userMessage });
  return messages;
}