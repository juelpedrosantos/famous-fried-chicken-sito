#!/usr/bin/env python3
"""Importa il menu pubblico di Famous Fried Chicken da Qromo e genera assets/js/menu-data.js.

Uso (dalla cartella del progetto):
    python3 tools/build_menu_data.py            # aggiorna dati + scarica le foto nuove
    python3 tools/build_menu_data.py --refresh  # riscarica anche le foto già presenti

Legge gli stessi dati che la pagina Qromo incorpora nell'HTML (categorie, prodotti,
prezzi, disponibilità, orari) e, per i prodotti personalizzabili, l'endpoint pubblico
degli "extras". Le foto vengono convertite in WebP con `cwebp` se disponibile.
"""
import argparse
import json
import re
import shutil
import subprocess
import sys
import tempfile
import time
import unicodedata
import urllib.request
from collections import defaultdict
from datetime import date
from pathlib import Path

SOURCE_URL = "https://famousfriedchicken.qromo.it/"
EXTRAS_URL = SOURCE_URL + "API/v1/businesses/{business_id}/public/menu/items/{item_id}/extras"
USER_AGENT = "Mozilla/5.0 (compatible; FFC-menu-sync/1.0)"
INSTAGRAM_URL = "https://www.instagram.com/famousfriedchicken.it/"
REQUEST_TIMEOUT_S = 20
RETRIES = 3
ITEM_IMAGE_WIDTH = 640
CATEGORY_IMAGE_WIDTH = 720
MAX_PAIRINGS = 4
BEST_SELLERS = 4
# Orari ufficiali del locale (0 = lunedì). "24:00" = mezzanotte di chiusura, mostrata come 00:00.
OPENING_HOURS = [
    {"day": d, "open": "11:30", "close": "24:00" if d in (4, 5) else "23:30"} for d in range(7)
]
CHILI = "\U0001F336"

ROOT = Path(__file__).resolve().parent.parent
IMG_DIR = ROOT / "assets" / "img" / "menu"
OUT_FILE = ROOT / "assets" / "js" / "menu-data.js"


def as_int(value, field):
    """I dati arrivano da un sito esterno: id, prezzi e limiti devono essere interi."""
    if isinstance(value, bool) or not isinstance(value, (int, float)) or value != int(value):
        raise RuntimeError(f"Valore non valido per {field}: {value!r}")
    return int(value)


def fetch(url):
    if not url.startswith("https://"):
        raise RuntimeError(f"URL non consentito (serve https): {url}")
    last_error = None
    for attempt in range(1, RETRIES + 1):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": USER_AGENT})
            with urllib.request.urlopen(req, timeout=REQUEST_TIMEOUT_S) as res:
                return res.read()
        except OSError as err:  # URLError, HTTPError and timeouts are all OSError
            last_error = err
            time.sleep(attempt)
    raise RuntimeError(f"Impossibile scaricare {url}: {last_error}")


def parse_page_constants(html):
    """Estrae le costanti JSON (`const nome = {...};`) incorporate nella pagina Qromo."""
    decoder = json.JSONDecoder()
    found = {}
    for match in re.finditer(r"const\s+(\w+)\s*=\s*", html):
        try:
            value, _ = decoder.raw_decode(html, match.end())
        except ValueError:
            continue
        found[match.group(1)] = value
    required = ["business", "menus", "menusCategories", "menusItems", "takeawayTimes"]
    missing = [key for key in required if key not in found]
    if missing:
        raise RuntimeError(f"La pagina Qromo non contiene i dati attesi: {', '.join(missing)}")
    return found


def clean_name(raw):
    """Toglie i peperoncini emoji dal nome e li trasforma in un livello di piccantezza."""
    text = (raw or "").strip()
    spice = text.count(CHILI)
    text = re.sub(r"[\U0001F300-\U0001FAFF️‍]", "", text)
    return re.sub(r"\s+", " ", text).strip(), spice


def slugify(text):
    ascii_text = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"[^a-z0-9]+", "-", ascii_text.lower()).strip("-")


def full_size_url(url):
    if not url or "-full." in url:
        return url
    return re.sub(r"(\.\w+)$", r"-full\1", url)


def save_image(url, name, width, refresh):
    """Scarica e converte un'immagine; restituisce il percorso relativo alla root del sito."""
    if not url:
        return None
    use_webp = shutil.which("cwebp") is not None
    target = IMG_DIR / f"{name}.{'webp' if use_webp else 'jpg'}"
    if target.exists() and not refresh:
        return target.relative_to(ROOT).as_posix()
    try:
        data = fetch(url)
    except RuntimeError as err:
        print(f"  ! foto non disponibile ({name}): {err}", file=sys.stderr)
        return None
    if not use_webp:
        target.write_bytes(data)
        return target.relative_to(ROOT).as_posix()
    with tempfile.NamedTemporaryFile(suffix=Path(url).suffix) as tmp:
        tmp.write(data)
        tmp.flush()
        result = subprocess.run(
            ["cwebp", "-quiet", "-q", "78", "-resize", str(width), "0", tmp.name, "-o", str(target)],
            capture_output=True, text=True,
        )
    if result.returncode != 0:
        print(f"  ! conversione fallita ({name}): {result.stderr.strip()}", file=sys.stderr)
        return None
    return target.relative_to(ROOT).as_posix()


