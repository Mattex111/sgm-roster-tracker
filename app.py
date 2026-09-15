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
        .header { position: sticky; top: 0; background: #161b22; padding: 14px 18px; border-radius: 8px; display: flex; flex-wrap: wrap; gap: 10px; align-items: center; z-index: 100; border: 1px solid #30363d; box-shadow: 0 4px 12px rgba(0,0,0,0.5); }
        input[type="text"] { padding: 8px 12px; border-radius: 6px; border: 1px solid #30363d; background: #0d1117; color: #fff; width: 140px; font-size: 0.9rem; }
        select { padding: 8px 10px; border-radius: 6px; border: 1px solid #30363d; background: #0d1117; color: #fff; font-size: 0.9rem; cursor: pointer; }
        button { padding: 8px 13px; border-radius: 6px; border: none; font-weight: 600; cursor: pointer; transition: 0.2s; font-size: 0.88rem; }
        .btn-green { background: #238636; color: #fff; }
        .btn-green:hover { background: #2ea043; }
        .btn-secondary { background: #21262d; color: #c9d1d9; border: 1px solid #30363d; }
        .btn-secondary:hover { background: #30363d; }
        .btn-undo { background: #388bfd1a; color: #58a6ff; border: 1px solid #388bfd66; }
        .btn-undo:hover:not(:disabled) { background: #388bfd33; }
        .btn-undo:disabled { opacity: 0.4; cursor: not-allowed; }
        .toggle-label { font-size: 0.85rem; color: #8b949e; display: flex; align-items: center; gap: 6px; cursor: pointer; user-select: none; }
        .counter { margin-left: auto; font-size: 0.95rem; color: #8b949e; }
        .counter span { color: #58a6ff; font-weight: bold; }

        .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px; margin-top: 20px; }
        .card { background: #161b22; border: 1px solid #30363d; border-radius: 8px; padding: 14px; display: flex; flex-direction: column; gap: 8px; transition: border-color 0.2s, background 0.2s; }
        .card.unlocked { border-color: #238636; background: #0d1c14; }
        .card-head { display: flex; align-items: center; justify-content: space-between; }
        .name-label { font-size: 1.05rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 8px; }
        .name-label input { transform: scale(1.2); cursor: pointer; }
        .badges { display: flex; gap: 5px; flex-wrap: wrap; justify-content: flex-end; }
        .tag { font-size: 0.7rem; padding: 2px 6px; border-radius: 10px; font-weight: bold; text-transform: uppercase; }
        .Diamond { background: #3ec5ff; color: #051626; }
        .Gold { background: #e3b341; color: #201700; }
        .Silver { background: #8b949e; color: #0d1117; }
        .Bronze { background: #bf6a40; color: #fff; }
        .element-tag { font-size: 0.7rem; padding: 2px 6px; border-radius: 10px; font-weight: bold; background: #21262d; color: #c9d1d9; border: 1px solid #30363d; }
        .char-tag { font-size: 0.7rem; padding: 2px 6px; border-radius: 10px; font-weight: bold; background: #30363d; color: #58a6ff; }

        .stats-row { display: flex; justify-content: space-between; background: #0d1117; border: 1px solid #21262d; border-radius: 6px; padding: 5px 12px; font-size: 0.8rem; font-weight: 600; }
        .stat-item { display: flex; gap: 6px; align-items: center; }
        .stat-atk { color: #ff7b72; }
        .stat-hp { color: #7ee787; }

        .ratings-row { display: grid; grid-template-columns: repeat(4, 1fr); gap: 4px; background: #0b0e14; padding: 6px 4px; border-radius: 6px; border: 1px solid #21262d; text-align: center; }
        .rate-box span:first-child { display: block; font-size: 0.65rem; color: #8b949e; text-transform: uppercase; margin-bottom: 2px; font-weight: normal; }
        .rank-badge { font-weight: 800; font-size: 0.85rem; }
        .rank-SS { color: #ff2d87 !important; text-shadow: 0 0 8px rgba(255, 45, 135, 0.4); }
        .rank-S  { color: #00ff66 !important; text-shadow: 0 0 8px rgba(0, 255, 102, 0.4); }
        .rank-A  { color: #ffd000 !important; }
        .rank-B  { color: #ff7b00 !important; }
        .rank-C  { color: #00bfff !important; }
        .rank-U, .rank-TBD { color: #57606a !important; }

        .sa-box { font-size: 0.82rem; line-height: 1.35; color: #8b949e; background: #0d1117; padding: 8px; border-radius: 6px; border: 1px solid #21262d; }
        .sa-box strong { color: #58a6ff; }
    </style>
</head>
<body>
    <div class="header">
        <input type="text" id="search" placeholder="Search variant..." oninput="filterAndSortCards()">

        <select id="charFilter" onchange="filterAndSortCards()">
            <option value="">All Fighters</option>
            {% for c in characters %}
            <option value="{{ c }}">{{ c }}</option>
            {% endfor %}
        </select>

        <select id="elementFilter" onchange="filterAndSortCards()">
            <option value="">All Elements</option>
            <option value="Air">Air</option>
            <option value="Dark">Dark</option>
            <option value="Fire">Fire</option>
            <option value="Light">Light</option>
            <option value="Water">Water</option>
            <option value="Neutral">Neutral</option>
        </select>

        <select id="tierFilter" onchange="filterAndSortCards()">
            <option value="">All Tiers</option>
            <option value="Diamond">Diamond</option>
            <option value="Gold">Gold</option>
            <option value="Silver">Silver</option>
            <option value="Bronze">Bronze</option>
        </select>

        <select id="statusFilter" onchange="filterAndSortCards()">
            <option value="">All Statuses</option>
            <option value="unlocked">Unlocked Only</option>
            <option value="locked">Locked Only</option>
        </select>

        <select id="modeFilter" onchange="filterAndSortCards()">
            <option value="any">Any Mode</option>
            <option value="pf_off">PF Offense</option>
            <option value="rift_off">Rift Offense</option>
            <option value="rift_def">Rift Defense</option>
            <option value="realms">Parallel Realms</option>
        </select>

        <select id="rankFilter" onchange="filterAndSortCards()">
            <option value="0">All Ranks</option>
            <option value="5">SS Only</option>
            <option value="4">S or better</option>
            <option value="3">A or better</option>
            <option value="2">B or better</option>
            <option value="1">C or better</option>
        </select>

        <select id="sortBy" onchange="filterAndSortCards()">
            <option value="name_asc">Sort: Name (A-Z)</option>
            <option value="name_desc">Sort: Name (Z-A)</option>
            <option value="atk_desc">Sort: ATK (High → Low)</option>
            <option value="atk_asc">Sort: ATK (Low → High)</option>
            <option value="hp_desc">Sort: HP (High → Low)</option>
            <option value="hp_asc">Sort: HP (Low → High)</option>
        </select>

        <button class="btn-secondary" onclick="batchToggle(true)">Select Visible</button>
        <button class="btn-secondary" onclick="batchToggle(false)">Deselect Visible</button>
        <button class="btn-undo" id="undoBtn" onclick="triggerUndo()" disabled title="Shortcut: Ctrl+Z">Undo</button>

        <label class="toggle-label" title="Toggle tier list badges in card view">
            <input type="checkbox" id="showRatingsToggle" onchange="toggleRatingsVisibility(this.checked)" checked>
            Show Tier Ratings
        </label>

        <label class="toggle-label" title="Include tier ratings when copying roster">
            <input type="checkbox" id="exportRatingsToggle" checked>
            Export Ratings
        </label>

        <button class="btn-green" onclick="copyRoster()">Copy Roster for AI</button>

        <div class="counter">Unlocked: <span id="unlockCount">0</span></div>
    </div>

    <div class="grid" id="cardGrid">
        {% for key, v in variants.items() %}
        <div class="card {% if v.unlocked %}unlocked{% endif %}"
             data-name="{{ v.name.lower() }}"
             data-rawname="{{ v.name }}"
             data-char="{{ v.character }}"
             data-element="{{ v.element }}"
             data-tier="{{ v.tier }}"
             data-atk="{{ v.atk_max if v.atk_max else 0 }}"
             data-hp="{{ v.hp_max if v.hp_max else 0 }}"
             data-unlocked="{{ 'true' if v.unlocked else 'false' }}"
             data-pfoff="{{ v.ratings.pf_off if v.ratings else 'U' }}"
             data-riftoff="{{ v.ratings.rift_off if v.ratings else 'U' }}"
             data-riftdef="{{ v.ratings.rift_def if v.ratings else 'U' }}"
             data-realms="{{ v.ratings.realms if v.ratings else 'U' }}">
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

            {% if v.atk_max or v.hp_max %}
            <div class="stats-row">
                <span class="stat-item stat-atk">⚔️ ATK: {{ "{:,}".format(v.atk_max) if v.atk_max else "N/A" }}</span>
                <span class="stat-item stat-hp">❤️ HP: {{ "{:,}".format(v.hp_max) if v.hp_max else "N/A" }}</span>
            </div>
            {% endif %}

            {% if v.ratings %}
            <div class="ratings-row">
                <div class="rate-box"><span>PF Off</span><span class="rank-badge rank-{{ v.ratings.pf_off.strip() }}">{{ v.ratings.pf_off }}</span></div>
                <div class="rate-box"><span>Rift Off</span><span class="rank-badge rank-{{ v.ratings.rift_off.strip() }}">{{ v.ratings.rift_off }}</span></div>
                <div class="rate-box"><span>Rift Def</span><span class="rank-badge rank-{{ v.ratings.rift_def.strip() }}">{{ v.ratings.rift_def }}</span></div>
                <div class="rate-box"><span>Realms</span><span class="rank-badge rank-{{ v.ratings.realms.strip() }}">{{ v.ratings.realms }}</span></div>
            </div>
            {% endif %}

            <div class="sa-box"><strong>SA1:</strong> {{ v.sa1 if v.sa1 else "N/A" }}</div>
            <div class="sa-box"><strong>SA2:</strong> {{ v.sa2 if v.sa2 else "N/A" }}</div>
        </div>
        {% endfor %}
    </div>

    <script>
        const undoStack = [];
        const RANK_VALUES = { 'SS': 5, 'S': 4, 'A': 3, 'B': 2, 'C': 1, 'U': 0, 'TBD': 0 };

        function updateUndoButton() {
            const btn = document.getElementById('undoBtn');
            btn.disabled = undoStack.length === 0;
        }

        function saveSnapshot(entries) {
            undoStack.push(entries);
            updateUndoButton();
        }

        function updateCount() {
            const count = document.querySelectorAll('.card.unlocked').length;
            document.getElementById('unlockCount').innerText = count;
        }

        function setCardState(name, status) {
            const card = document.querySelector(`.card[data-rawname="${CSS.escape(name)}"]`);
            if (card) {
                card.dataset.unlocked = status ? 'true' : 'false';
                const cb = card.querySelector('input[type="checkbox"]');
                if (cb) cb.checked = status;
                if (status) card.classList.add('unlocked');
                else card.classList.remove('unlocked');
            }
        }

        function toggleLock(name, status, el) {
            saveSnapshot([{ name: name, previousState: !status }]);

            fetch('/toggle', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({name: name, unlocked: status})
            }).then(() => {
                setCardState(name, status);
                updateCount();
            });
        }

        function batchToggle(status) {
            const visibleCards = Array.from(document.querySelectorAll('.card')).filter(c => c.style.display !== 'none');
            const targetCards = visibleCards.filter(c => (c.dataset.unlocked === 'true') !== status);

            if (targetCards.length === 0) return;

            const actionText = status ? "SELECT" : "DESELECT";
            const confirmed = confirm(`Are you sure you want to ${actionText} all ${targetCards.length} visible fighter(s)?`);
            if (!confirmed) return;

            const snapshot = targetCards.map(c => ({
                name: c.dataset.rawname,
                previousState: c.dataset.unlocked === 'true'
            }));
            saveSnapshot(snapshot);

            const names = targetCards.map(c => c.dataset.rawname);
            fetch('/toggle_batch', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({names: names, unlocked: status})
            }).then(() => {
                names.forEach(name => setCardState(name, status));
                updateCount();
            });
        }

        function triggerUndo() {
            if (undoStack.length === 0) return;
            const lastAction = undoStack.pop();
            updateUndoButton();

            fetch('/apply_states', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({states: lastAction})
            }).then(() => {
                lastAction.forEach(item => setCardState(item.name, item.previousState));
                updateCount();
            });
        }

        // Keyboard shortcut: Ctrl+Z or Cmd+Z
        document.addEventListener('keydown', (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
                if (document.activeElement.tagName !== 'INPUT') {
                    e.preventDefault();
                    triggerUndo();
                }
            }
        });

        function toggleRatingsVisibility(show) {
            document.querySelectorAll('.ratings-row').forEach(el => {
                el.style.display = show ? 'grid' : 'none';
            });
        }

        function filterAndSortCards() {
            const query = document.getElementById('search').value.toLowerCase();
            const char = document.getElementById('charFilter').value;
            const elem = document.getElementById('elementFilter').value;
            const tier = document.getElementById('tierFilter').value;
            const status = document.getElementById('statusFilter').value;
            const mode = document.getElementById('modeFilter').value;
            const minRank = parseInt(document.getElementById('rankFilter').value, 10);
            const sortBy = document.getElementById('sortBy').value;

            const grid = document.getElementById('cardGrid');
            const cards = Array.from(document.querySelectorAll('.card'));

            // Filter logic
            cards.forEach(c => {
                const matchName = c.dataset.name.includes(query);
                const matchChar = !char || c.dataset.char === char;
                const matchElem = !elem || c.dataset.element === elem;
                const matchTier = !tier || c.dataset.tier === tier;
                const isUnlocked = c.dataset.unlocked === 'true';
                const matchStatus = !status || (status === 'unlocked' && isUnlocked) || (status === 'locked' && !isUnlocked);

                let matchRank = true;
                if (minRank > 0) {
                    const p = RANK_VALUES[c.dataset.pfoff] || 0;
                    const ro = RANK_VALUES[c.dataset.riftoff] || 0;
                    const rd = RANK_VALUES[c.dataset.riftdef] || 0;
                    const rl = RANK_VALUES[c.dataset.realms] || 0;

                    if (mode === 'any') {
                        matchRank = Math.max(p, ro, rd, rl) >= minRank;
                    } else if (mode === 'pf_off') {
                        matchRank = p >= minRank;
                    } else if (mode === 'rift_off') {
                        matchRank = ro >= minRank;
                    } else if (mode === 'rift_def') {
                        matchRank = rd >= minRank;
                    } else if (mode === 'realms') {
                        matchRank = rl >= minRank;
                    }
                }

                c.style.display = (matchName && matchChar && matchElem && matchTier && matchStatus && matchRank) ? 'flex' : 'none';
            });

            // Sorting logic
            cards.sort((a, b) => {
                const atkA = parseInt(a.dataset.atk, 10) || 0;
                const atkB = parseInt(b.dataset.atk, 10) || 0;
                const hpA = parseInt(a.dataset.hp, 10) || 0;
                const hpB = parseInt(b.dataset.hp, 10) || 0;
                const nameA = a.dataset.name;
                const nameB = b.dataset.name;

                if (sortBy === 'atk_desc') return atkB - atkA;
                if (sortBy === 'atk_asc') return atkA - atkB;
                if (sortBy === 'hp_desc') return hpB - hpA;
                if (sortBy === 'hp_asc') return hpA - hpB;
                if (sortBy === 'name_desc') return nameB.localeCompare(nameA);
                return nameA.localeCompare(nameB);
            });

            cards.forEach(c => grid.appendChild(c));
        }

        function copyRoster() {
            fetch('/export')
                .then(r => r.json())
                .then(data => {
                    if (data.length === 0) {
                        alert("No variants selected! Check some fighters first.");
                        return;
                    }
                    const includeRatings = document.getElementById('exportRatingsToggle').checked;
                    const header = "### MY SKULLGIRLS MOBILE UNLOCKED ROSTER\\n";
                    const body = data.map(x => {
                        let line = `- [${x.character} | ${x.tier} - ${x.element}] ${x.name}:\\n`;
                        if (x.atk_max || x.hp_max) {
                            line += `  Base Stats: Max ATK: ${x.atk_max ? x.atk_max.toLocaleString() : 'N/A'}, Max HP: ${x.hp_max ? x.hp_max.toLocaleString() : 'N/A'}\\n`;
                        }
                        if (includeRatings && x.ratings) {
                            line += `  Ratings: PF Offense: ${x.ratings.pf_off}, Rift Offense: ${x.ratings.rift_off}, Rift Defense: ${x.ratings.rift_def}, Parallel Realms: ${x.ratings.realms}\\n`;
                        }
                        line += `  SA1: ${x.sa1}\\n  SA2: ${x.sa2}`;
                        return line;
                    }).join('\\n');

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

@app.route("/toggle_batch", methods=["POST"])
def toggle_batch():
    payload = request.json
    names = payload.get("names", [])
    unlocked = payload.get("unlocked", False)

    unlocked_set = set()
    if os.path.exists(USER_ROSTER_FILE):
        with open(USER_ROSTER_FILE, "r", encoding="utf-8") as f:
            unlocked_set = set(json.load(f))

    if unlocked:
        unlocked_set.update(names)
    else:
        unlocked_set.difference_update(names)

    save_user_roster(unlocked_set)
    return jsonify({"status": "ok"})

@app.route("/apply_states", methods=["POST"])
def apply_states():
    payload = request.json
    states = payload.get("states", [])

    unlocked_set = set()
    if os.path.exists(USER_ROSTER_FILE):
        with open(USER_ROSTER_FILE, "r", encoding="utf-8") as f:
            unlocked_set = set(json.load(f))

    for item in states:
        name = item.get("name")
        prev = item.get("previousState", False)
        if prev:
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
