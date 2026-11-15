"""Generate the site's brand assets — share card, favicon, and app icons.

Everything here is drawn from one description of the pillar, ported from
src/components/layout/CorinthianPillar.tsx, so the tab icon, the home-screen
icon, the share card and the colonnade standing behind the pages can't drift
apart. The geometry is emitted as backend-neutral shapes and painted twice:
once through Pillow for the PNGs, once as SVG for the favicon.

Type on the card is the site's own — Inter is read out of the installed
@fontsource package (WOFF, unpacked to SFNT in memory), so no system fonts and
no network are involved.

Run from the repo root:  python3 scripts/generate_brand_assets.py
Needs: pillow (pip install pillow)
"""

import io
import math
import re
import struct
import zlib
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parent.parent
PUBLIC = ROOT / "public"

# The site's palette, read out of the @theme block in index.css so the card and
# the icons can't drift from the page.
THEME = dict(re.findall(r"--color-(page|slate-\d+):\s*(#[0-9a-f]{6})",
                        (ROOT / "src" / "index.css").read_text()))


def theme_rgb(name: str) -> tuple:
    return tuple(int(THEME[name][i : i + 2], 16) for i in (1, 3, 5))


BG = theme_rgb("page")          # body background
MARK = theme_rgb("slate-200")   # the pillar's masses
FLUTE = theme_rgb("slate-400")  # fluting lines
TITLE = theme_rgb("slate-300")  # the navbar wordmark's colour, not white
SUB = theme_rgb("slate-400")
RULE = theme_rgb("slate-500")
FOOT = theme_rgb("slate-500")

# Share card: 1200x630 is what every crawler crops to, rendered at 3x and
# downsampled so the fluting and the volute coils stay clean.
W, H = 1200, 630
S = 3

# One large pillar standing behind the card, the way App.tsx stands one behind
# every page that isn't the home hero: capital near the top, fluted shaft running
# down past the wordmark and off the bottom edge. Slightly less faint than the
# page's 5% — a share card is read at thumbnail size, where 5% disappears.
BG_PILLAR_OPACITY = 0.12
BG_PILLAR_WIDTH = 560      # capital ~half the card's width; shaft sits behind the type

# Icons: a rounded square of the page colour with a column rising out of the
# bottom edge — capital at the top, shaft running off the frame, no base. The
# stepped base reads as a second, wrong capital at that size, and cropping it
# lets the column be bigger in the same square. Deliberately not a circular
# badge either: every platform masks the icon to its own shape, and a circle
# inside that reads as a sticker.
ICON_RADIUS = 0.22         # corner radius as a fraction of the icon's size
ICON_WIDTH = 0.78          # capital's width, as a fraction of the icon's size
ICON_TOP = 0.13            # where the capital starts, likewise
# Maskable icons are cropped to the central 80% circle, so the capital has to sit
# inside it — the shaft is the only part that can afford to be shaved.
MASKABLE_WIDTH = 0.56
MASKABLE_TOP = 0.25

# The mark on an icon is quieter than the mark on a page: an icon is small, solid
# and lit by whatever is behind it, and slate-200 at that size reads as white.
ICON_MARK = theme_rgb("slate-300")
ICON_FLUTE = theme_rgb("slate-500")


# --- fonts -----------------------------------------------------------------
# WOFF is an SFNT with each table zlib-deflated and a 44-byte header in front.
# Unpacking it is a dozen lines and saves depending on fonttools/brotli just to
# draw two lines of text.
def woff_to_sfnt(data: bytes) -> bytes:
    if data[:4] != b"wOFF":
        raise ValueError("not a WOFF file")
    flavor, _, num_tables = struct.unpack(">4sIH", data[4:14])
    entries = []
    for i in range(num_tables):
        off = 44 + i * 20
        tag, t_off, comp_len, orig_len, checksum = struct.unpack(">4sIIII", data[off : off + 20])
        raw = data[t_off : t_off + comp_len]
        entries.append((tag, checksum, raw if comp_len == orig_len else zlib.decompress(raw), orig_len))

    entry_selector = max(0, int(math.log2(num_tables)))
    search_range = (2**entry_selector) * 16
    out = bytearray(
        struct.pack(">4sHHHH", flavor, num_tables, search_range, entry_selector,
                    num_tables * 16 - search_range)
    )
    body_offset = 12 + num_tables * 16
    body = bytearray()
    for tag, checksum, table, orig_len in entries:
        out += struct.pack(">4sIII", tag, checksum, body_offset + len(body), orig_len)
        body += table
        body += b"\0" * (-len(table) % 4)
    return bytes(out + body)


