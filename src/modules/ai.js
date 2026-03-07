import { state, showToast, loadComponents } from '../app.js';
import { invoke } from '@tauri-apps/api/core';

const OLLAMA_BASE       = 'http://localhost:11434';
const CHAT_HISTORY_LIMIT = 40;
const BATCH_SIZE         = 15; // components per categorization batch

let _currentModel    = '';
let _availableModels = [];
let _chatHistory     = [];

// ============================================================
// Ollama HTTP via Rust proxy (bypasses WebView CORS)
// ============================================================
async function ollamaGet(path) {
  const text = await invoke('ollama_get', { url: OLLAMA_BASE + path });
  return JSON.parse(text);
}

async function ollamaPost(path, bodyObj, timeoutSecs = 120) {
  const text = await invoke('ollama_post', {
    url: OLLAMA_BASE + path,
    body: JSON.stringify(bodyObj),
    timeoutSecs,
  });
  return JSON.parse(text);
}

// ============================================================
// Ollama status polling
// ============================================================
export function pollOllamaStatus() {
  checkOllamaStatus();
  setInterval(checkOllamaStatus, 30000);
}

async function checkOllamaStatus() {
  const dot   = document.getElementById('ollama-dot');
  const label = document.getElementById('ollama-label');
  if (!dot || !label) return;

  dot.className     = 'status-dot checking';
  label.textContent = 'Checking...';

  try {
    const data       = await ollamaGet('/api/tags');
    _availableModels = (data.models || []).map(m => m.name);
    dot.className    = 'status-dot online';
    label.textContent = `Ollama: ${_availableModels.length} model${_availableModels.length !== 1 ? 's' : ''}`;
    refreshModelSelect();
  } catch {
    dot.className     = 'status-dot offline';
    label.textContent = 'Ollama offline';
    _availableModels  = [];
    refreshModelSelect();
  }
}

function refreshModelSelect() {
  const sel = document.getElementById('ai-model-select');
  if (!sel) return;
  const prev = _currentModel;

  sel.innerHTML = _availableModels.length === 0
    ? '<option value="">No models available</option>'
    : _availableModels.map(m =>
        `<option value="${m}"${m === prev ? ' selected' : ''}>${m}</option>`
      ).join('');

  if (_availableModels.length > 0 && !_currentModel) {
    _currentModel = _availableModels[0];
    sel.value     = _currentModel;
  }

  const badge = document.getElementById('ai-model-badge');
  if (badge) badge.textContent = _currentModel || 'No model';

  updateInventoryContext();
}

function updateInventoryContext() {
  const ctxEl = document.getElementById('ai-inventory-ctx');
  if (ctxEl) {
    ctxEl.textContent = `${state.components.length} components loaded`;
  }
}

// ============================================================
// System prompt — inventory is explicitly injected
// ============================================================
function buildSystemPrompt() {
  const count = state.components.length;

  if (count === 0) {
    return `You are an electronics component inventory assistant.
The user's inventory is currently EMPTY. Help them add components or import data.`;
  }

  const header = 'ID | Part Code | Category | Subcategory | Qty | Package | Manufacturer | MPN | Location | V_max(V) | I_max(A) | Description';

  // Limit to 200 components to avoid context window overflow
  const sample = count > 200 ? state.components.slice(0, 200) : state.components;
  const rows = sample.map(c => [
    c.id,
    c.part_code     || '',
    c.category      || '',
    c.subcategory   || '',
    c.quantity      ?? 0,
    c.package       || '',
    c.manufacturer  || '',
    c.mpn           || '',
    c.location      || '',
    c.voltage_max   ?? '',
    c.current_max   ?? '',
    c.description   || '',
  ].join(' | ')).join('\n');

  const truncNote = count > 200
    ? `\n[NOTE: Showing first 200 of ${count} total components due to context limits.]`
    : '';

  return `[SYSTEM — ELECTRONICS INVENTORY ASSISTANT]

You are an AI assistant embedded in the user's electronic component inventory management software.
You have DIRECT ACCESS to the component database. The COMPLETE inventory is listed below.

CRITICAL RULES:
- The data below IS the user's real inventory. Do NOT say you cannot see it.
- Answer questions about quantities, categories, part codes directly from the data.
- When suggesting alternatives, use parts that EXIST in the inventory.
- Be concise and technical. Use English for all technical terms.
- If asked about a part, look it up in the table below.

COMPONENT INVENTORY (${count} components${count > 200 ? ', first 200 shown' : ''}):
${header}
${rows}${truncNote}

[END INVENTORY DATA]`;
}

