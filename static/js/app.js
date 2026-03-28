// ═══════════════════════════════════════════════════════
//   MAX — App Controller  v3.0
//   UI, API calls, state management
// ═══════════════════════════════════════════════════════

const App = (() => {
  let allNodes = [], allEdges = [];
  let selectedNodeId = null;
  let chatHistory = [];
  let researchChatHistory = [];
  let pendingPos = null;
  let currentPersonality = 'max';
  let pendingImageData = null;
  let pendingFileText = null;
  let pendingFileMime = null;   // track actual mime type
  let activeResearchTab = 'blog'; // 'blog' | 'chat'
  let chatContextMode = 'free';  // 'free' | 'node'

  // ── Boot Sequence ──────────────────────────────────────
  const BOOT_LOGS = [
    "Initializing MAX core systems...",
    "Loading knowledge universe...",
    "Calibrating neural pathways...",
    "Connecting to Groq AI engine...",
    "Mapping knowledge clusters...",
    "Spatial rendering engine online...",
    "Memory banks synchronized...",
    "Timetable module online...",
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
    }, 200);
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
      loadPersonalities();
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
        // NO prompt popup — just connect immediately with default label
        await createEdge(src.id, tgt.id, 'related to');
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

  async function unlinkEdge(edgeId, sourceId, targetId) {
    await fetch('/api/edges/' + edgeId, { method: 'DELETE' });
    allEdges = allEdges.filter(e => e.id !== edgeId);
    Universe.removeEdge(edgeId);
    updateStats();
    // Refresh detail panel connections
    const node = allNodes.find(n => n.id === selectedNodeId);
    if (node) showDetailPanel(node);
    Universe.showToast('LINK REMOVED');
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

  // ── Markdown Renderer ──────────────────────────────────
  function renderMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);

    // Code blocks
    html = html.replace(/```(\w*)\n?([\s\S]*?)```/g, (_, lang, code) => {
      return `<pre class="md-code-block"><code class="language-${lang || 'text'}">${code.trim()}</code></pre>`;
    });

    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code class="md-inline-code">$1</code>');

    // Headers
    html = html.replace(/^### (.+)$/gm, '<h3 class="md-h3">$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2 class="md-h2">$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1 class="md-h1">$1</h1>');

    // Bold
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong class="md-bold">$1</strong>');

    // Italic
    html = html.replace(/\*(.+?)\*/g, '<em class="md-italic">$1</em>');

    // Unordered lists
    html = html.replace(/^[\*\-] (.+)$/gm, '<li class="md-li">$1</li>');
    html = html.replace(/(<li class="md-li">.*<\/li>\n?)+/g, m => `<ul class="md-ul">${m}</ul>`);

    // Ordered lists
    html = html.replace(/^\d+\. (.+)$/gm, '<li class="md-oli">$1</li>');
    html = html.replace(/(<li class="md-oli">.*<\/li>\n?)+/g, m => `<ol class="md-ol">${m}</ol>`);

    // Blockquotes
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote class="md-quote">$1</blockquote>');

    // Horizontal rule
    html = html.replace(/^---$/gm, '<hr class="md-hr">');

    // Paragraphs (double newlines)
    html = html.replace(/\n\n/g, '</p><p class="md-p">');
    html = '<p class="md-p">' + html + '</p>';

    // Single newlines within paragraphs
    html = html.replace(/\n/g, '<br>');

    // Clean up empty paragraphs
    html = html.replace(/<p class="md-p"><\/p>/g, '');
    html = html.replace(/<p class="md-p">(<h[123]|<ul|<ol|<pre|<hr|<blockquote)/g, '$1');
    html = html.replace(/(<\/h[123]>|<\/ul>|<\/ol>|<\/pre>|<\/blockquote>|<hr[^>]*>)<\/p>/g, '$1');

    return html;
  }

  // ── Detail Panel ───────────────────────────────────────
  function showDetailPanel(node) {
    selectedNodeId = node.id;
    const panel    = document.getElementById('detail-panel');

    const badge = document.getElementById('dp-type');
    badge.lastChild.textContent = ' ' + node.type.toUpperCase();
    badge.style.color       = TYPE_COLORS[node.type] || '#00c8ff';
    badge.style.borderColor = (TYPE_COLORS[node.type] || '#00c8ff') + '44';

    document.getElementById('dp-title').textContent   = node.title;
    document.getElementById('dp-content').textContent = node.content || '';

    const tags = Array.isArray(node.tags) ? node.tags : [];
    document.getElementById('dp-tags').innerHTML =
      tags.map(t => '<span class="tag">' + escapeHtml(t) + '</span>').join('');

    // connections with unlink button
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
        <div class="conn-item" data-id="${c.node.id}" data-edge-id="${c.edgeId}">
          <span style="display:flex;align-items:center;gap:6px;flex:1;overflow:hidden">
            <span style="width:5px;height:5px;border-radius:50%;background:${c.node.color};flex-shrink:0"></span>
            <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${escapeHtml(c.node.title)}</span>
          </span>
          <span style="display:flex;align-items:center;gap:4px;flex-shrink:0">
            <span class="conn-label">${escapeHtml(c.label || '')}</span>
            <button class="conn-unlink" data-edge-id="${c.edgeId}" title="Remove link">
              <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
                <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </span>
        </div>`).join('');

    connEl.querySelectorAll('.conn-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.conn-unlink')) return;
        const n = allNodes.find(n => n.id === item.dataset.id);
        if (n) showDetailPanel(n);
      });
    });

    connEl.querySelectorAll('.conn-unlink').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const edgeId = btn.dataset.edgeId;
        const edge = allEdges.find(e => e.id === edgeId);
        if (edge) unlinkEdge(edgeId, edge.source, edge.target);
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
    } else if (cmd === 'timetable' || cmd === 'schedule' || cmd === 'day') {
      openTimetable();
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

  // ── Personalities ──────────────────────────────────────
  async function loadPersonalities() {
    try {
      const res = await fetch('/api/personalities');
      const list = await res.json();
      const sel = document.getElementById('personality-select');
      if (sel) {
        sel.innerHTML = list.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
        sel.value = currentPersonality;
        sel.addEventListener('change', () => {
          currentPersonality = sel.value;
          const label = sel.options[sel.selectedIndex].text;
          Universe.showToast('PERSONALITY: ' + label.toUpperCase());
          // Update the greeting message prefix style
        });
      }
    } catch(e) {
      // Keep default option if API fails
    }
  }

  // ── Chat ───────────────────────────────────────────────
  function openChat(prefill = '') {
    document.getElementById('chat-panel').classList.remove('hidden');
    document.getElementById('chat-toggle').classList.add('hidden');
    document.getElementById('memory-panel').classList.add('hidden');
    document.getElementById('search-panel').classList.add('hidden');
    document.getElementById('timetable-panel').classList.add('hidden');
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
    if (!msg && !pendingImageData && !pendingFileText) return;
    const displayMsg = msg || (pendingImageData ? '[Image attached]' : '[PDF attached]');
    input.value = '';

    appendChatMsg('user', displayMsg, false, pendingImageData);
    chatHistory.push({ role: 'user', content: displayMsg });

    // Determine node context based on mode
    const selectedNode = (chatContextMode === 'node') ? Universe.getSelectedNode() : null;
    const thinkEl      = appendChatMsg('assistant', 'Processing...');
    thinkEl.style.opacity = '0.45';

    // Capture and clear attachments
    const imgToSend  = pendingImageData;
    const fileToSend = pendingFileText;
    const mimeToSend = pendingFileMime;
    clearAttachments();

    try {
      const res  = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: msg,
          history: chatHistory.slice(-8),
          node_context: selectedNode,
          personality: currentPersonality,
          image: imgToSend,
          image_mime: mimeToSend,
          file_text: fileToSend
        })
      });
      const data = await res.json();
      thinkEl.remove();

      const replyEl = appendChatMsg('assistant', data.reply, true);
      chatHistory.push({ role: 'assistant', content: data.reply });

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

  function appendChatMsg(role, content, useMarkdown = false, imageData = null) {
    const messages = document.getElementById('chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg ' + role;
    const prefix = role === 'assistant' ? currentPersonalityPrefix() : 'YOU //';
    const prefixEl = `<span class="msg-prefix">${prefix}</span>`;

    let body = '';
    if (imageData && role === 'user') {
      body = `<img src="data:image/jpeg;base64,${imageData}" style="max-width:120px;max-height:80px;border-radius:3px;display:block;margin-bottom:4px;border:1px solid var(--panel-border)">`;
    }
    if (useMarkdown && role === 'assistant') {
      body += '<div class="md-content">' + renderMarkdown(content) + '</div>';
    } else {
      body += escapeHtml(content);
    }
    div.innerHTML = prefixEl + body;
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
  }

  function currentPersonalityPrefix() {
    const sel = document.getElementById('personality-select');
    if (!sel) return 'MAX //';
    const label = sel.options[sel.selectedIndex]?.text || 'MAX';
    // Shorten to first word
    return label.split(' ')[0].toUpperCase() + ' //';
  }

  // ── Attachment handling ────────────────────────────────
  function clearAttachments() {
    pendingImageData = null;
    pendingFileText = null;
    pendingFileMime = null;
    const preview = document.getElementById('attachment-preview');
    if (preview) preview.innerHTML = '';
  }

  function handleFileAttachment(file) {
    if (!file) return;
    const preview = document.getElementById('attachment-preview');

    if (file.type.startsWith('image/')) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const b64 = e.target.result.split(',')[1];
        pendingImageData = b64;
        pendingFileMime = file.type || 'image/jpeg';
        pendingFileText = null;
        if (preview) preview.innerHTML = `
          <div class="attach-chip">
            <img src="${e.target.result}" style="height:28px;width:28px;object-fit:cover;border-radius:2px;">
            <span>${escapeHtml(file.name)}</span>
            <span class="attach-type-badge">IMAGE</span>
            <button class="attach-remove" onclick="App._clearAttachments()">×</button>
          </div>`;
        Universe.showToast('IMAGE ATTACHED — ' + file.type.split('/')[1].toUpperCase());
      };
      reader.readAsDataURL(file);
    } else if (file.type === 'application/pdf') {
      const reader = new FileReader();
      reader.onload = async (e) => {
        pendingImageData = null;
        pendingFileMime = 'application/pdf';
        let extractedText = '';
        try {
          const arr = new Uint8Array(e.target.result);
          if (window.pdfjsLib) {
            const pdf = await pdfjsLib.getDocument({ data: arr }).promise;
            const numPages = Math.min(pdf.numPages, 15);
            for (let i = 1; i <= numPages; i++) {
              const page = await pdf.getPage(i);
              const content = await page.getTextContent();
              const pageText = content.items.map(s => s.str).join(' ');
              extractedText += `\n--- Page ${i} ---\n${pageText}`;
            }
            pendingFileText = extractedText.trim().slice(0, 6000);
            Universe.showToast(`PDF LOADED — ${pdf.numPages} pages extracted`);
          } else {
            pendingFileText = `[PDF attached: ${file.name} — PDF.js not loaded, content unavailable]`;
            Universe.showToast('PDF ATTACHED (no text extraction)');
          }
        } catch(err) {
          pendingFileText = `[PDF: ${file.name} — text extraction failed: ${err.message}]`;
          Universe.showToast('PDF ATTACHED (extraction error)');
        }
        if (preview) preview.innerHTML = `
          <div class="attach-chip">
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><rect x="2" y="1" width="10" height="12" rx="1" stroke="var(--orange)" stroke-width="1.2"/><path d="M4 5h6M4 7h6M4 9h4" stroke="var(--orange)" stroke-width="1" stroke-linecap="round"/></svg>
            <span>${escapeHtml(file.name)}</span>
            <span class="attach-type-badge" style="background:rgba(255,112,64,0.15);color:var(--orange)">PDF</span>
            <span style="font-size:9px;color:var(--text-dim)">${pendingFileText ? Math.round(pendingFileText.length/100)/10+'k chars' : 'no text'}</span>
            <button class="attach-remove" onclick="App._clearAttachments()">×</button>
          </div>`;
      };
      reader.readAsArrayBuffer(file);
    } else {
      Universe.showToast('UNSUPPORTED — use image or PDF');
    }
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
    document.getElementById('timetable-panel').classList.add('hidden');
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

  // ── Search / Research Panel ────────────────────────────
  async function openSearchPanel(query = '', node = null) {
    const panel = document.getElementById('search-panel');
    panel.classList.remove('hidden');
    document.getElementById('detail-panel').classList.add('hidden');
    document.getElementById('memory-panel').classList.add('hidden');
    document.getElementById('chat-panel').classList.add('hidden');
    document.getElementById('timetable-panel').classList.add('hidden');
    document.getElementById('chat-toggle').classList.remove('hidden');

    // Set node context for research chat
    const nodeTitle = node ? node.title : (selectedNodeId ? (allNodes.find(n=>n.id===selectedNodeId)||{}).title||'' : '');
    document.getElementById('search-panel').dataset.nodeTitle = nodeTitle;

    // Show tab toggle if came from node
    const tabBar = document.getElementById('research-tab-bar');
    tabBar.style.display = 'flex';

    if (query) {
      document.getElementById('search-query').value = query;
      switchResearchTab('blog');
      doSearch(query);
    } else {
      switchResearchTab('blog');
    }
  }

  function switchResearchTab(tab) {
    activeResearchTab = tab;
    document.getElementById('tab-blog').classList.toggle('active', tab === 'blog');
    document.getElementById('tab-chat').classList.toggle('active', tab === 'chat');
    document.getElementById('research-blog-view').classList.toggle('hidden', tab !== 'blog');
    document.getElementById('research-chat-view').classList.toggle('hidden', tab !== 'chat');
  }

  async function doSearch(query) {
    if (!query) return;
    const results = document.getElementById('search-results');
    results.innerHTML = '<div class="search-loading">SEARCHING THE WEB...</div>';

    try {
      const res  = await fetch('/api/search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query })
      });
      const data = await res.json();

      if (data.error) {
        results.innerHTML = `<div style="color:var(--orange);font-size:11px;padding:12px">${escapeHtml(data.error)}</div>`;
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

  // ── Research Chat ──────────────────────────────────────
  async function sendResearchChat() {
    const input = document.getElementById('research-chat-input');
    const msg = input.value.trim();
    if (!msg) return;
    input.value = '';

    const nodeTitle = document.getElementById('search-panel').dataset.nodeTitle || '';
    appendResearchMsg('user', msg);
    researchChatHistory.push({ role: 'user', content: msg });

    const thinkEl = appendResearchMsg('assistant', 'Searching & thinking...');
    thinkEl.style.opacity = '0.5';

    try {
      const res = await fetch('/api/research-chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: msg, history: researchChatHistory.slice(-6), node_title: nodeTitle })
      });
      const data = await res.json();
      thinkEl.remove();
      const el = appendResearchMsg('assistant', data.reply, true);
      researchChatHistory.push({ role: 'assistant', content: data.reply });

      // Show sources if any
      if (data.sources && data.sources.length > 0) {
        const srcDiv = document.createElement('div');
        srcDiv.className = 'research-sources';
        srcDiv.innerHTML = '<div class="sources-label">SOURCES</div>' +
          data.sources.slice(0,3).map(s => `
            <a href="${s.link}" target="_blank" rel="noopener" class="source-link">
              <svg width="8" height="8" viewBox="0 0 10 10" fill="none"><path d="M4 2H2a1 1 0 00-1 1v5a1 1 0 001 1h5a1 1 0 001-1V6M6 1h3m0 0v3M9 1L4.5 5.5" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"/></svg>
              ${escapeHtml(s.title.slice(0,50))}
            </a>`).join('');
        document.getElementById('research-chat-messages').appendChild(srcDiv);
      }
      document.getElementById('research-chat-messages').scrollTop = 9999;
    } catch(e) {
      thinkEl.remove();
      appendResearchMsg('assistant', 'Research error. Check connection.');
    }
  }

  function appendResearchMsg(role, content, useMarkdown = false) {
    const messages = document.getElementById('research-chat-messages');
    const div = document.createElement('div');
    div.className = 'chat-msg ' + role;
    const prefix = role === 'assistant' ? 'RESEARCH //' : 'YOU //';
    if (useMarkdown) {
      div.innerHTML = `<span class="msg-prefix">${prefix}</span><div class="md-content">${renderMarkdown(content)}</div>`;
    } else {
      div.innerHTML = `<span class="msg-prefix">${prefix}</span>${escapeHtml(content)}`;
    }
    messages.appendChild(div);
    messages.scrollTop = messages.scrollHeight;
    return div;
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

  // ── Timetable / Day Manager ────────────────────────────
  let timetableDate = new Date().toISOString().split('T')[0];

  function openTimetable() {
    document.getElementById('timetable-panel').classList.remove('hidden');
    document.getElementById('chat-panel').classList.add('hidden');
    document.getElementById('memory-panel').classList.add('hidden');
    document.getElementById('search-panel').classList.add('hidden');
    document.getElementById('detail-panel').classList.add('hidden');
    document.getElementById('chat-toggle').classList.remove('hidden');
    // Always reset to today when opening
    timetableDate = new Date().toISOString().split('T')[0];
    renderTimetableDate();
    loadTasks();
    loadStreaks();
  }

  function renderTimetableDate() {
    const el = document.getElementById('tt-date-display');
    if (el) {
      // Use noon to avoid timezone-related off-by-one
      const d = new Date(timetableDate + 'T12:00:00');
      const today = new Date().toISOString().split('T')[0];
      if (timetableDate === today) {
        el.textContent = 'TODAY — ' + d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric' });
      } else {
        el.textContent = d.toLocaleDateString('en-US', { weekday:'long', month:'long', day:'numeric', year:'numeric' });
      }
    }
    const inp = document.getElementById('tt-date-input');
    if (inp) inp.value = timetableDate;
  }

  function safeAddDays(dateStr, delta) {
    const d = new Date(dateStr + 'T12:00:00');
    d.setDate(d.getDate() + delta);
    return d.toISOString().split('T')[0];
  }

  async function loadTasks() {
    try {
      const res = await fetch('/api/tasks?date=' + timetableDate);
      const tasks = await res.json();
      renderTasks(tasks);
    } catch(e) {}
  }

  function renderTasks(tasks) {
    const el = document.getElementById('task-list');
    if (!el) return;
    if (tasks.length === 0) {
      el.innerHTML = '<div class="tt-empty">No tasks for this day. Add one or use AI planning.</div>';
      return;
    }
    const PRIORITY_COLORS = { high: 'var(--orange)', medium: 'var(--accent)', low: 'var(--text-dim)' };
    const CAT_ICONS = {
      work: '💼', learning: '📚', health: '🏃', personal: '✦', creative: '🎨', general: '●'
    };
    el.innerHTML = tasks.map(t => `
      <div class="task-item ${t.completed ? 'completed' : ''}" data-id="${t.id}">
        <div class="task-check" data-id="${t.id}">
          ${t.completed
            ? '<svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M2 6l3 3 5-6" stroke="var(--green)" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>'
            : '<div style="width:12px;height:12px;border:1px solid var(--panel-border);border-radius:2px;"></div>'
          }
        </div>
        <div class="task-content">
          <div class="task-title">${escapeHtml(t.title)}</div>
          ${t.description ? `<div class="task-desc">${escapeHtml(t.description)}</div>` : ''}
          <div class="task-meta">
            ${t.start_time ? `<span class="task-time">${t.start_time}${t.end_time ? ' – ' + t.end_time : ''}</span>` : ''}
            <span class="task-cat" style="color:${PRIORITY_COLORS[t.priority]||'var(--text-dim)'}">
              ${CAT_ICONS[t.category]||'●'} ${t.category}
            </span>
            <span class="task-priority" style="color:${PRIORITY_COLORS[t.priority]}">${t.priority}</span>
          </div>
        </div>
        <button class="task-del" data-id="${t.id}" title="Delete task">
          <svg width="9" height="9" viewBox="0 0 10 10" fill="none">
            <path d="M1.5 1.5l7 7M8.5 1.5l-7 7" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
          </svg>
        </button>
      </div>`).join('');

    el.querySelectorAll('.task-check').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.id;
        // Always read the current completed state from the DOM element
        const taskItem = btn.closest('.task-item');
        const isCompleted = taskItem.classList.contains('completed');
        await fetch('/api/tasks/' + id, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ completed: !isCompleted })
        });
        loadTasks();
      });
    });

    el.querySelectorAll('.task-del').forEach(btn => {
      btn.addEventListener('click', async () => {
        await fetch('/api/tasks/' + btn.dataset.id, { method: 'DELETE' });
        loadTasks();
        Universe.showToast('TASK DELETED');
      });
    });
  }

  async function loadStreaks() {
    try {
      const res = await fetch('/api/streaks');
      const streaks = await res.json();
      renderCalendar(streaks);
      renderStreakCount(streaks);
    } catch(e) {}
  }

  function renderStreakCount(streaks) {
    const el = document.getElementById('streak-count');
    if (!el) return;
    // Count consecutive days up to today
    const today = new Date().toISOString().split('T')[0];
    const dates = new Set(streaks.map(s => s.date));
    let count = 0;
    let d = new Date();
    while (true) {
      const ds = d.toISOString().split('T')[0];
      if (dates.has(ds)) { count++; d.setDate(d.getDate()-1); }
      else break;
    }
    el.textContent = count + ' DAY STREAK 🔥';
  }

  function renderCalendar(streaks) {
    const el = document.getElementById('streak-calendar');
    if (!el) return;
    const checkedDates = new Set(streaks.map(s => s.date));
    const today = new Date();
    const year = today.getFullYear();
    const month = today.getMonth();
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthName = today.toLocaleString('default', { month: 'long', year: 'numeric' });

    let html = `<div class="cal-month">${monthName}</div><div class="cal-grid">`;
    const days = ['S','M','T','W','T','F','S'];
    html += days.map(d => `<div class="cal-day-label">${d}</div>`).join('');
    for (let i = 0; i < firstDay; i++) html += '<div></div>';
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${String(month+1).padStart(2,'0')}-${String(d).padStart(2,'0')}`;
      const isToday = d === today.getDate();
      const checked = checkedDates.has(dateStr);
      html += `<div class="cal-day ${checked ? 'checked' : ''} ${isToday ? 'today' : ''}" data-date="${dateStr}" title="${dateStr}">${d}</div>`;
    }
    html += '</div>';
    el.innerHTML = html;

    // Click to checkin
    el.querySelectorAll('.cal-day').forEach(day => {
      day.addEventListener('click', async () => {
        const d = day.dataset.date;
        if (d === new Date().toISOString().split('T')[0]) {
          await fetch('/api/streaks/checkin', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ note: '' })
          });
          loadStreaks();
          Universe.showToast('CHECKED IN ✓');
        }
      });
    });
  }

  async function aiPlanDay() {
    const desc = document.getElementById('tt-ai-desc').value.trim();
    if (!desc) { Universe.showToast('DESCRIBE YOUR DAY FIRST'); return; }

    const btn = document.getElementById('tt-ai-plan-btn');
    const origHTML = btn.innerHTML;
    btn.innerHTML = '<span style="opacity:0.7">PLANNING...</span>';
    btn.disabled = true;

    try {
      const res = await fetch('/api/plan-day', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ description: desc, date: timetableDate })
      });
      const data = await res.json();
      if (data.tasks && data.tasks.length > 0) {
        Universe.showToast(data.tasks.length + ' TASKS PLANNED BY AI');
        document.getElementById('tt-ai-desc').value = '';
        document.getElementById('tt-add-form').classList.add('hidden');
        await loadTasks();
      } else {
        const errMsg = data.error ? data.error.slice(0, 60) : 'No tasks returned';
        Universe.showToast('AI PLANNING FAILED: ' + errMsg);
      }
    } catch(e) {
      Universe.showToast('PLAN ERROR: ' + e.message.slice(0, 40));
    } finally {
      btn.innerHTML = origHTML;
      btn.disabled = false;
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
    // Command bar
    const cmdExec = () => executeCommand(document.getElementById('cmd-bar').value);
    document.getElementById('cmd-exec').addEventListener('click', cmdExec);
    document.getElementById('cmd-bar').addEventListener('keydown', e => {
      if (e.key === 'Enter') cmdExec();
    });

    // Top bar buttons
    document.getElementById('btn-add-node').addEventListener('click', () => openAddModal());
    document.getElementById('btn-autoconnect').addEventListener('click', autoConnect);
    document.getElementById('btn-memory').addEventListener('click', openMemoryPanel);
    document.getElementById('btn-center').addEventListener('click', () => Universe.centerView());
    document.getElementById('btn-timetable').addEventListener('click', openTimetable);
    document.getElementById('btn-connect-mode').addEventListener('click', () => {
      Universe.setConnectMode(true);
      Universe.showToast('CONNECT MODE — click source node');
    });

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
      if (node) openSearchPanel(node.title, node);
    });
    document.getElementById('dp-delete').addEventListener('click', () => {
      if (selectedNodeId && confirm('Delete this node and all its connections?')) deleteNode(selectedNodeId);
    });

    // Add modal
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

    // Chat
    document.getElementById('chat-toggle').addEventListener('click', () => openChat());
    document.getElementById('chat-close').addEventListener('click', () => {
      document.getElementById('chat-panel').classList.add('hidden');
      document.getElementById('chat-toggle').classList.remove('hidden');
    });
    document.getElementById('chat-send').addEventListener('click', sendChat);
    document.getElementById('chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter' && !e.shiftKey) sendChat();
    });

    // Clear chat button
    document.getElementById('chat-clear-btn').addEventListener('click', () => {
      chatHistory = [];
      clearAttachments();
      const messages = document.getElementById('chat-messages');
      messages.innerHTML = `<div class="chat-msg assistant">
        <span class="msg-prefix">MAX //</span>Memory cleared. Universe online. What do you want to explore?
      </div>`;
      Universe.showToast('CHAT CLEARED');
    });

    // Context mode toggle
    document.getElementById('chat-ctx-toggle').addEventListener('click', () => {
      chatContextMode = chatContextMode === 'free' ? 'node' : 'free';
      const btn = document.getElementById('chat-ctx-toggle');
      const indicator = document.getElementById('ctx-mode-label');
      if (chatContextMode === 'node') {
        btn.classList.add('active');
        if (indicator) indicator.textContent = 'NODE CTX';
        Universe.showToast('NODE CONTEXT MODE — select a node to focus');
      } else {
        btn.classList.remove('active');
        if (indicator) indicator.textContent = 'FREE CHAT';
        Universe.showToast('FREE CHAT MODE');
      }
    });

    // File attach in chat
    document.getElementById('chat-attach-btn').addEventListener('click', () => {
      document.getElementById('chat-file-input').click();
    });
    document.getElementById('chat-file-input').addEventListener('change', (e) => {
      if (e.target.files[0]) handleFileAttachment(e.target.files[0]);
      e.target.value = '';
    });

    // Drag-drop on chat panel
    const chatPanel = document.getElementById('chat-panel');
    chatPanel.addEventListener('dragover', e => { e.preventDefault(); chatPanel.classList.add('drag-over'); });
    chatPanel.addEventListener('dragleave', () => chatPanel.classList.remove('drag-over'));
    chatPanel.addEventListener('drop', e => {
      e.preventDefault();
      chatPanel.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleFileAttachment(file);
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
      await loadMemories();
      Universe.showToast('MEMORY STORED');
    });
    document.getElementById('mem-key').addEventListener('keydown', e => {
      if (e.key === 'Enter') document.getElementById('mem-add-btn').click();
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

    // Research tab switches
    document.getElementById('tab-blog').addEventListener('click', () => switchResearchTab('blog'));
    document.getElementById('tab-chat').addEventListener('click', () => {
      switchResearchTab('chat');
      document.getElementById('research-chat-input').focus();
    });

    // Research chat
    document.getElementById('research-chat-send').addEventListener('click', sendResearchChat);
    document.getElementById('research-chat-input').addEventListener('keydown', e => {
      if (e.key === 'Enter') sendResearchChat();
    });

    // Timetable
    document.getElementById('tt-close').addEventListener('click', () => {
      document.getElementById('timetable-panel').classList.add('hidden');
    });
    document.getElementById('tt-date-input').addEventListener('change', (e) => {
      timetableDate = e.target.value;
      renderTimetableDate();
      loadTasks();
    });
    document.getElementById('tt-prev-day').addEventListener('click', () => {
      timetableDate = safeAddDays(timetableDate, -1);
      renderTimetableDate();
      loadTasks();
    });
    document.getElementById('tt-next-day').addEventListener('click', () => {
      timetableDate = safeAddDays(timetableDate, 1);
      renderTimetableDate();
      loadTasks();
    });
    document.getElementById('tt-add-task-btn').addEventListener('click', () => {
      document.getElementById('tt-add-form').classList.toggle('hidden');
    });
    document.getElementById('tt-save-task').addEventListener('click', async () => {
      const title = document.getElementById('tt-task-title').value.trim();
      if (!title) {
        document.getElementById('tt-task-title').focus();
        Universe.showToast('TASK TITLE REQUIRED');
        return;
      }
      const payload = {
        title,
        description: document.getElementById('tt-task-desc').value.trim(),
        date: timetableDate,
        start_time: document.getElementById('tt-task-start').value,
        end_time: document.getElementById('tt-task-end').value,
        category: document.getElementById('tt-task-cat').value,
        priority: document.getElementById('tt-task-priority').value,
      };
      try {
        const res = await fetch('/api/tasks', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        if (!res.ok) throw new Error('Server error');
        // Clear all fields
        document.getElementById('tt-task-title').value = '';
        document.getElementById('tt-task-desc').value = '';
        document.getElementById('tt-task-start').value = '';
        document.getElementById('tt-task-end').value = '';
        document.getElementById('tt-task-cat').value = 'general';
        document.getElementById('tt-task-priority').value = 'medium';
        document.getElementById('tt-add-form').classList.add('hidden');
        await loadTasks();
        Universe.showToast('TASK ADDED');
      } catch(e) {
        Universe.showToast('SAVE FAILED: ' + e.message);
      }
    });
    document.getElementById('tt-ai-plan-btn').addEventListener('click', aiPlanDay);
    document.getElementById('tt-checkin-btn').addEventListener('click', async () => {
      const note = document.getElementById('tt-checkin-note').value.trim();
      try {
        const res = await fetch('/api/streaks/checkin', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ note })
        });
        const data = await res.json();
        document.getElementById('tt-checkin-note').value = '';
        await loadStreaks();
        const completed = data.tasks_completed || 0;
        Universe.showToast(`DAY CHECKED IN ✓ — ${completed} tasks completed`);
      } catch(e) {
        Universe.showToast('CHECK-IN FAILED');
      }
    });

    // Global keyboard shortcuts
    document.addEventListener('keydown', e => {
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

    // Close modal on overlay click
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

  return {
    start,
    _clearAttachments: clearAttachments
  };
})();

document.addEventListener('DOMContentLoaded', App.start);