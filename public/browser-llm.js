import * as webllm from "https://esm.run/@mlc-ai/web-llm";
let enginePromise = null;
let engine = null;
let engineReady = false;
let currentModel = null;
let cancelled = false;
function hasWebGPU() { return typeof navigator !== "undefined" && !!navigator.gpu; }
function setStatus(text) { const el = document.getElementById("status"); if (el) el.textContent = text; }
function ui(q) { return document.querySelector(q); }
function getStored(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : v; } catch { return d; } }
function setStored(k, v) { try { localStorage.setItem(k, v); } catch {} }
export function getSelectedModel() { const sel = ui('#model-select'); return (sel && sel.value) || getStored('selectedModel', 'Qwen2-0.5B-Instruct'); }
export function setSelectedModel(name) { const sel = ui('#model-select'); if (sel) sel.value = name; setStored('selectedModel', name); }
export function shouldAutoPreload() {
  const pref = getStored('preloadPref', 'false') === 'true';
  const c = navigator.connection;
  const fast = c && c.effectiveType !== '2g' && (c.downlink || 0) >= 1.5;
  const wifi = c && c.type === 'wifi';
  return pref || fast || wifi;
}
function showProgressUI(show) { ui('#model-load-container').style.display = show ? 'block' : 'none'; ui('#cancel-preload-btn').style.display = show ? 'inline-block' : 'none'; }
function updateProgress(info) {
  if (cancelled) return;
  showProgressUI(true);
  const bar = ui('#model-load-bar');
  const text = ui('#model-load-text');
  if (!bar || !text) return;
  if (info.progress !== undefined) {
    const pct = Math.round(info.progress * 100);
    bar.style.width = pct + '%';
    text.textContent = `Loading model: ${pct}% (${info.text || ''})`;
    if (info.progress === 1) { text.textContent = 'Model: ready'; ui('#cancel-preload-btn').style.display = 'none'; setTimeout(() => showProgressUI(false), 800); }
  } else if (info.writtenBytes && info.totalBytes) {
    const pct = Math.round((info.writtenBytes / info.totalBytes) * 100);
    bar.style.width = pct + '%';
    text.textContent = `Downloading: ${pct}% (${info.text || ''})`;
  }
}
export async function startPreload(modelName) {
  if (!hasWebGPU()) { setStatus('Model: WebGPU not supported (fallback to DEV)'); return; }
  cancelled = false;
  setSelectedModel(modelName);
  currentModel = modelName;
  setStatus('Model: loading');
  showProgressUI(true);
  const progress = (p) => updateProgress(p || {});
  if (engine && engineReady) {
    await engine.reload(modelName, { initProgressCallback: progress });
    engineReady = true;
    setStatus('Model: ready');
    return engine;
  }
  if (!enginePromise) {
    enginePromise = webllm.CreateMLCEngine(modelName, { initProgressCallback: progress })
      .then((eng) => { if (cancelled) { try { eng.dispose?.(); } catch {} } engine = eng; engineReady = !cancelled; if (!cancelled) setStatus('Model: ready'); return eng; });
  }
  return enginePromise;
}
export function cancelPreload() {
  cancelled = true;
  showProgressUI(false);
  setStatus('Model: not loaded');
}
export function browserLLMInit(modelName) { return startPreload(modelName || getSelectedModel()); }
export function browserLLMIsReady() { return engineReady; }
export async function generateLLM(messages) {
  if (!hasWebGPU()) return "Browser does not support WebGPU.";
  const r = await engine.chat.completions.create({ messages, temperature: 0.6 });
  const msg = r.choices?.[0]?.message?.content || "";
  return msg.trim();
}
export async function generateLLMStreaming(messages, onDelta) {
  if (!hasWebGPU()) return "Browser does not support WebGPU.";
  const chunks = await engine.chat.completions.create({ messages, temperature: 0.7, stream: true });
  let acc = "";
  for await (const chunk of chunks) {
    const delta = chunk.choices?.[0]?.delta?.content || "";
    acc += delta;
    if (onDelta) onDelta(acc);
  }
  return acc.trim();
}
window.browserLLMInit = browserLLMInit;
window.browserLLMIsReady = browserLLMIsReady;
window.browserLLMGenerate = generateLLM;
window.browserLLMGenerateStreaming = generateLLMStreaming;
window.startPreload = startPreload;
window.cancelPreload = cancelPreload;
window.shouldAutoPreload = shouldAutoPreload;
window.getSelectedModel = getSelectedModel;
window.setSelectedModel = setSelectedModel;