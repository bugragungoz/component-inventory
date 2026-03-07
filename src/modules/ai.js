import { state, showToast, loadComponents } from '../app.js';

const OLLAMA_BASE = 'http://localhost:11434';
const CHAT_HISTORY_LIMIT = 40;

let _currentModel   = '';
let _availableModels = [];
let _chatHistory     = [];

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
  dot.className = 'status-dot checking';
  label.textContent = 'Checking...';

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/tags`, { signal: AbortSignal.timeout(5000) });
    if (res.ok) {
      const data = await res.json();
      _availableModels = (data.models || []).map(m => m.name);
      dot.className   = 'status-dot online';
      label.textContent = `Ollama: ${_availableModels.length} model${_availableModels.length !== 1 ? 's' : ''}`;
      refreshModelSelect();
    } else {
      throw new Error('Non-OK response');
    }
  } catch (_) {
    dot.className   = 'status-dot offline';
    label.textContent = 'Ollama offline';
    _availableModels = [];
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
    sel.value = _currentModel;
  }

  const badge = document.getElementById('ai-model-badge');
  if (badge) badge.textContent = _currentModel || 'No model';
}

// ============================================================
// Build system prompt with full inventory context
// ============================================================
function buildSystemPrompt() {
  const header = 'Part Code | Category | Subcategory | Qty | Package | Manufacturer | MPN | Location | V Max | I Max | Description';
  const rows = state.components.map(c => [
    c.part_code || '',
    c.category || '',
    c.subcategory || '',
    c.quantity ?? '',
    c.package || '',
    c.manufacturer || '',
    c.mpn || '',
    c.location || '',
    c.voltage_max ?? '',
    c.current_max ?? '',
    c.description || '',
  ].join(' | ')).join('\n');

  return `You are an expert electronics engineer AI assistant with full access to the user's component inventory.

INVENTORY (${state.components.length} components):
${header}
${rows}

Answer concisely and technically. When referencing components, use their Part Code. If asked to suggest alternatives, use what is available in the inventory. All responses must be in plain English.`;
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
    const body = {
      model: _currentModel,
      messages: [
        { role: 'system', content: buildSystemPrompt() },
        ..._chatHistory,
      ],
      stream: false,
    };

    const res = await fetch(`${OLLAMA_BASE}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(120000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
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
// Auto-categorize all components
// ============================================================
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
  showToast(`Categorizing ${state.components.length} components...`, 'info', 6000);

  const compList = state.components.map(c =>
    `${c.id}|${c.part_code}|${c.description || ''}|${c.manufacturer || ''}`
  ).join('\n');

  const prompt = `You are an electronics component categorization expert.
Given the following components (format: ID|PartCode|Description|Manufacturer),
assign each a Category and Subcategory.

Use standard electronics categories such as:
Resistors, Capacitors, Inductors, Transistors, Diodes, ICs, Connectors,
Modules, Sensors, Power, LEDs, Switches, Crystals, Ferrites, Transformers, Misc.

Respond ONLY with a JSON array, no explanation:
[{"id": 1, "category": "...", "subcategory": "..."}, ...]

Components:
${compList}`;

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: _currentModel, prompt, stream: false }),
      signal: AbortSignal.timeout(300000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data  = await res.json();
    const text  = data.response || '';
    const match = text.match(/\[[\s\S]*\]/);
    if (!match) throw new Error('No JSON array in response');

    const results = JSON.parse(match[0]);
    let updated = 0;

    for (const item of results) {
      const comp = state.components.find(c => c.id === item.id);
      if (!comp) continue;
      await state.db.execute(
        `UPDATE components SET category=?, subcategory=?, updated_at=datetime('now') WHERE id=?`,
        [item.category || comp.category, item.subcategory || comp.subcategory, comp.id]
      );
      updated++;
    }

    await loadComponents();
    showToast(`Re-categorized ${updated} components`, 'success');
  } catch (err) {
    showToast('Categorization failed: ' + (err.message || err), 'error');
  } finally {
    btn.disabled = false;
  }
}

// ============================================================
// AI Enrich (fill component fields)
// ============================================================
async function enrichComponent(partCode) {
  if (!_currentModel) {
    showToast('Ollama is offline or no model selected', 'error');
    return;
  }

  const prompt = `You are an electronics expert. Given the part code "${partCode}", provide likely specifications.
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
Be concise. If unknown, use null for numbers and empty string for text.`;

  showToast(`AI enriching "${partCode}"...`, 'info', 3000);

  try {
    const res = await fetch(`${OLLAMA_BASE}/api/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: _currentModel, prompt, stream: false }),
      signal: AbortSignal.timeout(60000),
    });

    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data  = await res.json();
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
  const div = document.createElement('div');
  div.className = `ai-message ${role}`;
  div.innerHTML = `
    <span class="msg-role">${role === 'user' ? 'You' : 'AI'}</span>
    <div class="msg-content">${escapeHtml(content)}</div>`;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
  return div;
}

function appendThinking() {
  const container = document.getElementById('ai-messages');
  const div = document.createElement('div');
  div.className = 'ai-message assistant';
  div.innerHTML = `
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
    const text = inputEl.value.trim();
    inputEl.value = '';
    inputEl.style.height = '';
    sendMessage(text);
  });

  inputEl.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      const text = inputEl.value.trim();
      inputEl.value = '';
      inputEl.style.height = '';
      sendMessage(text);
    }
  });

  // Auto-resize textarea
  inputEl.addEventListener('input', () => {
    inputEl.style.height = 'auto';
    inputEl.style.height = Math.min(inputEl.scrollHeight, 120) + 'px';
  });

  clearBtn.addEventListener('click', () => {
    _chatHistory = [];
    document.getElementById('ai-messages').innerHTML = `
      <div class="ai-welcome">
        <p>Chat cleared. I have full access to your component inventory. Ask me anything.</p>
      </div>`;
  });

  catBtn.addEventListener('click', autoCategorizeAll);

  modelSelect.addEventListener('change', () => {
    _currentModel = modelSelect.value;
    const badge = document.getElementById('ai-model-badge');
    if (badge) badge.textContent = _currentModel || 'No model';
  });

  // AI enrich from edit modal
  document.addEventListener('ai-enrich-request', async e => {
    await enrichComponent(e.detail.partCode);
  });

  // Focus chat input when modal opens
  document.addEventListener('ai-modal-opened', () => {
    setTimeout(() => inputEl.focus(), 80);
    checkOllamaStatus();
  });
}
