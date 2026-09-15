import sys
import json
import re
import requests
from bs4 import BeautifulSoup

API_URL = "https://skullgirlsmobile.fandom.com/api.php"
HEADERS = {"User-Agent": "SGM_Database_Builder/4.0"}

TIERS = ["Bronze", "Silver", "Gold", "Diamond"]
ELEMENTS = ["Air", "Dark", "Fire", "Light", "Water", "Neutral"]
CHARACTERS = [
    "Annie", "Beowulf", "Big Band", "Black Dahlia", "Cerebella",
    "Eliza", "Filia", "Fukua", "Marie", "Ms. Fortune",
    "Painwheel", "Peacock", "Parasoul", "Robo-Fortune", "Squigly",
    "Umbrella", "Valentine", "Double"
]

def get_tier_list_ratings():
    print("Fetching wiki Tier List page...")
    params = {
        "action": "parse",
        "page": "Tier_List",
        "prop": "text",
        "format": "json",
    }
    res = requests.get(API_URL, params=params, headers=HEADERS).json()
    if "parse" not in res:
        print("Warning: Unable to fetch Tier_List page via API.")
        return {}

    html_content = res["parse"]["text"]["*"]
    soup = BeautifulSoup(html_content, "html.parser")
    ratings = {}

    for table in soup.find_all("table", class_="article-table"):
        for row in table.find_all("tr"):
            cols = row.find_all("td")
            if len(cols) >= 5:
                # Estrae il nome variante direttamente dal link <a>
                link = cols[0].find("a")
                v_name = link.get_text(strip=True) if link else cols[0].get_text(strip=True)

                pf_off = cols[1].get_text(strip=True).upper()
                rift_off = cols[2].get_text(strip=True).upper()
                rift_def = cols[3].get_text(strip=True).upper()
                realms = cols[4].get_text(strip=True).upper()

                if v_name:
                    ratings[v_name] = {
                        "pf_off": pf_off,
                        "rift_off": rift_off,
                        "rift_def": rift_def,
                        "realms": realms,
                    }
    print(f"Retrieved ratings for {len(ratings)} variants.")
    return ratings

def get_all_variants():
    variants = []
    cmcontinue = ""
    while True:
        params = {
            "action": "query",
            "list": "categorymembers",
            "cmtitle": "Category:Variants",
            "cmlimit": "500",
            "format": "json",
            "cmcontinue": cmcontinue,
        }
        res = requests.get(API_URL, params=params, headers=HEADERS).json()
        for m in res.get("query", {}).get("categorymembers", []):
            title = m["title"]
            if not title.startswith("Category:") and not title.startswith("Template:"):
                variants.append(title)
        if "continue" in res:
            cmcontinue = res["continue"]["cmcontinue"]
        else:
            break
    return variants

def parse_variant(page_title):
    params = {
        "action": "parse",
        "page": page_title,
        "prop": "wikitext|text",
        "format": "json",
    }
    res = requests.get(API_URL, params=params, headers=HEADERS).json()
    if "parse" not in res:
        return None

    raw_wikitext = res["parse"]["wikitext"]["*"]
    html_content = res["parse"]["text"]["*"]

    # 1. Tier, Element & Character
    element = "Unknown"
    tier = "Unknown"
    character = "Unknown"
    header_text = raw_wikitext[:500]

    for el in ELEMENTS:
        if re.search(rf"\b{el}\b", header_text, re.IGNORECASE):
            element = el
            break

    for t in TIERS:
        if re.search(rf"\b{t}\b", header_text, re.IGNORECASE):
            tier = t
            break

    for ch in CHARACTERS:
        if re.search(rf"\b{re.escape(ch)}\b", header_text, re.IGNORECASE):
            character = ch
            break

    # 2. SA1 & SA2
    soup = BeautifulSoup(html_content, "html.parser")
    sa1, sa2 = "", ""

    for table in soup.find_all("table"):
        text_all = table.get_text()
        if "SA 1" in text_all or "SA1" in text_all:
            rows = table.find_all("tr")
            for r in rows:
                th = r.find(["th", "td"])
                tds = r.find_all("td")
                header_name = th.get_text(strip=True) if th else ""

                target_cell = tds[-1] if len(tds) > 0 else None
                if target_cell:
                    cleaned_text = " ".join(target_cell.get_text().split())
                    if re.search(r"SA\s*1\b", header_name, re.I):
                        sa1 = cleaned_text
                    elif re.search(r"SA\s*2\b", header_name, re.I):
                        sa2 = cleaned_text

            if sa1 or sa2:
                break

    sa1 = re.sub(r"Num\|", "", sa1)
    sa2 = re.sub(r"Num\|", "", sa2)

    return {
        "name": page_title,
        "character": character,
        "tier": tier,
        "element": element,
        "sa1": sa1,
        "sa2": sa2,
        "unlocked": False,
    }

def run():
    force_update = "--force" in sys.argv
    ratings_only = "--ratings-only" in sys.argv

    # Carica il database esistente se disponibile
    try:
        with open("sgm_database.json", "r", encoding="utf-8") as f:
            db = json.load(f)
    except FileNotFoundError:
        db = {}

    if not ratings_only:
        variants = get_all_variants()
        print(f"Checking {len(variants)} variants...")

        for name in variants:
            # Salta se già presente e non forzato
            if not force_update and name in db and (db[name].get("sa1") or db[name].get("sa2")):
                continue

            try:
                data = parse_variant(name)
                if data and (data["sa1"] or data["sa2"]):
                    # Conserva i voti precedenti se già presenti
                    if name in db and "ratings" in db[name]:
                        data["ratings"] = db[name]["ratings"]
                    db[name] = data
                    print(f"Parsed: [{data['character']} | {data['tier']} - {data['element']}] {name}")
            except Exception as e:
                print(f"Error parsing {name}: {e}")

    # Aggiorna sempre i voti della Tier List (richiede una sola richiesta HTTP)
    ratings = get_tier_list_ratings()
    for name, item in db.items():
        if name in ratings:
            item["ratings"] = ratings[name]

    with open("sgm_database.json", "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
    print("\nDatabase successfully synced in sgm_database.json!")

if __name__ == "__main__":
    run()
