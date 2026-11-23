"""Generate placeholder app icons / splash images with the DYH mark.
Replace with the official brand assets before store submission."""
import sys
from PIL import Image, ImageDraw, ImageFont

NAVY = (23, 50, 95)
WHITE = (255, 255, 255)

def font(size):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"]:
        try:
            return ImageFont.truetype(p, size)
        except OSError:
            pass
    return ImageFont.load_default()

def mark(draw, cx, cy, s, color, w):
    # outlined medical cross + inner rounded rect, as in the DYH logo
    pts = [(30, 8), (52, 8), (52, 22), (68, 22), (68, 44), (52, 44), (52, 58), (30, 58), (30, 44), (14, 44), (14, 22), (30, 22)]
    ox, oy = cx - 41 * s, cy - 33 * s
    P = [(ox + x * s, oy + y * s) for x, y in pts]
    draw.line(P + [P[0]], fill=color, width=w, joint="curve")
    draw.rounded_rectangle([ox + 29 * s, oy + 25 * s, ox + 54 * s, oy + 41 * s], radius=6 * s, outline=color, width=w)

def icon(path, size=1024, label=None):
    im = Image.new("RGB", (size, size), NAVY)
    d = ImageDraw.Draw(im)
    mark(d, size / 2, size * 0.42, size / 110, WHITE, max(6, size // 60))
    f = font(size // 7)
    t = "DYH"
    w = d.textlength(t, font=f)
    d.text(((size - w) / 2, size * 0.66), t, font=f, fill=WHITE)
    if label:
        f2 = font(size // 22)
        w2 = d.textlength(label, font=f2)
        d.text(((size - w2) / 2, size * 0.84), label, font=f2, fill=(200, 214, 238))
    im.save(path)

out, label = sys.argv[1], (sys.argv[2] if len(sys.argv) > 2 else None)
icon(f"{out}/icon.png", 1024, label)
icon(f"{out}/splash.png", 1242, label)
