"""
Ni90ty mark — generated to the CI manual, volume one.

Construction (CI section 02, cross-checked by measuring the manual's own
artwork at 200 dpi):

  RING   stroke = one tenth of the outside diameter. Outside diameter =
         wordmark x-height + one stroke, so the dial sits optically level
         with the 9 and the t.
  HANDS  three quarters of the ring stroke in weight, meeting at the centre
         with no pivot dot. One stands at twelve; the second is struck
         ninety degrees of a clock face later -- measured at 112.5 deg from
         twelve in the supplied artwork, with lengths 0.747 and 0.664 of the
         outside radius. Both hands cyan.
  FIT    side bearings half a stroke each side; letterspacing across the
         whole wordmark minus four percent.

The wordmark is artwork, not live text (CI section 05): letters are emitted
as filled paths from Source Serif 4 outlines, so no viewer needs the font
and nobody can reset the name in another face.

Everything below is drawn in a single y-down SVG coordinate system with the
baseline at y = 0, in font units (1000/em).
"""
import math
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.misc.transform import Transform

PAPER, INK, CYAN = "#F3F2F2", "#201E1D", "#0088B0"
CYAN_LT = "#4FB3D3"          # reversed lockup: hands step one shade lighter

SRC = "/home/user/chimera_dashboard/website/assets/fonts/source-serif-4-var-roman-latin.woff2"

# Display weight; a text-to-subhead optical size, which is what the manual's
# specimen shows -- not the 60 pt display cut, which is too high in contrast.
font = instantiateVariableFont(TTFont(SRC), {"wght": 600, "opsz": 24}, inplace=False)
gs, cmap, hmtx = font.getGlyphSet(), font.getBestCmap(), font["hmtx"]
XH   = font["OS/2"].sxHeight
DESC = font["hhea"].descent                 # negative
TRACK = -0.04

STROKE = XH / 9.0                            # OD = XH + stroke and stroke = OD/10
OD     = XH + STROKE
R_OUT  = OD / 2.0
R_MID  = R_OUT - STROKE / 2.0                # ring centreline, for a stroked circle
SIDE   = STROKE / 2.0

HAND_W  = STROKE * 0.75
HAND_A  = R_OUT * 0.747                      # hand at twelve
HAND_B  = R_OUT * 0.664                      # the second hand
ANGLE_B = 112.5

def gname(ch):    return cmap[ord(ch)]
def adv(ch):      return hmtx[gname(ch)][0]
def track(ch):    return adv(ch) * TRACK

def glyph_path(ch, x, baseline=0.0, scale=1.0):
    """One character as an SVG path, y-down, sitting on `baseline`."""
    pen = SVGPathPen(gs)
    gs[gname(ch)].draw(TransformPen(pen, Transform(scale, 0, 0, -scale, x, baseline)))
    return pen.getCommands()

def hand_path(cx, cy, deg, length):
    """A hand as a rotated rectangle, y-down, measured clockwise from twelve."""
    a = math.radians(deg)
    ux, uy = math.sin(a), -math.cos(a)        # along the hand, y-down
    px, py = -uy, ux                          # across it
    hw = HAND_W / 2.0
    pts = [(cx + px*hw,             cy + py*hw),
           (cx + px*hw + ux*length, cy + py*hw + uy*length),
           (cx - px*hw + ux*length, cy - py*hw + uy*length),
           (cx - px*hw,             cy - py*hw)]
    return "M" + " L".join("%.2f,%.2f" % p for p in pts) + " Z"

def dial(cx, cy, ring_col, hand_col, scale=1.0, hands=True, thicken=1.0):
    """thicken > 1 is the small-size ring: the hands are dropped and the ring
    thickens to hold (CI section 08). The outside diameter is preserved, so the
    extra weight grows inwards."""
    sw = STROKE * scale * thicken
    r  = (R_OUT * scale) - sw / 2.0
    out = ['<circle cx="%.2f" cy="%.2f" r="%.2f" fill="none" stroke="%s" stroke-width="%.2f"/>'
           % (cx, cy, r, ring_col, sw)]
    if hands:
        global HAND_W
        hw_save = HAND_W; HAND_W = HAND_W*scale
        out.append('<path d="%s" fill="%s"/>' % (hand_path(cx, cy, 0,       HAND_A*scale), hand_col))
        out.append('<path d="%s" fill="%s"/>' % (hand_path(cx, cy, ANGLE_B, HAND_B*scale), hand_col))
        HAND_W = hw_save
    return out

