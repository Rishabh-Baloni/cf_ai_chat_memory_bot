export function buildPrompt(system: string, summary: string | null, history: { role: "user" | "assistant"; content: string }[], userMessage: string) {
  const messages: { role: "system" | "user" | "assistant"; content: string }[] = [];
  messages.push({ role: "system", content: system });
  if (summary && summary.trim().length > 0) {
    messages.push({ role: "system", content: "Conversation summary: " + summary });
  }
  for (const m of history) {
    messages.push(m);
  }
  messages.push({ role: "user", content: userMessage });
  return messages;
}