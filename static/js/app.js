// ═══════════════════════════════════════════════════════
//   MAX — App Controller  v2.0
//   UI, API calls, state management
// ═══════════════════════════════════════════════════════

const App = (() => {
  let allNodes = [], allEdges = [];
  let selectedNodeId = null;
  let chatHistory = [];
  let pendingPos = null;

  // ── Boot Sequence ──────────────────────────────────────
  const BOOT_LOGS = [
    "Initializing MAX core systems...",
    "Loading knowledge universe...",
    "Calibrating neural pathways...",
    "Connecting to Groq AI engine...",
    "Mapping knowledge clusters...",
    "Spatial rendering engine online...",
    "Memory banks synchronized...",
    "All systems nominal. Welcome."
  ];

  async function boot() {
    const logEl = document.getElementById('boot-log');
    const bar   = document.querySelector('.boot-progress');
    let i = 0;
    const iv = setInterval(() => {
      if (i < BOOT_LOGS.length) {
        const line = document.createElement('div');
        line.style.cssText = 'color:rgba(0,200,255,0.55);font-size:10px;';
        line.textContent = '> ' + BOOT_LOGS[i];
        logEl.appendChild(line);
        logEl.scrollTop = logEl.scrollHeight;
        bar.style.width = ((i + 1) / BOOT_LOGS.length * 100) + '%';
        i++;
      } else {
        clearInterval(iv);
        setTimeout(launchHUD, 500);
      }
    }, 220);
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
    }, 900);
  }

  // ── Universe Init ──────────────────────────────────────
  function initUniverse() {
    Universe.init({
      onNodeSelect: (node) => showDetailPanel(node),
      onNodeDoubleClick: (node) => showDetailPanel(node),
      onCanvasDoubleClick: (x, y) => {
        pendingPos = { x, y };
        openAddModal();
      },
      onConnect: async (src, tgt) => {
        const label = prompt('Connection label (e.g. "related to", "leads to"):', 'related to') || '';
        await createEdge(src.id, tgt.id, label);
        Universe.showToast('LINKED: ' + src.title + ' → ' + tgt.title);
      }
    });
  }

  // ── Load Data ──────────────────────────────────────────
  async function loadData() {
    try {
      const res  = await fetch('/api/nodes');
      const data = await res.json();
      allNodes = data.nodes;
      allEdges = data.edges;
      Universe.setData(allNodes, allEdges);
      updateStats();
      updateRecentList();
    } catch(e) {
      Universe.showToast('ERROR LOADING DATA');
    }
  }

  function updateStats() {
    document.getElementById('node-count').textContent = allNodes.length + ' NODES';
    document.getElementById('edge-count').textContent = allEdges.length + ' LINKS';
  }

  async function updateMemStats() {
    try {
      const res  = await fetch('/api/memory');
      const mems = await res.json();
      document.getElementById('mem-count').textContent = mems.length + ' MEM';
    } catch(_) {}
  }

  function updateRecentList() {
    const el     = document.getElementById('recent-list');
    const recent = [...allNodes].reverse().slice(0, 10);
    el.innerHTML = recent.map(n => `
      <div class="recent-item" data-id="${n.id}">
        <span style="display:inline-block;width:6px;height:6px;border-radius:50%;background:${n.color};flex-shrink:0;margin-top:1px"></span>
        <span>${escapeHtml(n.title)}</span>
      </div>`).join('');
    el.querySelectorAll('.recent-item').forEach(item => {
      item.addEventListener('click', () => {
        const node = allNodes.find(n => n.id === item.dataset.id);
        if (node) showDetailPanel(node);
      });
    });
  }

  // ── Clock & Ticker ─────────────────────────────────────
  function startClock() {
    const el = document.getElementById('live-time');
    const tick = () => {
      const now = new Date();
      el.textContent = now.toLocaleTimeString('en-US', { hour12: false });
    };
    tick();
    setInterval(tick, 1000);
    updateMemStats();
    setInterval(updateMemStats, 30000);
  }

  // ── Node CRUD ──────────────────────────────────────────
  const TYPE_COLORS = {
    concept: '#00c8ff', idea: '#7fff3e',
    memory: '#ff7040', topic: '#c060ff', research: '#ffc840'
  };

  async function createNode(title, content, type, tags, x, y) {
    const pos = (x !== undefined) ? { x, y } : Universe.randomPosition();
    const res  = await fetch('/api/nodes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, content, type, tags: tags || [], x: pos.x, y: pos.y })
    });
    const data = await res.json();
    const newNode = {
      id: data.id, title, content, type, tags: tags || [],
      x: pos.x, y: pos.y,
      color: TYPE_COLORS[type] || '#00c8ff'
    };
    allNodes.push(newNode);
    Universe.addNode(newNode);
    updateStats();
    updateRecentList();
    Universe.showToast('NODE CREATED: ' + title);
    return newNode;
  }

  async function createEdge(source, target, label, strength) {
    const res  = await fetch('/api/edges', {
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
    await fetch('/api/nodes/' + id, { method: 'DELETE' });
    allNodes = allNodes.filter(n => n.id !== id);
    allEdges = allEdges.filter(e => e.source !== id && e.target !== id);
    Universe.removeNode(id);
    hideDetailPanel();
    updateStats();
    updateRecentList();
    Universe.showToast('NODE DELETED');
  }

  // ── Detail Panel ───────────────────────────────────────
  function showDetailPanel(node) {
    selectedNodeId = node.id;
    const panel    = document.getElementById('detail-panel');

    // type badge
    const badge = document.getElementById('dp-type');
    badge.lastChild.textContent = ' ' + node.type.toUpperCase();
    badge.style.color       = TYPE_COLORS[node.type] || '#00c8ff';
    badge.style.borderColor = (TYPE_COLORS[node.type] || '#00c8ff') + '44';

    document.getElementById('dp-title').textContent   = node.title;
    document.getElementById('dp-content').textContent = node.content || '';

    // tags
    const tags = Array.isArray(node.tags) ? node.tags : [];
    document.getElementById('dp-tags').innerHTML =
      tags.map(t => '<span class="tag">' + escapeHtml(t) + '</span>').join('');

    // connections
    const connEl    = document.getElementById('dp-conn-list');
    const connected = allEdges
      .filter(e => e.source === node.id || e.target === node.id)
      .map(e => {
        const otherId = e.source === node.id ? e.target : e.source;
        const other   = allNodes.find(n => n.id === otherId);
        return other ? { node: other, label: e.label, edgeId: e.id } : null;
      }).filter(Boolean);

    connEl.innerHTML = connected.length === 0
      ? '<div style="color:var(--text-faint);font-size:11px;padding:4px 0">No connections yet</div>'
      : connected.map(c => `
        <div class="conn-item" data-id="${c.node.id}">
          <span style="display:flex;align-items:center;gap:6px">
            <span style="width:5px;height:5px;border-radius:50%;background:${c.node.color};flex-shrink:0"></span>
            ${escapeHtml(c.node.title)}
          </span>
          <span class="conn-label">${escapeHtml(c.label || '')}</span>
        </div>`).join('');

    connEl.querySelectorAll('.conn-item').forEach(item => {
      item.addEventListener('click', () => {
        const n = allNodes.find(n => n.id === item.dataset.id);
        if (n) showDetailPanel(n);
      });
    });

    document.getElementById('dp-ai-result').classList.add('hidden');
    document.getElementById('memory-panel').classList.add('hidden');
    document.getElementById('search-panel').classList.add('hidden');
    panel.classList.remove('hidden');
  }

  function hideDetailPanel() {
    document.getElementById('detail-panel').classList.add('hidden');
    selectedNodeId = null;
  }

  // ── Add Node Modal ─────────────────────────────────────
  function openAddModal(defaults = {}) {
    document.getElementById('new-title').value   = defaults.title   || '';
    document.getElementById('new-content').value = defaults.content || '';
    document.getElementById('new-type').value    = defaults.type    || 'concept';
    document.getElementById('new-tags').value    = (defaults.tags || []).join(', ');
    document.getElementById('add-modal').classList.remove('hidden');
    setTimeout(() => document.getElementById('new-title').focus(), 50);
  }

  // ── Command Bar ────────────────────────────────────────
  function executeCommand(raw) {
    const cmd = raw.trim().toLowerCase();
    if (!cmd) return;

    if (cmd.startsWith('add ') || cmd.startsWith('create ')) {
      openAddModal({ title: raw.replace(/^(add|create)\s+/i, '').trim() });
    } else if (cmd === 'connect') {
      Universe.setConnectMode(true);
      Universe.showToast('CONNECT — click source node');
    } else if (cmd === 'center' || cmd === 'reset') {
      Universe.centerView();
    } else if (cmd.startsWith('search ') || cmd.startsWith('find ')) {
      openSearchPanel(raw.replace(/^(search|find)\s+/i, '').trim());
    } else if (cmd.startsWith('ask ') || cmd.startsWith('?')) {
      openChat(raw.replace(/^(ask|\?)\s*/i, '').trim());
    } else if (cmd === 'export') {
      exportUniverse();
    } else if (cmd === 'memory') {
      openMemoryPanel();
    } else {
      openChat(raw);
    }
    document.getElementById('cmd-bar').value = '';
  }

  // ── Export ─────────────────────────────────────────────
  function exportUniverse() {
    const data = Universe.exportData();
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = 'max-universe-' + Date.now() + '.json';
    a.click(); URL.revokeObjectURL(url);
    Universe.showToast('UNIVERSE EXPORTED');
  }

  // ── Chat ───────────────────────────────────────────────
  function openChat(prefill = '') {
    document.getElementById('chat-panel').classList.remove('hidden');
    document.getElementById('chat-toggle').classList.add('hidden');
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
    const msg   = input.value.trim();
    if (!msg) return;
    input.value = '';

    appendChatMsg('user', msg);
    chatHistory.push({ role: 'user', content: msg });

    const selectedNode = Universe.getSelectedNode();
    const thinkEl      = appendChatMsg('assistant', 'Processing...');
    thinkEl.style.opacity = '0.45';

    try {
      const res  = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: chatHistory.slice(-8),
          node_context: selectedNode
        })
      });
      const data = await res.json();
      thinkEl.remove();

      const replyEl = appendChatMsg('assistant', data.reply);
      chatHistory.push({ role: 'assistant', content: data.reply });

      // parse embedded node suggestions
      if (data.reply.includes('"title"') && data.reply.includes('"type"')) {
        try {
          const jsonMatch = data.reply.match(/\[[\s\S]*?\]/);
          if (jsonMatch) addSuggestionsToChat(JSON.parse(jsonMatch[0]), replyEl);
        } catch(_) {}
      }
    } catch(e) {
      thinkEl.remove();
      appendChatMsg('assistant', 'Network error. Check your connection.');
    }
  }

  function appendChatMsg(role, content) {
    const messages = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg ' + role;
    const prefix = role === 'assistant' ? 'MAX //' : 'YOU //';
    div.innerHTML = '<span class="msg-prefix">' + prefix + '</span>' + escapeHtml(content);
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  function addSuggestionsToChat(suggestions, afterEl) {
    const div = document.createElement('div');
    div.className = 'dp-ai-result';
    div.style.cssText = 'margin:8px 0;';
    div.innerHTML =
      '<div style="color:var(--green);font-family:var(--font-mono);font-size:9px;letter-spacing:2px;margin-bottom:8px">SUGGESTED NODES — CLICK TO ADD</div>' +
      suggestions.map(s => `
        <div class="suggestion-item"
          data-title="${escapeAttr(s.title)}"
          data-type="${escapeAttr(s.type || 'concept')}"
          data-content="${escapeAttr(s.content || '')}"
          data-rel="${escapeAttr(s.relation || '')}">
          <div class="suggestion-title">${escapeHtml(s.title)}</div>
          <div class="suggestion-type">${escapeHtml((s.type || 'concept').toUpperCase())} — <span style="color:var(--text-dim)">${escapeHtml(s.relation || '')}</span></div>
          <div class="suggestion-rel">${escapeHtml(s.content || '')}</div>
        </div>`).join('');

    div.querySelectorAll('.suggestion-item').forEach(item => {
      item.addEventListener('click', async () => {
        const node = await createNode(item.dataset.title, item.dataset.content, item.dataset.type, []);
        const sel  = Universe.getSelectedNode();
        if (sel && item.dataset.rel) await createEdge(sel.id, node.id, item.dataset.rel);
        item.style.opacity = '0.35';
        item.style.pointerEvents = 'none';
        Universe.showToast('ADDED: ' + item.dataset.title);
      });
    });

    document.getElementById('chat-messages').appendChild(div);
    document.getElementById('chat-messages').scrollTop = 9999;
  }

  // ── Memory Panel ───────────────────────────────────────
  async function openMemoryPanel() {
    document.getElementById('memory-panel').classList.remove('hidden');
    document.getElementById('detail-panel').classList.add('hidden');
    document.getElementById('search-panel').classList.add('hidden');
    document.getElementById('chat-panel').classList.add('hidden');
    document.getElementById('chat-toggle').classList.remove('hidden');
    await loadMemories();
  }

  async function loadMemories() {
    const res  = await fetch('/api/memory');
    const mems = await res.json();
    document.getElementById('mem-count').textContent = mems.length + ' MEM';
    document.getElementById('memory-list').innerHTML = mems.map(m => `
      <div class="memory-item">
        <div class="mem-content">
          <div class="mem-key">${escapeHtml(m.key)}</div>
          <div class="mem-val">${escapeHtml(m.value)}</div>
          <span class="mem-cat">${escapeHtml(m.category)}</span>
        </div>
        <button class="mem-del" data-id="${m.id}" title="Delete memory">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>`).join('');

    document.getElementById('memory-list').querySelectorAll('.mem-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        await fetch('/api/memory/' + btn.dataset.id, { method: 'DELETE' });
        loadMemories();
        Universe.showToast('MEMORY DELETED');
      });
    });
  }

  // ── Search Panel ───────────────────────────────────────
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
    results.innerHTML = '<div style="color:var(--text-dim);font-family:var(--font-mono);font-size:10px;padding:12px;letter-spacing:2px">SEARCHING...</div>';

    try {
      const res  = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await res.json();

      if (data.error) {
        results.innerHTML = '<div style="color:var(--orange);font-size:11px;padding:12px">' + escapeHtml(data.error) + '</div>';
        return;
      }
      if (!data.results || data.results.length === 0) {
        results.innerHTML = '<div style="color:var(--text-dim);font-size:11px;padding:12px">No results found.</div>';
        return;
      }

      results.innerHTML = data.results.map(r => `
        <div class="search-result">
          <div class="sr-title">${escapeHtml(r.title)}</div>
          <div class="sr-snippet">${escapeHtml(r.snippet)}</div>
          <div class="sr-link">${escapeHtml(r.link)}</div>
          <div class="sr-actions">
            <button class="sr-btn" data-title="${escapeAttr(r.title)}" data-content="${escapeAttr(r.snippet)}" data-action="add">
              <svg width="9" height="9" viewBox="0 0 9 9" fill="none"><path d="M4.5 1v7M1 4.5h7" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
              ADD NODE
            </button>
            <a href="${r.link}" target="_blank" rel="noopener" style="text-decoration:none">
              <button class="sr-btn">
                <svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M4 2H2a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V6M6 1h3m0 0v3M9 1L4.5 5.5" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" stroke-linejoin="round"/></svg>
                OPEN
              </button>
            </a>
          </div>
        </div>`).join('');

      results.querySelectorAll('[data-action="add"]').forEach(btn => {
        btn.addEventListener('click', async () => {
          await createNode(btn.dataset.title, btn.dataset.content, 'research', [query]);
          btn.innerHTML = '<svg width="9" height="9" viewBox="0 0 10 10" fill="none"><path d="M1.5 5l3 3 4-5" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg> ADDED';
          btn.style.color = 'var(--green)';
          btn.disabled = true;
        });
      });
    } catch(e) {
      results.innerHTML = '<div style="color:var(--orange);font-size:11px;padding:12px">Search failed. Check API key.</div>';
    }
  }

  // ── AI Expand ──────────────────────────────────────────
  async function expandNode(node) {
    const resultEl = document.getElementById('dp-ai-result');
    resultEl.classList.remove('hidden');
    resultEl.innerHTML = '<div style="color:var(--green);font-family:var(--font-mono);font-size:10px;letter-spacing:2px">EXPANDING NODE...</div>';

    try {
      const res  = await fetch('/api/expand', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ node })
      });
      const data = await res.json();

      if (!data.suggestions || data.suggestions.length === 0) {
        resultEl.innerHTML = '<div style="color:var(--orange);font-size:11px">No suggestions. Check Groq API key.</div>';
        return;
      }

      resultEl.innerHTML =
        '<div style="color:var(--green);font-family:var(--font-mono);font-size:9px;letter-spacing:2px;margin-bottom:8px">CLICK TO ADD CONNECTED NODES</div>' +
        data.suggestions.map(s => `
          <div class="suggestion-item"
            data-title="${escapeAttr(s.title)}"
            data-type="${escapeAttr(s.type || 'concept')}"
            data-content="${escapeAttr(s.content || '')}"
            data-rel="${escapeAttr(s.relation || '')}">
            <div class="suggestion-title">${escapeHtml(s.title)}</div>
            <div class="suggestion-type">${escapeHtml((s.type || 'concept').toUpperCase())} — <span style="color:var(--text-dim)">${escapeHtml(s.relation || '')}</span></div>
            <div class="suggestion-rel">${escapeHtml(s.content || '')}</div>
          </div>`).join('');

      resultEl.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', async () => {
          const newNode = await createNode(item.dataset.title, item.dataset.content, item.dataset.type, []);
          await createEdge(node.id, newNode.id, item.dataset.rel || 'related to');
          item.style.opacity = '0.35';
          item.style.pointerEvents = 'none';
          Universe.showToast('EXPANDED: ' + item.dataset.title);
        });
      });
    } catch(e) {
      resultEl.innerHTML = '<div style="color:var(--orange);font-size:11px">Expand failed.</div>';
    }
  }

  // ── Auto-Connect ───────────────────────────────────────
  async function autoConnect() {
    Universe.showToast('AI ANALYZING CONNECTIONS...');
    try {
      const res  = await fetch('/api/autoconnect', { method: 'POST' });
      const data = await res.json();

      if (!data.connections || data.connections.length === 0) {
        Universe.showToast('No new connections found');
        return;
      }

      let added = 0;
      for (const c of data.connections) {
        const exists = allEdges.find(e =>
          (e.source === c.source && e.target === c.target) ||
          (e.source === c.target && e.target === c.source));
        if (!exists) {
          await createEdge(c.source, c.target, c.label, c.strength);
          added++;
        }
      }
      Universe.showToast(added + ' CONNECTIONS MAPPED');
    } catch(e) {
      Universe.showToast('AUTO-LINK ERROR');
    }
  }

  // ── Utility ────────────────────────────────────────────
  function escapeHtml(s) {
    return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }
  function escapeAttr(s) {
    return String(s || '').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
  }

  // ── Event Bindings ─────────────────────────────────────
  function bindUI() {
    // ── Command bar
    const cmdExec = () => executeCommand(document.getElementById('cmd-bar').value);
    document.getElementById('cmd-exec').addEventListener('click', cmdExec);
    document.getElementById('cmd-bar').addEventListener('keydown', e => {
      if (e.key === 'Enter') cmdExec();
    });

    // ── Top bar buttons
    document.getElementById('btn-add-node').addEventListener('click', () => openAddModal());
    document.getElementById('btn-autoconnect').addEventListener('click', autoConnect);
    document.getElementById('btn-memory').addEventListener('click', openMemoryPanel);
    document.getElementById('btn-center').addEventListener('click', () => Universe.centerView());
    document.getElementById('btn-connect-mode').addEventListener('click', () => {
      Universe.setConnectMode(true);
      Universe.showToast('CONNECT MODE — click source node');
    });

    // ── Filters
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Universe.setFilter(btn.dataset.type);
      });
    });

    // ── Detail panel
    document.getElementById('dp-close').addEventListener('click', hideDetailPanel);
    document.getElementById('dp-save').addEventListener('click', async () => {
      if (!selectedNodeId) return;
      const title   = document.getElementById('dp-title').textContent.trim();
      const content = document.getElementById('dp-content').textContent.trim();
      await fetch('/api/nodes/' + selectedNodeId, {
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
      if (selectedNodeId && confirm('Delete this node and all its connections?')) deleteNode(selectedNodeId);
    });

    // ── Add modal
    document.getElementById('modal-cancel').addEventListener('click', () => {
      document.getElementById('add-modal').classList.add('hidden');
      pendingPos = null;
    });
    document.getElementById('modal-create').addEventListener('click', async () => {
      const title = document.getElementById('new-title').value.trim();
      if (!title) { document.getElementById('new-title').focus(); return; }
      const content = document.getElementById('new-content').value.trim();
      const type    = document.getElementById('new-type').value;
      const tags    = document.getElementById('new-tags').value.split(',').map(t => t.trim()).filter(Boolean);
      const pos     = pendingPos || Universe.randomPosition();
      await createNode(title, content, type, tags, pos.x, pos.y);
      document.getElementById('add-modal').classList.add('hidden');
      pendingPos = null;
    });
    document.getElementById('new-title').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('modal-create').click();
    });

    // ── Chat
    document.getElementById('chat-toggle').addEventListener('click', () => openChat());
    document.getElementById('chat-close').addEventListener('click', () => {
      document.getElementById('chat-panel').classList.add('hidden');
      document.getElementById('chat-toggle').classList.remove('hidden');
    });
    document.getElementById('chat-send').addEventListener('click', sendChat);
    document.getElementById('chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') sendChat();
    });

    // ── Memory
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
      await loadMemories();
      Universe.showToast('MEMORY STORED');
    });
    document.getElementById('mem-key').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('mem-add-btn').click();
    });

    // ── Search
    document.getElementById('search-close').addEventListener('click', () => {
      document.getElementById('search-panel').classList.add('hidden');
    });
    document.getElementById('search-exec').addEventListener('click', () => {
      doSearch(document.getElementById('search-query').value.trim());
    });
    document.getElementById('search-query').addEventListener('keydown', e => {
      if (e.key === 'Enter') doSearch(e.target.value.trim());
    });

    // ── Global keyboard shortcuts
    document.addEventListener('keydown', e => {
      // ignore if typing in an input/textarea/contenteditable
      const tag = e.target.tagName;
      const isInput = tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable;

      if (e.key === 'Escape') {
        document.getElementById('add-modal').classList.add('hidden');
        hideDetailPanel();
        Universe.setConnectMode(false);
        pendingPos = null;
      }
      if (!isInput && (e.key === 'n' || e.key === 'N') && !e.ctrlKey && !e.metaKey) {
        openAddModal();
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'n') {
        e.preventDefault(); openAddModal();
      }
      if (!isInput && (e.key === 'c' || e.key === 'C') && e.shiftKey) {
        Universe.setConnectMode(true);
        Universe.showToast('CONNECT MODE — click source node');
      }
      if (!isInput && (e.key === 'e' || e.key === 'E') && !e.ctrlKey) {
        exportUniverse();
      }
      if (!isInput && e.key === ' ') {
        e.preventDefault();
        Universe.centerView();
      }
    });

    // ── Close modal on overlay click
    document.getElementById('add-modal').addEventListener('click', e => {
      if (e.target === document.getElementById('add-modal')) {
        document.getElementById('add-modal').classList.add('hidden');
        pendingPos = null;
      }
    });
  }

  // ── Start ──────────────────────────────────────────────
  function start() {
    bindUI();
    boot();
  }

  return { start };
})();

document.addEventListener('DOMContentLoaded', App.start);