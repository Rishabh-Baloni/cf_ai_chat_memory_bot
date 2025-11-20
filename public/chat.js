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
        if (!placeholder.__raw) placeholder.__raw = "";
        if (delta) {
          placeholder.__raw += delta;
          placeholder.textContent = placeholder.__raw;
        }
      } catch {}
    };
    es.onerror = async () => {
      es.close();
      const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: text, sessionId }) });
      const data = await r.json();
      const finalText = (data.assistant && String(data.assistant).trim().length > 0) ? data.assistant : "No response. Check Groq API key/model and network.";
      placeholder.innerHTML = renderMarkdown(finalText);
    };
    es.addEventListener("message", (e) => {
      if (e.data === "[DONE]") {
        const raw = placeholder.__raw || "";
        placeholder.innerHTML = renderMarkdown(raw);
      }
    });
  } catch {
    const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: text, sessionId }) });
    const data = await r.json();
    const finalText = (data.assistant && String(data.assistant).trim().length > 0) ? data.assistant : "No response. Check Groq API key/model and network.";
    placeholder.innerHTML = renderMarkdown(finalText);
  }
}

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;"}[c]));
}
function renderMarkdown(raw) {
  let s = raw || "";
  s = s.replace(/```([\s\S]*?)```/g, (m, code) => `<pre><code>${escapeHtml(code)}</code></pre>`);
  s = escapeHtml(s);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/`([^`]+)`/g, "<code>$1</code>");
  s = s.replace(/(^|\n)-\s+([^\n]+)/g, "$1• $2");
  s = s.replace(/\n/g, "<br>");
  return s;
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