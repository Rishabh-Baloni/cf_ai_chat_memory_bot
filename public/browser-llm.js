import * as webllm from "https://esm.run/@mlc-ai/web-llm";
let enginePromise = null;
let engineReady = false;
function hasWebGPU() { return typeof navigator !== "undefined" && !!navigator.gpu; }
function setStatus(text) { const el = document.getElementById("status"); if (el) el.textContent = text; }
export async function browserLLMInit() {
  if (!hasWebGPU()) { setStatus("Model: WebGPU not supported (fallback to DEV)"); return; }
  if (!enginePromise) {
    const model = "Qwen2-0.5B-Instruct";
    enginePromise = webllm.CreateMLCEngine(model, {
      initProgressCallback: (p) => {
        const pct = Math.round((p.progress || 0) * 100);
        setStatus(p.text ? `Model: ${p.text}` : `Model: loading ${pct}%`);
      }
    }).then((eng) => { engineReady = true; setStatus("Model: ready"); return eng; });
  }
  return enginePromise;
}
export function browserLLMIsReady() { return engineReady; }
export async function generateLLM(messages) {
  if (!hasWebGPU()) return "Browser does not support WebGPU.";
  const engine = await browserLLMInit();
  const r = await engine.chat.completions.create({ messages, temperature: 0.6 });
  const msg = r.choices?.[0]?.message?.content || "";
  return msg.trim();
}
export async function generateLLMStreaming(messages, onDelta) {
  if (!hasWebGPU()) return "Browser does not support WebGPU.";
  const engine = await browserLLMInit();
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