def load_font(file: str, size: int) -> ImageFont.FreeTypeFont:
    path = ROOT / "node_modules" / "@fontsource" / "inter" / "files" / file
    if not path.is_file():
        raise SystemExit(f"font not found: {path}\nRun `bun install` first.")
    return ImageFont.truetype(io.BytesIO(woff_to_sfnt(path.read_bytes())), size)


# --- the pillar, ported from CorinthianPillar.tsx --------------------------
# All coordinates live in the component's 50-unit-wide space and are scaled by
# the caller, exactly as the component does it.
CAPITAL_UNITS = 17.5
VOLUTE_TURNS = 1.25
VOLUTE_END_R = 1.8
RIBBON_START, RIBBON_MAX, RIBBON_END = 0.9, 2.2, 0.3
VOLUTE_CY, VOLUTE_R, VOLUTE_CX = 10.9, 5.0, (7.0, 43.0)
MOTIF_TOP, MOTIF_BOTTOM = 6.4, 12.6
BOX_X, BOX_W, HOLE = 22.0, 6.0, 2.4
HOLE_X = BOX_X + (BOX_W - HOLE) / 2
HOLE_Y = (MOTIF_TOP + MOTIF_BOTTOM - HOLE) / 2
FLUTES = (17, 21, 25, 29, 33)
BASE_SLABS = ((26, 12, 0, 2.5, 0.5), (30, 10, 5, 3, 0.5), (34, 8, 10, 4, 1))  # w, x, y, h, r
BASE_UNITS = 14  # the three slabs together


def smoothstep(t: float) -> float:
    return t * t * (3 - 2 * t)


def ribbon_width(t: float) -> float:
    """Width of the volute's ribbon along the coil: swells over the first third,
    tapers to a point from there, the way the icon's scroll is cut."""
    if t < 0.3:
        return RIBBON_START + (RIBBON_MAX - RIBBON_START) * smoothstep(t / 0.3)
    return RIBBON_MAX + (RIBBON_END - RIBBON_MAX) * smoothstep((t - 0.3) / 0.7)


def volute_polygon(cx: float, cy: float, r: float, clockwise: bool) -> list:
    steps = 56
    sweep = (1 if clockwise else -1) * VOLUTE_TURNS * 2 * math.pi
    spine = []
    for i in range(steps + 1):
        t = i / steps
        angle = -math.pi / 2 + sweep * t          # starts at the top of the volute
        radius = r - (r - VOLUTE_END_R) * t
        spine.append((cx + radius * math.cos(angle), cy + radius * math.sin(angle), t))

    outer, inner = [], []
    for i, (x, y, t) in enumerate(spine):
        bx, by, _ = spine[max(0, i - 1)]
        ax, ay, _ = spine[min(steps, i + 1)]
        dx, dy = ax - bx, ay - by
        length = math.hypot(dx, dy) or 1
        half = ribbon_width(t) / 2
        nx, ny = -dy / length * half, dx / length * half
        outer.append((x + nx, y + ny))
        inner.append((x - nx, y - ny))
    return outer + inner[::-1]


# Shapes are plain dicts so the same geometry can be painted by Pillow or written
# out as SVG. `role` picks the colour: the masses, the fluting, or the opening in
# the capital's centre square, which shows whatever is behind the pillar.
def _rect(x, y, w, h, r=0.0, role="mark"):
    return {"kind": "rect", "x": x, "y": y, "w": w, "h": h, "r": r, "role": role}