# --------------------------------------------------------------------------
# Wordmark layout: Ni9 + dial + ty
# --------------------------------------------------------------------------
def layout():
    items, x = [], 0.0
    for ch in "Ni9":
        items.append(("glyph", ch, x)); x += adv(ch) + track(ch)
    x += SIDE
    items.append(("dial", None, x + R_OUT))
    x += OD + SIDE + OD * TRACK
    for ch in "ty":
        items.append(("glyph", ch, x)); x += adv(ch) + track(ch)
    return x, items

WIDTH, ITEMS = layout()
TOP    = -XH * 1.46          # cap height of N, with a little air
BOTTOM = -DESC * 0.60        # the descender of the y

def wordmark(ink, hand_col, ground=None, label="Ni90ty"):
    y0, h = TOP, BOTTOM - TOP
    body = []
    if ground:
        body.append('<rect x="0" y="%.2f" width="%.2f" height="%.2f" fill="%s"/>' % (y0, WIDTH, h, ground))
    for kind, ch, x in ITEMS:
        if kind == "glyph":
            body.append('<path d="%s" fill="%s"/>' % (glyph_path(ch, x), ink))
        else:
            body += dial(x, -XH/2.0, ink, hand_col)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 %.2f %.2f %.2f" '
            'role="img" aria-label="%s">\n  %s\n</svg>\n'
            % (y0, WIDTH, h, label, "\n  ".join(body)))

def stacked(ink, hand_col):
    """Dial above, name below at two fifths the dial's height (CI section 03)."""
    name_h = OD * 0.40
    scale  = name_h / XH
    gap    = OD * 0.34
    text, x = [], 0.0
    for ch in "Ni90ty":
        text.append((ch, x)); x += adv(ch) + track(ch)
    tw = x * scale
    W  = max(OD, tw)
    cx = W / 2.0
    body = dial(cx, R_OUT, ink, hand_col)
    baseline = OD + gap + name_h
    for ch, gx in text:
        body.append('<path d="%s" fill="%s"/>' % (glyph_path(ch, (W-tw)/2.0 + gx*scale, baseline, scale), ink))
    H = baseline + (-DESC * 0.60) * scale
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %.2f %.2f" role="img" '
            'aria-label="Ni90ty">\n  %s\n</svg>\n' % (W, H, "\n  ".join(body)))

def dial_only(ring_col, hand_col, hands=True, thicken=1.0):
    pad = STROKE * 0.0
    S = OD
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %.2f %.2f" role="img" '
            'aria-label="Ni90ty">\n  %s\n</svg>\n'
            % (S, S, "\n  ".join(dial(S/2, S/2, ring_col, hand_col, hands=hands, thicken=thicken))))

def tile(ring_col, hand_col, ground, hands=True, T=1024.0, pct=0.65, radius=0.2237, thicken=1.0):
    scale = (T * pct) / OD
    body  = ['<rect width="%g" height="%g" rx="%.1f" fill="%s"/>' % (T, T, T*radius, ground)]
    body += dial(T/2, T/2, ring_col, hand_col, scale=scale, hands=hands, thicken=thicken)
    return ('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 %g %g" role="img" '
            'aria-label="Ni90ty">\n  %s\n</svg>\n' % (T, T, "\n  ".join(body)))

OUT = "/home/user/chimera_dashboard/website/assets/img/"
files = {
    # CI section 03 -- five versions, and no others
    "logo-primary.svg":       wordmark(INK,   CYAN),
    "logo-reversed.svg":      wordmark(PAPER, CYAN_LT),
    "logo-one-ink.svg":       wordmark(INK,   INK),
    "logo-stacked.svg":       stacked(INK,    CYAN),
    "dial.svg":               dial_only(INK,  CYAN),
    "dial-reversed.svg":      dial_only(PAPER, CYAN_LT),
    # below 16 px the hands are dropped and the ring alone is used (CI section 04)
    "dial-ring-only.svg":     dial_only(INK,  INK, hands=False),
    # CI section 08 -- two tiles only
    "icon-buyer.svg":         tile(PAPER, CYAN_LT, INK),
    "icon-terminal.svg":      tile(PAPER, PAPER,   CYAN),
    "icon-maskable.svg":      tile(PAPER, CYAN_LT, INK, pct=0.46, radius=0.0),
    # 32 px and below: hands dropped, ring thickened
    "icon-buyer-small.svg":   tile(PAPER, PAPER, INK, hands=False, thicken=1.6),
    "dial-ring-thick.svg":    dial_only(INK, INK, hands=False, thicken=1.6),
}
for name, svg in files.items():
    open(OUT + name, "w").write(svg); print("%-24s %6d B" % (name, len(svg)))
print("\nx-height %d  stroke %.1f  OD %.1f  hand %.1f  wordmark %.0f x %.0f (aspect %.3f)"
      % (XH, STROKE, OD, HAND_W, WIDTH, BOTTOM-TOP, WIDTH/(BOTTOM-TOP)))
