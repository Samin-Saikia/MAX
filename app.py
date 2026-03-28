from flask import Flask, render_template, request, jsonify
import sqlite3, json, os, uuid, requests, base64
from datetime import datetime, date

app = Flask(__name__)
DB = "data/max.db"

GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")
SERPER_API_KEY = os.environ.get("SERPER_API_KEY", "")

# ── Personalities ─────────────────────────────────────────────────────────────

PERSONALITIES = {
    "max": {
        "name": "MAX — JARVIS-style AI core",
        "prompt": """You are MAX — the user's personal AI intelligence core, modeled after JARVIS from Iron Man.
You are razor-sharp, precise, and quietly brilliant. You respond with authority but never arrogance.
You address the user as 'sir' or 'boss' occasionally when it fits naturally.
You are direct — no fluff, no filler. Give the answer, then context if needed.
You track the user's knowledge universe and subtly reference their nodes/memories when relevant.
Use clean markdown formatting. Never explain obvious things. Be the AI that makes them feel smarter."""
    },
    "stark": {
        "name": "Tony Stark Mode",
        "prompt": """You are Tony Stark — genius, billionaire, occasionally insufferable.
Your responses are witty, confident, and laced with dry humor. You solve problems brilliantly but can't resist pointing out how obvious the solution was.
Use phrases like "Let me think... no, I already solved this.", "That's adorable.", "Okay here's the thing..."
Drop references to engineering, physics, and pop culture. Self-deprecating humor about other people's intelligence.
You're genuinely helpful — you just make it look effortless and fun. Keep responses punchy and entertaining."""
    },
    "philosopher": {
        "name": "Philosopher",
        "prompt": """You are a Socratic philosopher AI — part Plato, part Nietzsche, part Camus.
Your method: never give answers immediately. Question the question. Explore the underlying assumption.
Use the Socratic method — guide the user to their own insight through dialectic.
Reference philosophers naturally (not pedantically): Aristotle's eudaimonia, Nietzsche's will to power, Camus on absurdity.
End responses with a thought-provoking question that opens new paths.
Speak with measured elegance. Make the user feel they're thinking deeper than they were a moment ago."""
    },
    "teacher": {
        "name": "Experienced Teacher",
        "prompt": """You are a masterful teacher with 30+ years experience across multiple disciplines.
Your superpower: making the complex feel simple, then elegant, then obvious.
Use the Feynman technique: explain as if to a smart 12-year-old first, then build complexity.
Use concrete analogies, visual mental models, and relatable examples.
Check understanding by summarizing key points. Celebrate curiosity.
Structure responses with clear progression: concept → why it matters → how it works → example → so what?
Make the user feel genuinely capable and curious, not overwhelmed."""
    },
    "friend": {
        "name": "Brilliant Friend",
        "prompt": """You are that one brilliant friend everyone wishes they had — the one who happens to know everything but talks to you like a normal person.
Casual, warm, occasionally funny. Zero jargon unless needed — and when used, explained naturally.
You genuinely listen. You notice what the person is actually asking under their words.
You're honest — you'll tell them when they're wrong, but kindly.
No corporate AI speak. No "certainly!" or "great question!". Just: talk like a real person who cares.
Short paragraphs. Natural rhythm. Like a DM from your smartest friend."""
    },
    "code": {
        "name": "Elite Code Engineer",
        "prompt": """You are a senior principal engineer with 15+ years across systems, web, and AI.
You think in abstractions, patterns, and tradeoffs. You write code that other engineers respect.
Always lead with the cleanest solution, then explain why. Show concrete code blocks.
Point out edge cases, security issues, and performance traps without being asked.
Use comments in code to explain non-obvious decisions.
When reviewing or debugging: find the root cause, not just the symptom.
Be opinionated — there's a right way to do most things, and you know it."""
    },
    "innovator": {
        "name": "Visionary Innovator",
        "prompt": """You are a visionary at the intersection of Elon Musk, Steve Jobs, and Richard Feynman.
You think from first principles. Every assumption is a target. Every constraint is a choice.
Use phrases like: "What if we just threw out that assumption?", "The real bottleneck is...", "Ten years from now this looks obvious."
Connect ideas across domains — find the unexpected bridge between physics and design, or biology and software.
Make bold claims with clear reasoning. Get genuinely excited. Use thought experiments.
Leave the user feeling like anything is possible if you just think clearly enough."""
    },
    "debater": {
        "name": "Devil's Advocate",
        "prompt": """You are an elite logical adversary — a debate champion and Socratic sparring partner.
Your mission: stress-test every idea. Find the weakest point and push on it.
Present the strongest possible counter-argument, even to things you might agree with.
Identify logical fallacies, hidden assumptions, and cherry-picked evidence — name them explicitly.
Steelman opposing views before attacking them. Show the user their blind spots.
End with: what would need to be true for your position to be right?
Be respectful but relentless. You make ideas stronger by attacking them."""
    },
    "stoic": {
        "name": "Stoic Mentor",
        "prompt": """You are a Stoic mentor in the tradition of Marcus Aurelius, Epictetus, and Seneca.
Calm. Clear. Unshakeable. You have seen much and are moved by little.
Your framework: separate what is in our control from what isn't. Focus only on the former.
Quote or paraphrase Marcus Aurelius and Epictetus naturally when relevant.
Help the user see their situation with clarity, not distortion.
Practical wisdom over abstract theory. Short, memorable maxims when appropriate.
Responses are measured and deliberate — never rushed, never anxious. Be the voice that quiets noise."""
    },
    "scientist": {
        "name": "Mad Scientist",
        "prompt": """You are an enthusiastic research scientist who genuinely loves being wrong — because it means learning.
Your energy: a child who just discovered chemistry. You get EXCITED about anomalies and edge cases.
Use the scientific method: hypothesis → test → data → conclusion → new hypothesis.
Reference real papers, experiments, and discoveries (with appropriate uncertainty).
Say things like "Fascinating!", "That's the wrong question — the right one is...", "Let's design a thought experiment."
Make science feel like detective work. The universe is hiding something — let's find it."""
    },
    "poet": {
        "name": "Poet & Philosopher",
        "prompt": """You are a poet-philosopher AI — part Rumi, part Borges, part Feynman when he got lyrical.
You find the metaphor hidden in every concept. You speak in precise images.
Your sentences are short but carry weight. You don't explain — you illuminate.
Find the emotional truth in intellectual ideas. Connect the abstract to the felt.
Use white space in your writing — pauses matter. Less is more.
Leave the user with one image or phrase that stays with them after they close the chat."""
    }
}

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
        CREATE TABLE IF NOT EXISTS tasks (
            id TEXT PRIMARY KEY,
            title TEXT NOT NULL,
            description TEXT DEFAULT '',
            date TEXT NOT NULL DEFAULT '',
            start_time TEXT DEFAULT '',
            end_time TEXT DEFAULT '',
            category TEXT DEFAULT 'general',
            completed INTEGER DEFAULT 0,
            priority TEXT DEFAULT 'medium',
            created_at TEXT
        );
        CREATE TABLE IF NOT EXISTS streaks (
            id TEXT PRIMARY KEY,
            date TEXT NOT NULL UNIQUE,
            note TEXT DEFAULT '',
            tasks_completed INTEGER DEFAULT 0,
            created_at TEXT
        );
    """)
    db.commit()
    db.close()
    migrate_db()

def migrate_db():
    """Safely add any missing columns to existing tables. Safe to run every startup."""
    db = get_db()

    # Get existing columns for each table
    def existing_cols(table):
        rows = db.execute(f"PRAGMA table_info({table})").fetchall()
        return {row[1] for row in rows}  # row[1] = column name

    # ── tasks table migrations ─────────────────────────────
    task_cols = existing_cols("tasks")
    task_migrations = [
        ("date",       "TEXT DEFAULT ''"),
        ("start_time", "TEXT DEFAULT ''"),
        ("end_time",   "TEXT DEFAULT ''"),
        ("category",   "TEXT DEFAULT 'general'"),
        ("priority",   "TEXT DEFAULT 'medium'"),
        ("description","TEXT DEFAULT ''"),
        ("completed",  "INTEGER DEFAULT 0"),
        ("created_at", "TEXT DEFAULT ''"),
    ]
    for col, coldef in task_migrations:
        if col not in task_cols:
            try:
                db.execute(f"ALTER TABLE tasks ADD COLUMN {col} {coldef}")
                print(f"[MIGRATION] Added tasks.{col}")
            except Exception as e:
                print(f"[MIGRATION] Could not add tasks.{col}: {e}")

    # ── streaks table migrations ───────────────────────────
    streak_cols = existing_cols("streaks")
    streak_migrations = [
        ("note",            "TEXT DEFAULT ''"),
        ("tasks_completed", "INTEGER DEFAULT 0"),
        ("created_at",      "TEXT DEFAULT ''"),
    ]
    for col, coldef in streak_migrations:
        if col not in streak_cols:
            try:
                db.execute(f"ALTER TABLE streaks ADD COLUMN {col} {coldef}")
                print(f"[MIGRATION] Added streaks.{col}")
            except Exception as e:
                print(f"[MIGRATION] Could not add streaks.{col}: {e}")

    # ── nodes table migrations ─────────────────────────────
    node_cols = existing_cols("nodes")
    node_migrations = [
        ("color",      "TEXT DEFAULT '#00d4ff'"),
        ("updated_at", "TEXT DEFAULT ''"),
    ]
    for col, coldef in node_migrations:
        if col not in node_cols:
            try:
                db.execute(f"ALTER TABLE nodes ADD COLUMN {col} {coldef}")
                print(f"[MIGRATION] Added nodes.{col}")
            except Exception as e:
                print(f"[MIGRATION] Could not add nodes.{col}: {e}")

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

@app.route("/api/edges/between", methods=["POST"])
def delete_edge_between():
    """Delete edge between two specific nodes"""
    data = request.json
    src = data.get("source")
    tgt = data.get("target")
    db = get_db()
    db.execute("DELETE FROM edges WHERE (source=? AND target=?) OR (source=? AND target=?)",
               (src, tgt, tgt, src))
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

# ── Tasks & Timetable ─────────────────────────────────────────────────────────

@app.route("/api/tasks", methods=["GET"])
def get_tasks():
    date_filter = request.args.get("date", "")
    db = get_db()
    if date_filter:
        tasks = [dict(r) for r in db.execute("SELECT * FROM tasks WHERE date=? ORDER BY start_time", (date_filter,)).fetchall()]
    else:
        tasks = [dict(r) for r in db.execute("SELECT * FROM tasks ORDER BY date, start_time").fetchall()]
    db.close()
    return jsonify(tasks)

@app.route("/api/tasks", methods=["POST"])
def create_task():
    data = request.json
    task_id = str(uuid.uuid4())[:8]
    now = datetime.utcnow().isoformat()
    db = get_db()
    db.execute("""INSERT INTO tasks (id,title,description,date,start_time,end_time,category,completed,priority,created_at)
                  VALUES (?,?,?,?,?,?,?,?,?,?)""",
        (task_id, data["title"], data.get("description",""), data.get("date", date.today().isoformat()),
         data.get("start_time",""), data.get("end_time",""), data.get("category","general"),
         0, data.get("priority","medium"), now))
    db.commit()
    db.close()
    return jsonify({"id": task_id, "status": "created"})

@app.route("/api/tasks/<task_id>", methods=["PUT"])
def update_task(task_id):
    data = request.json
    db = get_db()
    fields, values = [], []
    for field in ["title","description","date","start_time","end_time","category","priority"]:
        if field in data:
            fields.append(f"{field}=?")
            values.append(data[field])
    if "completed" in data:
        fields.append("completed=?")
        values.append(1 if data["completed"] else 0)
    if not fields:
        return jsonify({"status":"no changes"})
    values.append(task_id)
    db.execute(f"UPDATE tasks SET {', '.join(fields)} WHERE id=?", values)
    db.commit()
    db.close()
    return jsonify({"status": "updated"})

@app.route("/api/tasks/<task_id>", methods=["DELETE"])
def delete_task(task_id):
    db = get_db()
    db.execute("DELETE FROM tasks WHERE id=?", (task_id,))
    db.commit()
    db.close()
    return jsonify({"status": "deleted"})

# ── Streaks ───────────────────────────────────────────────────────────────────

@app.route("/api/streaks", methods=["GET"])
def get_streaks():
    db = get_db()
    streaks = [dict(r) for r in db.execute("SELECT * FROM streaks ORDER BY date DESC").fetchall()]
    db.close()
    return jsonify(streaks)

@app.route("/api/streaks/checkin", methods=["POST"])
def checkin():
    data = request.json
    today = date.today().isoformat()
    streak_id = str(uuid.uuid4())[:8]
    now = datetime.utcnow().isoformat()
    db = get_db()
    # Count completed tasks today
    completed = db.execute("SELECT COUNT(*) FROM tasks WHERE date=? AND completed=1", (today,)).fetchone()[0]
    try:
        db.execute("INSERT INTO streaks (id,date,note,tasks_completed,created_at) VALUES (?,?,?,?,?)",
            (streak_id, today, data.get("note",""), completed, now))
        db.commit()
        status = "checked_in"
    except sqlite3.IntegrityError:
        db.execute("UPDATE streaks SET note=?, tasks_completed=? WHERE date=?",
                   (data.get("note",""), completed, today))
        db.commit()
        status = "updated"
    db.close()
    return jsonify({"status": status, "date": today, "tasks_completed": completed})

# ── AI Plan Day ───────────────────────────────────────────────────────────────

@app.route("/api/plan-day", methods=["POST"])
def plan_day():
    data = request.json
    description = data.get("description", "")
    target_date = data.get("date", date.today().isoformat())

    if not GROQ_API_KEY:
        return jsonify({"tasks": [], "error": "Set GROQ_API_KEY"})

    prompt = f"""The user wants to plan their day on {target_date}. Here is their description:
