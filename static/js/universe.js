// ═══════════════════════════════════════════════════════
//   MAX — Universe Canvas Engine  v2.0
//   Rendering, physics, interaction, minimap
// ═══════════════════════════════════════════════════════

const Universe = (() => {
  let canvas, ctx;
  let mmCanvas, mmCtx; // minimap
  let nodes = [], edges = [];
  let scale = 1, offsetX = 0, offsetY = 0;
  let isDragging = false, dragNode = null;
  let isPanning = false, panStart = null;
  let selectedNode = null;
  let connectMode = false, connectSource = null;
  let activeFilter = 'all';
  let stars = [];
  let animFrame = null;
  let onNodeSelect = null, onNodeDoubleClick = null, onCanvasDoubleClick = null, onConnect = null;

  const NODE_COLORS = {
    concept:  '#00c8ff',
    idea:     '#7fff3e',
    memory:   '#ff7040',
    topic:    '#c060ff',
    research: '#ffc840'
  };

  // SVG path data for node type icons (drawn on canvas)
  const NODE_ICONS = {
    // concept: diamond
    concept: (ctx, x, y, s) => {
      ctx.beginPath();
      ctx.moveTo(x, y - s);
      ctx.lineTo(x + s * 0.7, y);
      ctx.lineTo(x, y + s);
      ctx.lineTo(x - s * 0.7, y);
      ctx.closePath();
    },
    // idea: 6-point star / spark
    idea: (ctx, x, y, s) => {
      for (let i = 0; i < 6; i++) {
        const outer = i * Math.PI / 3 - Math.PI / 2;
        const inner = outer + Math.PI / 6;
        if (i === 0) ctx.moveTo(x + Math.cos(outer) * s, y + Math.sin(outer) * s);
        else ctx.lineTo(x + Math.cos(outer) * s, y + Math.sin(outer) * s);
        ctx.lineTo(x + Math.cos(inner) * s * 0.45, y + Math.sin(inner) * s * 0.45);
      }
      ctx.closePath();
    },
    // memory: concentric rings indicator
    memory: (ctx, x, y, s) => {
      ctx.arc(x, y, s, 0, Math.PI * 2);
    },
    // topic: hexagon
    topic: (ctx, x, y, s) => {
      ctx.beginPath();
      for (let i = 0; i < 6; i++) {
        const a = i * Math.PI / 3 - Math.PI / 6;
        if (i === 0) ctx.moveTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
        else ctx.lineTo(x + Math.cos(a) * s, y + Math.sin(a) * s);
      }
      ctx.closePath();
    },
    // research: crosshair / target
    research: (ctx, x, y, s) => {
      ctx.arc(x, y, s, 0, Math.PI * 2);
    }
  };

  const NODE_R = 26;

  // ── Init ──────────────────────────────────────────────
  function init(opts = {}) {
    canvas = document.getElementById('universe-canvas');
    ctx = canvas.getContext('2d');
    mmCanvas = document.getElementById('minimap-canvas');
    mmCtx = mmCanvas ? mmCanvas.getContext('2d') : null;

    onNodeSelect       = opts.onNodeSelect       || (() => {});
    onNodeDoubleClick  = opts.onNodeDoubleClick  || (() => {});
    onCanvasDoubleClick = opts.onCanvasDoubleClick || (() => {});
    onConnect          = opts.onConnect          || (() => {});

    resize();
    window.addEventListener('resize', resize);
    generateStars();
    bindEvents();
    loop();
  }

  function resize() {
    canvas.width  = window.innerWidth;
    canvas.height = window.innerHeight;
    if (mmCanvas) {
      mmCanvas.width  = mmCanvas.offsetWidth  * window.devicePixelRatio || 140;
      mmCanvas.height = mmCanvas.offsetHeight * window.devicePixelRatio || 90;
    }
  }

  function generateStars() {
    stars = [];
    for (let i = 0; i < 340; i++) {
      stars.push({
        x: Math.random() * 5000 - 2500,
        y: Math.random() * 5000 - 2500,
        r: Math.random() * 1.3,
        brightness: Math.random(),
        phase: Math.random() * Math.PI * 2,
        speed: 0.4 + Math.random() * 1.2
      });
    }
  }

  // ── Data ──────────────────────────────────────────────
  function setData(n, e) {
    nodes = n.map(nd => ({ ...nd, vx: 0, vy: 0 }));
    edges = e;
    if (nodes.length > 0) centerView();
  }

  function addNode(node)          { nodes.push({ ...node, vx: 0, vy: 0 }); }
  function updateNode(id, data)   { const n = nodes.find(n => n.id === id); if (n) Object.assign(n, data); }
  function removeNode(id)         {
    nodes = nodes.filter(n => n.id !== id);
    edges = edges.filter(e => e.source !== id && e.target !== id);
    if (selectedNode?.id === id) selectedNode = null;
  }
  function addEdge(edge)          { edges.push(edge); }
  function removeEdge(id)         { edges = edges.filter(e => e.id !== id); }
  function setFilter(type)        { activeFilter = type; }
  function getSelectedNode()      { return selectedNode; }

  function setConnectMode(active) {
    connectMode = active;
    connectSource = null;
    document.body.classList.toggle('connecting-mode', active);
    canvas.style.cursor = active ? 'crosshair' : 'default';
  }

  function centerView() {
    if (nodes.length === 0) return;
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    offsetX = canvas.width  / 2 - cx * scale;
    offsetY = canvas.height / 2 - cy * scale;
  }

  // ── Events ────────────────────────────────────────────
  function bindEvents() {
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup',   onMouseUp);
    canvas.addEventListener('dblclick',  onDblClick);
    canvas.addEventListener('wheel',     onWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());

    // minimap click to jump
    if (mmCanvas) {
      mmCanvas.addEventListener('click', onMinimapClick);
    }
  }

  function worldPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - offsetX) / scale,
      y: (e.clientY - rect.top  - offsetY) / scale
    };
  }

  function hitTest(wx, wy) {
    const visible = activeFilter === 'all' ? nodes : nodes.filter(n => n.type === activeFilter);
    for (let i = visible.length - 1; i >= 0; i--) {
      const n = visible[i];
      const dx = wx - n.x, dy = wy - n.y;
      if (Math.sqrt(dx * dx + dy * dy) < NODE_R + 10) return n;
    }
    return null;
  }

  function onMouseDown(e) {
    if (e.button !== 0) return;
    const w = worldPos(e);
    const hit = hitTest(w.x, w.y);

    if (hit) {
      if (connectMode) {
        if (!connectSource) {
          connectSource = hit;
          showToast('SOURCE: ' + hit.title + ' — click target');
        } else if (connectSource.id !== hit.id) {
          onConnect(connectSource, hit);
          connectSource = null;
          setConnectMode(false);
        }
        return;
      }
      dragNode = hit;
      dragNode._dragStartX  = dragNode.x;
      dragNode._dragStartY  = dragNode.y;
      dragNode._mouseStartX = w.x;
      dragNode._mouseStartY = w.y;
      isDragging = false;
    } else {
      isPanning = true;
      panStart = { x: e.clientX - offsetX, y: e.clientY - offsetY };
    }
  }

  function onMouseMove(e) {
    if (dragNode) {
      const w = worldPos(e);
      const dx = w.x - dragNode._mouseStartX;
      const dy = w.y - dragNode._mouseStartY;
      if (Math.abs(dx) > 3 || Math.abs(dy) > 3) isDragging = true;
      dragNode.x = dragNode._dragStartX + dx;
      dragNode.y = dragNode._dragStartY + dy;
    } else if (isPanning) {
      offsetX = e.clientX - panStart.x;
      offsetY = e.clientY - panStart.y;
    }
  }

  function onMouseUp(e) {
    if (dragNode) {
      if (!isDragging) {
        selectedNode = dragNode;
        onNodeSelect(dragNode);
      } else {
        saveNodePosition(dragNode.id, dragNode.x, dragNode.y);
      }
      dragNode = null;
      isDragging = false;
    }
    isPanning = false;
    panStart = null;
  }

  function onDblClick(e) {
    const w = worldPos(e);
    const hit = hitTest(w.x, w.y);
    if (hit) onNodeDoubleClick(hit);
    else onCanvasDoubleClick(w.x, w.y);
  }

  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    offsetX = mx - (mx - offsetX) * factor;
    offsetY = my - (my - offsetY) * factor;
    scale = Math.min(3.5, Math.max(0.15, scale * factor));
  }

  function onMinimapClick(e) {
    if (!mmCanvas || nodes.length === 0) return;
    const rect = mmCanvas.getBoundingClientRect();
    const mx = (e.clientX - rect.left) / rect.width;
    const my = (e.clientY - rect.top)  / rect.height;

    const bounds = getNodeBounds();
    const wx = bounds.minX + mx * (bounds.maxX - bounds.minX);
    const wy = bounds.minY + my * (bounds.maxY - bounds.minY);
    offsetX = canvas.width  / 2 - wx * scale;
    offsetY = canvas.height / 2 - wy * scale;
  }

  async function saveNodePosition(id, x, y) {
    try {
      await fetch('/api/nodes/' + id, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ x, y })
      });
    } catch(_) {}
  }

  // ── Helpers ───────────────────────────────────────────
  function getNodeBounds() {
    if (nodes.length === 0) return { minX: -500, minY: -500, maxX: 500, maxY: 500 };
    const pad = 100;
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    return {
      minX: Math.min(...xs) - pad,
      minY: Math.min(...ys) - pad,
      maxX: Math.max(...xs) + pad,
      maxY: Math.max(...ys) + pad
    };
  }

  // ── Render Loop ───────────────────────────────────────
  function loop() {
    draw();
    if (mmCtx) drawMinimap();
    animFrame = requestAnimationFrame(loop);
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawBackground();

    ctx.save();
    ctx.translate(offsetX, offsetY);
    ctx.scale(scale, scale);

    drawGrid();
    drawStars();
    drawEdges();
    drawNodes();

    if (connectSource) drawConnectRing();

    ctx.restore();
  }

  function drawBackground() {
    const grad = ctx.createRadialGradient(
      canvas.width * 0.5, canvas.height * 0.4, 0,
      canvas.width * 0.5, canvas.height * 0.5, Math.max(canvas.width, canvas.height) * 0.9
    );
    grad.addColorStop(0, '#030c1a');
    grad.addColorStop(0.5, '#020810');
    grad.addColorStop(1, '#010406');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawGrid() {
    const gs = 80;
    const sx = Math.floor(-offsetX / scale / gs) * gs - gs;
    const sy = Math.floor(-offsetY / scale / gs) * gs - gs;
    const ex = sx + canvas.width  / scale + gs * 2;
    const ey = sy + canvas.height / scale + gs * 2;

    ctx.strokeStyle = 'rgba(0,200,255,0.028)';
    ctx.lineWidth = 0.5;
    for (let x = sx; x < ex; x += gs) {
      ctx.beginPath(); ctx.moveTo(x, sy); ctx.lineTo(x, ey); ctx.stroke();
    }
    for (let y = sy; y < ey; y += gs) {
      ctx.beginPath(); ctx.moveTo(sx, y); ctx.lineTo(ex, y); ctx.stroke();
    }
  }

  function drawStars() {
    const t = Date.now() / 2000;
    stars.forEach(s => {
      const twinkle = 0.35 + 0.65 * Math.abs(Math.sin(s.phase + t * s.speed));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(170,215,255,${s.brightness * twinkle * 0.55})`;
      ctx.fill();
    });
  }

  function drawEdges() {
    const t = (Date.now() / 1400) % 1;
    edges.forEach(e => {
      const src = nodes.find(n => n.id === e.source);
      const tgt = nodes.find(n => n.id === e.target);
      if (!src || !tgt) return;

      const srcVis = activeFilter === 'all' || src.type === activeFilter;
      const tgtVis = activeFilter === 'all' || tgt.type === activeFilter;
      if (!srcVis && !tgtVis) return;

      const alpha = (srcVis && tgtVis) ? 0.35 : 0.08;
      const sw = Math.max(0.4, (e.strength || 1) * 1.2);

      // edge line
      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = `rgba(0,180,220,${alpha})`;
      ctx.lineWidth = sw;
      ctx.stroke();

      // animated pulse dot
      if (srcVis && tgtVis) {
        const px = src.x + (tgt.x - src.x) * t;
        const py = src.y + (tgt.y - src.y) * t;
        ctx.beginPath();
        ctx.arc(px, py, 2.2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(0,210,255,${alpha * 1.8})`;
        ctx.fill();
      }

      // edge label
      if (e.label && scale > 0.7) {
        const mx = (src.x + tgt.x) / 2;
        const my = (src.y + tgt.y) / 2;
        ctx.font = `${9 / scale}px 'Share Tech Mono'`;
        ctx.fillStyle = `rgba(0,200,255,${alpha * 0.9})`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(e.label, mx, my - 7);
      }
    });
  }

  function drawNodes() {
    const t = Date.now() / 1000;
    const visible = activeFilter === 'all' ? nodes : nodes.filter(n => n.type === activeFilter);

    visible.forEach(n => {
      const isSelected = selectedNode?.id === n.id;
      const color = n.color || NODE_COLORS[n.type] || '#00c8ff';
      const pulse = 1 + Math.sin(t * 1.4 + n.x * 0.008 + n.y * 0.006) * 0.06;
      const r = NODE_R * pulse;

      // outer glow halo
      const glowR = (isSelected ? 56 : 44) * pulse;
      const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
      glow.addColorStop(0,   color + '28');
      glow.addColorStop(0.4, color + '0a');
      glow.addColorStop(1,   'transparent');
      ctx.beginPath();
      ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // selection dashed ring
      if (isSelected) {
        const ringR = r + 9 + Math.sin(t * 2.8) * 2;
        ctx.beginPath();
        ctx.arc(n.x, n.y, ringR, 0, Math.PI * 2);
        ctx.strokeStyle = color + 'aa';
        ctx.lineWidth = 1.2 / scale;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // node fill circle
      const nodeGrad = ctx.createRadialGradient(n.x - 5, n.y - 5, 1, n.x, n.y, r);
      nodeGrad.addColorStop(0, color + '2e');
      nodeGrad.addColorStop(1, color + '08');
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.fillStyle = nodeGrad;
      ctx.fill();
      ctx.strokeStyle = color + 'cc';
      ctx.lineWidth = isSelected ? 1.5 : 0.8;
      ctx.stroke();

      // inner icon shape
      ctx.save();
      ctx.translate(n.x, n.y);
      const iconSize = 7;
      ctx.beginPath();
      const iconFn = NODE_ICONS[n.type];
      if (iconFn) {
        if (n.type === 'memory' || n.type === 'research') {
          // circle with inner ring
          iconFn(ctx, 0, 0, iconSize);
          ctx.strokeStyle = color + 'dd';
          ctx.lineWidth = 1.2;
          ctx.stroke();
          if (n.type === 'research') {
            // crosshair lines
            ctx.beginPath();
            ctx.moveTo(-iconSize * 1.4, 0); ctx.lineTo(iconSize * 1.4, 0);
            ctx.moveTo(0, -iconSize * 1.4); ctx.lineTo(0, iconSize * 1.4);
            ctx.strokeStyle = color + '88';
            ctx.lineWidth = 0.7;
            ctx.stroke();
          } else {
            // memory inner dot
            ctx.beginPath();
            ctx.arc(0, 0, 2.5, 0, Math.PI * 2);
            ctx.fillStyle = color + 'cc';
            ctx.fill();
          }
        } else {
          iconFn(ctx, 0, 0, iconSize);
          ctx.fillStyle = color + 'cc';
          ctx.fill();
          ctx.strokeStyle = color + '55';
          ctx.lineWidth = 0.6;
          ctx.stroke();
        }
      }
      ctx.restore();

      // title label
      if (scale > 0.35) {
        const fontSize = Math.min(12, 10 / scale);
        ctx.font = `${fontSize}px 'Rajdhani'`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = color + 'ee';
        const title = n.title.length > 20 ? n.title.slice(0, 19) + '…' : n.title;
        ctx.fillText(title, n.x, n.y + r + 5);
      }
    });
  }

  function drawConnectRing() {
    const t = Date.now() / 350;
    const n = connectSource;
    const color = n.color || NODE_COLORS[n.type] || '#7fff3e';
    ctx.beginPath();
    ctx.arc(n.x, n.y, NODE_R + 12 + Math.sin(t) * 5, 0, Math.PI * 2);
    ctx.strokeStyle = '#7fff3eaa';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  // ── Minimap ───────────────────────────────────────────
  function drawMinimap() {
    if (!mmCtx || nodes.length === 0) return;
    const w = mmCanvas.width, h = mmCanvas.height;
    const bounds = getNodeBounds();
    const bw = bounds.maxX - bounds.minX;
    const bh = bounds.maxY - bounds.minY;
    const scaleX = w / bw, scaleY = h / bh;
    const mmScale = Math.min(scaleX, scaleY) * 0.85;

    mmCtx.clearRect(0, 0, w, h);

    // draw edges
    edges.forEach(e => {
      const s = nodes.find(n => n.id === e.source);
      const t = nodes.find(n => n.id === e.target);
      if (!s || !t) return;
      const sx = (s.x - bounds.minX) * mmScale + (w - bw * mmScale) / 2;
      const sy = (s.y - bounds.minY) * mmScale + (h - bh * mmScale) / 2;
      const tx = (t.x - bounds.minX) * mmScale + (w - bw * mmScale) / 2;
      const ty = (t.y - bounds.minY) * mmScale + (h - bh * mmScale) / 2;
      mmCtx.beginPath();
      mmCtx.moveTo(sx, sy);
      mmCtx.lineTo(tx, ty);
      mmCtx.strokeStyle = 'rgba(0,180,220,0.2)';
      mmCtx.lineWidth = 0.5;
      mmCtx.stroke();
    });

    // draw nodes
    nodes.forEach(n => {
      const nx = (n.x - bounds.minX) * mmScale + (w - bw * mmScale) / 2;
      const ny = (n.y - bounds.minY) * mmScale + (h - bh * mmScale) / 2;
      const col = n.color || NODE_COLORS[n.type] || '#00c8ff';
      mmCtx.beginPath();
      mmCtx.arc(nx, ny, 2.5, 0, Math.PI * 2);
      mmCtx.fillStyle = col + 'cc';
      mmCtx.fill();
    });

    // viewport rect
    const vx = (-offsetX / scale - bounds.minX) * mmScale + (w - bw * mmScale) / 2;
    const vy = (-offsetY / scale - bounds.minY) * mmScale + (h - bh * mmScale) / 2;
    const vw = (canvas.width  / scale) * mmScale;
    const vh = (canvas.height / scale) * mmScale;
    mmCtx.strokeStyle = 'rgba(0,200,255,0.5)';
    mmCtx.lineWidth = 0.8;
    mmCtx.strokeRect(vx, vy, vw, vh);
  }

  // ── Utility ───────────────────────────────────────────
  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('hidden'), 2800);
  }

  function randomPosition() {
    const viewW = canvas.width / scale, viewH = canvas.height / scale;
    const cx = -offsetX / scale, cy = -offsetY / scale;
    const spread = 300 + nodes.length * 15;
    return {
      x: cx + viewW / 2 - spread / 2 + Math.random() * spread,
      y: cy + viewH / 2 - spread / 2 + Math.random() * spread
    };
  }

  function exportData() {
    return { nodes: nodes.map(n => ({ ...n })), edges: edges.map(e => ({ ...e })) };
  }

  return {
    init, setData, addNode, updateNode, removeNode, addEdge, removeEdge,
    setFilter, setConnectMode, getSelectedNode, centerView, randomPosition,
    showToast, exportData
  };
})();