import json
import re
import requests
from bs4 import BeautifulSoup

API_URL = "https://skullgirlsmobile.fandom.com/api.php"
HEADERS = {"User-Agent": "SGM_Database_Builder/2.0"}

TIERS = ["Bronze", "Silver", "Gold", "Diamond"]
ELEMENTS = ["Air", "Dark", "Fire", "Light", "Water", "Neutral"]


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

    # 1. Tier and Element (extracted from introductory wikitext)
    element = "Unknown"
    tier = "Unknown"
    header_text = raw_wikitext[:400]

    for el in ELEMENTS:
        if re.search(rf"\b{el}\b", header_text, re.IGNORECASE):
            element = el
            break

    for t in TIERS:
        if re.search(rf"\b{t}\b", header_text, re.IGNORECASE):
            tier = t
            break

    # 2. Extract SA1 and SA2 from rendered HTML table
    soup = BeautifulSoup(html_content, "html.parser")
    sa1 = ""
    sa2 = ""

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

    # Clean residual wiki template artifacts
    sa1 = re.sub(r"Num\|", "", sa1)
    sa2 = re.sub(r"Num\|", "", sa2)

    return {
        "name": page_title,
        "tier": tier,
        "element": element,
        "sa1": sa1,
        "sa2": sa2,
        "unlocked": False,
    }


def run():
    variants = get_all_variants()
    print(f"Fetching data for {len(variants)} variants...")
    db = {}

    for name in variants:
        try:
            data = parse_variant(name)
            if data and (data["sa1"] or data["sa2"]):
                db[name] = data
                print(f"[{data['tier']} - {data['element']}] {name}")
        except Exception as e:
            print(f"Error parsing {name}: {e}")

    with open("sgm_database.json", "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
    print("\nDatabase successfully generated in sgm_database.json!")


if __name__ == "__main__":
    run()
