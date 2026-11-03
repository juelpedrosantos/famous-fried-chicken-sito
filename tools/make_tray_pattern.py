"""Genera la texture "carta da vassoio" (loghi ripetuti) usata come sfondo: assets/img/brand/tray-pattern.webp (via cwebp)."""
import sys
from pathlib import Path
from PIL import Image

OPACITY = 0.12
TILE = 600
BRAND = Path(__file__).resolve().parent.parent / "assets" / "img" / "brand"

def faded(img, opacity):
    r, g, b, a = img.split()
    return Image.merge("RGBA", (r, g, b, a.point(lambda v: int(v * opacity))))

wordmark = Image.open(BRAND / "wordmark.png").convert("RGBA")
wordmark = wordmark.crop(wordmark.getbbox())
wordmark = wordmark.resize((280, int(280 * wordmark.height / wordmark.width)), Image.LANCZOS).rotate(12, expand=True, resample=Image.BICUBIC)
mascot = Image.open(BRAND / "mascot.png").convert("RGBA")
mascot = mascot.crop(mascot.getbbox()).resize((120, 120), Image.LANCZOS)

tile = Image.new("RGBA", (TILE, TILE), (0, 0, 0, 0))
half = TILE // 2
for (x, y) in [(10, 30), (half + 10, half + 30)]:
    tile.alpha_composite(faded(wordmark, OPACITY), (x % TILE, y % TILE))
for (x, y) in [(half + 90, 50), (90, half + 50)]:
    tile.alpha_composite(faded(mascot, OPACITY), (x, y))
tile.save(sys.argv[1] if len(sys.argv) > 1 else BRAND / "tray-pattern.png", optimize=True)
