import { ROLES } from './roles.js';
import { streamChat } from './gemini.js';
import { renderMarkdown } from './markdown.js';

const KEY_STORAGE = 'gemini-api-key';
const ROLE_STORAGE = 'interview-role';

const $ = (id) => document.getElementById(id);
const els = {
  roleList: $('roleList'),
  chatRole: $('chatRole'),
  chatSub: $('chatSub'),
  messages: $('messages'),
  suggestions: $('suggestions'),
  composer: $('composer'),
  input: $('input'),
  sendBtn: $('sendBtn'),
  resetBtn: $('resetBtn'),
  keyBtn: $('keyBtn'),
  keyDot: $('keyDot'),
  keyBtnLabel: $('keyBtnLabel'),
  keyDialog: $('keyDialog'),
  keyForm: $('keyForm'),
  keyInput: $('keyInput'),
  rememberKey: $('rememberKey'),
  clearKeyBtn: $('clearKeyBtn'),
};

const storage = {
  get(k) {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set(k, v) {
    try {
      localStorage.setItem(k, v);
    } catch {}
  },
  remove(k) {
    try {
      localStorage.removeItem(k);
    } catch {}
  },
};

const state = {
  apiKey: storage.get(KEY_STORAGE) || '',
  roleId: ROLES.some((r) => r.id === storage.get(ROLE_STORAGE)) ? storage.get(ROLE_STORAGE) : ROLES[0].id,
  // Each role keeps its own conversation so switching back resumes where you left off.
  histories: Object.fromEntries(ROLES.map((r) => [r.id, []])),
  busy: false,
  controller: null,
};

const currentRole = () => ROLES.find((r) => r.id === state.roleId);

// ---------- Rendering ----------

function renderRoles() {
  els.roleList.innerHTML = '';
  for (const role of ROLES) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'role-card';
    btn.setAttribute('role', 'radio');
    btn.setAttribute('aria-checked', String(role.id === state.roleId));
    btn.style.setProperty('--c', role.accent);
    btn.style.setProperty('--c2', role.accent2);
    btn.innerHTML = `
      <span class="role-icon">${role.icon}</span>
      <span class="role-title">${role.title}</span>`;
    btn.addEventListener('click', () => selectRole(role.id));
    els.roleList.appendChild(btn);
  }
}

function applyTheme(role) {
  const root = document.documentElement.style;
  root.setProperty('--accent', role.accent);
  root.setProperty('--accent-2', role.accent2);
  root.setProperty('--glow', role.glow);
}

function renderHeader(role) {
  els.chatRole.textContent = `${role.title} coach`;
  els.chatSub.textContent = role.short;
}

function renderSuggestions(role) {
  els.suggestions.innerHTML = '';
  if (state.histories[role.id].length) return;
  for (const text of role.suggestions) {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'chip';
    chip.textContent = text;
    chip.addEventListener('click', () => send(text));
    els.suggestions.appendChild(chip);
  }
}

function renderMessages(role) {
  els.messages.innerHTML = '';
  const history = state.histories[role.id];
  if (!history.length) {
    els.messages.innerHTML = `
      <div class="welcome">
        <div class="big-icon">${role.icon}</div>
        <h2>Prep for your ${role.title} interview</h2>
        <p>Ask about the interview process, practice a mock round, or paste an answer for feedback.</p>
      </div>`;
    return;
  }
  for (const m of history) addBubble(m.role === 'user' ? 'user' : 'bot', m.text);
}

function addBubble(kind, text) {
  els.messages.querySelector('.welcome')?.remove();
  const div = document.createElement('div');
  div.className = `msg ${kind}`;
  if (kind === 'user') div.textContent = text;
  else div.innerHTML = renderMarkdown(text);
  els.messages.appendChild(div);
  scrollToBottom();
  return div;
}

function scrollToBottom() {
  els.messages.scrollTop = els.messages.scrollHeight;
}

function renderKeyStatus() {
  const has = Boolean(state.apiKey);
  els.keyDot.classList.toggle('ok', has);
  els.keyBtnLabel.textContent = has ? 'API key connected' : 'Add API key';
}

function render() {
  const role = currentRole();
  applyTheme(role);
  renderRoles();
  renderHeader(role);
  renderMessages(role);
  renderSuggestions(role);
  renderKeyStatus();
}

// ---------- Actions ----------

function selectRole(id) {
  if (id === state.roleId) return;
  state.controller?.abort();
  state.roleId = id;
  storage.set(ROLE_STORAGE, id);
  render();
  els.input.focus();
}

async function send(text) {
  text = text.trim();
  if (!text || state.busy) return;
  if (!state.apiKey) {
    openKeyDialog();
    return;
  }

  const role = currentRole();
  const history = state.histories[role.id];
  history.push({ role: 'user', text });
  addBubble('user', text);
  els.suggestions.innerHTML = '';
  els.input.value = '';
  autosize();
  setBusy(true);

  const bubble = addBubble('bot', '');
  bubble.innerHTML = '<span class="typing"><span></span><span></span><span></span></span>';
  let reply = '';
  state.controller = new AbortController();

  try {
    reply = await streamChat({
      apiKey: state.apiKey,
      system: role.system,
      history,
      signal: state.controller.signal,
      onChunk: (chunk) => {
        reply += chunk;
        bubble.innerHTML = renderMarkdown(reply);
        scrollToBottom();
      },
    });
    history.push({ role: 'model', text: reply || '(No response)' });
    if (!reply) bubble.textContent = '(No response)';
  } catch (err) {
    if (err.name === 'AbortError') {
      // The user switched roles mid-reply; keep whatever arrived so the history stays valid.
      if (reply) history.push({ role: 'model', text: reply });
      else history.pop();
    } else {
      history.pop();
      bubble.classList.add('error');
      bubble.textContent = `⚠ ${err.message}`;
      if (/api key|permission|unauth/i.test(err.message)) openKeyDialog();
    }
  } finally {
    state.controller = null;
    setBusy(false);
  }
}

function setBusy(busy) {
  state.busy = busy;
  els.sendBtn.disabled = busy;
}

function autosize() {
  els.input.style.height = 'auto';
  els.input.style.height = `${els.input.scrollHeight}px`;
}

function openKeyDialog() {
  els.keyInput.value = state.apiKey;
  els.keyDialog.showModal();
  els.keyInput.focus();
}

// ---------- Events ----------

els.composer.addEventListener('submit', (e) => {
  e.preventDefault();
  send(els.input.value);
});

els.input.addEventListener('input', autosize);
els.input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    send(els.input.value);
  }
});

els.resetBtn.addEventListener('click', () => {
  state.controller?.abort();
  state.histories[state.roleId] = [];
  render();
});

els.keyBtn.addEventListener('click', openKeyDialog);

els.keyForm.addEventListener('submit', () => {
  state.apiKey = els.keyInput.value.trim();
  if (state.apiKey && els.rememberKey.checked) storage.set(KEY_STORAGE, state.apiKey);
  else storage.remove(KEY_STORAGE);
  renderKeyStatus();
});

els.clearKeyBtn.addEventListener('click', () => {
  state.apiKey = '';
  storage.remove(KEY_STORAGE);
  els.keyInput.value = '';
  renderKeyStatus();
  els.keyDialog.close();
});

render();
if (!state.apiKey) openKeyDialog();
