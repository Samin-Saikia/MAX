from flask import Flask, render_template, request, jsonify
import sqlite3, json, os, uuid, requests
from datetime import datetime

app = Flask(__name__)
DB = "data/max.db"

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
SERPER_API_KEY = os.environ.get("SERPER_API_KEY", "")

# ── Database ──────────────────────────────────────────────────────────────────

def get_db():
    conn = sqlite3.connect(DB)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    os.makedirs("data", exist_ok=True)
    db = get_db()
    db.executescript("""
        CREATE TABLE IF NOT EXISTS nodes (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            content TEXT,
            type TEXT DEFAULT 'concept',
            tags TEXT DEFAULT '[]',
            x REAL DEFAULT 0,
            y REAL DEFAULT 0,
            color TEXT DEFAULT '#00d4ff',
            created_at TEXT,
            updated_at TEXT
        );
        CREATE TABLE IF NOT EXISTS edges (
            id TEXT PRIMARY KEY,
            source TEXT NOT NULL,
            target TEXT NOT NULL,
            label TEXT DEFAULT '',
            strength REAL DEFAULT 1.0,
            created_at TEXT,
            FOREIGN KEY(source) REFERENCES nodes(id),
            FOREIGN KEY(target) REFERENCES nodes(id)
        );
        CREATE TABLE IF NOT EXISTS memories (
            id TEXT PRIMARY KEY,
            key TEXT NOT NULL,
            value TEXT NOT NULL,
            category TEXT DEFAULT 'general',
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS chat_history (
            id TEXT PRIMARY KEY,
            role TEXT,
            content TEXT,
            node_context TEXT,
            created_at TEXT
        );
    """)
    db.commit()
    db.close()

# ── Routes ────────────────────────────────────────────────────────────────────

@app.route("/")
def index():
    return render_template("index.html")

# ── Nodes ─────────────────────────────────────────────────────────────────────

@app.route("/api/nodes", methods=["GET"])
def get_nodes():
    db = get_db()
    nodes = [dict(r) for r in db.execute("SELECT * FROM nodes").fetchall()]
    edges = [dict(r) for r in db.execute("SELECT * FROM edges").fetchall()]
    db.close()
    for n in nodes:
        n["tags"] = json.loads(n["tags"])
    return jsonify({"nodes": nodes, "edges": edges})

