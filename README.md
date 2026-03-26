# MAX — Knowledge Universe  v2.0

A spatial, AI-powered personal knowledge system.  
Dark cosmic JARVIS aesthetic. Groq AI + Serper Search + Flask + SQLite.

---

## What's new in v2.0

- **SVG icons** — all emoji replaced with crisp inline SVG throughout the UI
- **Shape-based node icons** — concept (diamond), idea (star), memory (ring), topic (hexagon), research (crosshair)
- **Minimap** — live scaled overview of your entire universe with viewport indicator
- **Export** — download your full universe as JSON (`E` key or `export` command)
- **LINK button** — dedicated connect-mode button in the top bar
- **CENTER button** — reset view to fit all nodes (`Space` key)
- **Improved keyboard shortcuts** — `N` new node, `Space` center, `Shift+C` connect mode, `E` export, `Esc` close
- **Refined visual design** — tighter spacing, crisper borders, smoother animations, scan-line overlay
- **Better randomPosition** — new nodes spread out as universe grows, avoiding pile-up
- **Error handling** — all API calls wrapped with try/catch, toast on failure

---

## Project Structure

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
        ├── universe.js     # Canvas engine (nodes, edges, minimap, rendering)
        └── app.js          # App controller (UI, API, state)
```

---

## Setup

### 1. Install dependencies
```bash
pip install -r requirements.txt
```

### 2. Set API keys
```bash
# Windows
set GROQ_API_KEY=your_groq_key_here
set SERPER_API_KEY=your_serper_key_here

# Linux / Mac
export GROQ_API_KEY=your_groq_key_here
export SERPER_API_KEY=your_serper_key_here
```

Keys:
- Groq (free): https://console.groq.com
- Serper (free tier): https://serper.dev

### 3. Run
```bash
python app.py
```
Open: http://localhost:5000

---

## Controls

| Action | How |
|--------|-----|
| Add node | `+ NODE` button, `N` key, double-click canvas, or `add <title>` |
| Select node | Single click |
| Move node | Drag |
| Pan universe | Drag empty space |
| Zoom | Scroll wheel |
| Connect nodes | `LINK` button or `Shift+C`, then click source → target |
| AI expand | Select node → `AI EXPAND` |
| Ask MAX | `ASK MAX` button or `ask <question>` in command bar |
| Live search | Select node → `RESEARCH` |
| Auto-link | `AUTO-LINK` button — AI maps connections across all nodes |
| Center view | `Space` key or CENTER button |
| Export universe | `E` key or type `export` |
| Close / deselect | `Esc` |

---

## Commands (type in command bar)

```
add <title>       — open create modal with title pre-filled
ask <question>    — send to MAX AI
search <query>    — web research
connect           — enter connect mode
center            — reset view
export            — download universe JSON
memory            — open memory panel
```