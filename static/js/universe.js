// ═══════════════════════════════════════════
//   MAX — Universe Canvas Engine
//   Handles all canvas rendering, physics, interaction
// ═══════════════════════════════════════════

const Universe = (() => {
  let canvas, ctx;
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
    concept: '#00d4ff',
    idea: '#a8ff3e',
    memory: '#ff6b35',
    topic: '#bf5fff',
    research: '#ffd700'
  };

  const NODE_RADIUS = 28;
  const GLOW_RADIUS = 50;

  // ── Init ──────────────────────────────────────
  function init(opts = {}) {
    canvas = document.getElementById('universe-canvas');
    ctx = canvas.getContext('2d');
    onNodeSelect = opts.onNodeSelect || (() => {});
    onNodeDoubleClick = opts.onNodeDoubleClick || (() => {});
    onCanvasDoubleClick = opts.onCanvasDoubleClick || (() => {});
    onConnect = opts.onConnect || (() => {});

    resize();
    window.addEventListener('resize', resize);
    generateStars();
    bindEvents();
    loop();
  }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }

  function generateStars() {
    stars = [];
    for (let i = 0; i < 300; i++) {
      stars.push({
        x: Math.random() * 4000 - 2000,
        y: Math.random() * 4000 - 2000,
        r: Math.random() * 1.2,
        brightness: Math.random(),
        twinkle: Math.random() * Math.PI * 2
      });
    }
  }

  // ── Data ──────────────────────────────────────
  function setData(n, e) {
    nodes = n.map(nd => ({ ...nd, vx: 0, vy: 0 }));
    edges = e;
    if (nodes.length > 0) centerView();
  }

  function addNode(node) {
    nodes.push({ ...node, vx: 0, vy: 0 });
  }

  function updateNode(id, data) {
    const n = nodes.find(n => n.id === id);
    if (n) Object.assign(n, data);
  }

  function removeNode(id) {
    nodes = nodes.filter(n => n.id !== id);
    edges = edges.filter(e => e.source !== id && e.target !== id);
    if (selectedNode?.id === id) selectedNode = null;
  }

  function addEdge(edge) {
    edges.push(edge);
  }

  function removeEdge(id) {
    edges = edges.filter(e => e.id !== id);
  }

  function setFilter(type) {
    activeFilter = type;
  }

  function setConnectMode(active) {
    connectMode = active;
    connectSource = null;
    document.body.classList.toggle('connecting-mode', active);
  }

  function centerView() {
    if (nodes.length === 0) return;
    const xs = nodes.map(n => n.x), ys = nodes.map(n => n.y);
    const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
    const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
    offsetX = canvas.width / 2 - cx * scale;
    offsetY = canvas.height / 2 - cy * scale;
  }

  function getSelectedNode() { return selectedNode; }

  // ── Events ────────────────────────────────────
  function bindEvents() {
    canvas.addEventListener('mousedown', onMouseDown);
    canvas.addEventListener('mousemove', onMouseMove);
    canvas.addEventListener('mouseup', onMouseUp);
    canvas.addEventListener('dblclick', onDblClick);
    canvas.addEventListener('wheel', onWheel, { passive: false });
    canvas.addEventListener('contextmenu', e => e.preventDefault());
  }

  function worldPos(e) {
    const rect = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left - offsetX) / scale,
      y: (e.clientY - rect.top - offsetY) / scale
    };
  }

  function hitTest(wx, wy) {
    const visible = activeFilter === 'all' ? nodes : nodes.filter(n => n.type === activeFilter);
    for (let i = visible.length - 1; i >= 0; i--) {
      const n = visible[i];
      const dx = wx - n.x, dy = wy - n.y;
      if (Math.sqrt(dx * dx + dy * dy) < NODE_RADIUS + 8) return n;
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
          showToast(`SOURCE: ${hit.title} — click target node`);
        } else if (connectSource.id !== hit.id) {
          onConnect(connectSource, hit);
          connectSource = null;
          setConnectMode(false);
        }
        return;
      }
      dragNode = hit;
      dragNode._dragStartX = dragNode.x;
      dragNode._dragStartY = dragNode.y;
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
        // persist position
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
    if (hit) {
      onNodeDoubleClick(hit);
    } else {
      onCanvasDoubleClick(w.x, w.y);
    }
  }

  function onWheel(e) {
    e.preventDefault();
    const factor = e.deltaY < 0 ? 1.1 : 0.91;
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left, my = e.clientY - rect.top;
    offsetX = mx - (mx - offsetX) * factor;
    offsetY = my - (my - offsetY) * factor;
    scale = Math.min(3, Math.max(0.2, scale * factor));
  }

  async function saveNodePosition(id, x, y) {
    await fetch(`/api/nodes/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ x, y })
    });
  }

  // ── Render ────────────────────────────────────
  function loop() {
    draw();
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

    if (connectSource) {
      // pulsing ring on source
      const t = Date.now() / 400;
      ctx.beginPath();
      ctx.arc(connectSource.x, connectSource.y, NODE_RADIUS + 10 + Math.sin(t) * 6, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(168,255,62,0.6)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }

    ctx.restore();
  }

  function drawBackground() {
    const grad = ctx.createRadialGradient(
      canvas.width / 2, canvas.height / 2, 0,
      canvas.width / 2, canvas.height / 2, Math.max(canvas.width, canvas.height) * 0.8
    );
    grad.addColorStop(0, '#030b14');
    grad.addColorStop(1, '#010406');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  function drawGrid() {
    const gridSize = 80;
    const startX = Math.floor(-offsetX / scale / gridSize) * gridSize - gridSize;
    const startY = Math.floor(-offsetY / scale / gridSize) * gridSize - gridSize;
    const endX = startX + canvas.width / scale + gridSize * 2;
    const endY = startY + canvas.height / scale + gridSize * 2;

    ctx.strokeStyle = 'rgba(0, 212, 255, 0.03)';
    ctx.lineWidth = 0.5;
    for (let x = startX; x < endX; x += gridSize) {
      ctx.beginPath(); ctx.moveTo(x, startY); ctx.lineTo(x, endY); ctx.stroke();
    }
    for (let y = startY; y < endY; y += gridSize) {
      ctx.beginPath(); ctx.moveTo(startX, y); ctx.lineTo(endX, y); ctx.stroke();
    }
  }

  function drawStars() {
    const t = Date.now() / 2000;
    stars.forEach(s => {
      const twinkle = 0.4 + 0.6 * Math.abs(Math.sin(s.twinkle + t));
      ctx.beginPath();
      ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(180, 220, 255, ${s.brightness * twinkle * 0.6})`;
      ctx.fill();
    });
  }

  function drawEdges() {
    edges.forEach(e => {
      const src = nodes.find(n => n.id === e.source);
      const tgt = nodes.find(n => n.id === e.target);
      if (!src || !tgt) return;

      const srcVis = activeFilter === 'all' || src.type === activeFilter;
      const tgtVis = activeFilter === 'all' || tgt.type === activeFilter;
      if (!srcVis && !tgtVis) return;

      const alpha = (srcVis && tgtVis) ? 0.4 : 0.1;

      // animated pulse along edge
      const t = (Date.now() / 1200) % 1;
      const px = src.x + (tgt.x - src.x) * t;
      const py = src.y + (tgt.y - src.y) * t;

      ctx.beginPath();
      ctx.moveTo(src.x, src.y);
      ctx.lineTo(tgt.x, tgt.y);
      ctx.strokeStyle = `rgba(0, 180, 220, ${alpha})`;
      ctx.lineWidth = Math.max(0.5, (e.strength || 1) * 1.5);
      ctx.stroke();

      // pulse dot
      ctx.beginPath();
      ctx.arc(px, py, 2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(0, 212, 255, ${alpha * 1.5})`;
      ctx.fill();

      // label
      if (e.label && scale > 0.7) {
        const mx = (src.x + tgt.x) / 2;
        const my = (src.y + tgt.y) / 2;
        ctx.font = `${10 / scale}px 'Share Tech Mono'`;
        ctx.fillStyle = `rgba(0, 212, 255, ${alpha})`;
        ctx.textAlign = 'center';
        ctx.fillText(e.label, mx, my - 6);
      }
    });
  }

  function drawNodes() {
    const t = Date.now() / 1000;
    const visibleNodes = activeFilter === 'all' ? nodes : nodes.filter(n => n.type === activeFilter);

    visibleNodes.forEach(n => {
      const isSelected = selectedNode?.id === n.id;
      const color = n.color || NODE_COLORS[n.type] || '#00d4ff';
      const pulse = 1 + Math.sin(t * 1.5 + n.x * 0.01) * 0.08;

      // outer glow
      const glowR = (isSelected ? GLOW_RADIUS * 1.5 : GLOW_RADIUS) * pulse;
      const glow = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, glowR);
      glow.addColorStop(0, `${color}22`);
      glow.addColorStop(0.4, `${color}08`);
      glow.addColorStop(1, 'transparent');
      ctx.beginPath();
      ctx.arc(n.x, n.y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = glow;
      ctx.fill();

      // selection ring
      if (isSelected) {
        ctx.beginPath();
        ctx.arc(n.x, n.y, NODE_RADIUS + 8 + Math.sin(t * 3) * 3, 0, Math.PI * 2);
        ctx.strokeStyle = `${color}99`;
        ctx.lineWidth = 1.5;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // node circle
      ctx.beginPath();
      ctx.arc(n.x, n.y, NODE_RADIUS * pulse, 0, Math.PI * 2);
      const nodeGrad = ctx.createRadialGradient(n.x - 6, n.y - 6, 2, n.x, n.y, NODE_RADIUS);
      nodeGrad.addColorStop(0, `${color}33`);
      nodeGrad.addColorStop(1, `${color}11`);
      ctx.fillStyle = nodeGrad;
      ctx.fill();
      ctx.strokeStyle = `${color}bb`;
      ctx.lineWidth = isSelected ? 2 : 1;
      ctx.stroke();

      // type icon center
      ctx.font = `${14}px serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = color;
      const icons = { concept: '◈', idea: '✦', memory: '◉', topic: '⬡', research: '⊕' };
      ctx.fillText(icons[n.type] || '◈', n.x, n.y);

      // title label
      if (scale > 0.4) {
        ctx.font = `${Math.min(13, 11 / scale)}px 'Rajdhani'`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = `${color}ee`;
        const maxW = 120;
        const title = n.title.length > 18 ? n.title.slice(0, 17) + '…' : n.title;
        ctx.fillText(title, n.x, n.y + NODE_RADIUS + 6);
      }
    });
  }

  // ── Helpers ───────────────────────────────────
  function showToast(msg) {
    const t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.remove('hidden');
    clearTimeout(t._timer);
    t._timer = setTimeout(() => t.classList.add('hidden'), 2500);
  }

  function randomPosition() {
    const viewW = canvas.width / scale, viewH = canvas.height / scale;
    const cx = -offsetX / scale, cy = -offsetY / scale;
    return {
      x: cx + viewW * 0.2 + Math.random() * viewW * 0.6,
      y: cy + viewH * 0.2 + Math.random() * viewH * 0.6
    };
  }

  return {
    init, setData, addNode, updateNode, removeNode, addEdge, removeEdge,
    setFilter, setConnectMode, getSelectedNode, centerView, randomPosition, showToast
  };
})();
