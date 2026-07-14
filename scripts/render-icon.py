from pathlib import Path
from PIL import Image, ImageDraw


ROOT = Path(__file__).resolve().parents[1]
SCALE = 4


def p(value):
    if isinstance(value, (tuple, list)):
        return tuple(int(item * SCALE) for item in value)
    return int(value * SCALE)


canvas = Image.new("RGB", p((256, 256)), "#FFFFFF")
draw = ImageDraw.Draw(canvas)

draw.rounded_rectangle(p((8, 8, 248, 248)), radius=p(44), fill="#17212B")
draw.rounded_rectangle(
    p((10, 10, 246, 246)), radius=p(42), outline="#31404D", width=p(3)
)
draw.polygon([p((104, 48)), p((42, 145)), p((104, 145))], fill="#20B7A5")
draw.polygon([p((122, 66)), p((202, 145)), p((122, 145))], fill="#FF705D")
draw.line(p((113, 44, 113, 156)), fill="#F4F1E8", width=p(10))
draw.ellipse(p((108, 39, 118, 49)), fill="#F4F1E8")

wave = []
for index in range(101):
    t = index / 100
    x = 42 + 144 * t
    y = 174 - 10 * __import__("math").sin(t * 2 * __import__("math").pi)
    wave.append(p((x, y)))
draw.line(wave, fill="#F4F1E8", width=p(8), joint="curve")

draw.line(p((67, 207, 189, 207)), fill="#60717E", width=p(5))
for x, color in ((67, "#20B7A5"), (128, "#F4F1E8"), (189, "#FF705D")):
    draw.ellipse(p((x - 8, 199, x + 8, 215)), fill=color)

icon = canvas.resize((256, 256), Image.Resampling.LANCZOS)
icon.save(ROOT / "icon.png", optimize=True)
icon.save(ROOT / "docs" / ".vuepress" / "public" / "logo.png", optimize=True)
