import json
import re
import requests
from bs4 import BeautifulSoup

API_URL = "https://skullgirlsmobile.fandom.com/api.php"
HEADERS = {"User-Agent": "SGM_Database_Builder/4.0"}

CHARACTERS = [
    "Annie", "Beowulf", "Big Band", "Black Dahlia", "Cerebella",
    "Double", "Eliza", "Filia", "Fukua", "Marie", "Ms. Fortune",
    "Painwheel", "Parasoul", "Peacock", "Robo-Fortune", "Squigly",
    "Umbrella", "Valentine"
]

def clean_text(text):
    text = re.sub(r'Num\|', '', text)
    return " ".join(text.split())

def scrape_character_abilities(character_name):
    # The wiki uses underscores and handles "Ms._Fortune"
    page_title = character_name.replace(" ", "_")
    params = {
        "action": "parse",
        "page": page_title,
        "prop": "text",
        "format": "json",
    }
    
    res = requests.get(API_URL, params=params, headers=HEADERS).json()
    if "parse" not in res:
        print(f"Failed to fetch {character_name}")
        return None

    html_content = res["parse"]["text"]["*"]
    soup = BeautifulSoup(html_content, "html.parser")

    result = {
        "character_ability": None,
        "marquee_group_name": "",
        "marquee_options": [],
        "prestige": None
    }

    # Find all divs defining Character Ability, Marquee, and Prestige
    for div in soup.find_all("div", style=lambda s: s and "font-size:large" in s):
        text = div.get_text(strip=True)

        # 0. Parsing Character Ability
        if "Character Ability" in text:
            curr = div.find_next_sibling()
            while curr:
                if curr.name == "table":
                    th = curr.find("th")
                    td = curr.find("td")
                    if th and td:
                        ca_name = clean_text(th.get_text())
                        ca_desc = clean_text(td.get_text())
                        result["character_ability"] = {
                            "name": ca_name,
                            "description": ca_desc
                        }
                    break
                curr = curr.find_next_sibling()

        # 1. Parsing Marquee Ability
        elif "Marquee Ability" in text:
            match = re.search(r"Marquee Ability:\s*(.*)", text, re.IGNORECASE)
            if match:
                result["marquee_group_name"] = match.group(1).strip()

            # Get the next two tables containing the options
            curr = div.find_next_sibling()
            count = 0
            while curr and count < 2:
                if curr.name == "table" and "article-table" in curr.get("class", []):
                    th = curr.find("th")
                    td = curr.find("td")
                    if th and td:
                        opt_name = clean_text(th.get_text())
                        opt_desc = clean_text(td.get_text())
                        result["marquee_options"].append({
                            "name": opt_name,
                            "description": opt_desc
                        })
                        count += 1
                curr = curr.find_next_sibling()

        # 2. Parsing Prestige Ability
        elif "Prestige Ability" in text:
            curr = div.find_next_sibling()
            while curr:
                if curr.name == "table" and "article-table" in curr.get("class", []):
                    th = curr.find("th")
                    td = curr.find("td")
                    if th and td:
                        pa_name = clean_text(th.get_text())
                        pa_desc = clean_text(td.get_text())
                        result["prestige"] = {
                            "name": pa_name,
                            "description": pa_desc
                        }
                    break
                curr = curr.find_next_sibling()

    return result

def run():
    print("Scraping Marquee & Prestige abilities for all 18 base characters...")
    abilities_db = {}

    for ch in CHARACTERS:
        print(f"Scraping {ch}...")
        try:
            data = scrape_character_abilities(ch)
            if data:
                abilities_db[ch] = data
        except Exception as e:
            print(f"Error scraping {ch}: {e}")

    with open("base_abilities.json", "w", encoding="utf-8") as f:
        json.dump(abilities_db, f, indent=2, ensure_ascii=False)

    print("\nSaved base_abilities.json successfully!")

if __name__ == "__main__":
    run()