def capital_shapes(x: float, y: float, scale: float) -> list:
    """The Ionic capital, top-left at (x, y). A cornice bar over a second,
    shorter one; the wedge / bar / boxed-square / bar / wedge run between the two
    scrolls; the plate the shaft rises into."""

    def sx(v):
        return x + v * scale

    def sy(v):
        return y + v * scale

    def rect(rx, ry, rw, rh, radius=0.0, role="mark"):
        return _rect(sx(rx), sy(ry), rw * scale, rh * scale, radius * scale, role)

    def wedge(spine, tip):
        pts = [(tip, MOTIF_TOP), (spine, MOTIF_TOP), (spine, MOTIF_BOTTOM),
               (spine + (tip - spine) * 0.3, MOTIF_BOTTOM)]
        return {"kind": "poly", "points": [(sx(px), sy(py)) for px, py in pts], "role": "mark"}

    shapes = [
        rect(3, 0.5, 44, 1.6, 0.4),
        rect(4.8, 3, 40.4, 1.4, 0.4),
        wedge(16, 11.5),
        wedge(34, 38.5),
        rect(17.5, MOTIF_TOP, 3, MOTIF_BOTTOM - MOTIF_TOP),
        rect(29.5, MOTIF_TOP, 3, MOTIF_BOTTOM - MOTIF_TOP),
        rect(BOX_X, MOTIF_TOP, BOX_W, MOTIF_BOTTOM - MOTIF_TOP),
        rect(HOLE_X, HOLE_Y, HOLE, HOLE, 0, "hole"),
        rect(10.1, 14.4, 29.8, 1.6, 0.4),
    ]
    for i, vcx in enumerate(VOLUTE_CX):
        shapes.append({
            "kind": "poly",
            "points": [(sx(px), sy(py)) for px, py in volute_polygon(vcx, VOLUTE_CY, VOLUTE_R, i == 1)],
            "role": "mark",
        })
        shapes.append({"kind": "circle", "cx": sx(vcx), "cy": sy(VOLUTE_CY),
                       "r": 0.75 * scale, "role": "mark"})
    return shapes


def pillar_shapes(x: float, width: float, top: float, bottom: float, base: bool = True) -> list:
    """A whole pillar: capital, fluted shaft, stepped base. The shaft stretches
    to fill whatever height it is given, which is what the component's flipped
    variant does. `base=False` runs the shaft off the bottom edge instead, for a
    column taller than its frame."""
    scale = width / 50
    shapes = capital_shapes(x, top, scale)

    shaft_top = top + CAPITAL_UNITS * scale
    shaft_bottom = bottom - (BASE_UNITS * scale if base else 0)
    shapes.append(_rect(x + 14 * scale, shaft_top, 22 * scale, shaft_bottom - shaft_top))
    for fx in FLUTES:
        shapes.append({"kind": "line", "x": x + fx * scale,
                       "y0": shaft_top + 2 * scale, "y1": shaft_bottom - 2 * scale,
                       "w": max(1.0, 0.75 * scale), "role": "flute"})

    if base:
        for bw, bx, by, bh, r in BASE_SLABS:
            shapes.append(_rect(x + bx * scale, shaft_bottom + by * scale,
                                bw * scale, bh * scale, r * scale))
    return shapes


def paint(layer: Image.Image, shapes: list, mark=MARK, flute=FLUTE) -> None:
    """Draw shapes onto an RGBA layer. The capital's opening is cleared to
    transparency so whatever the layer is composited over shows through it."""
    colours = {"mark": mark + (255,), "flute": flute + (255,), "hole": (0, 0, 0, 0)}
    d = ImageDraw.Draw(layer)
    for s in shapes:
        fill = colours[s["role"]]
        if s["kind"] == "rect":
            box = [s["x"], s["y"], s["x"] + s["w"], s["y"] + s["h"]]
            if s["r"] > 0:
                d.rounded_rectangle(box, radius=s["r"], fill=fill)
            else:
                d.rectangle(box, fill=fill)
        elif s["kind"] == "poly":
            d.polygon(s["points"], fill=fill)
        elif s["kind"] == "circle":
            d.ellipse([s["cx"] - s["r"], s["cy"] - s["r"], s["cx"] + s["r"], s["cy"] + s["r"]],
                      fill=fill)
        elif s["kind"] == "line":
            d.line([(s["x"], s["y0"]), (s["x"], s["y1"])], fill=fill, width=int(round(s["w"])))


