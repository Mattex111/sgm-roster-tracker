# 💀 Skullgirls Mobile - Roster & Ability Tracker

![Python](https://img.shields.io/badge/Python-3.10+-3776AB?style=flat&logo=python&logoColor=white)
![Flask](https://img.shields.io/badge/Flask-Web%20App-000000?style=flat&logo=flask&logoColor=white)
![Offline First](https://img.shields.io/badge/Data-Local%20%26%20Offline-2ea043?style=flat)
![License](https://img.shields.io/badge/License-MIT-blue?style=flat)

A clean, offline tool to track your Skullgirls Mobile collection, browse abilities and community tier ratings, and export your entire roster formatted for AI strategy chats (ChatGPT, Claude, Gemini).

---

## ⚡ What It Does & How It Works

Managing a collection of 300+ fighters across different tiers and game modes can get messy. This tool keeps everything organized directly on your computer:

* 📋 **Visual Roster Checklist:** Browse every variant in the game sorted by base characters, tiers, and elements. Check the box for fighters you own—choices save automatically in real time.
* 🏆 **Community Meta Ratings:** Every card displays the latest Wiki tier list grades across 4 game modes: **PF Offense**, **Rift Offense**, **Rift Defense**, and **Parallel Realms** (from SS down to U).
* 🔍 **Smart Filtering & Search:**
  * Instant search by variant name.
  * Filter by Base Fighter (*Filia, Beowulf, Dahlia, etc.*), Element, or Rarity Tier.
  * Filter by Meta Score (e.g., show only fighters with *S or better* in *Rift Defense*).
  * Batch actions: Select or deselect all visible filtered fighters with one click.
* 🛡️ **Accident Protection:** Confirmation prompt before bulk modifications, plus a full **Undo** button (`Ctrl+Z` on keyboard) to restore previous states instantly.
* 💾 **Safe Local Save:** Your collection is saved in a private local file (`my_roster.json`). Updating the app or running the scraper will **never** reset your checked fighters.
* 🤖 **One-Click AI Strategy Export:** Click **"Copy Roster for AI"** to grab a clean Markdown summary of your collection (with exact SA1 & SA2 passive descriptions and tier scores). Paste it into any LLM to get instant team synergies and investment advice without hallucinations.

---

## 🚀 Quick Setup

### 1. Clone this repository
```bash
git clone [https://github.com/Mattex111/sgm-roster-tracker.git](https://github.com/Mattex111/sgm-roster-tracker.git)
cd sgm-roster-tracker
```

### 2. Create and activate a virtual environment

```bash
python3 -m venv venv
source venv/bin/activate

```

> **Windows:** `venv\Scripts\activate`

### 3. Install requirements

```bash
pip install -r requirements.txt

```

### 4. (Optional) Sync latest wiki data & tier ratings

The project already comes with a populated database. If a new game patch drops, you can refresh it anytime:

```bash
python3 scrape.py

```

> **Tips:**
> * `python3 scrape.py` (Default): Fast sync. Skips characters you already have and updates tier list scores in ~5 seconds.
> * `python3 scrape.py --force`: Full rescan. Re-downloads every character page from scratch to capture official balance reworks or ability rewrites.
> 
> 

### 5. Launch the tracker

```bash
python3 app.py

```

Open **`http://localhost:5000`** in your browser, check off the fighters you own, and you're ready to go!
