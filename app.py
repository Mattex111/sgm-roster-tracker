import json
import os
from flask import Flask, jsonify, request, render_template_string

app = Flask(__name__)
DB_FILE = "sgm_database.json"
USER_ROSTER_FILE = "my_roster.json"

def load_data():
    with open(DB_FILE, "r", encoding="utf-8") as f:
        db = json.load(f)

    unlocked_set = set()
    if os.path.exists(USER_ROSTER_FILE):
        with open(USER_ROSTER_FILE, "r", encoding="utf-8") as f:
            unlocked_set = set(json.load(f))

    for name in db:
        db[name]["unlocked"] = name in unlocked_set
    return db

def save_user_roster(unlocked_names):
    with open(USER_ROSTER_FILE, "w", encoding="utf-8") as f:
        json.dump(list(unlocked_names), f, indent=2, ensure_ascii=False)

HTML = """
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <title>SGM Roster Tracker</title>
    <style>
        body { font-family: system-ui, -apple-system, sans-serif; background: #0f111a; color: #e6edf3; margin: 0; padding: 20px; }
        .header { position: sticky; top: 0; background: #161b22; padding: 16px 20px; border-radius: 8px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; z-index: 100; border: 1px solid #30363d; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
        input[type="text"] { padding: 9px 14px; border-radius: 6px; border: 1px solid #30363d; background: #0d1117; color: #fff; width: 220px; font-size: 0.95rem; }
        select { padding: 9px 14px; border-radius: 6px; border: 1px solid #30363d; background: #0d1117; color: #fff; font-size: 0.95rem; cursor: pointer; }
        button { padding: 9px 16px; border-radius: 6px; border: none; background: #238636; color: #fff; font-weight: 600; cursor: pointer; transition: 0.2s; }
        button:hover { background: #2ea043; }
        .counter { margin-left: auto; font-size: 0.95rem; color: #8b949e; }
        .counter span { color: #58a6ff; font-weight: bold; }
        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; margin-top: 20px; }
        .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 16px; display: flex; flex-direction: column; gap: 8px; transition: border-color 0.2s, background 0.2s; }
        .card.unlocked { border-color: #238636; background: #0d1c14; }
        .card-head { display: flex; align-items: center; justify-content: space-between; }
        .name-label { font-size: 1.1rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .name-label input { transform: scale(1.2); cursor: pointer; }
        .badges { display: flex; gap: 6px; flex-wrap: wrap; justify-content: flex-end; }
        .tag { font-size: 0.72rem; padding: 2px 7px; border-radius: 12px; font-weight: bold; text-transform: uppercase; }
        .Diamond { background: #3ec5ff; color: #051626; }
        .Gold { background: #e3b341; color: #201700; }
        .Silver { background: #8b949e; color: #0d1117; }
        .Bronze { background: #bf6a40; color: #fff; }
        .element-tag { font-size: 0.72rem; padding: 2px 7px; border-radius: 12px; font-weight: bold; background: #21262d; color: #c9d1d9; border: 1px solid #30363d; }
        .char-tag { font-size: 0.72rem; padding: 2px 7px; border-radius: 12px; font-weight: bold; background: #30363d; color: #58a6ff; }
        .sa-box { font-size: 0.82rem; line-height: 1.35; color: #8b949e; background: #0d1117; padding: 8px; border-radius: 6px; border: 1px solid #21262d; margin-top: 4px; }
        .sa-box strong { color: #58a6ff; }
    </style>
</head>
<body>
    <div class="header">
        <input type="text" id="search" placeholder="Search variant..." oninput="filterCards()">

        <select id="charFilter" onchange="filterCards()">
            <option value="">All Fighters</option>
            {% for c in characters %}
            <option value="{{ c }}">{{ c }}</option>
            {% endfor %}
        </select>

        <select id="tierFilter" onchange="filterCards()">
            <option value="">All Tiers</option>
            <option value="Diamond">Diamond</option>
            <option value="Gold">Gold</option>
            <option value="Silver">Silver</option>
            <option value="Bronze">Bronze</option>
        </select>

        <select id="statusFilter" onchange="filterCards()">
            <option value="">All Statuses</option>
            <option value="unlocked">Unlocked Only</option>
            <option value="locked">Locked Only</option>
        </select>

        <button onclick="copyRoster()">Copy Roster for AI</button>
        <div class="counter">Unlocked: <span id="unlockCount">0</span></div>
    </div>

    <div class="grid" id="cardGrid">
        {% for key, v in variants.items() %}
        <div class="card {% if v.unlocked %}unlocked{% endif %}"
             data-name="{{ v.name.lower() }}"
             data-char="{{ v.character }}"
             data-tier="{{ v.tier }}"
             data-unlocked="{{ 'true' if v.unlocked else 'false' }}">
            <div class="card-head">
                <label class="name-label">
                    <input type="checkbox" onchange="toggleLock('{{ v.name }}', this.checked, this)" {% if v.unlocked %}checked{% endif %}>
                    {{ v.name }}
                </label>
                <div class="badges">
                    <span class="char-tag">{{ v.character }}</span>
                    <span class="tag {{ v.tier }}">{{ v.tier }}</span>
                    <span class="element-tag">{{ v.element }}</span>
                </div>
            </div>
            <div class="sa-box"><strong>SA1:</strong> {{ v.sa1 if v.sa1 else "N/A" }}</div>
            <div class="sa-box"><strong>SA2:</strong> {{ v.sa2 if v.sa2 else "N/A" }}</div>
        </div>
        {% endfor %}
    </div>

    <script>
        function updateCount() {
            const count = document.querySelectorAll('.card.unlocked').length;
            document.getElementById('unlockCount').innerText = count;
        }

        function toggleLock(name, status, el) {
            fetch('/toggle', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name: name, unlocked: status})
            }).then(() => {
                const card = el.closest('.card');
                card.dataset.unlocked = status ? 'true' : 'false';
                if (status) card.classList.add('unlocked');
                else card.classList.remove('unlocked');
                updateCount();
            });
        }

        function filterCards() {
            const query = document.getElementById('search').value.toLowerCase();
            const char = document.getElementById('charFilter').value;
            const tier = document.getElementById('tierFilter').value;
            const status = document.getElementById('statusFilter').value;

            document.querySelectorAll('.card').forEach(c => {
                const matchName = c.dataset.name.includes(query);
                const matchChar = !char || c.dataset.char === char;
                const matchTier = !tier || c.dataset.tier === tier;
                const isUnlocked = c.dataset.unlocked === 'true';
                const matchStatus = !status || (status === 'unlocked' && isUnlocked) || (status === 'locked' && !isUnlocked);

                c.style.display = (matchName && matchChar && matchTier && matchStatus) ? 'flex' : 'none';
            });
        }

        function copyRoster() {
            fetch('/export')
                .then(r => r.json())
                .then(data => {
                    if (data.length === 0) {
                        alert("No variants selected! Check some fighters first.");
                        return;
                    }
                    const header = "### MY SKULLGIRLS MOBILE UNLOCKED ROSTER\\n";
                    const body = data.map(x => `- [${x.character} | ${x.tier} - ${x.element}] ${x.name}:\\n  SA1: ${x.sa1}\\n  SA2: ${x.sa2}`).join('\\n');
                    const text = header + body;

                    navigator.clipboard.writeText(text).then(() => {
                        alert(`Copied ${data.length} fighters to clipboard! Paste directly into your AI chat.`);
                    });
                });
        }

        updateCount();
    </script>
</body>
</html>
"""

@app.route("/")
def index():
    data = load_data()
    chars = sorted(list(set(v.get("character", "Unknown") for v in data.values() if v.get("character") != "Unknown")))
    return render_template_string(HTML, variants=data, characters=chars)

@app.route("/toggle", methods=["POST"])
def toggle():
    payload = request.json
    name = payload.get("name")
    unlocked = payload.get("unlocked", False)

    unlocked_set = set()
    if os.path.exists(USER_ROSTER_FILE):
        with open(USER_ROSTER_FILE, "r", encoding="utf-8") as f:
            unlocked_set = set(json.load(f))

    if unlocked:
        unlocked_set.add(name)
    else:
        unlocked_set.discard(name)

    save_user_roster(unlocked_set)
    return jsonify({"status": "ok"})

@app.route("/export")
def export():
    data = load_data()
    return jsonify([v for v in data.values() if v.get("unlocked")])

if __name__ == "__main__":
    app.run(port=5000, debug=True)
