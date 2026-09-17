# Skullgirls Mobile - Roster Tracker

An advanced offline web tool designed for Skullgirls Mobile players to track their collection, build custom teams with synergy analysis, manage wishlists, inspect fighter kits and official Fandom Wiki loadouts, filter by combat modifiers, and export custom rosters.

![Dashboard Preview](examples/1.gif)

## Features

- **Interactive Roster Checklist:** Click anywhere on a fighter card to mark it as owned in real time with persistent local storage (`my_roster.json`).
- **Team Builder & Synergy Analyzer:** Create, save, and manage custom 3-fighter loadouts tailored for specific game modes (*Prize Fight*, *Rift Offense*, *Rift Defense*, *Parallel Realms*). Automatically previews combined Signature Abilities (SA1 & SA2) and support synergies, with duplicate protection and tier rank sorting.
- **Wishlist Tracker:** Track target Gold and Diamond variants you are hunting for with interactive priority slots.
- **Base Stats (Max Lvl 60):** Card view displays official Max ATK and HP stats.
- **Full Character Kit:** Expandable details showing character-specific Prestige Abilities (PA) and Marquee options (MA).
- **Official Wiki Loadouts:** Integrated Stat Investments and Preferred Movesets scraped directly from the official Skullgirls Mobile Fandom Wiki.
- **Global Text Search & Highlight:** Search freely across variant names, descriptions, and kits with real-time keyword highlighting.
- **Modifier Multi-Search:** Filter fighters by specific Buffs and Debuffs (e.g. *Hex*, *Curse*, *Armor*, *Thorns*) with keyword highlighting.
- **Tier Multi-Select:** Choose single or combined rarity pools (*Diamond*, *Gold*, *Silver*, *Bronze*).
- **Meta Grades:** Community tier ratings across 4 modes (PF Offense, Rift Offense, Rift Defense, Parallel Realms) sourced from the [Fandom Community Tier List](https://skullgirlsmobile.fandom.com/wiki/Tier_List).
- **Custom Clipboard Exporter:** Export selections in Full markdown, single-line Compact summaries, or comma-separated name lists.
- **Accident Prevention:** Bulk selection safeguards with one-click Undo (`Ctrl+Z`).
- **100% Offline & Private:** No accounts, external servers, or tracking cookies.

## Screenshots

<img src="examples/1.png" width="280" alt="Roster Tracker"> <img src="examples/2.png" width="280" alt="Export Modal"> <img src="examples/3.png" width="280" alt="Team Builder">

## Setup & Run

### Prerequisites

1. **Python (3.8 or higher):** Download from [python.org](https://www.python.org/downloads/).
   - ⚠️ **Windows Users:** During installation, check the box that says **"Add python.exe to PATH"** at the bottom of the installer!
2. **Git (Optional but Recommended):** Download from [git-scm.com](https://git-scm.com/downloads). *While you can simply click the green **Code** button and download the ZIP, installing Git is highly recommended because it makes future updates as easy as running a single `git pull` command!*

---

### For Windows Users

1. **Get the project & open the folder:**
   - **Option A (Using Git):**
     ```cmd
     git clone https://github.com/Mattex111/sgm-roster-tracker.git
     cd sgm-roster-tracker
     ```
   - **Option B (Without Git):** Extract the downloaded ZIP file, open the folder, click on the File Explorer address bar at the top, type `cmd`, and press **Enter**.

2. **Create and activate the virtual environment:**
    ```cmd
    python -m venv venv
    venv\Scripts\activate
    ```
3. **Install dependencies:**
    ```cmd
    pip install -r requirements.txt
    ```
4. **Start the application:**
    ```cmd
    python app.py
    ```
    Open http://localhost:5000 in your browser.

### For Linux / macOS Users

1. **Clone the repository & enter the folder:**
    ```Bash
    git clone https://github.com/Mattex111/sgm-roster-tracker.git
    cd sgm-roster-tracker
    ```
2. **Create and activate the virtual environment:**
    ```Bash
    python3 -m venv venv
    source venv/bin/activate
    ```
3. **Install dependencies:**
    ```Bash
    pip install -r requirements.txt
    ```
4. **Start the application:**
    ```Bash
    python3 app.py
    ```
    Open http://localhost:5000 in your browser.

---

### 🔄 Running the App Again (Subsequent Uses)

Once the initial setup is complete, you **do not** need to create the virtual environment or run `pip install` again. Whenever you close your terminal or restart your PC, simply open `cmd` in the folder and run:

- **Windows:**
  ```cmd
  venv\Scripts\activate
  python app.py
  ```
- **Linux / macOS:**
  ```bash
  source venv/bin/activate
  python3 app.py
  ```

## Data Sync (Optional)

The repository includes pre-scraped datasets (`sgm_database.json` and `base_abilities.json`). To pull official balance updates or newly released fighters from the wiki:

* Sync variant stats and tier ratings:
```bash
python3 scrape.py
```

*(Pass `--force` to re-download all pages from scratch).*
* Sync base character kits (Prestige & Marquee):
```bash
python3 scrape_base_abilities.py
```

## Frequently Asked Questions (FAQ)

### ❓ How do I update to the latest version? Will I lose my saved roster or teams?
**Your saved data is completely safe!** 
- **If using Git:** Open `cmd` in your project folder and run `git pull`.
- **If using ZIP download:** Download the latest ZIP from GitHub and extract/overwrite the files in your folder. Your saved collection (`my_roster.json`) and custom teams (`my_teams.json`) are created locally on your PC and are not included in the GitHub repository, so updating will **never** erase your progress.

### ❓ Why do I need to activate `venv` every time I use the app?
- **What `venv` does:** `python -m venv venv` creates a **Virtual Environment** (a self-contained sandbox folder named `venv`). This ensures the app's packages (like Flask) stay isolated and don't conflict with your main system Python.
- **Why reactivate every time:** When you close your Command Prompt or terminal window, your system forgets the active sandbox session. Running `venv\Scripts\activate` (or `source venv/bin/activate`) tells your terminal: *"Hey, turn the sandbox back on!"* so Python can access its installed dependencies before launching `python app.py`.

### 📱 Is there a Mobile version available?
The app runs locally on PC web browsers. Full mobile responsive UI optimization is currently in active development!