@app.route("/api/nodes", methods=["POST"])
def create_node():
    data = request.json
    node_id = str(uuid.uuid4())[:8]
    now = datetime.utcnow().isoformat()
    colors = {"concept":"#00d4ff","memory":"#ff6b35","idea":"#a8ff3e","topic":"#bf5fff","research":"#ffd700"}
    color = colors.get(data.get("type","concept"), "#00d4ff")
    db = get_db()
    db.execute("""INSERT INTO nodes (id,title,content,type,tags,x,y,color,created_at,updated_at)
                  VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (node_id, data["title"], data.get("content",""), data.get("type","concept"),
         json.dumps(data.get("tags",[])), data.get("x",0), data.get("y",0),
         data.get("color", color), now, now))
    db.commit()
    db.close()
    return jsonify({"id": node_id, "status": "created"})

@app.route("/api/nodes/<node_id>", methods=["PUT"])
def update_node(node_id):
    data = request.json
    now = datetime.utcnow().isoformat()
    db = get_db()
    fields = []
    values = []
    for field in ["title","content","type","x","y","color"]:
        if field in data:
            fields.append(f"{field}=?")
            values.append(data[field])
    if "tags" in data:
        fields.append("tags=?")
        values.append(json.dumps(data["tags"]))
    fields.append("updated_at=?")
    values.append(now)
    values.append(node_id)
    db.execute(f"UPDATE nodes SET {', '.join(fields)} WHERE id=?", values)
    db.commit()
    db.close()
    return jsonify({"status": "updated"})

@app.route("/api/nodes/<node_id>", methods=["DELETE"])
def delete_node(node_id):
    db = get_db()
    db.execute("DELETE FROM nodes WHERE id=?", (node_id,))
    db.execute("DELETE FROM edges WHERE source=? OR target=?", (node_id, node_id))
    db.commit()
    db.close()
    return jsonify({"status": "deleted"})

# ── Edges ─────────────────────────────────────────────────────────────────────

@app.route("/api/edges", methods=["POST"])
def create_edge():
    data = request.json
    edge_id = str(uuid.uuid4())[:8]
    now = datetime.utcnow().isoformat()
    db = get_db()
    db.execute("INSERT INTO edges (id,source,target,label,strength,created_at) VALUES (?,?,?,?,?,?)",
        (edge_id, data["source"], data["target"], data.get("label",""), data.get("strength",1.0), now))
    db.commit()
    db.close()
    return jsonify({"id": edge_id, "status": "created"})

@app.route("/api/edges/<edge_id>", methods=["DELETE"])
def delete_edge(edge_id):
    db = get_db()
    db.execute("DELETE FROM edges WHERE id=?", (edge_id,))
    db.commit()
    db.close()
    return jsonify({"status": "deleted"})

# ── Memory ────────────────────────────────────────────────────────────────────

@app.route("/api/memory", methods=["GET"])
def get_memory():
    db = get_db()
    memories = [dict(r) for r in db.execute("SELECT * FROM memories ORDER BY created_at DESC").fetchall()]
    db.close()
    return jsonify(memories)

@app.route("/api/memory", methods=["POST"])
def add_memory():
    data = request.json
    mem_id = str(uuid.uuid4())[:8]
    now = datetime.utcnow().isoformat()
    db = get_db()
    db.execute("INSERT INTO memories (id,key,value,category,created_at) VALUES (?,?,?,?,?)",
        (mem_id, data["key"], data["value"], data.get("category","general"), now))
    db.commit()
    db.close()
    return jsonify({"id": mem_id, "status": "created"})

@app.route("/api/memory/<mem_id>", methods=["DELETE"])
def delete_memory(mem_id):
    db = get_db()
    db.execute("DELETE FROM memories WHERE id=?", (mem_id,))
    db.commit()
    db.close()
    return jsonify({"status":"deleted"})

# ── AI Chat ───────────────────────────────────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    user_msg = data.get("message","")
    node_context = data.get("node_context", None)
    history = data.get("history", [])

    if not GROQ_API_KEY:
        return jsonify({"reply": "⚠️ Set your GROQ_API_KEY environment variable to activate MAX's AI core.", "error": True})

    db = get_db()
    nodes = [dict(r) for r in db.execute("SELECT id,title,content,type,tags FROM nodes").fetchall()]
    memories = [dict(r) for r in db.execute("SELECT key,value,category FROM memories").fetchall()]
    db.close()

    universe_summary = "\n".join([f"[{n['type']}] {n['title']}: {n['content'][:100]}" for n in nodes[:30]])
    memory_summary = "\n".join([f"{m['key']}: {m['value']}" for m in memories[:20]])

    system_prompt = f"""You are MAX — a hyper-intelligent AI core powering a personal knowledge universe.
You have access to the user's entire knowledge graph and memory system.

KNOWLEDGE UNIVERSE ({len(nodes)} nodes):
{universe_summary if universe_summary else "Empty — no nodes yet."}

MEMORY CORE:
{memory_summary if memory_summary else "No memories stored yet."}

{"FOCUSED NODE: " + json.dumps(node_context) if node_context else ""}

You help the user:
- Explore and connect ideas across their universe
- Expand concepts and suggest new connections
- Answer questions using their stored knowledge
- Suggest what nodes to create or link

Respond in a sharp, intelligent tone — like JARVIS. Be concise but insightful.
When suggesting new nodes or connections, format them clearly.
"""

    messages = []
    for h in history[-6:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": user_msg})

    try:
        resp = requests.post("https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={"model": "groq/compound", "messages": [{"role":"system","content":system_prompt}] + messages, "max_tokens": 1024},
            timeout=30)
        result = resp.json()
        reply = result["choices"][0]["message"]["content"]
        return jsonify({"reply": reply})
    except Exception as e:
        return jsonify({"reply": f"MAX core error: {str(e)}", "error": True})

# ── Web Search ────────────────────────────────────────────────────────────────

@app.route("/api/search", methods=["POST"])
def web_search():
    query = request.json.get("query","")
    if not SERPER_API_KEY:
        return jsonify({"results": [], "error": "Set SERPER_API_KEY to enable live research."})
    try:
        resp = requests.post("https://google.serper.dev/search",
            headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
            json={"q": query, "num": 5}, timeout=15)
        data = resp.json()
        results = []
        for r in data.get("organic", [])[:5]:
            results.append({"title": r.get("title",""), "snippet": r.get("snippet",""), "link": r.get("link","")})
        return jsonify({"results": results})
    except Exception as e:
        return jsonify({"results": [], "error": str(e)})

# ── AI Expand Node ────────────────────────────────────────────────────────────

@app.route("/api/expand", methods=["POST"])
def expand_node():
    data = request.json
    node = data.get("node", {})
    if not GROQ_API_KEY:
        return jsonify({"suggestions": []})
    prompt = f"""Given this knowledge node:
Title: {node.get('title','')}
Content: {node.get('content','')}
Type: {node.get('type','')}

Generate 4 related concepts/ideas that should be connected to this node.
Return ONLY a JSON array like:
[{{"title":"...", "type":"concept|idea|memory|research", "content":"...", "relation":"caused by|related to|leads to|contradicts|part of"}}]
No markdown, no explanation. Raw JSON only."""

    try:
        resp = requests.post("https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={"model": "llama-3.3-70b-versatile", "messages": [{"role":"user","content":prompt}], "max_tokens": 512},
            timeout=20)
        text = resp.json()["choices"][0]["message"]["content"].strip()
        text = text.replace("```json","").replace("```","").strip()
        suggestions = json.loads(text)
        return jsonify({"suggestions": suggestions})
    except Exception as e:
        return jsonify({"suggestions": [], "error": str(e)})

# ── AI Auto-Connect ───────────────────────────────────────────────────────────

@app.route("/api/autoconnect", methods=["POST"])
def auto_connect():
    if not GROQ_API_KEY:
        return jsonify({"connections": []})
    db = get_db()
    nodes = [dict(r) for r in db.execute("SELECT id,title,content,type FROM nodes").fetchall()]
    db.close()
    if len(nodes) < 2:
        return jsonify({"connections": []})

    node_list = "\n".join([f"{n['id']}: {n['title']} ({n['type']})" for n in nodes[:20]])
    prompt = f"""Given these knowledge nodes:
{node_list}

Suggest the 5 most meaningful connections between them.
Return ONLY a JSON array:
[{{"source":"id1","target":"id2","label":"relation type","strength":0.8}}]
strength is 0.1–1.0. No markdown. Raw JSON only."""

    try:
        resp = requests.post("https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={"model": "llama-3.3-70b-versatile","messages":[{"role":"user","content":prompt}],"max_tokens":400},
            timeout=20)
        text = resp.json()["choices"][0]["message"]["content"].strip()
        text = text.replace("```json","").replace("```","").strip()
        connections = json.loads(text)
        return jsonify({"connections": connections})
    except Exception as e:
        return jsonify({"connections": [], "error": str(e)})

if __name__ == "__main__":
    init_db()
    print("⚡ MAX is online.")
    app.run(debug=True, port=5000)