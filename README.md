# Skullgirls Mobile - Roster & Ability Tracker

A lightweight local Flask web app to track your unlocked Skullgirls Mobile variants, view their Signature Abilities (SA1 & SA2), and export your collection formatted for AI analysis and team building discussions.

---

## How It Works

This project provides an automated pipeline to extract, manage, and export variant data without third-party account linking:

* **Data Scraping (`scrape.py`):** Queries the official Fandom MediaWiki API (`Category:Variants`) using automated pagination to fetch raw variant entries. It parses introductory wikitext via regular expressions to identify **Tier** and **Element**, while using **BeautifulSoup** to extract clean **SA1** and **SA2** ability text from table structures (removing wiki formatting tags like `Num|`). All metadata is compiled into `sgm_database.json`.
* **Static Database (`sgm_database.json`):** Serves as the central reference containing all 300+ game variants with their accurate names, elements, tiers, and ability descriptions.
* **Persistent Local State (`my_roster.json`):** Tracks your unlocked fighter selections independently. Kept out of Git tracking (`.gitignore`) so database updates or repository pushes never overwrite your local progress.
* **Web UI & Server (`app.py`):** A lightweight local **Flask** app that combines the static database with your personal roster. Offers real-time filtering (by name, tier, and unlock status) and sends asynchronous POST requests to update your collection instantly on disk.
* **AI Export Pipeline:** A single click on **"Copy Roster for AI"** formats your unlocked fighters with complete official ability texts into Markdown. Pasting this directly into an LLM (such as ChatGPT, Claude, or Gemini) eliminates AI hallucinations regarding tiers, percentages, or effects during team building and strategy discussions.

---

## Setup Instructions

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

### 3. Install dependencies
```bash
pip install -r requirements.txt
```

### 4. (Optional) Update the database
```bash
python3 scrape.py
```

### 5. Start the web tracker
```bash
python3 app.py
```

Open `http://localhost:5000` in your browser, check the variants you own, and click **"Copy Roster for AI"**!
