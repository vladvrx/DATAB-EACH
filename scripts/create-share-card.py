from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ASSETS = ROOT / "reference" / "assets"
OUT = ROOT / "reference" / "share" / "share_en.png"

width, height = 1200, 630
image = Image.new("RGB", (width, height), "#071d46")
pixels = image.load()
for y in range(height):
    t = y / (height - 1)
    if t < 0.68:
        a = t / 0.68
        top = (7, 29, 70)
        bottom = (24, 163, 194)
        color = tuple(round(top[i] * (1 - a) + bottom[i] * a) for i in range(3))
    else:
        a = (t - 0.68) / 0.32
        top = (24, 163, 194)
        bottom = (244, 149, 72)
        color = tuple(round(top[i] * (1 - a) + bottom[i] * a) for i in range(3))
    for x in range(width):
        pixels[x, y] = color

draw = ImageDraw.Draw(image)

# Pixel clouds, sun, and distant islands keep the card playful without reusing source artwork.
for x, y in [(90, 108), (145, 88), (200, 108), (870, 124), (930, 104), (990, 124)]:
    draw.rectangle((x, y, x + 54, y + 18), fill="#c9f6f3")
    draw.rectangle((x + 14, y - 14, x + 40, y + 18), fill="#c9f6f3")
draw.rectangle((830, 72, 1018, 260), fill="#ffd36b")
draw.rectangle((858, 48, 990, 284), fill="#ffd36b")
draw.rectangle((0, 438, width, height), fill="#f4b95f")
draw.rectangle((0, 470, width, height), fill="#f7d47c")
for x, h in [(80, 44), (240, 70), (390, 50), (1020, 58), (1130, 84)]:
    draw.polygon([(x, 438), (x + 86, 438), (x + 52, 438 - h), (x + 28, 438 - h - 15)], fill="#1d7895")
for x in range(-20, width + 40, 100):
    draw.rectangle((x, 520, x + 58, 529), fill="#fff1bc")
    draw.rectangle((x + 25, 529, x + 91, 538), fill="#fff1bc")

# Pixel palm silhouettes.
for base_x, base_y, scale in [(92, 510, 1), (1080, 516, 1.15)]:
    trunk = [(base_x, base_y), (base_x + 16 * scale, base_y), (base_x + 8 * scale, base_y - 170 * scale), (base_x - 4 * scale, base_y - 170 * scale)]
    draw.polygon(trunk, fill="#12365b")
    cx, cy = base_x + 2, base_y - 172 * scale
    for dx, dy in [(-74, -32), (-53, -56), (-17, -72), (24, -66), (60, -38), (72, -4)]:
        draw.rectangle((min(cx, cx + dx), min(cy, cy + dy), max(cx, cx + dx), max(cy, cy + dy)), fill="#12365b")
        draw.rectangle((cx + dx - 5, cy + dy - 5, cx + dx + 8, cy + dy + 8), fill="#12365b")

logo_path = ASSETS / "databeach-logo.png"
with Image.open(logo_path).convert("RGBA") as logo:
    logo.thumbnail((650, 330), Image.Resampling.LANCZOS)
    image.paste(logo, ((width - logo.width) // 2, 162), logo)

font_path = r"C:\Windows\Fonts\arialbd.ttf"
small = ImageFont.truetype(font_path, 24)
label = "A PLAYFUL ISLAND ADVENTURE"
box = draw.textbbox((0, 0), label, font=small)
draw.text(((width - (box[2] - box[0])) // 2, 570), label, font=small, fill="#06214a")

image.save(OUT, format="PNG", optimize=True)
print(f"Wrote {OUT}")
