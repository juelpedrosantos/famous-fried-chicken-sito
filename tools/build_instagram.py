#!/usr/bin/env python3
"""Aggiorna la griglia "Seguici sui social" con gli ultimi post Instagram.

Legge il feed JSON di Behold (collegato all'account @famousfriedchicken.it), scarica le anteprime
in assets/img/instagram/ come WebP e riscrive la lista tra i marcatori IG:START / IG:END di index.html.
Gira ogni ora nella stessa GitHub Action del menu. Se il feed non risponde, il sito resta com'è.

Uso: python3 tools/build_instagram.py [--feed URL]
"""
import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import urllib.request
from datetime import datetime
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
INDEX = ROOT / "index.html"
IMG_DIR = ROOT / "assets" / "img" / "instagram"
DEFAULT_FEED = "https://feeds.behold.so/xf0AyBv5p7yRoYHL03oR"
MAX_POSTS = 6  # il piano gratuito di Behold restituisce al massimo 6 post
IMG_WIDTH = 640
TIMEOUT_S = 30
ALLOWED_IMAGE_HOSTS = ("behold.pictures", "cdn2.behold.pictures")
MARK_START = "<!-- IG:START -->"
MARK_END = "<!-- IG:END -->"
MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio",
          "agosto", "settembre", "ottobre", "novembre", "dicembre"]
PLAY_ICON = ('<span class="social-post__play" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22">'
             '<path d="M8 5v14l11-7z" fill="currentColor"/></svg></span>')


def fail(message: str) -> None:
    print(f"Instagram: {message}", file=sys.stderr)
    sys.exit(1)


def fetch(url: str) -> bytes:
    if not url.startswith("https://"):
        fail(f"indirizzo non sicuro: {url}")
    req = urllib.request.Request(url, headers={"User-Agent": "famous-site-bot/1.0"})
    with urllib.request.urlopen(req, timeout=TIMEOUT_S) as resp:
        return resp.read()


def host_of(url: str) -> str:
    match = re.match(r"https://([^/]+)/", url)
    return match.group(1) if match else ""


def valid_post(post: dict) -> dict | None:
    """Tiene solo i campi che servono, dopo averli controllati."""
    post_id = str(post.get("id", ""))
    permalink = str(post.get("permalink", ""))
    if not post_id.isdigit() or not re.match(r"^https://www\.instagram\.com/(p|reel|tv)/[\w-]+/?$", permalink):
        return None
    if post.get("visibility", "visible") != "visible":
        return None
    sizes = post.get("sizes") or {}
    image = (sizes.get("medium") or sizes.get("large") or {}).get("mediaUrl", "")
    if host_of(image) not in ALLOWED_IMAGE_HOSTS:
        return None
    try:
        when = datetime.strptime(str(post.get("timestamp", ""))[:10], "%Y-%m-%d")
    except ValueError:
        return None
    caption = str(post.get("prunedCaption") or post.get("caption") or "").strip()
    return {
        "id": post_id,
        "href": permalink,
        "image": image,
        "is_video": post.get("mediaType") == "VIDEO",
        "date": f"{when.day} {MONTHS[when.month - 1]}",
        "caption": caption.splitlines()[0][:90] if caption else "",
    }


def save_image(url: str, post_id: str) -> str:
    """Scarica l'anteprima una sola volta (gli id dei post non cambiano)."""
    target = IMG_DIR / f"ig-{post_id}.webp"
    if target.exists():
        return target.name
    data = fetch(url)
    with tempfile.NamedTemporaryFile(suffix=".jpg") as tmp:
        tmp.write(data)
        tmp.flush()
        if shutil.which("cwebp") is None:
            fail("serve cwebp per convertire le immagini")
        subprocess.run(["cwebp", "-quiet", "-q", "80", "-resize", str(IMG_WIDTH), "0", tmp.name, "-o", str(target)], check=True)
    return target.name


def render_item(post: dict, image_name: str) -> str:
    kind = "Reel" if post["is_video"] else "Post"
    label = f"{kind} Instagram del {post['date']}"
    if post["caption"]:
        label += f": {post['caption']}"
    return (
        f'            <li><a class="social-post" href="{html.escape(post["href"])}" target="_blank" rel="noopener" '
        f'aria-label="{html.escape(label)}"><img src="assets/img/instagram/{image_name}" alt="" width="640" height="640" '
        f'loading="lazy">{PLAY_ICON if post["is_video"] else ""}</a></li>'
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--feed", default=os.environ.get("INSTAGRAM_FEED_URL", DEFAULT_FEED))
    args = parser.parse_args()

    try:
        feed = json.loads(fetch(args.feed))
    except Exception as err:  # rete o JSON non validi: non tocchiamo il sito
        fail(f"feed non leggibile ({err})")
    raw_posts = feed.get("posts") if isinstance(feed, dict) else None
    if not isinstance(raw_posts, list):
        fail("il feed non contiene una lista di post")
    posts = [p for p in (valid_post(x) for x in raw_posts if isinstance(x, dict)) if p][:MAX_POSTS]
    if len(posts) < 3:
        fail(f"troppo pochi post validi ({len(posts)}), lascio la griglia com'è")

    IMG_DIR.mkdir(parents=True, exist_ok=True)
    items = [render_item(p, save_image(p["image"], p["id"])) for p in posts]

    page = INDEX.read_text(encoding="utf-8")
    start, end = page.find(MARK_START), page.find(MARK_END)
    if start < 0 or end < start:
        fail("marcatori IG:START / IG:END non trovati in index.html")
    block = MARK_START + "\n" + "\n".join(items) + "\n            "
    INDEX.write_text(page[:start] + block + page[end:], encoding="utf-8")

    keep = {f"ig-{p['id']}.webp" for p in posts}
    for old in IMG_DIR.glob("*.webp"):
        if old.name not in keep:
            old.unlink()
    print(f"Instagram: {len(posts)} post aggiornati")


if __name__ == "__main__":
    main()
