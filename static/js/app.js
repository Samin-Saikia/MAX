// ═══════════════════════════════════════════
//   MAX — App Controller
//   UI, API, state management
// ═══════════════════════════════════════════

const App = (() => {
  let allNodes = [], allEdges = [];
  let selectedNodeId = null;
  let chatHistory = [];
  let pendingPos = null; // for canvas dbl-click position

  // ── Boot Sequence ─────────────────────────────
  const BOOT_LOGS = [
    "Initializing MAX core systems...",
    "Loading knowledge universe...",
    "Calibrating neural pathways...",
    "Connecting to Groq AI core...",
    "Mapping knowledge clusters...",
    "Spatial engine online...",
    "Memory banks synchronized...",
    "All systems nominal. Welcome."
  ];

  async function boot() {
    const logEl = document.getElementById('boot-log');
    const bar = document.querySelector('.boot-progress');
    let i = 0;
    const interval = setInterval(() => {
      if (i < BOOT_LOGS.length) {
        const line = document.createElement('div');
        line.style.cssText = 'color:rgba(0,212,255,0.6);font-size:11px;';
        line.textContent = '> ' + BOOT_LOGS[i];
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
        bar.style.width = ((i + 1) / BOOT_LOGS.length * 100) + '%';
        i++;
      } else {
        clearInterval(interval);
        setTimeout(launchHUD, 600);
      }
    }, 240);
  }

  function launchHUD() {
    const boot = document.getElementById('boot-screen');
    boot.classList.add('fade-out');
    setTimeout(() => {
      boot.style.display = 'none';
      document.getElementById('hud').classList.remove('hidden');
      initUniverse();
      loadData();
      startClock();
    }, 800);
  }

  // ── Universe Init ─────────────────────────────
  function initUniverse() {
    Universe.init({
      onNodeSelect: (node) => showDetailPanel(node),
      onNodeDoubleClick: (node) => showDetailPanel(node),
      onCanvasDoubleClick: (x, y) => {
        pendingPos = { x, y };
        openAddModal();
      },
      onConnect: async (src, tgt) => {
        const label = prompt(`Connection type (e.g. "related to", "leads to"):`, 'related to') || '';
        await createEdge(src.id, tgt.id, label);
        Universe.showToast(`LINKED: ${src.title} → ${tgt.title}`);
      }
    });
  }

  // ── Load Data ─────────────────────────────────
  async function loadData() {
    const res = await fetch('/api/nodes');
    const data = await res.json();
    allNodes = data.nodes;
    allEdges = data.edges;
    Universe.setData(allNodes, allEdges);
    updateStats();
    updateRecentList();
  }

  function updateStats() {
    document.getElementById('node-count').textContent = `${allNodes.length} NODES`;
    document.getElementById('edge-count').textContent = `${allEdges.length} LINKS`;
  }

  async function updateMemStats() {
    const res = await fetch('/api/memory');
    const mems = await res.json();
    document.getElementById('mem-count').textContent = `${mems.length} MEMORIES`;
  }

  function updateRecentList() {
    const el = document.getElementById('recent-list');
    const recent = [...allNodes].reverse().slice(0, 8);
    el.innerHTML = recent.map(n => `
      <div class="recent-item" data-id="${n.id}">
        <span style="color:${n.color}">${typeIcon(n.type)}</span> ${n.title}
      </div>`).join('');
    el.querySelectorAll('.recent-item').forEach(item => {
      item.addEventListener('click', () => {
        const node = allNodes.find(n => n.id === item.dataset.id);
        if (node) showDetailPanel(node);
      });
    });
  }

  function typeIcon(t) {
    return { concept: '◈', idea: '✦', memory: '◉', topic: '⬡', research: '⊕' }[t] || '◈';
  }

  // ── Clock ─────────────────────────────────────
  function startClock() {
    const el = document.getElementById('live-time');
    setInterval(() => {
      const now = new Date();
      el.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    }, 1000);
    updateMemStats();
    setInterval(updateMemStats, 30000);
  }

  // ── Node CRUD ─────────────────────────────────
  async function createNode(title, content, type, tags, x, y) {
    const pos = (x !== undefined) ? { x, y } : Universe.randomPosition();
    const res = await fetch('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, type, tags: tags || [], x: pos.x, y: pos.y })
    });
    const data = await res.json();
    const newNode = {
      id: data.id, title, content, type, tags: tags || [],
      x: pos.x, y: pos.y,
      color: { concept:'#00d4ff', idea:'#a8ff3e', memory:'#ff6b35', topic:'#bf5fff', research:'#ffd700' }[type] || '#00d4ff'
    };
    allNodes.push(newNode);
    Universe.addNode(newNode);
    updateStats();
    updateRecentList();
    Universe.showToast(`NODE CREATED: ${title}`);
    return newNode;
  }

  async function createEdge(source, target, label, strength) {
    const res = await fetch('/api/edges', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ source, target, label: label || '', strength: strength || 1.0 })
    });
    const data = await res.json();
    const newEdge = { id: data.id, source, target, label: label || '', strength: strength || 1.0 };
    allEdges.push(newEdge);
    Universe.addEdge(newEdge);
    updateStats();
    return newEdge;
  }

  async function deleteNode(id) {
    await fetch(`/api/nodes/${id}`, { method: 'DELETE' });
    allNodes = allNodes.filter(n => n.id !== id);
    allEdges = allEdges.filter(e => e.source !== id && e.target !== id);
    Universe.removeNode(id);
    hideDetailPanel();
    updateStats();
    updateRecentList();
    Universe.showToast('NODE DELETED');
  }

  // ── Detail Panel ──────────────────────────────
  function showDetailPanel(node) {
    selectedNodeId = node.id;
    const panel = document.getElementById('detail-panel');
    const typeColors = { concept:'#00d4ff', idea:'#a8ff3e', memory:'#ff6b35', topic:'#bf5fff', research:'#ffd700' };

    document.getElementById('dp-type').textContent = node.type.toUpperCase();
    document.getElementById('dp-type').style.color = typeColors[node.type] || '#00d4ff';
    document.getElementById('dp-type').style.borderColor = (typeColors[node.type] || '#00d4ff') + '44';
    document.getElementById('dp-title').textContent = node.title;
    document.getElementById('dp-content').textContent = node.content || '';

    // tags
    const tagsEl = document.getElementById('dp-tags');
    const tags = Array.isArray(node.tags) ? node.tags : [];
    tagsEl.innerHTML = tags.map(t => `<span class="tag">${t}</span>`).join('');

    // connections
    const connEl = document.getElementById('dp-conn-list');
    const connected = allEdges
      .filter(e => e.source === node.id || e.target === node.id)
      .map(e => {
        const otherId = e.source === node.id ? e.target : e.source;
        const other = allNodes.find(n => n.id === otherId);
        return other ? { node: other, label: e.label, edgeId: e.id } : null;
      }).filter(Boolean);

    connEl.innerHTML = connected.length === 0
      ? '<div style="color:var(--text-dim);font-size:11px;opacity:0.5">No connections yet</div>'
      : connected.map(c => `
        <div class="conn-item" data-id="${c.node.id}">
          <span>${typeIcon(c.node.type)} ${c.node.title}</span>
          <span class="conn-label">${c.label || ''}</span>
        </div>`).join('');

    connEl.querySelectorAll('.conn-item').forEach(item => {
      item.addEventListener('click', () => {
        const n = allNodes.find(n => n.id === item.dataset.id);
        if (n) showDetailPanel(n);
      });
    });

    document.getElementById('dp-ai-result').classList.add('hidden');
    panel.classList.remove('hidden');

    // Hide memory/search panels
    document.getElementById('memory-panel').classList.add('hidden');
    document.getElementById('search-panel').classList.add('hidden');
  }

  function hideDetailPanel() {
    document.getElementById('detail-panel').classList.add('hidden');
    selectedNodeId = null;
  }

  // ── Add Node Modal ────────────────────────────
  function openAddModal(defaults = {}) {
    document.getElementById('new-title').value = defaults.title || '';
    document.getElementById('new-content').value = defaults.content || '';
    document.getElementById('new-type').value = defaults.type || 'concept';
    document.getElementById('new-tags').value = (defaults.tags || []).join(', ');
    document.getElementById('add-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('new-title').focus(), 50);
  }

  // ── Command Bar ───────────────────────────────
  function executeCommand(raw) {
    const cmd = raw.trim().toLowerCase();
    if (!cmd) return;

    if (cmd.startsWith('add ') || cmd.startsWith('create ')) {
      const title = raw.replace(/^(add|create)\s+/i, '').trim();
      openAddModal({ title });
    } else if (cmd === 'connect') {
      Universe.setConnectMode(true);
      Universe.showToast('CONNECT MODE — click source node');
    } else if (cmd === 'center' || cmd === 'reset view') {
      Universe.centerView();
    } else if (cmd.startsWith('search ') || cmd.startsWith('find ')) {
      const q = raw.replace(/^(search|find)\s+/i, '').trim();
      openSearchPanel(q);
    } else if (cmd.startsWith('ask ') || cmd.startsWith('?')) {
      const q = raw.replace(/^(ask|\?)\s*/i, '').trim();
      openChat(q);
    } else {
      // treat as AI question
      openChat(raw);
    }
    document.getElementById('cmd-bar').value = '';
  }

  // ── Chat ──────────────────────────────────────
  function openChat(prefill = '') {
    const panel = document.getElementById('chat-panel');
    const toggle = document.getElementById('chat-toggle');
    panel.classList.remove('hidden');
    toggle.classList.add('hidden');
    document.getElementById('memory-panel').classList.add('hidden');
    document.getElementById('search-panel').classList.add('hidden');
    if (prefill) {
      document.getElementById('chat-input').value = prefill;
      setTimeout(sendChat, 50);
    } else {
      document.getElementById('chat-input').focus();
    }
  }

  async function sendChat() {
    const input = document.getElementById('chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';

    appendChatMsg('user', msg);
    chatHistory.push({ role: 'user', content: msg });

    const selectedNode = Universe.getSelectedNode();

    const thinking = appendChatMsg('assistant', 'Processing...');
    thinking.style.opacity = '0.5';

    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: msg,
        history: chatHistory.slice(-8),
        node_context: selectedNode
      })
    });
    const data = await res.json();
    thinking.remove();

    const replyEl = appendChatMsg('assistant', data.reply);
    chatHistory.push({ role: 'assistant', content: data.reply });

    // Check if reply contains node suggestions
    if (data.reply.includes('"title"') && data.reply.includes('"type"')) {
      try {
        const jsonMatch = data.reply.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const suggestions = JSON.parse(jsonMatch[0]);
          addSuggestionsToChat(suggestions, replyEl);
        }
      } catch (e) {}
    }
  }

  function appendChatMsg(role, content) {
    const messages = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = `chat-msg ${role}`;
    if (role === 'assistant') {
      div.innerHTML = `<span class="msg-prefix">MAX //</span>${escapeHtml(content)}`;
    } else {
      div.innerHTML = `<span class="msg-prefix">YOU //</span>${escapeHtml(content)}`;
    }
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  function addSuggestionsToChat(suggestions, afterEl) {
    const div = document.createElement('div');
    div.className = 'dp-ai-result';
    div.style.margin = '8px 0';
    div.innerHTML = '<div style="color:var(--green);font-family:var(--font-mono);font-size:10px;letter-spacing:2px;margin-bottom:8px">SUGGESTED NODES — CLICK TO ADD</div>' +
      suggestions.map(s => `
        <div class="suggestion-item" data-title="${escapeAttr(s.title)}" data-type="${s.type}" data-content="${escapeAttr(s.content)}" data-rel="${escapeAttr(s.relation||'')}">
          <div class="suggestion-title">${escapeHtml(s.title)}</div>
          <div class="suggestion-type">${s.type.toUpperCase()}</div>
          <div class="suggestion-rel">${s.relation || ''}</div>
        </div>`).join('');

    div.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', async () => {
        const node = await createNode(item.dataset.title, item.dataset.content, item.dataset.type, []);
        const sel = Universe.getSelectedNode();
        if (sel && item.dataset.rel) {
          await createEdge(sel.id, node.id, item.dataset.rel);
        }
        item.style.opacity = '0.4';
        item.style.pointerEvents = 'none';
        Universe.showToast(`ADDED: ${item.dataset.title}`);
      });
    });

    const messages = document.getElementById('chat-messages');
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
  }

  // ── Memory Panel ──────────────────────────────
  async function openMemoryPanel() {
    document.getElementById('memory-panel').classList.remove('hidden');
    document.getElementById('detail-panel').classList.add('hidden');
    document.getElementById('search-panel').classList.add('hidden');
    document.getElementById('chat-panel').classList.add('hidden');
    document.getElementById('chat-toggle').classList.remove('hidden');
    await loadMemories();
  }

  async function loadMemories() {
    const res = await fetch('/api/memory');
    const mems = await res.json();
    document.getElementById('mem-count').textContent = `${mems.length} MEMORIES`;
    const list = document.getElementById('memory-list');
    list.innerHTML = mems.map(m => `
      <div class="memory-item">
        <div class="mem-content">
          <div class="mem-key">${escapeHtml(m.key)}</div>
          <div class="mem-val">${escapeHtml(m.value)}</div>
          <span class="mem-cat">${m.category}</span>
        </div>
        <button class="mem-del" data-id="${m.id}">✕</button>
      </div>`).join('');

    list.querySelectorAll('.mem-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        await fetch(`/api/memory/${btn.dataset.id}`, { method: 'DELETE' });
        loadMemories();
      });
    });
  }

  // ── Search Panel ──────────────────────────────
  async function openSearchPanel(query = '') {
    document.getElementById('search-panel').classList.remove('hidden');
    document.getElementById('detail-panel').classList.add('hidden');
    document.getElementById('memory-panel').classList.add('hidden');
    document.getElementById('chat-panel').classList.add('hidden');
    document.getElementById('chat-toggle').classList.remove('hidden');
    if (query) {
      document.getElementById('search-query').value = query;
      doSearch(query);
    }
  }

  async function doSearch(query) {
    const results = document.getElementById('search-results');
    results.innerHTML = '<div style="color:var(--text-dim);font-family:var(--font-mono);font-size:11px;padding:12px">SEARCHING THE WEB...</div>';

    const res = await fetch('/api/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    const data = await res.json();

    if (data.error) {
      results.innerHTML = `<div style="color:var(--orange);font-size:11px;padding:12px">${data.error}</div>`;
      return;
    }

    if (data.results.length === 0) {
      results.innerHTML = '<div style="color:var(--text-dim);font-size:11px;padding:12px">No results found.</div>';
      return;
    }

    results.innerHTML = data.results.map(r => `
      <div class="search-result">
        <div class="sr-title">${escapeHtml(r.title)}</div>
        <div class="sr-snippet">${escapeHtml(r.snippet)}</div>
        <div class="sr-link">${r.link}</div>
        <div class="sr-actions">
          <button class="sr-btn" data-title="${escapeAttr(r.title)}" data-content="${escapeAttr(r.snippet)}" data-action="add">+ ADD NODE</button>
          <a href="${r.link}" target="_blank" style="text-decoration:none">
            <button class="sr-btn">OPEN ↗</button>
          </a>
        </div>
      </div>`).join('');

    results.querySelectorAll('[data-action="add"]').forEach(btn => {
      btn.addEventListener('click', async () => {
        await createNode(btn.dataset.title, btn.dataset.content, 'research', [query]);
        btn.textContent = '✓ ADDED';
        btn.style.color = 'var(--green)';
        btn.disabled = true;
      });
    });
  }

  // ── AI Expand ─────────────────────────────────
  async function expandNode(node) {
    const resultEl = document.getElementById('dp-ai-result');
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = '<div style="color:var(--green);font-family:var(--font-mono);font-size:11px">⚡ EXPANDING NODE...</div>';

    const res = await fetch('/api/expand', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ node })
    });
    const data = await res.json();

    if (!data.suggestions || data.suggestions.length === 0) {
      resultEl.innerHTML = '<div style="color:var(--orange);font-size:11px">Could not generate suggestions. Check Groq API key.</div>';
      return;
    }

    resultEl.innerHTML = '<div style="color:var(--green);font-family:var(--font-mono);font-size:10px;letter-spacing:2px;margin-bottom:8px">CLICK TO ADD CONNECTED NODES</div>' +
      data.suggestions.map(s => `
        <div class="suggestion-item" data-title="${escapeAttr(s.title)}" data-type="${s.type}" data-content="${escapeAttr(s.content||'')}" data-rel="${escapeAttr(s.relation||'')}">
          <div class="suggestion-title">${escapeHtml(s.title)}</div>
          <div class="suggestion-type">${(s.type||'concept').toUpperCase()} — <span style="color:var(--text-dim)">${escapeHtml(s.relation||'')}</span></div>
          <div class="suggestion-rel">${escapeHtml(s.content||'')}</div>
        </div>`).join('');

    resultEl.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', async () => {
        const newNode = await createNode(item.dataset.title, item.dataset.content, item.dataset.type, []);
        await createEdge(node.id, newNode.id, item.dataset.rel || 'related to');
        item.style.opacity = '0.4';
        item.style.pointerEvents = 'none';
        Universe.showToast(`EXPANDED: ${item.dataset.title}`);
      });
    });
  }

  // ── Auto Connect ──────────────────────────────
  async function autoConnect() {
    Universe.showToast('AI ANALYZING CONNECTIONS...');
    const res = await fetch('/api/autoconnect', { method: 'POST' });
    const data = await res.json();

    if (!data.connections || data.connections.length === 0) {
      Universe.showToast('No new connections found');
      return;
    }

    for (const c of data.connections) {
      const exists = allEdges.find(e =>
        (e.source === c.source && e.target === c.target) ||
        (e.source === c.target && e.target === c.source));
      if (!exists) {
        await createEdge(c.source, c.target, c.label, c.strength);
      }
    }
    Universe.showToast(`⚡ ${data.connections.length} CONNECTIONS MAPPED`);
  }

  // ── Utility ───────────────────────────────────
  function escapeHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function escapeAttr(s) {
    return String(s || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ── Event Bindings ────────────────────────────
  function bindUI() {
    // Command bar
    document.getElementById('cmd-exec').addEventListener('click', () => {
      executeCommand(document.getElementById('cmd-bar').value);
    });
    document.getElementById('cmd-bar').addEventListener('keydown', e => {
      if (e.key === 'Enter') executeCommand(e.target.value);
    });

    // Top buttons
    document.getElementById('btn-add-node').addEventListener('click', () => openAddModal());
    document.getElementById('btn-autoconnect').addEventListener('click', autoConnect);
    document.getElementById('btn-memory').addEventListener('click', openMemoryPanel);

    // Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Universe.setFilter(btn.dataset.type);
      });
    });

    // Detail panel
    document.getElementById('dp-close').addEventListener('click', hideDetailPanel);
    document.getElementById('dp-save').addEventListener('click', async () => {
      if (!selectedNodeId) return;
      const title = document.getElementById('dp-title').textContent.trim();
      const content = document.getElementById('dp-content').textContent.trim();
      await fetch(`/api/nodes/${selectedNodeId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, content })
      });
      const n = allNodes.find(n => n.id === selectedNodeId);
      if (n) { n.title = title; n.content = content; Universe.updateNode(selectedNodeId, { title, content }); }
      updateRecentList();
      Universe.showToast('NODE SAVED');
    });
    document.getElementById('dp-expand').addEventListener('click', () => {
      const node = allNodes.find(n => n.id === selectedNodeId);
      if (node) expandNode(node);
    });
    document.getElementById('dp-search').addEventListener('click', () => {
      const node = allNodes.find(n => n.id === selectedNodeId);
      if (node) openSearchPanel(node.title);
    });
    document.getElementById('dp-delete').addEventListener('click', () => {
      if (selectedNodeId && confirm('Delete this node?')) deleteNode(selectedNodeId);
    });

    // Add modal
    document.getElementById('modal-cancel').addEventListener('click', () => {
      document.getElementById('add-modal').classList.add('hidden');
      pendingPos = null;
    });
    document.getElementById('modal-create').addEventListener('click', async () => {
      const title = document.getElementById('new-title').value.trim();
      if (!title) return;
      const content = document.getElementById('new-content').value.trim();
      const type = document.getElementById('new-type').value;
      const tags = document.getElementById('new-tags').value.split(',').map(t => t.trim()).filter(Boolean);
      const pos = pendingPos || Universe.randomPosition();
      await createNode(title, content, type, tags, pos.x, pos.y);
      document.getElementById('add-modal').classList.add('hidden');
      pendingPos = null;
    });
    document.getElementById('new-title').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('modal-create').click();
    });

    // Chat
    document.getElementById('chat-toggle').addEventListener('click', () => openChat());
    document.getElementById('chat-close').addEventListener('click', () => {
      document.getElementById('chat-panel').classList.add('hidden');
      document.getElementById('chat-toggle').classList.remove('hidden');
    });
    document.getElementById('chat-send').addEventListener('click', sendChat);
    document.getElementById('chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') sendChat();
    });

    // Memory
    document.getElementById('mem-close').addEventListener('click', () => {
      document.getElementById('memory-panel').classList.add('hidden');
    });
    document.getElementById('mem-add-btn').addEventListener('click', async () => {
      const key = document.getElementById('mem-key').value.trim();
      const val = document.getElementById('mem-val').value.trim();
      if (!key || !val) return;
      const cat = document.getElementById('mem-cat').value;
      await fetch('/api/memory', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key, value: val, category: cat })
      });
      document.getElementById('mem-key').value = '';
      document.getElementById('mem-val').value = '';
      loadMemories();
      Universe.showToast('MEMORY STORED');
    });

    // Search
    document.getElementById('search-close').addEventListener('click', () => {
      document.getElementById('search-panel').classList.add('hidden');
    });
    document.getElementById('search-exec').addEventListener('click', () => {
      doSearch(document.getElementById('search-query').value.trim());
    });
    document.getElementById('search-query').addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch(e.target.value.trim());
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') {
        document.getElementById('add-modal').classList.add('hidden');
        hideDetailPanel();
        Universe.setConnectMode(false);
        pendingPos = null;
      }
      if (e.key === 'n' && (e.ctrlKey || e.metaKey)) {
        e.preventDefault(); openAddModal();
      }
    });

    // Close modal on overlay click
    document.getElementById('add-modal').addEventListener('click', e => {
      if (e.target === document.getElementById('add-modal')) {
        document.getElementById('add-modal').classList.add('hidden');
        pendingPos = null;
      }
    });
  }

  // ── Start ─────────────────────────────────────
  function start() {
    bindUI();
    boot();
  }

  return { start };
})();

document.addEventListener('DOMContentLoaded', App.start);
