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

    # 2. SA1, SA2 and Base/Max Stats
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

    # Extract ATK (Base and Max)
    atk_base, atk_max = None, None
    atk_box = soup.find("div", {"data-source": "atk"})
    if atk_box:
        val_div = atk_box.find("div", class_="pi-data-value")
        if val_div:
            numbers = re.findall(r'[\d,]+', val_div.text)
            clean_nums = [int(n.replace(',', '').strip()) for n in numbers if n.replace(',', '').strip().isdigit()]
            if len(clean_nums) >= 2:
                atk_base, atk_max = clean_nums[0], clean_nums[1]
            elif len(clean_nums) == 1:
                atk_max = clean_nums[0]

    # Extract HP (Base and Max)
    hp_base, hp_max = None, None
    hp_box = soup.find("div", {"data-source": "hp"})
    if hp_box:
        val_div = hp_box.find("div", class_="pi-data-value")
        if val_div:
            numbers = re.findall(r'[\d,]+', val_div.text)
            clean_nums = [int(n.replace(',', '').strip()) for n in numbers if n.replace(',', '').strip().isdigit()]
            if len(clean_nums) >= 2:
                hp_base, hp_max = clean_nums[0], clean_nums[1]
            elif len(clean_nums) == 1:
                hp_max = clean_nums[0]

    # Extract Variant Card Image URL
    image_url = None
    img_box = soup.find("figure", {"data-source": "image"})
    if img_box:
        img_tag = img_box.find("img")
        if img_tag and img_tag.get("src"):
            raw_src = img_tag["src"]
            image_url = re.sub(r'/scale-to-width-down/\d+', '', raw_src).split('?')[0]

def extract_text_block(heading_tag):
    lines = []
    curr = heading_tag.find_next_sibling()
    while curr and curr.name not in ["h2", "h3", "h4", "h5"]:
        if curr.name in ["style", "script"]:
            curr = curr.find_next_sibling()
            continue
        if curr.name == "ul":
            for li in curr.find_all("li"):
                t = " ".join(li.get_text().split())
                if t and t not in lines:
                    lines.append(t)
        elif curr.name == "p":
            t = " ".join(curr.get_text().split())
            if t and t not in lines:
                lines.append(t)
        curr = curr.find_next_sibling()
    return lines

def clean_heading_title(title):
    t = title.replace("[edit]", "").replace("[edit | edit source]", "").replace("[]", "").strip()
    lower = t.lower()
    if "rift battle" in lower or "rift offense" in lower:
        return "Rift Battles Offense Moveset"
    if "offensive" in lower:
        return "Offensive Moveset"
    if "defensive" in lower:
        return "Defensive Moveset"
    if "preferred" in lower or "moveset" in lower:
        return "Preferred Moveset"
    return t

def extract_moveset_setups_from_heading(heading_tag):
    setups = []
    curr = heading_tag.find_next_sibling()
    while curr and curr.name not in ["h2", "h3", "h4", "h5"]:
        classes = curr.get("class", [])
        if curr.name == "table" and "movetable" in classes:
            if "mobile" in classes and "nomobile" not in classes:
                curr = curr.find_next_sibling()
                continue
            rows = curr.find_all("tr")
            if rows:
                target_row = rows[0]
                cells = target_row.find_all(["td", "th"])
                row_moves = []
                for cell in cells:
                    for br in cell.find_all("br"):
                        br.replace_with(" / ")
                    
                    cell_text = cell.get_text(separator=" ", strip=True)
                    img_titles = []
                    for img in cell.find_all("img"):
                        t = img.get("alt") or img.get("title")
                        if t and t.strip() and not t.lower().endswith(".png") and not t.lower().endswith(".jpg"):
                            img_titles.append(t.strip())
                    
                    if img_titles:
                        row_moves.append(" / ".join(img_titles))
                    elif " or " in cell_text.lower():
                        parts = re.split(r"\s+or\s+", cell_text, flags=re.I)
                        clean_parts = [" ".join(p.split()) for p in parts if p.strip()]
                        row_moves.append(" / ".join(clean_parts))
                    elif cell_text:
                        row_moves.append(" ".join(cell_text.split()))

                cleaned = [m for m in row_moves if m and m.lower() not in ["or", "/", "+"]]
                if len(cleaned) >= 2 and cleaned not in setups:
                    setups.append(cleaned)

        curr = curr.find_next_sibling()
    return setups

IGNORED_TITLE_PREFIXES = ('category:', 'edit', 'module:', 'file:', 'template:', 'help:', 'special:', 'talk:')