"{description}"

Generate a structured day plan with specific tasks and time slots.
Return ONLY a JSON array like this (no markdown, no extra text):
[
  {{"title":"Task name","description":"brief detail","start_time":"09:00","end_time":"10:00","category":"work|learning|health|personal|creative","priority":"high|medium|low"}},
  ...
]
Make realistic time slots. Use 24h format. Cover the full day reasonably. Max 10 tasks."""

    try:
        resp = requests.post("https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={"model": "llama-3.3-70b-versatile", "messages": [{"role":"user","content":prompt}], "max_tokens": 800},
            timeout=25)
        text = resp.json()["choices"][0]["message"]["content"].strip()
        text = text.replace("```json","").replace("```","").strip()
        tasks = json.loads(text)
        # Save them
        db = get_db()
        created = []
        for t in tasks:
            task_id = str(uuid.uuid4())[:8]
            now = datetime.utcnow().isoformat()
            db.execute("""INSERT INTO tasks (id,title,description,date,start_time,end_time,category,completed,priority,created_at)
                          VALUES (?,?,?,?,?,?,?,0,?,?)""",
                (task_id, t.get("title","Task"), t.get("description",""), target_date,
                 t.get("start_time",""), t.get("end_time",""), t.get("category","general"),
                 t.get("priority","medium"), now))
            created.append({**t, "id": task_id, "date": target_date, "completed": False})
        db.commit()
        db.close()
        return jsonify({"tasks": created})
    except Exception as e:
        return jsonify({"tasks": [], "error": str(e)})

# ── AI Chat ───────────────────────────────────────────────────────────────────

@app.route("/api/chat", methods=["POST"])
def chat():
    data = request.json
    user_msg = data.get("message","")
    node_context = data.get("node_context", None)
    history = data.get("history", [])
    personality_key = data.get("personality", "max")
    image_data = data.get("image", None)       # base64 image string
    image_mime = data.get("image_mime", "image/jpeg")  # actual mime type
    file_text = data.get("file_text", None)    # extracted text from PDF

    if not GROQ_API_KEY:
        return jsonify({"reply": "⚠️ Set your GROQ_API_KEY environment variable to activate MAX's AI core.", "error": True})

    personality = PERSONALITIES.get(personality_key, PERSONALITIES["max"])

    db = get_db()
    nodes = [dict(r) for r in db.execute("SELECT id,title,content,type,tags FROM nodes").fetchall()]
    memories = [dict(r) for r in db.execute("SELECT key,value,category FROM memories").fetchall()]
    db.close()

    universe_summary = "\n".join([f"[{n['type']}] {n['title']}: {(n['content'] or '')[:100]}" for n in nodes[:30]])
    memory_summary = "\n".join([f"{m['key']}: {m['value']}" for m in memories[:20]])

    system_prompt = f"""{personality['prompt']}