def build_options(extras):
    composite = extras.get("composite") or {}
    groups = sorted(composite.get("lists") or [], key=lambda g: g["order_number"])
    products = defaultdict(list)
    for product in composite.get("lists_products") or []:
        products[product["menu_item_list_id"]].append(product)
    options = []
    for group in groups:
        choices = []
        for product in sorted(products[group["menu_item_list_id"]], key=lambda p: p["order_number"]):
            name, spice = clean_name(product["product_name"])
            choices.append({
                "id": as_int(product["menu_item_list_product_id"], "id opzione"),
                "name": name,
                "price": as_int(product["product_price"] or 0, "prezzo opzione"),
                "spice": spice,
                "available": bool(product["available"]),
            })
        if not choices:
            continue
        options.append({
            "id": as_int(group["menu_item_list_id"], "id gruppo"),
            "name": group["name"].strip(),
            "min": as_int(group["select_min"] or 0, "minimo gruppo"),
            "max": as_int(group["select_max"] or 0, "massimo gruppo"),
            "multi": bool(group["select_multi"]),
            "choices": choices,
        })
    return options


def format_time(hour, minute):
    return f"{hour:02d}:{minute:02d}"


def build_business(raw):
    business = raw["business"]
    address = business.get("address") or {}
    hours = OPENING_HOURS
    intervals = {slot.get("intervals") for slot in raw["takeawayTimes"] if slot.get("intervals")}
    return {
        "name": business["name"],
        "tagline": business.get("description") or "",
        "address": {
            "street": f'{address.get("via", "")} {address.get("civico", "")}'.strip(),
            "city": address.get("comune", ""),
            "province": address.get("provincia_codice", ""),
            "full": address.get("address", ""),
        },
        "mapsUrl": "https://maps.google.com/?q=" + urllib.request.quote(address.get("address", "")),
        "instagram": INSTAGRAM_URL,
        "hours": hours,
        "pickupIntervalMinutes": min(intervals) if intervals else 30,
        "company": business.get("fiscal_name") or "",
        "vat": business.get("vat") or "",
        "orderUrl": SOURCE_URL,
    }


def visible_categories(raw):
    available_menus = {m["menu_id"] for m in raw["menus"] if m.get("available")}
    categories = [
        c for c in raw["menusCategories"]
        if c.get("active") and not c.get("variations_only") and c["menu_id"] in available_menus
    ]
    return sorted(categories, key=lambda c: c["order_number"])


def build_menu(raw, refresh):
    business_id = raw["business"]["business_id"]
    categories = visible_categories(raw)
    category_ids = {c["menu_category_id"] for c in categories}
    items_by_category = defaultdict(list)
    for item in raw["menusItems"]:
        if item["category_id"] in category_ids:
            items_by_category[item["category_id"]].append(item)

    visible_ids = {i["menu_item_id"] for items in items_by_category.values() for i in items if i["available"]}
    pairings = defaultdict(list)
    for assoc in raw.get("menusItemsAssociations") or []:
        if assoc["id1"] != assoc["id2"] and assoc["id2"] in visible_ids:
            pairings[assoc["id1"]].append((assoc["qs"], assoc["id2"]))

    out_categories = []
    for category in categories:
        print(f"- {category['name']}")
        items = []
        for item in sorted(items_by_category[category["menu_category_id"]], key=lambda i: i["order_number"]):
            item_id = as_int(item["menu_item_id"], "id prodotto")
            name, spice = clean_name(item["name"])
            description = (item.get("ingredients") or "").strip()
            options = []
            if item.get("composite"):
                extras = json.loads(fetch(EXTRAS_URL.format(business_id=business_id, item_id=item_id)))
                options = build_options(extras)
            searchable = f"{name} {description}".lower()
            items.append({
                "id": item_id,
                "name": name,
                "description": description,
                "price": as_int(item["price"] or 0, "prezzo prodotto"),
                "image": save_image(full_size_url(item.get("picture")), f"item-{item_id}", ITEM_IMAGE_WIDTH, refresh),
                "available": bool(item["available"]),
                "spice": spice,
                "tags": ["vegano"] if ("vegan" in searchable or "planted" in searchable) else [],
                "pairsWith": [as_int(i, "abbinamento") for _, i in sorted(pairings[item_id], reverse=True)[:MAX_PAIRINGS]],
                "options": options,
            })
        out_categories.append({
            "id": as_int(category["menu_category_id"], "id categoria"),
            "name": category["name"].strip(),
            "slug": slugify(category["name"]),
            "image": save_image(category.get("picture"), f"category-{category['menu_category_id']}", CATEGORY_IMAGE_WIDTH, refresh),
            "items": items,
        })

    sold = sorted(raw.get("menusItemsSold") or [], key=lambda s: -s["qs"])
    best_sellers = [as_int(s["id"], "più venduto") for s in sold if s["id"] in visible_ids][:BEST_SELLERS]
    return out_categories, best_sellers


def main():
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--refresh", action="store_true", help="riscarica anche le foto già presenti")
    args = parser.parse_args()

    IMG_DIR.mkdir(parents=True, exist_ok=True)
    print(f"Scarico {SOURCE_URL}")
    raw = parse_page_constants(fetch(SOURCE_URL).decode("utf-8"))
    categories, best_sellers = build_menu(raw, args.refresh)
    payload = {
        "updatedAt": date.today().isoformat(),
        "source": SOURCE_URL,
        "business": build_business(raw),
        "bestSellers": best_sellers,
        "categories": categories,
    }
    body = json.dumps(payload, ensure_ascii=False, indent=2)
    OUT_FILE.write_text(
        "/* Generato da tools/build_menu_data.py: non modificare a mano, rilancia lo script. */\n"
        f"window.FFC_MENU = {body};\n",
        encoding="utf-8",
    )
    count = sum(len(c["items"]) for c in categories)
    print(f"OK: {len(categories)} categorie, {count} prodotti -> {OUT_FILE.relative_to(ROOT)}")


if __name__ == "__main__":
    try:
        main()
    except RuntimeError as err:
        sys.exit(f"Errore: {err}")
