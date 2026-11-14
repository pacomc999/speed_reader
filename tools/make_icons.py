"""Draws the app icons for the speed reader.

The icon looks like the reader itself: the word "read" on dark grey,
with the focus letter in red and the two small guide marks above and
below it.

Run from the speed_reader folder:
    python tools/make_icons.py
"""

from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

# Same colours as style.css
BACKGROUND = (18, 18, 18)
TEXT = (232, 232, 232)
ACCENT = (229, 72, 77)
GUIDE = (90, 90, 90)

FONT_FILE = "C:/Windows/Fonts/georgia.ttf"
OUTPUT_FOLDER = Path(__file__).resolve().parent.parent / "icons"

# File name -> size in pixels.
# 180 is what iPhones use for the home screen; 192 and 512 are for other devices.
ICON_SIZES = {
    "apple-touch-icon.png": 180,
    "icon-192.png": 192,
    "icon-512.png": 512,
}

WORD_BEFORE = "r"
WORD_FOCUS = "e"
WORD_AFTER = "ad"


def draw_icon(size):
    """Returns a square image of the icon at the given size."""
    image = Image.new("RGB", (size, size), BACKGROUND)
    draw = ImageDraw.Draw(image)
    font = ImageFont.truetype(FONT_FILE, int(size * 0.27))

    # Place the focus letter's middle at the centre of the icon,
    # just like the reader keeps the focus letter in the centre
    before_width = draw.textlength(WORD_BEFORE, font=font)
    focus_width = draw.textlength(WORD_FOCUS, font=font)
    start_x = size / 2 - before_width - focus_width / 2
    baseline_y = size * 0.6

    draw.text((start_x, baseline_y), WORD_BEFORE, font=font, fill=TEXT, anchor="ls")
    draw.text((start_x + before_width, baseline_y), WORD_FOCUS, font=font, fill=ACCENT, anchor="ls")
    draw.text((start_x + before_width + focus_width, baseline_y), WORD_AFTER, font=font, fill=TEXT, anchor="ls")

    draw_guides(draw, size)
    return image


def draw_guides(draw, size):
    """Draws the two small vertical marks above and below the focus letter."""
    middle = size / 2
    half_width = max(1, size // 90)
    mark_length = size * 0.08
    top_mark_y = size * 0.27
    bottom_mark_y = size * 0.66

    for y in (top_mark_y, bottom_mark_y):
        draw.rectangle(
            [middle - half_width, y, middle + half_width, y + mark_length],
            fill=GUIDE,
        )


def main():
    OUTPUT_FOLDER.mkdir(exist_ok=True)
    for file_name, size in ICON_SIZES.items():
        draw_icon(size).save(OUTPUT_FOLDER / file_name)
        print("saved", OUTPUT_FOLDER / file_name)


if __name__ == "__main__":
    main()
