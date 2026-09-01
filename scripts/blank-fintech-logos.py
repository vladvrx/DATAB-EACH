from pathlib import Path

from PIL import Image

ASSET_DIR = Path(__file__).resolve().parents[1] / "reference" / "assets"
PREFIXES = ("tech-company-", "neutral-logo-", "phone-tech-company-")
FORMATS = {".png": "PNG", ".webp": "WEBP", ".avif": "AVIF"}

count = 0
for path in sorted(ASSET_DIR.iterdir()):
    if not path.is_file() or not path.name.startswith(PREFIXES) or path.suffix.lower() not in FORMATS:
        continue
    with Image.open(path) as source:
        blank = Image.new("RGBA", source.size, (0, 0, 0, 0))
        save_kwargs = {"format": FORMATS[path.suffix.lower()]}
        if path.suffix.lower() in {".webp", ".avif"}:
            save_kwargs["quality"] = 90
        blank.save(path, **save_kwargs)
    count += 1

blank_path = ASSET_DIR / "blank-tech-company.png"
Image.new("RGBA", (256, 256), (0, 0, 0, 0)).save(blank_path, format="PNG")
print(f"Blanked {count} neutral company logo variants and wrote {blank_path.name}.")
