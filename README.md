# Skullgirls Mobile - Roster & Ability Tracker

A lightweight local Flask web app to track your unlocked Skullgirls Mobile variants, view their Signature Abilities (SA1 & SA2), and export your collection formatted for AI analysis and team building discussions.

## Setup Instructions

### 1. Clone this repository
```bash
git clone https://github.com/Mattex111/sgm-roster-tracker.git
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