def to_svg(shapes: list, hole_fill: str) -> str:
    """The same shapes as SVG. The capital's opening can't be a hole here — the
    favicon is one flat layer — so it is filled with the field colour."""
    hexes = {"mark": THEME["slate-300"], "flute": THEME["slate-500"], "hole": hole_fill}
    out = []
    for s in shapes:
        fill = hexes[s["role"]]
        if s["kind"] == "rect":
            r = f' rx="{s["r"]:.1f}"' if s["r"] > 0 else ""
            out.append(f'<rect x="{s["x"]:.1f}" y="{s["y"]:.1f}" width="{s["w"]:.1f}" '
                       f'height="{s["h"]:.1f}"{r} fill="{fill}"/>')
        elif s["kind"] == "poly":
            pts = " ".join(f"{px:.1f},{py:.1f}" for px, py in s["points"])
            out.append(f'<polygon points="{pts}" fill="{fill}"/>')
        elif s["kind"] == "circle":
            out.append(f'<circle cx="{s["cx"]:.1f}" cy="{s["cy"]:.1f}" r="{s["r"]:.1f}" fill="{fill}"/>')
        elif s["kind"] == "line":
            out.append(f'<line x1="{s["x"]:.1f}" y1="{s["y0"]:.1f}" x2="{s["x"]:.1f}" '
                       f'y2="{s["y1"]:.1f}" stroke="{fill}" stroke-width="{s["w"]:.1f}" '
                       f'stroke-linecap="round"/>')
    return "\n    ".join(out)


def icon_pillar(size: float, width_ratio: float, top_ratio: float) -> list:
    """A column centred in a square of `size`, rising out of the bottom edge.

    Proportioned for a small square rather than left at the component's 1:4 — a
    column that slim reads as a line at 32px — and cropped at the foot rather
    than stood on its base, so the capital can be as large as the square allows.
    """
    width = size * width_ratio
    return pillar_shapes((size - width) / 2, width, size * top_ratio, size, base=False)


def build_icon(path: Path, size: int, width_ratio: float, top_ratio: float, radius: float) -> None:
    ss = 4  # supersample, then downscale — the flutes and coils are hairlines
    canvas = Image.new("RGBA", (size * ss, size * ss), (0, 0, 0, 0))
    field = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    ImageDraw.Draw(field).rounded_rectangle([0, 0, size * ss - 1, size * ss - 1],
                                            radius=radius * size * ss, fill=BG + (255,))
    canvas.alpha_composite(field)

    pillar = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    paint(pillar, icon_pillar(size * ss, width_ratio, top_ratio), ICON_MARK, ICON_FLUTE)
    canvas.alpha_composite(pillar)

    canvas.resize((size, size), Image.LANCZOS).save(path, "PNG", optimize=True)
    report(path)


def build_favicon(path: Path) -> None:
    """The tab icon. Same rounded field as the app icons so a bookmark, a tab and
    a home screen all show the same mark."""
    size = 512
    body = to_svg(icon_pillar(size, ICON_WIDTH, ICON_TOP), hole_fill=THEME["page"])
    path.write_text(
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">\n'
        "  <!-- Criterion Club pillar mark. Generated by scripts/generate_brand_assets.py\n"
        "       from the geometry in src/components/layout/CorinthianPillar.tsx —\n"
        "       edit those, not this file. -->\n"
        f'  <rect width="512" height="512" rx="{ICON_RADIUS * size:.0f}" fill="{THEME["page"]}"/>\n'
        f"  <g>\n    {body}\n  </g>\n</svg>\n"
    )
    report(path)


# --- share card ------------------------------------------------------------
def fade(layer: Image.Image, opacity: float) -> Image.Image:
    """Scale a layer's alpha only.

    NOT `Image.blend` against a transparent layer: that scales the colour
    channels too, so a 12% layer composites at roughly 1% and the pillar all but
    disappears.
    """
    faded = layer.copy()
    faded.putalpha(layer.getchannel("A").point(lambda a: int(a * opacity)))
    return faded