// ============================================================
// Chat
// ============================================================
async function sendMessage(userText) {
  if (!userText.trim()) return;
  if (!_currentModel) {
    showToast('No Ollama model selected or Ollama is offline', 'error');
    return;
  }

  appendMessage('user', userText);
  _chatHistory.push({ role: 'user', content: userText });
  if (_chatHistory.length > CHAT_HISTORY_LIMIT) {
    _chatHistory = _chatHistory.slice(-CHAT_HISTORY_LIMIT);
  }

  const thinkingEl = appendThinking();
  setSendDisabled(true);

  try {
    const data  = await ollamaPost('/api/chat', {
      model: _currentModel,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        ..._chatHistory,
      ],
      stream: false,
    }, 120);

    const reply = data.message?.content || '';
    thinkingEl.remove();
    appendMessage('assistant', reply);
    _chatHistory.push({ role: 'assistant', content: reply });
  } catch (err) {
    thinkingEl.remove();
    appendMessage('assistant', `Error: ${err.message || 'Request failed'}`);
  } finally {
    setSendDisabled(false);
  }
}

// ============================================================
// Auto-categorize — BATCHED with progress overlay
// ============================================================
function setProgress(current, total, batchLabel) {
  const overlay  = document.getElementById('categorize-progress');
  const bar      = document.getElementById('progress-bar-fill');
  const labelEl  = document.getElementById('progress-label');
  const subEl    = document.getElementById('progress-sub');

  if (!overlay) return;

  const pct = total > 0 ? Math.round((current / total) * 100) : 0;
  overlay.style.display = '';
  bar.style.width        = `${pct}%`;
  labelEl.textContent    = `Processing components... ${pct}%`;
  subEl.textContent      = batchLabel || '';
}

function hideProgress() {
  const overlay = document.getElementById('categorize-progress');
  if (overlay) overlay.style.display = 'none';
}

async function autoCategorizeAll() {
  if (!_currentModel) {
    showToast('Ollama is offline or no model selected', 'error');
    return;
  }
  if (state.components.length === 0) {
    showToast('Inventory is empty', 'warning');
    return;
  }

  const btn = document.getElementById('btn-ai-categorize');
  btn.disabled = true;

  const total   = state.components.length;
  const batches = [];
  for (let i = 0; i < total; i += BATCH_SIZE) {
    batches.push(state.components.slice(i, i + BATCH_SIZE));
  }

  let processed = 0;
  let updated   = 0;

  setProgress(0, total, `0 / ${total} — Batch 0 of ${batches.length}`);

  try {
    for (let bIdx = 0; bIdx < batches.length; bIdx++) {
      const batch = batches[bIdx];
      setProgress(
        processed,
        total,
        `Batch ${bIdx + 1} / ${batches.length} — ${processed} of ${total} done`
      );

      const compList = batch.map(c =>
        `${c.id}|${c.part_code}|${c.description || ''}|${c.manufacturer || ''}`
      ).join('\n');

      const prompt = `You are an electronics component categorization expert.
Given these components (format: ID|PartCode|Description|Manufacturer), assign Category and Subcategory.

Use standard categories: Resistors, Capacitors, Inductors, Transistors, Diodes, LEDs,
ICs, Connectors, Modules, Sensors, Power, Switches, Crystals, Ferrites, Transformers, Relays, Misc.

Reply ONLY with valid JSON array, no markdown, no explanation:
[{"id":1,"category":"...","subcategory":"..."}, ...]

Components:
${compList}`;

      try {
        const data  = await ollamaPost('/api/generate', {
          model: _currentModel,
          prompt,
          stream: false,
          options: { temperature: 0.1 },
        }, 120);

        const text  = data.response || '';
        const match = text.match(/\[[\s\S]*?\]/);
        if (!match) {
          console.warn(`Batch ${bIdx + 1}: no JSON array found`);
        } else {
          const results = JSON.parse(match[0]);
          for (const item of results) {
            const comp = state.components.find(c => c.id === item.id);
            if (!comp || (!item.category && !item.subcategory)) continue;
            await state.db.execute(
              `UPDATE components SET category=?, subcategory=?, updated_at=datetime('now') WHERE id=?`,
              [
                item.category    || comp.category,
                item.subcategory || comp.subcategory,
                comp.id,
              ]
            );
            updated++;
          }
        }
      } catch (batchErr) {
        console.warn(`Batch ${bIdx + 1} failed:`, batchErr);
      }

      processed += batch.length;
      setProgress(processed, total, `Batch ${bIdx + 1} / ${batches.length} — ${processed} of ${total} done`);

      // Small pause to let UI breathe
      await new Promise(r => setTimeout(r, 200));
    }

    await loadComponents();
    showToast(`Auto-categorize complete: ${updated} of ${total} components updated`, 'success', 5000);
  } catch (err) {
    showToast('Categorization failed: ' + (err.message || err), 'error');
  } finally {
    btn.disabled = false;
    hideProgress();
  }
}

