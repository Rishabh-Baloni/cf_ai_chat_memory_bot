import { pipeline } from 'https://cdn.jsdelivr.net/npm/@xenova/transformers/dist/transformers.min.js';
let generatorPromise = null;
async function init() {
  if (!generatorPromise) {
    generatorPromise = pipeline('text-generation', 'Xenova/gpt2');
  }
  return generatorPromise;
}
export async function generateLLM(prompt) {
  const generator = await init();
  const out = await generator(prompt, { max_new_tokens: 64, do_sample: true, temperature: 0.9 });
  const text = Array.isArray(out) ? out[0].generated_text : out.generated_text;
  const clean = text.startsWith(prompt) ? text.slice(prompt.length) : text;
  return clean.trim();
}
window.browserLLMGenerate = generateLLM;