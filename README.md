# Skullgirls Mobile - Roster & Ability Tracker

A clean, offline tool to track your Skullgirls Mobile collection, browse abilities and community tier ratings, and export your entire roster formatted for AI strategy chats (ChatGPT, Claude, Gemini).

---

## What It Does & How It Works

Managing a collection of 300+ fighters across different tiers and game modes can get messy. This tool keeps everything organized directly on your computer:

* **Visual Roster Checklist:** Browse every variant in the game sorted with official base characters, tiers, and elements. Check the box for the fighters you own—your choices save automatically in real time.
* **Community Meta Ratings:** Every card displays the latest Wiki tier list grades across 4 game modes: **Prize Fights (PF Offense)**, **Rift Offense**, **Rift Defense**, and **Parallel Realms** (from SS down to U).
* **Smart Filtering & Search:**
  * Search instantly by variant name.
  * Filter by Base Fighter (*Filia, Beowulf, Dahlia, etc.*), Element, or Rarity Tier.
  * Filter by Meta Score (e.g. show only your fighters with *S or better* in *Rift Defense*).
  * Batch actions: Select or deselect all visible filtered fighters with one click.
* **Accident Protection:** Includes a confirmation prompt before bulk selecting/deselecting, plus a full **Undo** button (`Ctrl+Z` on keyboard) to restore your previous state instantly.
* **Safe Local Save:** Your personal collection is saved in a local private file (`my_roster.json`). Updating the app, running scrapers, or downloading new game patches will **never** overwrite or reset your checked fighters.
* **One-Click AI Strategy Export:** Click **"Copy Roster for AI"** to grab a clean Markdown summary of your collection (complete with exact SA1 & SA2 passive texts and optional tier scores). Paste this into any AI chat to get accurate team synergies, rift defense setups, and investment advice without the AI confusing abilities or stats.

---

## Quick Setup

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