def tracked_width(font, text: str, tracking: float) -> float:
    return sum(font.getlength(c) for c in text) + tracking * max(0, len(text) - 1)


def draw_tracked(draw, xy, text: str, font, fill, tracking: float) -> None:
    """Letter-spaced text — the site's eyebrows run at 0.25em, which Pillow has
    no setting for, so the string is laid out a glyph at a time."""
    x, y = xy
    for ch in text:
        draw.text((x, y), ch, font=font, fill=fill)
        x += font.getlength(ch) + tracking


def soft_rule(layer: Image.Image, cx: float, y: float, width: float, height: float, colour) -> None:
    """A hairline that fades out at both ends rather than stopping — the same
    treatment SoftRule gives it in the hero banners."""
    strip = Image.new("RGBA", (int(width), max(1, int(height))), colour + (0,))
    px = strip.load()
    for i in range(strip.width):
        t = i / (strip.width - 1)
        alpha = int(255 * 0.7 * (1 - abs(t - 0.5) * 2) ** 0.85)
        for j in range(strip.height):
            px[i, j] = colour + (alpha,)
    layer.alpha_composite(strip, (int(cx - width / 2), int(y)))


def build_card(path: Path) -> None:
    canvas = Image.new("RGBA", (W * S, H * S), BG + (255,))

    backdrop = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    paint(backdrop, pillar_shapes((W - BG_PILLAR_WIDTH) / 2 * S, BG_PILLAR_WIDTH * S,
                                  18 * S, H * S + 80 * S, base=False))
    canvas.alpha_composite(fade(backdrop, BG_PILLAR_OPACITY))

    draw = ImageDraw.Draw(canvas)
    cx = W * S / 2

    # Sized for the thumbnail, not for the 1200x630 file: a timeline card is
    # served at a third of that, so the subtitle at 36px is really 12px to the
    # reader and the footer at 22px is 7px. Anything smaller stops being text
    # and becomes texture.
    inter_bold = load_font("inter-latin-700-normal.woff", 108 * S)
    inter_reg = load_font("inter-latin-400-normal.woff", 36 * S)
    inter_med = load_font("inter-latin-500-normal.woff", 22 * S)

    title = "Criterion Club"
    tracking = -2.0 * S  # the navbar wordmark is tracking-tight
    draw_tracked(draw, (cx - tracked_width(inter_bold, title, tracking) / 2, 212 * S),
                 title, inter_bold, TITLE + (255,), tracking)

    soft_rule(canvas, cx, 368 * S, 380 * S, max(1, int(1.2 * S)), RULE)

    sub = "the leading unrecorded podcast on cinema"
    draw.text((cx - inter_reg.getlength(sub) / 2, 390 * S), sub, font=inter_reg, fill=SUB + (255,))

    foot = "CRITERIONCLUB.ORG"
    foot_track = 0.28 * 22 * S  # the site's 0.25-0.3em eyebrow tracking
    draw_tracked(draw, (cx - tracked_width(inter_med, foot, foot_track) / 2, 520 * S),
                 foot, inter_med, FOOT + (255,), foot_track)

    canvas.resize((W, H), Image.LANCZOS).convert("RGB").save(path, "PNG", optimize=True)
    report(path)


def report(path: Path) -> None:
    print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size / 1024:.1f} KB)")


def main() -> None:
    build_card(PUBLIC / "og-card.png")
    build_favicon(PUBLIC / "pillar.svg")
    build_icon(PUBLIC / "pillar-180x180.png", 180, ICON_WIDTH, ICON_TOP, ICON_RADIUS)  # apple-touch
    build_icon(PUBLIC / "pillar-192x192.png", 192, ICON_WIDTH, ICON_TOP, ICON_RADIUS)
    build_icon(PUBLIC / "pillar-512x512.png", 512, ICON_WIDTH, ICON_TOP, ICON_RADIUS)
    # Maskable: square to the edges, since the launcher supplies the shape.
    build_icon(PUBLIC / "pillar-maskable-512x512.png", 512, MASKABLE_WIDTH, MASKABLE_TOP, 0)


if __name__ == "__main__":
    main()