def is_valid_fighter_title(title):
    if not title:
        return False
    t_lower = title.strip().lower()
    for prefix in IGNORED_TITLE_PREFIXES:
        if t_lower.startswith(prefix):
            return False
    return True

def extract_team_combinations(heading_tag, current_variant_name=""):
    teams = []
    curr = heading_tag.find_next_sibling()
    while curr and curr.name not in ["h2", "h3", "h4", "h5"]:
        if curr.name in ["style", "script"]:
            curr = curr.find_next_sibling()
            continue

        classes = curr.get("class", [])
        if "mobile" in classes and "nomobile" not in classes:
            curr = curr.find_next_sibling()
            continue

        if curr.name == "table":
            for tr in curr.find_all("tr"):
                tds = tr.find_all("td")
                if not tds:
                    continue
                row_slots = []
                for td in tds:
                    slot_fighters = []
                    containers = td.find_all(class_="portrait-container")
                    if containers:
                        for pc in containers:
                            a = pc.find("a", title=True)
                            self_link = pc.find(class_="mw-selflink") or td.find(class_="mw-selflink")
                            if a and is_valid_fighter_title(a.get("title")):
                                f_name = a["title"].strip()
                                if f_name and f_name not in slot_fighters:
                                    slot_fighters.append(f_name)
                            elif self_link and current_variant_name:
                                if current_variant_name not in slot_fighters:
                                    slot_fighters.append(current_variant_name)
                            else:
                                ph = pc.find(class_="portrait-placeholder-text")
                                if ph:
                                    lines = [l.strip() for l in ph.get_text("\n", strip=True).splitlines() if l.strip()]
                                    if lines:
                                        f_name = lines[0]
                                        if is_valid_fighter_title(f_name) and f_name not in slot_fighters:
                                            slot_fighters.append(f_name)
                    else:
                        for a in td.find_all("a", title=True):
                            t = a["title"].strip()
                            if is_valid_fighter_title(t) and t not in slot_fighters:
                                slot_fighters.append(t)
                        if td.find(class_="mw-selflink") and current_variant_name and current_variant_name not in slot_fighters:
                            slot_fighters.append(current_variant_name)
                        if not slot_fighters:
                            raw_text = td.get_text(separator=" ", strip=True)
                            parts = [p.strip() for p in re.split(r'\s+or\s+|\s*/\s*|\s*,\s*', raw_text) if p.strip()]
                            for p in parts:
                                if p and p.lower() not in ["or", "/", "+"] and is_valid_fighter_title(p) and p not in slot_fighters:
                                    slot_fighters.append(p)
                    if slot_fighters:
                        row_slots.append(slot_fighters)
                if row_slots and row_slots not in teams:
                    teams.append(row_slots)
        elif curr.name == "ul":
            for li in curr.find_all("li"):
                row_slots = []
                li_text = li.get_text(separator=" ", strip=True)
                raw_slots = re.split(r'\s*\+\s*|\s+and\s+', li_text)
                for raw_s in raw_slots:
                    fighters = [f.strip() for f in re.split(r'\s+or\s+|\s*/\s*|\s*,\s*', raw_s) if f.strip() and f.strip().lower() not in ["or", "/", "+"] and is_valid_fighter_title(f.strip())]
                    if fighters:
                        row_slots.append(fighters)
                if row_slots and row_slots not in teams:
                    teams.append(row_slots)
        curr = curr.find_next_sibling()
    return teams

