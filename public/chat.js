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
function inlineFormat(s) {
  s = s.replace(/`([^`]+)`/g, (m, t) => `<code>${escapeHtml(t)}</code>`);
  s = s.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  s = s.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  s = s.replace(/\[([^\]]+)\]\((https?:[^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
  return s;
}
function renderMarkdown(raw) {
  const lines = (raw || "").split(/\r?\n/);
  const out = [];
  let inCode = false;
  let codeLang = "";
  let codeLines = [];
  let inTable = false;
  let tableRows = [];
  let inUl = false;
  let inOl = false;
  let para = [];
  function flushPara() {
    if (para.length) {
      const text = para.join("\n");
      out.push(`<p>${inlineFormat(escapeHtml(text)).replace(/\n/g, '<br>')}</p>`);
      para = [];
    }
  }
  function flushList() {
    if (inUl) { out.push('</ul>'); inUl = false; }
    if (inOl) { out.push('</ol>'); inOl = false; }
  }
  function flushTable() {
    if (!inTable) return;
    if (tableRows.length) {
      const header = tableRows[0];
      const sep = tableRows[1] && /^\s*[:\-\| ]+\s*$/.test(tableRows[1]);
      const bodyStart = sep ? 2 : 1;
      const renderRow = (row, cellTag) => {
        const cells = row.split('|').map(c => c.trim()).filter(c => c.length > 0);
        return `<tr>` + cells.map(c => `<${cellTag}>${inlineFormat(escapeHtml(c))}</${cellTag}>`).join('') + `</tr>`;
      };
      const headerHtml = sep ? renderRow(header, 'th') : '';
      const bodyHtml = tableRows.slice(bodyStart).map(r => renderRow(r, 'td')).join('');
      const tableHtml = `<table class="md-table">${headerHtml ? `<thead>${headerHtml}</thead>` : ''}<tbody>${bodyHtml}</tbody></table>`;
      out.push(tableHtml);
    }
    tableRows = [];
    inTable = false;
  }
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (inCode) {
      if (/^```/.test(line)) {
        const code = codeLines.join('\n');
        out.push(`<pre><code class="lang-${escapeHtml(codeLang)}">${escapeHtml(code)}</code></pre>`);
        inCode = false; codeLang = ""; codeLines = [];
        continue;
      }
      codeLines.push(line);
      continue;
    }
    if (/^```/.test(line)) {
      flushPara(); flushList(); flushTable();
      codeLang = line.replace(/^```\s*/, '').trim();
      inCode = true; codeLines = [];
      continue;
    }
    if (/^\s*$/.test(line)) {
      flushPara(); flushList(); flushTable();
      continue;
    }
    const heading = line.match(/^(#{1,6})\s+(.*)$/);
    if (heading) {
      flushPara(); flushList(); flushTable();
      const level = heading[1].length;
      out.push(`<h${level}>${inlineFormat(escapeHtml(heading[2]))}</h${level}>`);
      continue;
    }
    if (/^>\s+/.test(line)) {
      flushPara(); flushList(); flushTable();
      out.push(`<blockquote>${inlineFormat(escapeHtml(line.replace(/^>\s+/, '')))}</blockquote>`);
      continue;
    }
    const ul = line.match(/^\s*[-*]\s+(.*)$/);
    if (ul) {
      flushPara(); flushTable();
      if (!inUl) { out.push('<ul>'); inUl = true; }
      out.push(`<li>${inlineFormat(escapeHtml(ul[1]))}</li>`);
      continue;
    }
    const ol = line.match(/^\s*\d+\.\s+(.*)$/);
    if (ol) {
      flushPara(); flushTable();
      if (!inOl) { out.push('<ol>'); inOl = true; }
      out.push(`<li>${inlineFormat(escapeHtml(ol[1]))}</li>`);
      continue;
    }
    const isTableLike = line.includes('|');
    if (isTableLike) {
      flushPara(); flushList();
      inTable = true; tableRows.push(line);
      const next = lines[i + 1] || '';
      if (!next.includes('|')) {
        flushTable();
      }
      continue;
    }
    para.push(line);
  }
  flushPara(); flushList(); flushTable();
  return out.join('\n');
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