# ⚡ MAX — Knowledge Universe

A spatial, AI-powered personal knowledge system.
Dark cosmic JARVIS aesthetic. Groq AI + Serper Search + Flask + SQLite.

---

## 📁 Project Structure

```
max/
├── app.py                  # Flask backend (all API routes)
├── requirements.txt
├── data/
│   └── max.db              # SQLite database (auto-created)
├── templates/
│   └── index.html          # Main HUD interface
└── static/
    ├── css/
    │   └── style.css       # Cosmic dark theme
    └── js/
        ├── universe.js     # Canvas engine (nodes, edges, rendering)
        └── app.js          # App controller (UI, API, state)
```

---

## 🚀 Setup

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Set API keys
```bash
# Linux / Mac
export GROQ_API_KEY=your_groq_key_here
export SERPER_API_KEY=your_serper_key_here

# Windows
set GROQ_API_KEY=your_groq_key_here
set SERPER_API_KEY=your_serper_key_here
```

Get keys:
- Groq (free): https://console.groq.com
- Serper (free tier): https://serper.dev

### 3. Run MAX
```bash
python app.py
```

Open: http://localhost:5000

---

## 🎮 Controls

| Action | How |
|--------|-----|
| Add node | `+ NODE` button, double-click canvas, or type `add <title>` |
| Select node | Single click |
| Move node | Drag |
| Pan universe | Drag on empty space |
| Zoom | Scroll wheel |
| Connect nodes | `SHIFT+CLICK` → click source, click target |
| AI expand node | Select node → `⚡ AI EXPAND` |
| Ask MAX | `◈ ASK MAX` button or type `ask <question>` |
| Live search | Select node → `🔍 RESEARCH` |
| Auto-link | `⚡ AUTO-LINK` — AI maps connections across all nodes |
| Keyboard | `N` = new node, `ESC` = close panels |

---

## ✨ Features

- **Universe Canvas** — infinite 2D space, animated nodes with glow, pulsing edges
- **Node Types** — Concept, Idea, Memory, Topic, Research (each with unique color)
- **AI Core (Groq)** — Chat with your universe, expand nodes, auto-detect connections
- **Live Research (Serper)** — Search web, import results as new nodes
- **Memory System** — Store persistent facts/goals that MAX always knows
- **Auto-Link** — AI scans all nodes and suggests meaningful connections
- **Command Bar** — Type commands like `add quantum computing` or `ask what connects AI and consciousness`
- **Cosmic HUD** — JARVIS-style dark space aesthetic, boot sequence, live clock

---

## 🔮 Planned Expansions

- Voice commands (Web Speech API)
- Node clustering / galaxy view
- Timeline mode
- Export universe as graph JSON
- Multiple universes / workspaces
- Collaborative mode
