const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("text");
const sendEl = document.getElementById("send");
const clearEl = document.getElementById("clear");
let sessionId = localStorage.getItem("sessionId") || "";
const clientHistory = [];
function add(role, text) {
  const d = document.createElement("div");
  d.className = role;
  d.textContent = text;
  messagesEl.appendChild(d);
  messagesEl.scrollTop = messagesEl.scrollHeight;
  return d;
}
async function send() {
  const text = inputEl.value.trim();
  if (!text) return;
  add("user", text);
  inputEl.value = "";
  const placeholder = add("assistant", "");
  try {
    const url = new URL(location.origin + "/api/stream");
    sessionId = sessionId || localStorage.getItem("sessionId") || "";
    if (!sessionId) {
      sessionId = crypto.randomUUID();
      localStorage.setItem("sessionId", sessionId);
    }
    url.searchParams.set("sessionId", sessionId);
    url.searchParams.set("message", text);
    const es = new EventSource(url.toString());
    es.onmessage = (e) => {
      if (e.data === "[DONE]") { es.close(); return; }
      try {
        const obj = JSON.parse(e.data);
        const delta = obj?.choices?.[0]?.delta?.content || obj?.choices?.[0]?.message?.content || "";
        if (delta) placeholder.textContent += delta;
      } catch {}
    };
    es.onerror = async () => {
      es.close();
      const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: text, sessionId }) });
      const data = await r.json();
      placeholder.textContent = (data.assistant && String(data.assistant).trim().length > 0) ? data.assistant : "No response. Check Groq API key/model and network.";
    };
  } catch {
    const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: text, sessionId }) });
    const data = await r.json();
    placeholder.textContent = (data.assistant && String(data.assistant).trim().length > 0) ? data.assistant : "No response. Check Groq API key/model and network.";
  }
}
async function clearMemory() {
  if (!sessionId) return;
  await fetch("/api/clear", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId }) });
  messagesEl.innerHTML = "";
  clientHistory.length = 0;
}
sendEl.addEventListener("click", send);
inputEl.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
clearEl.addEventListener("click", clearMemory);