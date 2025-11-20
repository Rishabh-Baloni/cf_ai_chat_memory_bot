import * as webllm from "https://esm.run/@mlc-ai/web-llm";
let enginePromise = null;
function hasWebGPU() { return typeof navigator !== "undefined" && !!navigator.gpu; }
async function init() {
  if (!enginePromise) {
    const model = "Qwen2-0.5B-Instruct";
    enginePromise = webllm.CreateMLCEngine(model, { initProgressCallback: () => {} });
  }
  return enginePromise;
}
export async function generateLLM(messages) {
  if (!hasWebGPU()) return "Browser does not support WebGPU.";
  const engine = await init();
  const r = await engine.chat.completions.create({ messages, temperature: 0.6 });
  const msg = r.choices?.[0]?.message?.content || "";
  return msg.trim();
}
window.browserLLMGenerate = generateLLM;