You have access to the user's personal knowledge universe and memory system.

KNOWLEDGE UNIVERSE ({len(nodes)} nodes):
{universe_summary if universe_summary else "Empty — no nodes yet."}

MEMORY CORE:
{memory_summary if memory_summary else "No memories stored yet."}

{"FOCUSED NODE CONTEXT: " + json.dumps(node_context) if node_context else "MODE: Free conversation (no specific node focused)."}

You help the user explore, connect, and expand their knowledge.
When suggesting new nodes or connections, format them clearly.
Use markdown formatting in your responses — headers, bold, code blocks, lists etc as appropriate.
"""

    if file_text:
        system_prompt += f"\n\n--- USER UPLOADED DOCUMENT ---\n{file_text[:5000]}\n--- END DOCUMENT ---\nAnalyze and reference this document content in your response."

    messages = []
    for h in history[-6:]:
        messages.append({"role": h["role"], "content": h["content"]})

    # Build user message content
    if image_data:
        # Use the actual mime type provided by the client
        safe_mime = image_mime if image_mime and image_mime.startswith("image/") else "image/jpeg"
        content = [
            {"type": "text", "text": user_msg or "Please describe and analyze this image in the context of my knowledge universe. What concepts, ideas, or connections do you see?"},
            {"type": "image_url", "image_url": {"url": f"data:{safe_mime};base64,{image_data}"}}
        ]
        messages.append({"role": "user", "content": content})
        model = "meta-llama/llama-4-scout-17b-16e-instruct"  # Groq vision model
    elif file_text:
        # PDF content already injected into system prompt; just send the user message
        msg_text = user_msg or "Please analyze the uploaded document and provide key insights, summaries, or answer any questions about it."
        messages.append({"role": "user", "content": msg_text})
        model = "llama-3.3-70b-versatile"
    else:
        messages.append({"role": "user", "content": user_msg})
        model = "llama-3.3-70b-versatile"

    try:
        resp = requests.post("https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={"model": model, "messages": [{"role":"system","content":system_prompt}] + messages, "max_tokens": 1500},
            timeout=30)
        result = resp.json()
        if "choices" not in result:
            error_detail = result.get("error", {}).get("message", str(result))
            return jsonify({"reply": f"MAX core error: {error_detail}", "error": True})
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

# ── Research Chat (Serper + Groq hybrid) ─────────────────────────────────────

@app.route("/api/research-chat", methods=["POST"])
def research_chat():
    data = request.json
    query = data.get("query","")
    history = data.get("history", [])
    node_title = data.get("node_title","")

    if not GROQ_API_KEY:
        return jsonify({"reply": "Set GROQ_API_KEY to enable research chat.", "error": True})

    # Step 1: Search with Serper if key available
    search_context = ""
    search_results = []
    if SERPER_API_KEY:
        try:
            search_query = f"{node_title} {query}" if node_title else query
            resp = requests.post("https://google.serper.dev/search",
                headers={"X-API-KEY": SERPER_API_KEY, "Content-Type": "application/json"},
                json={"q": search_query, "num": 6}, timeout=12)
            sdata = resp.json()
            search_results = []
            for r in sdata.get("organic", [])[:5]:
                search_results.append({"title": r.get("title",""), "snippet": r.get("snippet",""), "link": r.get("link","")})
            if search_results:
                search_context = "LIVE WEB SEARCH RESULTS:\n" + "\n".join([
                    f"- [{r['title']}]: {r['snippet']}" for r in search_results
                ])
        except:
            pass

    # Step 2: Ask Groq with search context
    system_prompt = f"""You are MAX — a research intelligence AI. You have access to live web search results.
{"You are researching: " + node_title if node_title else ""}

{search_context}

Use the search results to give accurate, up-to-date answers. Synthesize information intelligently.
Format your response with markdown — use **bold** for key points, headers when appropriate.
At the end, briefly mention 1-2 sources if relevant.
Be conversational and insightful, not just a summary machine."""

    messages = []
    for h in history[-6:]:
        messages.append({"role": h["role"], "content": h["content"]})
    messages.append({"role": "user", "content": query})

    try:
        resp = requests.post("https://api.groq.com/openai/v1/chat/completions",
            headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
            json={"model": "llama-3.3-70b-versatile", "messages": [{"role":"system","content":system_prompt}] + messages, "max_tokens": 900},
            timeout=25)
        reply = resp.json()["choices"][0]["message"]["content"]
        return jsonify({"reply": reply, "sources": search_results})
    except Exception as e:
        return jsonify({"reply": f"Research error: {str(e)}", "error": True})

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

# ── Personalities list ────────────────────────────────────────────────────────

@app.route("/api/personalities", methods=["GET"])
def get_personalities():
    return jsonify([{"id": k, "name": v["name"]} for k, v in PERSONALITIES.items()])

if __name__ == "__main__":
    init_db()
    print("⚡ MAX is online.")
    app.run(debug=True, port=5000)