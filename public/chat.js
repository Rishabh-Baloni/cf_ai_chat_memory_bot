const messagesEl = document.getElementById("messages");
const inputEl = document.getElementById("text");
const sendEl = document.getElementById("send");
const clearEl = document.getElementById("clear");
let sessionId = localStorage.getItem("sessionId") || "";
const clientHistory = [];
const modelSelect = document.getElementById('model-select');
const preloadBtn = document.getElementById('preload-btn');
const cancelBtn = document.getElementById('cancel-preload-btn');
const preloadPref = document.getElementById('preload-pref');
if (modelSelect) {
  const saved = window.getSelectedModel ? window.getSelectedModel() : modelSelect.value;
  modelSelect.value = saved;
  modelSelect.addEventListener('change', async () => {
    window.setSelectedModel && window.setSelectedModel(modelSelect.value);
    if (window.browserLLMIsReady && window.browserLLMIsReady()) {
      const ok = confirm('Switching models will re-download. Continue?');
      if (ok) await window.startPreload(modelSelect.value);
    }
  });
}
if (preloadPref) {
  const stored = localStorage.getItem('preloadPref') === 'true';
  preloadPref.checked = stored;
  preloadPref.addEventListener('change', () => localStorage.setItem('preloadPref', preloadPref.checked ? 'true' : 'false'));
}
if (preloadBtn) preloadBtn.addEventListener('click', () => window.startPreload && window.startPreload(modelSelect.value));
if (cancelBtn) cancelBtn.addEventListener('click', () => window.cancelPreload && window.cancelPreload());
if (window.shouldAutoPreload && window.shouldAutoPreload()) {
  window.startPreload && window.startPreload(modelSelect.value);
}
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
  const useBrowser = document.getElementById("browser").checked;
  if (useBrowser && window.browserLLMGenerate) {
    if (window.browserLLMIsReady && !window.browserLLMIsReady()) {
      add("assistant", "Model is loading... first run can take a few minutes.");
      return;
    }
    const sys = { role: "system", content: "You are a helpful assistant." };
    clientHistory.push({ role: "user", content: text });
    const placeholder = add("assistant", "");
    if (window.browserLLMGenerateStreaming) {
      const final = await window.browserLLMGenerateStreaming([sys, ...clientHistory], (partial) => { placeholder.textContent = partial; });
      clientHistory.push({ role: "assistant", content: final || "" });
    } else {
      const gen = await window.browserLLMGenerate([sys, ...clientHistory]);
      placeholder.textContent = gen || "";
      clientHistory.push({ role: "assistant", content: gen || "" });
    }
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
  clientHistory.length = 0;
}
sendEl.addEventListener("click", send);
inputEl.addEventListener("keydown", e => { if (e.key === "Enter") send(); });
clearEl.addEventListener("click", clearMemory);