// ============================================================
// AI Enrich (fill component fields from part code)
// ============================================================
async function enrichComponent(partCode) {
  if (!_currentModel) {
    showToast('Ollama is offline or no model selected', 'error');
    return;
  }

  const prompt = `You are an electronics expert. Given the part code "${partCode}", provide specifications.
Respond ONLY with a JSON object:
{
  "category": "...",
  "subcategory": "...",
  "package": "...",
  "manufacturer": "...",
  "voltage_max": <number or null>,
  "current_max": <number or null>,
  "description": "..."
}
If unknown, use null for numbers and empty string for text.`;

  showToast(`AI enriching "${partCode}"...`, 'info', 3000);

  try {
    const data  = await ollamaPost('/api/generate', {
      model: _currentModel,
      prompt,
      stream: false,
    }, 60);

    const text  = data.response || '';
    const match = text.match(/\{[\s\S]*\}/);
    if (!match) throw new Error('No JSON in response');

    const info = JSON.parse(match[0]);
    if (info.category)     setFormField('edit-category',     info.category);
    if (info.subcategory)  setFormField('edit-subcategory',  info.subcategory);
    if (info.package)      setFormField('edit-package',      info.package);
    if (info.manufacturer) setFormField('edit-manufacturer', info.manufacturer);
    if (info.description)  setFormField('edit-description',  info.description);
    if (info.voltage_max != null) setFormField('edit-voltage-max', info.voltage_max);
    if (info.current_max != null) setFormField('edit-current-max', info.current_max);

    showToast('AI enrichment applied', 'success');
  } catch (err) {
    showToast('Enrich failed: ' + (err.message || err), 'error');
  }
}

function setFormField(id, value) {
  const el = document.getElementById(id);
  if (el && value !== null && value !== undefined && value !== '') el.value = value;
}

// ============================================================
// Chat UI helpers
// ============================================================
function appendMessage(role, content) {
  const container = document.getElementById('ai-messages');
  const div       = document.createElement('div');
  div.className   = `ai-message ${role}`;
  div.innerHTML   = `
    <span class="msg-role">${role === 'user' ? 'You' : 'AI'}</span>
    <div class="msg-content">${escapeHtml(content)}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function appendThinking() {
  const container = document.getElementById('ai-messages');
  const div       = document.createElement('div');
  div.className   = 'ai-message assistant';
  div.innerHTML   = `
    <span class="msg-role">AI</span>
    <div class="msg-thinking">
      <span></span><span></span><span></span>
    </div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function setSendDisabled(disabled) {
  const btn = document.getElementById('btn-ai-send');
  const inp = document.getElementById('ai-input');
  if (btn) btn.disabled = disabled;
  if (inp) inp.disabled = disabled;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ============================================================
// Init
// ============================================================
export function initAI() {
  const sendBtn     = document.getElementById('btn-ai-send');
  const inputEl     = document.getElementById('ai-input');
  const clearBtn    = document.getElementById('btn-ai-clear');
  const catBtn      = document.getElementById('btn-ai-categorize');
  const modelSelect = document.getElementById('ai-model-select');

  sendBtn.addEventListener('click', () => {
    const text    = inputEl.value.trim();
    inputEl.value = '';
    inputEl.style.height = '';
    sendMessage(text);
  });

  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text    = inputEl.value.trim();
      inputEl.value = '';
      inputEl.style.height = '';
      sendMessage(text);
    }
  });

  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });

  clearBtn.addEventListener('click', () => {
    _chatHistory = [];
    document.getElementById('ai-messages').innerHTML = `
      <div class="ai-welcome">
        <div class="ai-welcome-icon">
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
        </div>
        <div>
          <p>Chat cleared. Inventory context is active.</p>
          <p style="font-size:11px;color:var(--text-tertiary);margin-top:4px" id="ai-inventory-ctx"></p>
        </div>
      </div>`;
    updateInventoryContext();
  });

  catBtn.addEventListener('click', autoCategorizeAll);

  modelSelect.addEventListener('change', () => {
    _currentModel = modelSelect.value;
    const badge   = document.getElementById('ai-model-badge');
    if (badge) badge.textContent = _currentModel || 'No model';
  });

  document.addEventListener('ai-enrich-request', async e => {
    await enrichComponent(e.detail.partCode);
  });

  document.addEventListener('ai-modal-opened', () => {
    setTimeout(() => inputEl.focus(), 80);
    checkOllamaStatus();
    updateInventoryContext();
  });
}