def parse_variant_loadouts(soup, page_title=""):
    role_strategy = []
    stat_investment = []
    movesets = {}
    rift_battles = []
    team_combinations = []
    playing_against = []

    headings = soup.find_all(lambda t: t.name in ["h2", "h3", "h4", "h5"])
    for h in headings:
        raw_title = h.get_text(strip=True).replace("[edit]", "").replace("[edit | edit source]", "").strip()
        lower_title = raw_title.lower()

        # 1. Movesets (Check FIRST so headings like "Moveset specifically for rift battles offense" are caught as movesets!)
        if "moveset" in lower_title or "preferred move" in lower_title:
            cat_name = clean_heading_title(raw_title)
            setups = extract_moveset_setups_from_heading(h)
            if setups:
                if cat_name not in movesets:
                    movesets[cat_name] = []
                for s in setups:
                    if s not in movesets[cat_name]:
                        movesets[cat_name].append(s)
        # 2. Role & Strategy
        elif re.search(r"role\s*&\s*strategy|role\s*and\s*strategy", lower_title):
            role_strategy.extend(extract_text_block(h))
        # 3. Stat Investment
        elif "stat investment" in lower_title or "recommended stat" in lower_title:
            stat_investment.extend(extract_text_block(h))
        # 4. Rift Battles
        elif "rift battle" in lower_title or "rift defense" in lower_title or "rift offense" in lower_title:
            rift_battles.extend(extract_text_block(h))
        # 5. Team Combinations / Synergy
        elif "team combination" in lower_title or "synergy" in lower_title:
            team_combinations.extend(extract_team_combinations(h, current_variant_name=page_title))
        # 6. Playing Against / Counters
        elif "playing against" in lower_title or "counter" in lower_title:
            playing_against.extend(extract_text_block(h))

    legacy_preferred = []
    if "Preferred Moveset" in movesets and movesets["Preferred Moveset"]:
        legacy_preferred = movesets["Preferred Moveset"][0]
    elif movesets:
        first_key = list(movesets.keys())[0]
        if movesets[first_key]:
            legacy_preferred = movesets[first_key][0]

    return {
        "role_strategy": role_strategy,
        "stat_investment": stat_investment,
        "preferred_moveset": legacy_preferred,
        "movesets": movesets,
        "rift_battles": rift_battles,
        "team_combinations": team_combinations,
        "playing_against": playing_against
    }

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

    # 2. SA1, SA2 and Base/Max Stats
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

    # Extract ATK (Base and Max)
    atk_base, atk_max = None, None
    atk_box = soup.find("div", {"data-source": "atk"})
    if atk_box:
        val_div = atk_box.find("div", class_="pi-data-value")
        if val_div:
            numbers = re.findall(r'[\d,]+', val_div.text)
            clean_nums = [int(n.replace(',', '').strip()) for n in numbers if n.replace(',', '').strip().isdigit()]
            if len(clean_nums) >= 2:
                atk_base, atk_max = clean_nums[0], clean_nums[1]
            elif len(clean_nums) == 1:
                atk_max = clean_nums[0]

    # Extract HP (Base and Max)
    hp_base, hp_max = None, None
    hp_box = soup.find("div", {"data-source": "hp"})
    if hp_box:
        val_div = hp_box.find("div", class_="pi-data-value")
        if val_div:
            numbers = re.findall(r'[\d,]+', val_div.text)
            clean_nums = [int(n.replace(',', '').strip()) for n in numbers if n.replace(',', '').strip().isdigit()]
            if len(clean_nums) >= 2:
                hp_base, hp_max = clean_nums[0], clean_nums[1]
            elif len(clean_nums) == 1:
                hp_max = clean_nums[0]

    # Extract Variant Card Image URL
    image_url = None
    img_box = soup.find("figure", {"data-source": "image"})
    if img_box:
        img_tag = img_box.find("img")
        if img_tag and img_tag.get("src"):
            raw_src = img_tag["src"]
            image_url = re.sub(r'/scale-to-width-down/\d+', '', raw_src).split('?')[0]

    # 3. Extract Loadouts & Tactics
    loadouts = parse_variant_loadouts(soup, page_title=page_title)

    return {
        "name": page_title,
        "character": character,
        "tier": tier,
        "element": element,
        "atk_base": atk_base,
        "atk_max": atk_max,
        "hp_base": hp_base,
        "hp_max": hp_max,
        "sa1": sa1,
        "sa2": sa2,
        "image_url": image_url,
        "loadouts": loadouts,
        "unlocked": False,
    }

def run():
    force_update = "--force" in sys.argv
    ratings_only = "--ratings-only" in sys.argv

    try:
        with open("sgm_database.json", "r", encoding="utf-8") as f:
            db = json.load(f)
    except FileNotFoundError:
        db = {}

    db = {name: data for name, data in db.items() if data.get("tier") in TIERS}

    if not ratings_only:
        variants = get_all_variants()
        print(f"Checking {len(variants)} variants...")

        for name in variants:
            if not force_update and name in db and (db[name].get("sa1") or db[name].get("sa2")) and "loadouts" in db[name]:
                continue

            try:
                data = parse_variant(name)
                if data and (data["sa1"] or data["sa2"]) and data["tier"] in TIERS:
                    if name in db and "ratings" in db[name]:
                        data["ratings"] = db[name]["ratings"]
                    db[name] = data
                    print(f"Parsed: [{data['character']} | {data['tier']} - {data['element']}] {name}")
            except Exception as e:
                print(f"Error parsing {name}: {e}")

    ratings = get_tier_list_ratings()
    for name, item in db.items():
        if name in ratings:
            item["ratings"] = ratings[name]

    with open("sgm_database.json", "w", encoding="utf-8") as f:
        json.dump(db, f, indent=2, ensure_ascii=False)
    print(f"\nDatabase successfully synced! Total playable fighters: {len(db)}")

if __name__ == "__main__":
    run()
