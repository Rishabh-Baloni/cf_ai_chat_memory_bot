const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("text");
const sendEl = document.getElementById("send");
const clearEl = document.getElementById("clear");
let sessionId = localStorage.getItem("sessionId") || "";
function add(role, text) {
  const d = document.createElement("div");
  d.className = role;
  d.textContent = text;
  messagesEl.appendChild(d);
  messagesEl.scrollTop = messagesEl.scrollHeight;
}
async function send() {
  const text = inputEl.value.trim();
  if (!text) return;
  add("user", text);
  inputEl.value = "";
  const useBrowser = document.getElementById("browser").checked;
  if (useBrowser && window.browserLLMGenerate) {
    const gen = await window.browserLLMGenerate(text);
    add("assistant", gen || "");
  } else {
    const r = await fetch("/api/chat", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ message: text, sessionId }) });
    const data = await r.json();
    if (!sessionId) {
      sessionId = data.sessionId;
      localStorage.setItem("sessionId", sessionId);
    }
    add("assistant", data.assistant || "");
  }
}
async function clearMemory() {
  if (!sessionId) return;
  await fetch("/api/clear", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ sessionId }) });
  messagesEl.innerHTML = "";
}
sendEl.addEventListener("click", send);
inputEl.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
clearEl.addEventListener("click", clearMemory);