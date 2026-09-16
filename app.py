"""
Skullgirls Mobile - Roster Tracker Backend Server

Flask application providing offline web endpoints for tracking unlocked fighters,
inspecting stats and meta tier ratings, and exporting custom roster selections.
"""

import json
import os
from flask import Flask, jsonify, request, render_template

app = Flask(__name__)

# Data file paths
DB_FILE = "sgm_database.json"
BASE_ABILITIES_FILE = "base_abilities.json"
USER_ROSTER_FILE = "my_roster.json"
WISHLIST_FILE = "my_wishlist.json"
TEAMS_FILE = "my_teams.json"


def load_base_abilities():
    """
    Load character Prestige and Marquee base abilities dataset.

    Returns:
        dict: Mapping of character names to their Prestige & Marquee details.
    """
    if os.path.exists(BASE_ABILITIES_FILE):
        with open(BASE_ABILITIES_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def load_data():
    """
    Load all fighter variants from sgm_database.json and cross-reference
    with user's my_roster.json state file.

    Returns:
        dict: Complete dictionary of variant data with 'unlocked' boolean set.
    """
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
    """
    Persist unlocked fighter names set into local my_roster.json file.

    Args:
        unlocked_names (iterable): Collection of unlocked variant names.
    """
    with open(USER_ROSTER_FILE, "w", encoding="utf-8") as f:
        json.dump(list(unlocked_names), f, indent=2, ensure_ascii=False)


def load_wishlist():
    """
    Load the user's relic wishlist from my_wishlist.json.

    Returns:
        dict: Dictionary containing 'golds' and 'diamonds' arrays.
    """
    if os.path.exists(WISHLIST_FILE):
        with open(WISHLIST_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return {"golds": [], "diamonds": []}


def load_teams():
    """
    Load custom saved team loadouts from my_teams.json.

    Returns:
        list: List of team dictionaries.
    """
    if os.path.exists(TEAMS_FILE):
        with open(TEAMS_FILE, "r", encoding="utf-8") as f:
            return json.load(f)
    return []


def save_teams(teams):
    """
    Save custom team loadouts to my_teams.json.

    Args:
        teams (list): List of team dictionaries.
    """
    with open(TEAMS_FILE, "w", encoding="utf-8") as f:
        json.dump(teams, f, indent=2, ensure_ascii=False)


@app.route("/")
def index():
    """
    Render main application index dashboard template.
    """
    data = load_data()
    base_abilities = load_base_abilities()
    wishlist = load_wishlist()
    teams = load_teams()
    chars = sorted(
        list(
            set(
                v.get("character", "Unknown")
                for v in data.values()
                if v.get("character") != "Unknown"
            )
        )
    )
    return render_template(
        "index.html",
        variants=data,
        characters=chars,
        base_abilities=base_abilities,
        wishlist=wishlist,
        teams=teams,
    )


@app.route("/toggle", methods=["POST"])
def toggle():
    """
    Toggle owned/unlocked status for a single fighter variant.
    Payload: {"name": "Variant Name", "unlocked": true/false}
    """
    payload = request.json or {}
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
    """
    Batch update owned status for multiple fighter variants.
    Payload: {"names": ["Name 1", "Name 2"], "unlocked": true/false}
    """
    payload = request.json or {}
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
    """
    Apply snapshot state changes (used by client-side Undo handler).
    Payload: {"states": [{"name": "Variant Name", "previousState": true/false}]}
    """
    payload = request.json or {}
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


@app.route("/update_wishlist", methods=["POST"])
def update_wishlist():
    """
    Save the user's updated relic wishlist.
    Payload: {"golds": ["..."], "diamonds": ["..."]}
    """
    payload = request.json or {}
    golds = payload.get("golds", [])
    diamonds = payload.get("diamonds", [])

    with open(WISHLIST_FILE, "w", encoding="utf-8") as f:
        json.dump({"golds": golds, "diamonds": diamonds}, f, indent=2, ensure_ascii=False)
    
    return jsonify({"status": "ok"})


@app.route("/update_teams", methods=["POST"])
def update_teams():
    """
    Save the user's updated team loadouts.
    Payload: {"teams": [...]}
    """
    payload = request.json or {}
    teams = payload.get("teams", [])
    save_teams(teams)
    return jsonify({"status": "ok"})


@app.route("/export_all")
def export_all():
    """
    API endpoint returning raw fighter dataset and base abilities for clipboard exports.
    """
    data = load_data()
    base_abilities = load_base_abilities()
    return jsonify({
        "fighters": data,
        "base_abilities": base_abilities
    })


if __name__ == "__main__":
    app.run(port=5000, debug=True)
