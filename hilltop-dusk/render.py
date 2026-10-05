#!/usr/bin/env python3
"""Hilltop at Dusk: a silent rubber-hose compilation of public-domain characters.

Every frame is drawn procedurally with pycairo (no source footage, no studio
artwork), numpy adds the film look and ffmpeg encodes.

    python3 render.py                 # compilation -> out/hilltop-dusk.mp4 (+ B&W cut)
    python3 render.py --clips         # also the six seamless 9.5 s loop clips
    python3 render.py --stills        # key-pose stills + contact sheet only

Shot list, timings and frame-by-frame beats live in SHOTLIST.md.
"""
import argparse
import math
import os
import subprocess

import cairo
import numpy as np

W, H = 960, 720            # 4:3, the silent-era frame
FPS = 24                   # output rate; characters, smoke and grass move on twos
P = 9.5                    # seconds per clip, and the loop period of every cycle
NF = int(round(P * FPS))   # 228 frames per clip
XFADE = 12                 # half-second dissolve between clips
STEP = 2 / FPS             # animation is held on twos (12 drawings a second)
TAU = math.tau

INK = (0.06, 0.05, 0.05)
PAPER = (0.94, 0.91, 0.83)
SMOKE = (0.90, 0.88, 0.84)
EMBER = (1.0, 0.52, 0.16)
WARM = (1.0, 0.78, 0.40)


# ----------------------------------------------------------------- helpers ---

def clamp(x, a=0.0, b=1.0):
    return a if x < a else b if x > b else x


def ease(x):
    x = clamp(x)
    return x * x * (3 - 2 * x)


def lerp(a, b, u):
    return a + (b - a) * u


def add(p, q):
    return (p[0] + q[0], p[1] + q[1])


def scl(p, k):
    return (p[0] * k, p[1] * k)


def rot(p, ang, c=(0.0, 0.0)):
    s, co = math.sin(ang), math.cos(ang)
    x, y = p[0] - c[0], p[1] - c[1]
    return (c[0] + x * co - y * s, c[1] + x * s + y * co)


def cubic(p0, p1, p2, p3, u):
    v = 1 - u
    return (v**3 * p0[0] + 3 * v * v * u * p1[0] + 3 * v * u * u * p2[0] + u**3 * p3[0],
            v**3 * p0[1] + 3 * v * v * u * p1[1] + 3 * v * u * u * p2[1] + u**3 * p3[1])


def hrand(a, b=0.0):
    """Deterministic hash in [0, 1) so every loop repeats exactly."""
    v = math.sin(a * 12.9898 + b * 78.233) * 43758.5453
    return v - math.floor(v)


def kf(t, keys):
    """Eased keyframe track; keys start at 0 and end at P with equal values."""
    for (t0, v0), (t1, v1) in zip(keys, keys[1:]):
        if t <= t1:
            return v1 if t1 <= t0 else v0 + (v1 - v0) * ease((t - t0) / (t1 - t0))
    return keys[-1][1]


def wind(t, x=0.0):
    """Gentle gusts, periodic in P so grass and ears loop cleanly."""
    return (0.6 * math.sin(TAU * 2 * t / P - x * 0.011)
            + 0.4 * math.sin(TAU * 5 * t / P - x * 0.023 + 1.3))


def ridge(x):
    """Top edge of the foreground rise the characters stand on."""
    return 588 + 0.00026 * (x - 290) ** 2


def ell(ctx, cx, cy, rx, ry, a=0.0):
    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(a)
    ctx.scale(rx, ry)
    ctx.new_sub_path()
    ctx.arc(0, 0, 1, 0, TAU)
    ctx.restore()


def paint(ctx, col, lw=2.6):
    ctx.set_source_rgb(*col)
    if lw:
        ctx.fill_preserve()
        ctx.set_source_rgb(*INK)
        ctx.set_line_width(lw)
        ctx.stroke()
    else:
        ctx.fill()


def union(ctx, col, lw=2.6):
    """Fill every sub-path as one shape with a single outer ink line."""
    ctx.set_source_rgb(*INK)
    ctx.set_line_width(lw * 2)
    ctx.stroke_preserve()
    ctx.set_source_rgb(*col)
    ctx.fill()


def line(ctx, pts, lw, col=INK):
    ctx.move_to(*pts[0])
    for p in pts[1:]:
        ctx.line_to(*p)
    ctx.set_source_rgb(*col)
    ctx.set_line_width(lw)
    ctx.stroke()


def curve(ctx, a, c1, c2, b, lw, col=INK):
    ctx.move_to(*a)
    ctx.curve_to(*c1, *c2, *b)
    ctx.set_source_rgb(*col)
    ctx.set_line_width(lw)
    ctx.stroke()


def hose_path(ctx, a, b, bend):
    """Rubber-hose limb: a smooth arc from a to b bowed sideways by `bend`."""
    dx, dy = b[0] - a[0], b[1] - a[1]
    ln = math.hypot(dx, dy) or 1.0
    nx, ny = -dy / ln, dx / ln
    ex = (a[0] + b[0]) / 2 + nx * bend * ln
    ey = (a[1] + b[1]) / 2 + ny * bend * ln
    qx, qy = 2 * ex - (a[0] + b[0]) / 2, 2 * ey - (a[1] + b[1]) / 2
    ctx.move_to(*a)
    ctx.curve_to(a[0] + (qx - a[0]) * 2 / 3, a[1] + (qy - a[1]) * 2 / 3,
                 b[0] + (qx - b[0]) * 2 / 3, b[1] + (qy - b[1]) * 2 / 3, *b)
    return (ex, ey)


def hose(ctx, a, b, bend, w, col=INK, outline=0.0):
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    elbow = hose_path(ctx, a, b, bend)
    if outline:
        ctx.set_source_rgb(*INK)
        ctx.set_line_width(w + 2 * outline)
        ctx.stroke_preserve()
    ctx.set_source_rgb(*col)
    ctx.set_line_width(w)
    ctx.stroke()
    return elbow


def mitt(ctx, c, ang, r, col=INK):
    """A bare cartoon hand: palm blob plus thumb, pinching whatever it holds."""
    ctx.save()
    ctx.translate(*c)
    ctx.rotate(ang)
    ell(ctx, 0, 0, r * 1.1, r * 0.95)
    ell(ctx, -r * 0.15, -r * 0.85, r * 0.45, r * 0.38, 0.4)
    union(ctx, col, 1.3 if col == INK else 1.6)
    ctx.restore()


def lidded_eye(ctx, cx, cy, rx, ry, squint, dx, pupil=(0.5, 0.6), white=True):
    """White eye with a black pupil; `squint` drops a black lid from the top."""
    if squint > 0.9:
        curve(ctx, (cx - rx, cy + ry * 0.2), (cx - rx * 0.4, cy + ry * 0.6),
              (cx + rx * 0.4, cy + ry * 0.6), (cx + rx, cy + ry * 0.2), 2.4)
        return
    ell(ctx, cx, cy, rx, ry)
    if white:
        paint(ctx, PAPER, 1.8)
    else:
        ctx.new_path()
    ctx.save()
    ell(ctx, cx, cy, rx, ry)
    ctx.clip()
    ell(ctx, cx + dx, cy + ry * 0.18, rx * pupil[0], ry * pupil[1])
    paint(ctx, INK, 0)
    if squint > 0:
        ctx.rectangle(cx - rx - 2, cy - ry - 2, 2 * rx + 4, (2 * ry + 2) * squint * 0.95)
        paint(ctx, INK, 0)
    ctx.restore()


def pie_eye(ctx, cx, cy, rx, ry, squint):
    """The 1928 Mickey eye: a tall black oval with a pie-wedge highlight."""
    if squint > 0.85:
        curve(ctx, (cx - rx, cy + ry * 0.35), (cx - rx * 0.3, cy + ry * 0.7),
              (cx + rx * 0.3, cy + ry * 0.7), (cx + rx, cy + ry * 0.35), 2.4)
        return
    h = ry * (1 - 0.8 * squint)
    cy += (ry - h) * 0.6
    ell(ctx, cx, cy, rx, h)
    paint(ctx, INK, 0)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(rx, h)
    ctx.move_to(0.12, -0.05)
    ctx.arc(0, 0, 0.98, -1.35, -0.55)
    ctx.close_path()
    ctx.restore()
    paint(ctx, PAPER, 0)


def fuzzball(ctx, x, y, r):
    for i in range(9):
        a = TAU * i / 9
        ell(ctx, x + math.cos(a) * r * 0.75, y + math.sin(a) * r * 0.75, r * 0.42, r * 0.42)
    ell(ctx, x, y, r * 0.85, r * 0.85)
    paint(ctx, INK, 0)


# ---------------------------------------------------------------- the beat ---

class Pose:
    pass


def pose_at(t):
    """One shared 9.5 s performance: idle, raise, drag, exhale, settle, idle."""
    t %= P
    p = Pose()
    p.t = t
    p.raise_ = kf(t, [(0, 0), (1.2, 0), (2.3, 1), (3.9, 1), (4.9, 0), (P, 0)])
    stretch = kf(t, [(0, 0), (2.2, 0), (3.7, 0.07), (4.35, 0.075), (4.95, -0.085),
                     (5.5, 0.03), (6.0, -0.012), (6.6, 0), (P, 0)])
    calm = kf(t, [(0, 1), (1.8, 1), (2.3, 0), (6.3, 0), (7.2, 1), (P, 1)])
    p.sy = 1 + stretch + 0.014 * math.sin(TAU * 3 * t / P) * calm
    p.sx = 1 - 0.75 * (p.sy - 1)
    p.lean = 0.012 * math.sin(TAU * t / P)
    p.tilt = kf(t, [(0, 0), (2.3, 0), (3.6, -0.07), (4.4, -0.05), (5.0, -0.13),
                    (6.2, -0.09), (7.0, 0.02), (8.4, 0.01), (P, 0)])
    p.look = kf(t, [(0, 0.5), (1.0, 0.5), (2.0, 0.25), (4.6, 0.4), (6.8, 0.6),
                    (7.6, 1.0), (8.6, 1.0), (P, 0.5)])
    squint = kf(t, [(0, 0), (2.4, 0), (3.0, 0.62), (4.0, 0.62), (4.6, 0.2), (5.2, 0.4),
                    (6.5, 0.28), (7.1, 0.08), (P, 0)])
    p.squint = max(squint, ease(1 - abs(t - 8.35) / 0.14))   # one slow blink
    p.drag = kf(t, [(0, 0), (2.3, 0), (2.6, 1), (3.8, 1), (4.3, 0), (P, 0)])
    p.exhale = kf(t, [(0, 0), (4.3, 0), (4.5, 1), (6.0, 0.8), (6.5, 0), (P, 0)])
    p.wind = wind(t, 300)
    return p


# --------------------------------------------------------------- the cast ---
# Each toon is drawn in local units: origin between the feet, y up is negative,
# about 300 units tall, facing right (toward the farmhouse) in three-quarter view.

class Toon:
    name = ''
    slug = ''
    scale = 1.2
    neck = (6, -172)
    head = (12, -215)
    shoulder = (10, -160)
    rest_hand = (40, -118)
    rest_ang = -0.95
    mouth_ang = 0.12
    mouth = (52, 14)
    cig_back, cig_front = 12, 16
    holder = 0
    pipe = False
    look_px = 6
    arm_w = 7
    hand_col = INK
    hand_r = 8

    def face(self, p):
        return ((p.look - 0.5) * self.look_px, 0.0)

    def on_head(self, p, rel):
        return rot(add(add(self.head, rel), self.face(p)), p.tilt, self.neck)

    def layout(self, p):
        L = {'mouth': self.on_head(p, self.mouth)}
        if self.pipe:
            grip = self.on_head(p, self.grip)
            p0, p3 = self.rest_hand, grip
            L['hand'] = cubic(p0, add(p0, (14, -30)), add(p3, (16, 34)), p3, p.raise_)
            L['ang'] = lerp(-0.4, -0.2, p.raise_)
            L['tip'] = self.on_head(p, self.bowl)
            return L
        ang = lerp(self.rest_ang, self.mouth_ang + p.tilt, p.raise_)
        d = (math.cos(ang), math.sin(ang))
        target = add(L['mouth'], scl(d, self.cig_back))
        p0 = self.rest_hand
        hand = cubic(p0, add(p0, (18, -30)), add(target, (28, 30)), target, p.raise_)
        L.update(hand=hand, ang=ang, butt=add(hand, scl(d, -self.cig_back)),
                 tip=add(hand, scl(d, self.cig_front)))
        if self.holder:
            L['holder_end'] = add(hand, scl(d, self.holder))
        return L

    def to_world(self, p, feet, pt):
        x, y = rot((pt[0] * self.scale * p.sx, pt[1] * self.scale * p.sy), p.lean)
        return (x + feet[0], y + feet[1])

    def draw(self, ctx, p, feet):
        L = self.layout(p)
        ctx.save()
        ctx.translate(*feet)
        ctx.rotate(p.lean)
        ctx.scale(self.scale * p.sx, self.scale * p.sy)
        ctx.set_line_join(cairo.LINE_JOIN_ROUND)
        ctx.set_line_cap(cairo.LINE_CAP_ROUND)
        self.draw_back(ctx, p)
        self.draw_body(ctx, p)
        ctx.save()
        ctx.translate(*self.neck)
        ctx.rotate(p.tilt)
        ctx.translate(-self.neck[0], -self.neck[1])
        self.draw_head(ctx, p, self.face(p)[0], self.head[0], self.head[1])
        ctx.restore()
        self.draw_arm(ctx, p, L)
        ctx.restore()

    def draw_arm(self, ctx, p, L):
        hand = L['hand']
        hose(ctx, self.shoulder, hand, 0.28, self.arm_w, self.arm_col(), self.arm_outline())
        if self.holder:
            line(ctx, [L['butt'], L['holder_end']], 4.2)
            line(ctx, [L['holder_end'], L['tip']], 5.5)
            line(ctx, [L['holder_end'], L['tip']], 3.6, PAPER)
        else:
            line(ctx, [L['butt'], L['tip']], 6.0)
            line(ctx, [L['butt'], L['tip']], 4.0, PAPER)
        mitt(ctx, hand, L['ang'] + 0.6, self.hand_r, self.hand_col)
        ember(ctx, L['tip'], p.drag)

    def arm_col(self):
        return INK

    def arm_outline(self):
        return 0.0


def ember(ctx, at, drag):
    g = cairo.RadialGradient(at[0], at[1], 0, at[0], at[1], 6 + 12 * drag)
    g.add_color_stop_rgba(0, 1.0, 0.75, 0.35, 0.55 + 0.4 * drag)
    g.add_color_stop_rgba(1, 1.0, 0.45, 0.10, 0.0)
    ctx.set_source(g)
    ctx.arc(at[0], at[1], 6 + 12 * drag, 0, TAU)
    ctx.fill()
    ell(ctx, at[0], at[1], 2.6 + drag, 2.6 + drag)
    paint(ctx, EMBER, 0)


def akimbo(ctx, shoulder, hip, w, col=INK, outline=0.0):
    hose(ctx, shoulder, hip, 0.55, w, col, outline)


class Mickey(Toon):
    """Steamboat Willie, 1928: black body, pie-cut eyes, long snout, bare hands,
    shorts with two buttons, thin tail. No gloves, no modern colour model."""
    name = 'Mickey Mouse (Steamboat Willie, 1928)'
    slug = '01-mickey-1928'

    def draw_back(self, ctx, p):
        w = p.wind
        ctx.move_to(-24, -104)
        ctx.curve_to(-64, -96, -72, -44, -54 + 4 * w, -12)
        ctx.curve_to(-48, -2, -40, -4, -34 + 2 * w, -12)
        ctx.set_source_rgb(*INK)
        ctx.set_line_width(3.2)
        ctx.stroke()
        akimbo(ctx, (-6, -160), (-22, -118), 7)

    def draw_body(self, ctx, p):
        shoe = (0.36, 0.35, 0.34)
        hose(ctx, (-8, -96), (-16, -12), -0.08, 7)
        ell(ctx, -10, -8, 22, 10)
        paint(ctx, shoe)
        hose(ctx, (8, -96), (18, -13), 0.08, 7)
        ell(ctx, 28, -9, 24, 11)
        paint(ctx, shoe)
        ell(ctx, 2, -142, 26, 32)
        paint(ctx, INK, 0)
        ctx.move_to(-30, -128)
        ctx.curve_to(-36, -110, -34, -94, -26, -88)
        ctx.line_to(-4, -88)
        ctx.curve_to(-2, -95, 4, -95, 6, -88)
        ctx.line_to(28, -90)
        ctx.curve_to(36, -100, 34, -118, 30, -128)
        ctx.curve_to(10, -134, -12, -134, -30, -128)
        ctx.close_path()
        paint(ctx, (0.22, 0.21, 0.21))
        ell(ctx, 10, -115, 4, 5.5)
        ell(ctx, 22, -113, 3.6, 5)
        paint(ctx, PAPER, 1.4)

    def draw_head(self, ctx, p, ox, hx, hy):
        ell(ctx, hx - 30 + ox * 0.3, hy - 36, 21, 21)
        ell(ctx, hx + 14 + ox * 0.4, hy - 44, 21, 21)
        ell(ctx, hx, hy, 40, 40)
        paint(ctx, INK, 0)
        ell(ctx, hx + 18 + ox, hy + 10, 27, 24)
        ell(ctx, hx + 42 + ox, hy + 6, 27, 13, -0.08)
        ell(ctx, hx + 12 + ox, hy - 6, 9, 14)
        ell(ctx, hx + 28 + ox, hy - 4, 9, 14)
        union(ctx, PAPER, 1.6)
        ex = (p.look - 0.5) * 2
        pie_eye(ctx, hx + 12 + ox + ex, hy - 9, 6, 11, p.squint)
        pie_eye(ctx, hx + 28 + ox + ex, hy - 7, 6.5, 12, p.squint)
        ell(ctx, hx + 69 + ox, hy - 1, 9, 7)
        paint(ctx, INK, 0)
        mx, my = hx + 52 + ox, hy + 14
        if p.exhale > 0.05:
            ell(ctx, mx, my, 2 + 4 * p.exhale, 2 + 3.5 * p.exhale)
            paint(ctx, INK, 0)
            curve(ctx, (hx + 26 + ox, hy + 15), (hx + 34 + ox, hy + 19),
                  (mx - 8, my + 2), (mx - 4, my), 2.4)
        else:
            sm = 5 * (1 - p.raise_)
            curve(ctx, (hx + 24 + ox, hy + 14), (hx + 32 + ox, hy + 20 + sm),
                  (hx + 48 + ox, hy + 20 + sm), (hx + 58 + ox, hy + 12), 2.4)


class Oswald(Toon):
    """Oswald the Lucky Rabbit, 1927: tall black ears, white face mask, plain
    shorts, cotton tail, bare feet."""
    name = 'Oswald the Lucky Rabbit (1927)'
    slug = '02-oswald-1927'
    head = (12, -210)
    neck = (6, -170)
    mouth = (46, 14)

    def draw_back(self, ctx, p):
        ell(ctx, -30, -108, 8, 8)
        paint(ctx, PAPER, 1.8)
        akimbo(ctx, (-6, -158), (-22, -116), 7)

    def draw_body(self, ctx, p):
        hose(ctx, (-8, -96), (-16, -12), -0.08, 7)
        ell(ctx, -8, -7, 23, 9)
        paint(ctx, INK, 0)
        hose(ctx, (8, -96), (18, -12), 0.08, 7)
        ell(ctx, 30, -8, 25, 9.5)
        paint(ctx, INK, 0)
        ell(ctx, 2, -140, 25, 30)
        paint(ctx, INK, 0)
        ctx.move_to(-28, -126)
        ctx.curve_to(-34, -110, -32, -96, -26, -90)
        ctx.line_to(-4, -90)
        ctx.curve_to(-2, -96, 4, -96, 6, -90)
        ctx.line_to(28, -92)
        ctx.curve_to(34, -102, 32, -118, 28, -126)
        ctx.curve_to(8, -131, -10, -131, -28, -126)
        ctx.close_path()
        paint(ctx, (0.40, 0.39, 0.38))

    def draw_head(self, ctx, p, ox, hx, hy):
        w = p.wind
        for base, a, ln in (((hx - 12, hy - 28), -0.30 + 0.05 * w, 40),
                            ((hx + 8, hy - 32), 0.10 + 0.07 * w, 43)):
            ctx.save()
            ctx.translate(*base)
            ctx.rotate(a)
            ell(ctx, 0, -ln, 10.5, ln + 4)
            ctx.restore()
        ell(ctx, hx, hy, 36, 36)
        paint(ctx, INK, 0)
        ell(ctx, hx + 16 + ox, hy + 10, 26, 22)
        ell(ctx, hx + 36 + ox, hy + 8, 19, 12)
        ell(ctx, hx + 10 + ox, hy - 6, 9, 13)
        ell(ctx, hx + 26 + ox, hy - 4, 9, 13)
        union(ctx, PAPER, 1.6)
        dx = (p.look - 0.5) * 4
        lidded_eye(ctx, hx + 10 + ox, hy - 8, 6.5, 10, p.squint, dx)
        lidded_eye(ctx, hx + 26 + ox, hy - 6, 7, 11, p.squint, dx)
        ell(ctx, hx + 53 + ox, hy + 2, 6, 5)
        paint(ctx, INK, 0)
        mx, my = hx + 46 + ox, hy + 14
        if p.exhale > 0.05:
            ell(ctx, mx, my, 2 + 4 * p.exhale, 2 + 3.5 * p.exhale)
            paint(ctx, INK, 0)
        else:
            sm = 5 * (1 - p.raise_)
            curve(ctx, (hx + 20 + ox, hy + 15), (hx + 28 + ox, hy + 21 + sm),
                  (hx + 42 + ox, hy + 21 + sm), (hx + 52 + ox, hy + 12), 2.4)
            ctx.rectangle(hx + 33 + ox, hy + 16 + sm * 0.5, 6, 6)
            paint(ctx, PAPER, 1.4)


class Felix(Toon):
    """Early Felix the Cat (1920s silent shorts): all-black lean body, pointed
    ears, white muzzle, big white eyes, whiskers, long expressive tail."""
    name = 'Felix the Cat (silent era)'
    slug = '03-felix-silent'
    head = (10, -198)
    neck = (6, -160)
    shoulder = (8, -142)
    rest_hand = (36, -102)
    mouth = (38, 22)
    look_px = 5

    def draw_back(self, ctx, p):
        w = p.wind
        ctx.move_to(-18, -96)
        ctx.curve_to(-64, -96, -84, -146 + 4 * w, -66 + 3 * w, -176)
        ctx.curve_to(-60, -186, -50, -184, -48 + 4 * w, -194)
        ctx.set_source_rgb(*INK)
        ctx.set_line_width(6)
        ctx.stroke()
        hose(ctx, (-2, -140), (-22, -104), 0.3, 7)

    def draw_body(self, ctx, p):
        hose(ctx, (-8, -92), (-16, -12), -0.06, 8)
        ell(ctx, -10, -6, 19, 8)
        paint(ctx, INK, 0)
        hose(ctx, (8, -92), (18, -12), 0.06, 8)
        ell(ctx, 26, -7, 20, 8.5)
        paint(ctx, INK, 0)
        ell(ctx, 2, -116, 24, 30)
        ell(ctx, 4, -146, 17, 18)
        paint(ctx, INK, 0)

    def draw_head(self, ctx, p, ox, hx, hy):
        ctx.move_to(hx - 36, hy - 14)
        ctx.line_to(hx - 40 + p.wind * 2, hy - 66)
        ctx.line_to(hx - 8, hy - 36)
        ctx.close_path()
        ctx.move_to(hx + 2, hy - 38)
        ctx.line_to(hx + 22 + p.wind * 2, hy - 80)
        ctx.line_to(hx + 34, hy - 24)
        ctx.close_path()
        ctx.set_source_rgb(*INK)
        ctx.set_line_width(5)
        ctx.stroke_preserve()
        ctx.fill()
        ell(ctx, hx, hy, 40, 37)
        paint(ctx, INK, 0)
        ell(ctx, hx + 20 + ox, hy + 16, 24, 15)
        ell(ctx, hx + 35 + ox, hy + 10, 14, 11)
        union(ctx, PAPER, 1.4)
        dx = (p.look - 0.5) * 5
        lidded_eye(ctx, hx + 4 + ox, hy - 10, 9, 13, p.squint, dx, white=True)
        lidded_eye(ctx, hx + 24 + ox, hy - 8, 10, 14, p.squint, dx, white=True)
        ell(ctx, hx + 46 + ox, hy + 6, 6, 4.5)
        paint(ctx, INK, 0)
        mx, my = hx + 38 + ox, hy + 22
        if p.exhale > 0.05:
            ell(ctx, mx, my, 2 + 3.5 * p.exhale, 2 + 3 * p.exhale)
            paint(ctx, INK, 0)
        else:
            curve(ctx, (hx + 14 + ox, hy + 22), (hx + 22 + ox, hy + 28 - 4 * p.raise_),
                  (hx + 34 + ox, hy + 28 - 4 * p.raise_), (hx + 44 + ox, hy + 20), 2.2)
        for dy, ex in ((-6, -10), (0, 0), (6, 9)):
            line(ctx, [(hx + 42 + ox, hy + 12 + dy * 0.4), (hx + 68 + ox, hy + 10 + dy + ex * 0.3)], 1.4)


class Popeye(Toon):
    """Popeye as he first appeared in the 1929 comic strip: small sailor cap,
    jutting jaw, one squinting eye, corncob pipe, dark shirt with a white sailor
    collar, light bell-bottoms. No spinach, no anchor tattoos, no 1933 film model."""
    name = 'Popeye (1929 comic strip)'
    slug = '04-popeye-1929'
    pipe = True
    head = (14, -238)
    neck = (8, -196)
    shoulder = (10, -180)
    rest_hand = (30, -124)
    mouth = (24, 15)
    bowl = (50, 6)
    grip = (50, 30)
    hand_col = PAPER
    hand_r = 9.5
    look_px = 4

    def draw_back(self, ctx, p):
        e = hose(ctx, (-8, -180), (-22, -128), 0.55, 6, PAPER, 1.3)
        hose(ctx, e, (-22, -128), 0.0, 13, PAPER, 1.3)
        ell(ctx, -22, -128, 8, 8)
        paint(ctx, PAPER, 1.6)

    def draw_body(self, ctx, p):
        ell(ctx, -12, -7, 24, 10)
        paint(ctx, INK, 0)
        ell(ctx, 32, -8, 26, 11)
        paint(ctx, INK, 0)
        for hip, ank in (((-10, -116), (-16, -22)), ((10, -116), (24, -22))):
            hose(ctx, hip, ank, 0.0, 17, PAPER, 1.4)
            x = ank[0]
            ctx.move_to(x - 9, -34)
            ctx.line_to(x + 9, -34)
            ctx.line_to(x + 14, -14)
            ctx.line_to(x - 14, -14)
            ctx.close_path()
            paint(ctx, PAPER, 2.2)
        ctx.move_to(-18, -188)
        ctx.curve_to(-26, -160, -22, -130, -20, -118)
        ctx.line_to(20, -118)
        ctx.curve_to(24, -140, 24, -170, 22, -188)
        ctx.close_path()
        paint(ctx, INK, 0)
        ctx.rectangle(-20, -124, 41, 8)
        paint(ctx, (0.40, 0.38, 0.36), 1.2)
        ctx.move_to(-24, -194)
        ctx.line_to(-2, -194)
        ctx.line_to(-6, -170)
        ctx.line_to(-28, -168)
        ctx.close_path()
        paint(ctx, PAPER, 1.6)
        ctx.move_to(0, -196)
        ctx.line_to(11, -170)
        ctx.line_to(22, -196)
        ctx.line_to(17, -196)
        ctx.line_to(11, -182)
        ctx.line_to(5, -196)
        ctx.close_path()
        paint(ctx, PAPER, 1.4)
        ctx.rectangle(3, -204, 10, 12)
        paint(ctx, PAPER, 1.6)

    def draw_head(self, ctx, p, ox, hx, hy):
        ell(ctx, hx, hy, 24, 26)
        ell(ctx, hx + 17 + ox, hy + 19, 27, 17, 0.25)
        ell(ctx, hx - 15, hy + 4, 6, 8)
        union(ctx, PAPER, 1.5)
        curve(ctx, (hx - 17, hy + 1), (hx - 13, hy - 1), (hx - 12, hy + 7), (hx - 15, hy + 8), 1.4)
        ell(ctx, hx + 35 + ox, hy - 2, 11, 9)
        paint(ctx, PAPER, 2.4)
        # one eye screwed shut, the other a small bead
        curve(ctx, (hx + 11 + ox, hy - 10), (hx + 15 + ox, hy - 14),
              (hx + 22 + ox, hy - 14), (hx + 26 + ox, hy - 9), 2.6)
        if p.squint < 0.85:
            ell(ctx, hx + 3 + ox, hy - 10, 2.6, 3.8 * (1 - 0.7 * p.squint))
            paint(ctx, INK, 0)
        mx, my = hx + 24 + ox, hy + 15
        if p.exhale > 0.05:
            ell(ctx, mx - 6, my + 1, 2 + 3 * p.exhale, 1.5 + 3 * p.exhale)
            paint(ctx, INK, 0)
        line(ctx, [(hx + 10 + ox, hy + 17), (mx, my)], 2.4)
        # sailor cap
        ell(ctx, hx - 4, hy - 20, 25, 6, -0.12)
        paint(ctx, PAPER, 2.2)
        ell(ctx, hx - 4, hy - 28, 17, 10, -0.15)
        paint(ctx, PAPER, 2.2)
        # corncob pipe in the corner of the mouth
        line(ctx, [(mx, my), (hx + 46 + ox, hy + 20)], 4.0)
        bx, by = hx + 50 + ox, hy + 6
        ctx.rectangle(bx - 6, by, 12, 20)
        paint(ctx, (0.74, 0.62, 0.46), 2.0)
        for k in range(3):
            line(ctx, [(bx - 4, by + 5 + k * 5), (bx + 4, by + 5 + k * 5)], 1.0, (0.45, 0.36, 0.26))
        ell(ctx, bx, by, 6, 2.2)
        paint(ctx, (0.15, 0.10, 0.08), 1.4)
        ember(ctx, (bx, by - 1), p.drag * 0.8)

    def draw_arm(self, ctx, p, L):
        hand = L['hand']
        e = hose(ctx, self.shoulder, hand, 0.30, 6, PAPER, 1.3)
        ctx.save()
        mid = ((e[0] + hand[0]) / 2, (e[1] + hand[1]) / 2)
        a = math.atan2(hand[1] - e[1], hand[0] - e[0])
        ln = math.hypot(hand[0] - e[0], hand[1] - e[1])
        ell(ctx, mid[0], mid[1], ln * 0.55, 8.5, a)
        paint(ctx, PAPER, 1.6)
        ctx.restore()
        ell(ctx, self.shoulder[0] + 1, self.shoulder[1] + 4, 9, 8)
        paint(ctx, INK, 0)
        mitt(ctx, hand, L['ang'], self.hand_r, PAPER)


class Koko(Toon):
    """Koko the Clown from the silent Out of the Inkwell shorts: baggy white
    suit with three black pompoms, ruff, small cone hat, white face."""
    name = 'Koko the Clown (silent era)'
    slug = '05-koko-silent'
    head = (12, -214)
    neck = (6, -182)
    shoulder = (14, -168)
    rest_hand = (44, -124)
    mouth = (34, 14)
    hand_col = PAPER
    arm_w = 13

    def arm_col(self):
        return PAPER

    def arm_outline(self):
        return 1.4

    def draw_back(self, ctx, p):
        akimbo(ctx, (-8, -168), (-26, -124), 13, PAPER, 1.4)
        mitt(ctx, (-26, -124), 2.6, 7.5, PAPER)

    def draw_body(self, ctx, p):
        for x, y, rx in ((-10, -7, 21), (30, -8, 23)):
            ell(ctx, x, y, rx, 8)
            paint(ctx, INK, 0)
            ell(ctx, x + rx * 0.95, y - 6, 4, 4)
            paint(ctx, INK, 0)
        hose(ctx, (-10, -110), (-14, -20), -0.05, 22, PAPER, 1.4)
        hose(ctx, (10, -110), (22, -20), 0.05, 22, PAPER, 1.4)
        ell(ctx, 2, -140, 34, 42)
        paint(ctx, PAPER, 2.4)
        for x, y in ((19, -168), (25, -142), (23, -116)):
            fuzzball(ctx, x, y, 7)
        for i in range(12):
            a = TAU * i / 12
            ell(ctx, 6 + math.cos(a) * 24, -182 + math.sin(a) * 7, 7, 6)
        union(ctx, PAPER, 1.3)

    def draw_head(self, ctx, p, ox, hx, hy):
        ell(ctx, hx - 24, hy - 2, 10, 13)
        ell(ctx, hx - 18, hy - 16, 9, 9)
        paint(ctx, INK, 0)
        ell(ctx, hx, hy, 31, 30)
        ell(ctx, hx - 19, hy + 3, 6, 8)
        ell(ctx, hx + 22 + ox, hy + 10, 14, 12)
        union(ctx, PAPER, 1.5)
        dx = (p.look - 0.5) * 3.5
        lidded_eye(ctx, hx + 8 + ox, hy - 5, 6, 9, p.squint, dx)
        lidded_eye(ctx, hx + 22 + ox, hy - 4, 6.5, 10, p.squint, dx)
        curve(ctx, (hx + 2 + ox, hy - 18), (hx + 5 + ox, hy - 22), (hx + 11 + ox, hy - 22), (hx + 14 + ox, hy - 18), 2.0)
        curve(ctx, (hx + 18 + ox, hy - 19), (hx + 21 + ox, hy - 23), (hx + 27 + ox, hy - 23), (hx + 30 + ox, hy - 18), 2.0)
        ell(ctx, hx + 36 + ox, hy + 3, 6.5, 6)
        paint(ctx, INK, 0)
        mx, my = hx + 34 + ox, hy + 14
        if p.exhale > 0.05:
            ell(ctx, mx, my + 1, 2 + 3.5 * p.exhale, 2 + 3 * p.exhale)
            paint(ctx, INK, 0)
        else:
            sm = 5 * (1 - p.raise_)
            curve(ctx, (hx + 10 + ox, hy + 14), (hx + 16 + ox, hy + 19 + sm),
                  (hx + 30 + ox, hy + 19 + sm), (hx + 38 + ox, hy + 12), 2.2)
        a = -0.18 + 0.04 * p.wind
        ctx.save()
        ctx.translate(hx - 2, hy - 24)
        ctx.rotate(a)
        ctx.move_to(-20, 2)
        ctx.line_to(-2, -42)
        ctx.line_to(18, 0)
        ctx.close_path()
        paint(ctx, PAPER, 2.2)
        fuzzball(ctx, -2, -44, 6)
        ctx.restore()


class Betty(Toon):
    """Betty from Dizzy Dishes (1930): the original singing-dog design with long
    floppy black ears, button dog nose, big lashed eyes, spit curls, short black
    dress, garter, heels. Not the later all-human flapper."""
    name = 'Betty (Dizzy Dishes, 1930)'
    slug = '06-betty-1930'
    head = (10, -208)
    neck = (4, -168)
    shoulder = (10, -156)
    rest_hand = (32, -150)
    rest_ang = -1.3
    mouth_ang = 0.05
    mouth = (34, 24)
    cig_back, cig_front = 8, 60
    holder = 44
    hand_col = PAPER
    hand_r = 6.5
    arm_w = 5.5

    def arm_col(self):
        return PAPER

    def arm_outline(self):
        return 1.2

    def draw_back(self, ctx, p):
        akimbo(ctx, (-4, -156), (-16, -124), 5.5, PAPER, 1.2)

    def draw_body(self, ctx, p):
        w = p.wind
        for x, y, rx in ((-12, -6, 12), (16, -6, 13)):
            ell(ctx, x, y, rx, 5.5)
            paint(ctx, INK, 0)
            line(ctx, [(x - rx + 2, y), (x - rx + 3, y + 6)], 2.4)
        hose(ctx, (-6, -104), (-12, -10), -0.04, 8, PAPER, 1.2)
        hose(ctx, (6, -104), (14, -10), 0.05, 8, PAPER, 1.2)
        ell(ctx, 10.5, -64, 6, 3, 0.1)
        paint(ctx, INK, 0)
        ctx.move_to(-12, -164)
        ctx.curve_to(-18, -146, -16, -136, -12, -130)
        ctx.line_to(-30 + 3 * w, -98)
        for i in range(5):
            x0 = -30 + 3 * w + i * 13
            ctx.curve_to(x0 + 3, -92, x0 + 10, -92, x0 + 13, -98)
        ctx.line_to(14, -130)
        ctx.curve_to(18, -140, 18, -152, 16, -164)
        ctx.curve_to(6, -168, -4, -168, -12, -164)
        ctx.close_path()
        paint(ctx, INK, 0)
        line(ctx, [(2, -166), (4, -176)], 5, INK)
        line(ctx, [(2, -166), (4, -176)], 3, PAPER)

    def draw_head(self, ctx, p, ox, hx, hy):
        w = p.wind
        ell(ctx, hx - 34, hy + 14, 12, 30, 0.35 + 0.05 * w)
        paint(ctx, INK, 0)
        ell(ctx, hx, hy, 36, 34)
        ell(ctx, hx + 30 + ox, hy + 12, 16, 11)
        union(ctx, PAPER, 1.5)
        dx = (p.look - 0.5) * 4
        for ex, ey, rx, ry in ((hx + 6 + ox, hy - 6, 9, 13), (hx + 24 + ox, hy - 4, 10, 14)):
            lidded_eye(ctx, ex, ey, rx, ry, p.squint, dx)
            if p.squint < 0.9:
                for a in (-1.05, -0.55):
                    x1, y1 = ex + math.cos(a) * rx, ey + math.sin(a) * ry * (1 - 0.4 * p.squint)
                    line(ctx, [(x1, y1), (x1 + math.cos(a) * 6, y1 + math.sin(a) * 6)], 1.8)
        ell(ctx, hx + 45 + ox, hy + 5, 7.5, 6)
        paint(ctx, INK, 0)
        mx, my = hx + 34 + ox, hy + 24
        ell(ctx, mx, my, 4.5 + 1.5 * p.exhale, 3 + 2.5 * p.exhale)
        paint(ctx, INK, 0)
        for cx, cy, r in ((hx - 10, hy - 32, 6), (hx + 2, hy - 36, 7), (hx + 14, hy - 33, 6)):
            ell(ctx, cx, cy, r, r)
            paint(ctx, INK, 0)
        ctx.arc(hx + 16 + ox, hy - 24, 4, 0.5, TAU * 0.9)
        ctx.set_source_rgb(*INK)
        ctx.set_line_width(2.2)
        ctx.stroke()
        ctx.save()
        ctx.translate(hx - 20, hy - 22)
        ctx.rotate(0.18 + 0.06 * w)
        ell(ctx, 0, 32, 14, 35)
        paint(ctx, INK, 0)
        ctx.restore()


CAST = [Mickey(), Oswald(), Felix(), Popeye(), Koko(), Betty()]


# ------------------------------------------------------------------ smoke ---

class Smoker:
    """Places a toon on the hill and works out where its smoke goes."""

    def __init__(self, toon):
        self.toon = toon
        self.feet = (300.0, ridge(300) + 3)
        self._lay = {}

    def at(self, e):
        k = int(round(e / STEP)) % int(round(P / STEP))
        if k not in self._lay:
            p = pose_at(k * STEP)
            L = self.toon.layout(p)
            tw = self.toon.to_world
            self._lay[k] = {n: tw(p, self.feet, L[n]) for n in ('mouth', 'tip')}
        return self._lay[k]

    def plume(self, t):
        """Exhaled puffs: born at the mouth 4.35-6.15 s, ride the breeze right
        toward the farmhouse, swell, then shrink away. Age is taken modulo P, so
        the loop is seamless."""
        out = []
        life = 6.0
        k0, k1 = int(round(4.35 / STEP)), int(round(6.15 / STEP))
        for k in range(k0, k1 + 1, 2):
            e = k * STEP
            a = (t - e) % P
            if a >= life:
                continue
            j1, j2, j3 = hrand(k, 1), hrand(k, 2), hrand(k, 3)
            x0, y0 = self.at(e)['mouth']
            v0, wnd, damp = 95 + 25 * j1, 40.0, 1.8
            push = (1 - math.exp(-damp * a)) / damp
            x = x0 + 6 + wnd * a + (v0 - wnd) * push
            y = (y0 + 2 + (-14 + 12 * j2) * push + 5 * a - 0.7 * a * a
                 + 7 * math.sin(1.3 * a + 6 * j3) * min(1.0, a))
            strength = 1.25 - 0.55 * (e - 4.35) / 1.8
            shrink = 1 - ease((a - 0.6 * life) / (0.4 * life))
            r = strength * (0.75 + 0.5 * j3) * (2.5 + 11 * math.sqrt(a)) * shrink
            if r > 0.6:
                out.append((x, y, r))
        return out

    def wisp(self, t, life=2.8):
        """The thin curl rising off the lit end, as an ordered ribbon."""
        pts = []
        n = int(round(life / STEP)) + 1
        kt = int(round(t / STEP))
        for i in range(n):
            e = (kt - i) * STEP
            a = i * STEP
            x0, y0 = self.at(e)['tip']
            px, py = self.at(e - STEP)['tip']
            sway = math.sin(TAU * 0.7 * e + a * 2.6) * (1.5 + 6 * a)
            moving = math.hypot(x0 - px, y0 - py) > 3.0
            pts.append((x0 + 6 * a + 9 * a ** 1.6 + sway, y0 - 30 * a + 2 * a * a, a, moving))
        return pts


def draw_plume(ctx, puffs):
    if not puffs:
        return
    ctx.push_group()
    for x, y, r in puffs:
        ctx.new_sub_path()
        ctx.arc(x, y, r + 2.4, 0, TAU)
    ctx.set_source_rgb(*INK)
    ctx.fill()
    for x, y, r in puffs:
        ctx.new_sub_path()
        ctx.arc(x, y, r, 0, TAU)
    ctx.set_source_rgb(*SMOKE)
    ctx.fill()
    for x, y, r in puffs:
        if r > 6:
            ctx.new_sub_path()
            ctx.arc(x - r * 0.25, y + r * 0.3, r * 0.55, 0.2, 2.6)
    ctx.set_source_rgba(0.70, 0.66, 0.66, 0.6)
    ctx.set_line_width(1.6)
    ctx.stroke()
    ctx.pop_group_to_source()
    ctx.paint_with_alpha(0.86)


def draw_wisp(ctx, pts, life, col=SMOKE, alpha=0.8, w0=1.8, w1=3.0):
    ctx.set_line_cap(cairo.LINE_CAP_ROUND)
    for (x0, y0, a0, m0), (x1, y1, _, m1) in zip(pts, pts[1:]):
        if m0 or m1:
            continue
        u = a0 / life
        ctx.move_to(x0, y0)
        ctx.line_to(x1, y1)
        ctx.set_source_rgba(*col, alpha * (1 - u) ** 1.3)
        ctx.set_line_width(w0 + w1 * u)
        ctx.stroke()


# ------------------------------------------------------------------ the set ---

def grass_blade(ctx, x, y, h, lean, w):
    tx, ty = x + h * math.sin(lean), y - h * math.cos(lean)
    cx, cy = x + h * 0.45 * math.sin(lean * 0.4), y - h * 0.6
    ctx.move_to(x - w / 2, y)
    ctx.curve_to(cx - w * 0.3, cy, tx - 0.5, ty + h * 0.15, tx, ty)
    ctx.curve_to(tx + 0.5, ty + h * 0.15, cx + w * 0.3, cy, x + w / 2, y)
    ctx.close_path()


class Set:
    """The shared dusk template: purple-orange sky, farmhouse with lit windows,
    windmill, the rise with tall grass and rocks."""

    house = (655, 505, 735, 548)
    mill = (805, 448)

    def __init__(self):
        rng = np.random.default_rng(1928)
        self.bg = self._background(rng)
        self.rocks = self._rocks()
        self.blades = []
        for _ in range(150):
            edge = rng.random() < 0.65
            x = (rng.uniform(-10, 230) if rng.random() < 0.5 else rng.uniform(720, 980)) if edge \
                else rng.uniform(200, 760)
            y = H + 8 - rng.random() * 46
            tall = 1.0 if edge else 0.55
            self.blades.append(dict(x=x, y=y, h=rng.uniform(55, 175) * tall,
                                    lean=rng.uniform(-0.05, 0.25), amp=rng.uniform(0.08, 0.2),
                                    w=rng.uniform(4, 9), shade=rng.uniform(0.0, 0.05),
                                    rim=rng.random() < 0.35))
        self.blades.sort(key=lambda b: b['y'])
        self.tufts = []
        for _ in range(110):
            x = rng.uniform(120, 560)
            y = ridge(x) + rng.uniform(-2, 26)
            self.tufts.append(dict(x=x, y=y, h=rng.uniform(14, 44), lean=rng.uniform(-0.1, 0.25),
                                   amp=rng.uniform(0.1, 0.25), w=rng.uniform(2.5, 4.5)))
        self.tufts.sort(key=lambda b: b['y'])

    def _background(self, rng):
        s = cairo.ImageSurface(cairo.FORMAT_RGB24, W, H)
        c = cairo.Context(s)
        g = cairo.LinearGradient(0, 0, 0, 500)
        for stop, col in ((0.0, (0.17, 0.11, 0.27)), (0.35, (0.36, 0.20, 0.38)),
                          (0.62, (0.66, 0.33, 0.40)), (0.84, (0.93, 0.52, 0.30)),
                          (1.0, (0.99, 0.74, 0.42))):
            g.add_color_stop_rgb(stop, *col)
        c.set_source(g)
        c.paint()
        for _ in range(14):
            x, y, r = rng.uniform(0, W), rng.uniform(8, 170), rng.uniform(0.7, 1.6)
            c.arc(x, y, r, 0, TAU)
            c.set_source_rgba(1, 0.95, 0.85, rng.uniform(0.4, 0.9))
            c.fill()
        sx, sy = 575, 476
        glow = cairo.RadialGradient(sx, sy, 0, sx, sy, 260)
        glow.add_color_stop_rgba(0, 1.0, 0.86, 0.55, 0.65)
        glow.add_color_stop_rgba(1, 1.0, 0.6, 0.35, 0.0)
        c.set_source(glow)
        c.paint()
        c.arc(sx, sy, 26, 0, TAU)
        c.set_source_rgb(1.0, 0.89, 0.62)
        c.fill()
        for cx, cy, w, h in ((170, 170, 270, 13), (740, 118, 320, 11), (520, 236, 210, 9),
                             (330, 300, 180, 7), (860, 262, 150, 8)):
            lobes = ((0, 0, 1.0), (-w * 0.18, -h * 0.5, 0.55), (w * 0.2, -h * 0.35, 0.5))
            for shift, col in (((0, 3), (0.98, 0.62, 0.40)), ((-6, 0), (0.44, 0.24, 0.40))):
                for ddx, ddy, f in lobes:
                    ell(c, cx + ddx + shift[0], cy + ddy + shift[1], w / 2 * f, h * f)
                c.set_source_rgb(*col)
                c.fill()

        def hills(base, amp, freq, phase, col):
            c.move_to(0, H)
            for x in range(0, W + 9, 8):
                c.line_to(x, base - amp * (math.sin(x * freq + phase) * 0.6
                                           + math.sin(x * freq * 2.3 + phase * 1.7) * 0.4))
            c.line_to(W, H)
            c.close_path()
            c.set_source_rgb(*col)
            c.fill()
        hills(462, 14, 0.008, 0.5, (0.44, 0.27, 0.42))
        hills(482, 9, 0.012, 2.1, (0.31, 0.19, 0.31))
        g = cairo.LinearGradient(0, 486, 0, 640)
        g.add_color_stop_rgb(0, 0.27, 0.17, 0.26)
        g.add_color_stop_rgb(1, 0.18, 0.12, 0.18)
        c.rectangle(0, 488, W, H)
        c.set_source(g)
        c.fill()
        c.move_to(0, 488)
        for x in range(0, W + 9, 8):
            c.line_to(x, 486 + 2 * math.sin(x * 0.02))
        c.line_to(W, 500)
        c.line_to(0, 500)
        c.close_path()
        c.set_source_rgb(0.27, 0.17, 0.26)
        c.fill()
        for i in range(7):
            y = 500 + i * 9 + i * i * 1.6
            c.move_to(380, y)
            c.line_to(W, y + 4)
            c.set_source_rgba(0.40, 0.25, 0.32, 0.35)
            c.set_line_width(1.2)
            c.stroke()
        # fence and lone tree
        for x in range(590, 790, 18):
            c.rectangle(x, 548, 2.2, 12)
        c.set_source_rgb(0.12, 0.08, 0.12)
        c.fill()
        for y in (551, 556):
            c.move_to(590, y)
            c.line_to(790, y)
        c.set_line_width(1.2)
        c.stroke()
        c.rectangle(624, 504, 5, 46)
        c.fill()
        for dx, dy, r in ((0, 0, 21), (-14, 8, 14), (14, 8, 15), (0, -12, 15)):
            c.arc(626 + dx, 496 + dy, r, 0, TAU)
            c.fill()
        # farmhouse
        x0, y0, x1, y1 = self.house
        c.rectangle(x0, y0, x1 - x0, y1 - y0)
        c.set_source_rgb(0.20, 0.13, 0.19)
        c.fill_preserve()
        c.set_source_rgb(*INK)
        c.set_line_width(1.6)
        c.stroke()
        c.rectangle(712, 462, 10, 30)
        c.set_source_rgb(0.13, 0.09, 0.13)
        c.fill()
        c.move_to(645, 508)
        c.line_to(695, 468)
        c.line_to(746, 508)
        c.close_path()
        c.set_source_rgb(0.13, 0.08, 0.12)
        c.fill_preserve()
        c.set_source_rgb(*INK)
        c.stroke()
        c.move_to(648, 506)
        c.line_to(695, 469)
        c.set_source_rgba(0.95, 0.55, 0.35, 0.45)
        c.set_line_width(1.4)
        c.stroke()
        # windmill tower
        mx, my = self.mill
        c.set_source_rgb(0.12, 0.08, 0.12)
        c.set_line_width(2.2)
        for a, b in (((788, 556), (801, my + 6)), ((822, 556), (809, my + 6))):
            c.move_to(*a)
            c.line_to(*b)
        c.stroke()
        c.set_line_width(1.1)
        for k in range(4):
            ya, yb = 556 - k * 26, 556 - (k + 1) * 26
            wa, wb = 17 - k * 3, 17 - (k + 1) * 3
            c.move_to(mx - wa, ya)
            c.line_to(mx + wb, yb)
            c.move_to(mx + wa, ya)
            c.line_to(mx - wb, yb)
        c.stroke()
        c.move_to(mx, my)
        c.line_to(mx + 46, my - 3)
        c.line_to(mx + 50, my - 16)
        c.line_to(mx + 34, my - 5)
        c.close_path()
        c.fill()
        # the rise
        c.move_to(0, H)
        for x in range(0, W + 5, 4):
            c.line_to(x, ridge(x))
        c.line_to(W, H)
        c.close_path()
        g = cairo.LinearGradient(0, 588, 0, H)
        g.add_color_stop_rgb(0, 0.15, 0.10, 0.12)
        g.add_color_stop_rgb(1, 0.06, 0.04, 0.06)
        c.set_source(g)
        c.fill()
        c.move_to(0, ridge(0))
        for x in range(0, W + 5, 4):
            c.line_to(x, ridge(x))
        c.set_source_rgba(0.85, 0.48, 0.38, 0.55)
        c.set_line_width(2.0)
        c.stroke()
        for x in np.arange(0, W, 5.0):
            hgt = rng.uniform(4, 15)
            grass_blade(c, x, ridge(x) + 2, hgt, rng.uniform(-0.3, 0.4), 2.4)
        c.set_source_rgb(0.11, 0.07, 0.09)
        c.fill()
        return s

    def _rocks(self):
        s = cairo.ImageSurface(cairo.FORMAT_ARGB32, W, H)
        c = cairo.Context(s)
        for pts in ([(0, 720), (6, 660), (40, 628), (104, 618), (160, 640), (196, 690), (204, 720)],
                    [(176, 720), (190, 694), (226, 684), (258, 700), (262, 720)],
                    [(800, 720), (818, 680), (862, 656), (920, 650), (960, 668), (960, 720)]):
            c.move_to(*pts[0])
            for q in pts[1:]:
                c.line_to(*q)
            c.close_path()
            c.set_source_rgb(0.15, 0.11, 0.14)
            c.fill_preserve()
            c.set_source_rgb(*INK)
            c.set_line_width(2.4)
            c.stroke()
            c.move_to(*pts[1])
            for q in pts[2:-1]:
                c.line_to(*q)
            c.set_source_rgba(0.80, 0.46, 0.40, 0.5)
            c.set_line_width(2.0)
            c.stroke()
        for a, b in (((60, 650), (84, 690)), ((84, 690), (74, 716)), ((880, 668), (870, 700))):
            c.move_to(*a)
            c.line_to(*b)
        c.set_source_rgb(*INK)
        c.set_line_width(1.6)
        c.stroke()
        return s

    def chimney(self, t):
        pts = []
        for i in range(0, 40):
            a = i * STEP
            e = t - a
            sway = math.sin(TAU * 2 * e / P + a * 1.5) * (1 + 3 * a)
            pts.append((717 + 4 * a + sway, 460 - 13 * a, a, False))
        return pts

    def render(self, ctx, toon, smoker, t):
        ctx.set_source_surface(self.bg)
        ctx.paint()
        draw_wisp(ctx, self.chimney(t), 40 * STEP, (0.80, 0.72, 0.74), 0.35, 1.5, 6)
        flick = 1 + 0.05 * math.sin(TAU * 7 * t / P) + 0.03 * math.sin(TAU * 11 * t / P + 1)
        for (x0, y0, x1, y1) in ((664, 516, 678, 532), (712, 516, 726, 532), (688, 522, 700, 548)):
            cx, cy = (x0 + x1) / 2, (y0 + y1) / 2
            g = cairo.RadialGradient(cx, cy, 0, cx, cy, 34)
            g.add_color_stop_rgba(0, 1.0, 0.75, 0.38, 0.42 * flick)
            g.add_color_stop_rgba(1, 1.0, 0.6, 0.3, 0.0)
            ctx.set_source(g)
            ctx.arc(cx, cy, 34, 0, TAU)
            ctx.fill()
            ctx.rectangle(x0, y0, x1 - x0, y1 - y0)
            ctx.set_source_rgb(WARM[0], WARM[1] * flick ** 0.3, WARM[2])
            ctx.fill()
            if y1 < 540:
                ctx.move_to(cx, y0)
                ctx.line_to(cx, y1)
                ctx.move_to(x0, cy)
                ctx.line_to(x1, cy)
                ctx.set_source_rgb(0.20, 0.13, 0.19)
                ctx.set_line_width(1.6)
                ctx.stroke()
        ctx.arc(695, 490, 4.5, 0, TAU)
        ctx.set_source_rgb(*WARM)
        ctx.fill()
        # windmill wheel: 12 blades turning five blade-spacings per loop
        mx, my = self.mill
        ang = TAU / 12 * 5 * t / P
        ctx.save()
        ctx.translate(mx, my)
        ctx.scale(0.62, 1.0)
        for i in range(12):
            a = ang + TAU * i / 12
            ctx.move_to(math.cos(a - 0.05) * 9, math.sin(a - 0.05) * 9)
            ctx.line_to(math.cos(a - 0.12) * 31, math.sin(a - 0.12) * 31)
            ctx.line_to(math.cos(a + 0.12) * 31, math.sin(a + 0.12) * 31)
            ctx.line_to(math.cos(a + 0.05) * 9, math.sin(a + 0.05) * 9)
            ctx.close_path()
        ctx.restore()
        ctx.set_source_rgb(0.12, 0.08, 0.12)
        ctx.fill()
        ctx.save()
        ctx.translate(mx, my)
        ctx.scale(0.62, 1.0)
        ctx.arc(0, 0, 30, 0, TAU)
        ctx.restore()
        ctx.set_line_width(1.6)
        ctx.stroke()
        ctx.arc(mx, my, 3.5, 0, TAU)
        ctx.fill()
        # cast shadow back toward camera-left, away from the low sun
        fx, fy = smoker.feet
        g = cairo.RadialGradient(fx - 26, fy + 4, 0, fx - 26, fy + 4, 70)
        g.add_color_stop_rgba(0, 0, 0, 0, 0.45)
        g.add_color_stop_rgba(1, 0, 0, 0, 0)
        ctx.save()
        ctx.translate(fx - 26, fy + 4)
        ctx.scale(1.0, 0.12)
        ctx.translate(-(fx - 26), -(fy + 4))
        ctx.set_source(g)
        ctx.arc(fx - 26, fy + 4, 70, 0, TAU)
        ctx.fill()
        ctx.restore()
        front = [b for b in self.tufts if b['y'] > fy + 3]
        for b in self.tufts:
            if b['y'] <= fy + 3:
                self._tuft(ctx, b, t)
        p = pose_at(t)
        toon.draw(ctx, p, smoker.feet)
        draw_wisp(ctx, smoker.wisp(t), 2.8)
        draw_plume(ctx, smoker.plume(t))
        for b in front:
            self._tuft(ctx, b, t)
        ctx.set_source_surface(self.rocks)
        ctx.paint()
        for b in self.blades:
            lean = b['lean'] + b['amp'] * (0.5 + 0.5 * wind(t, b['x']))
            grass_blade(ctx, b['x'], b['y'], b['h'], lean, b['w'])
            sh = b['shade']
            ctx.set_source_rgb(0.08 + sh, 0.07 + sh, 0.06 + sh * 0.5)
            ctx.fill()
            if b['rim']:
                tx = b['x'] + b['h'] * math.sin(lean)
                ty = b['y'] - b['h'] * math.cos(lean)
                ctx.move_to(b['x'] + b['w'] * 0.3, b['y'] - b['h'] * 0.3)
                ctx.curve_to(b['x'] + b['h'] * 0.45 * math.sin(lean * 0.4) + 1, b['y'] - b['h'] * 0.6,
                             tx, ty + b['h'] * 0.15, tx, ty)
                ctx.set_source_rgba(0.85, 0.50, 0.38, 0.45)
                ctx.set_line_width(1.0)
                ctx.stroke()

    def _tuft(self, ctx, b, t):
        lean = b['lean'] + b['amp'] * (0.5 + 0.5 * wind(t, b['x']))
        grass_blade(ctx, b['x'], b['y'], b['h'], lean, b['w'])
        ctx.set_source_rgb(0.10, 0.07, 0.08)
        ctx.fill()


# ------------------------------------------------------------- film look ---

class Film:
    """Grain, flicker, gate weave, dust, scratches, vignette, soft early colour."""

    def __init__(self):
        yy, xx = np.mgrid[0:H, 0:W].astype(np.float32)
        d = np.sqrt(((xx - W / 2) / (W * 0.62)) ** 2 + ((yy - H / 2) / (H * 0.62)) ** 2)
        self.vig = np.clip(1.08 - 0.55 * d ** 2.4, 0.25, 1.0)[..., None].astype(np.float32)

    @staticmethod
    def weave(g):
        return (0.6 * math.sin(g * 0.83) + 0.7 * (hrand(g, 7) - 0.5),
                0.5 * math.sin(g * 0.61 + 1) + 0.9 * (hrand(g, 9) - 0.5))

    @staticmethod
    def dirt(ctx, g):
        n = int(hrand(g, 3) * 4.5)
        for i in range(n):
            x, y = hrand(g, 10 + i) * W, hrand(g, 20 + i) * H
            r = 0.8 + hrand(g, 30 + i) * 2.6
            dark = hrand(g, 40 + i) < 0.6
            ell(ctx, x, y, r, r * (0.6 + hrand(g, 50 + i)))
            ctx.set_source_rgba(*((0.05, 0.04, 0.03, 0.8) if dark else (1, 0.97, 0.9, 0.7)))
            ctx.fill()
        if hrand(g, 4) < 0.03:
            x, y = hrand(g, 60) * W, hrand(g, 61) * H
            ctx.move_to(x, y)
            ctx.curve_to(x + 14, y - 10, x + 6, y + 18, x + 22, y + 26)
            ctx.set_source_rgba(0.05, 0.04, 0.03, 0.7)
            ctx.set_line_width(1.0)
            ctx.stroke()
        run = g // 20
        if hrand(run, 5) < 0.3:
            x = hrand(run, 6) * W + (g % 20) * (hrand(run, 8) - 0.5) * 1.5
            ctx.move_to(x, 0)
            ctx.line_to(x + 2, H)
            ctx.set_source_rgba(1, 0.96, 0.88, 0.22 + 0.15 * hrand(g, 11))
            ctx.set_line_width(0.9)
            ctx.stroke()

    def finish(self, surf, g, mono=False):
        buf = np.ndarray((H, surf.get_stride() // 4, 4), np.uint8, surf.get_data())
        img = buf[:, :W, 2::-1].astype(np.float32) / 255.0
        img = (img * 4 + np.roll(img, 1, 0) + np.roll(img, -1, 0)
               + np.roll(img, 1, 1) + np.roll(img, -1, 1)) / 8
        lum = img @ np.array([0.299, 0.587, 0.114], np.float32)
        if mono:
            img = np.repeat(lum[..., None], 3, axis=2) * np.array([1.03, 1.0, 0.93], np.float32)
        else:
            img = lum[..., None] * 0.32 + img * 0.68
            img *= np.array([1.02, 0.99, 0.94], np.float32)
        img = np.clip(img, 0, 1)
        img = 0.62 * img + 0.38 * img * img * (3 - 2 * img)
        rng = np.random.default_rng(g + 77)
        flick = 1 + 0.035 * (hrand(g, 1) - 0.5) + 0.02 * math.sin(g * 1.7)
        grain = rng.standard_normal((H, W), dtype=np.float32) * 0.045
        img = img * flick + grain[..., None] * (0.6 + 0.4 * img)
        img *= self.vig
        return (np.clip(img, 0, 1) * 255 + 0.5).astype(np.uint8)


# ------------------------------------------------------------------ output ---

class Renderer:
    def __init__(self):
        self.set = Set()
        self.film = Film()
        self.smokers = [Smoker(t) for t in CAST]
        self.surf = [cairo.ImageSurface(cairo.FORMAT_RGB24, W, H) for _ in range(2)]
        self.out = cairo.ImageSurface(cairo.FORMAT_RGB24, W, H)

    def scene(self, i, f, g, surf):
        """Clip i, local frame f, drawn with the gate weave of global frame g."""
        t = (f // 2) * STEP
        ctx = cairo.Context(surf)
        dx, dy = Film.weave(g)
        ctx.translate(W / 2 + dx, H / 2 + dy)
        ctx.scale(1.012, 1.012)
        ctx.translate(-W / 2, -H / 2)
        self.set.render(ctx, CAST[i], self.smokers[i], t)

    def compose(self, parts, g, mono=False):
        """parts: [(clip, local frame, weight)]; dissolves are plain mixes."""
        ctx = cairo.Context(self.out)
        for n, (i, f, wgt) in enumerate(parts):
            self.scene(i, f, g, self.surf[n])
            ctx.set_source_surface(self.surf[n])
            ctx.paint_with_alpha(wgt) if n else ctx.paint()
        Film.dirt(ctx, g)
        return self.film.finish(self.out, g, mono)


def compilation_parts(g):
    """Six clips, each NF frames, overlapped by XFADE; the tail of clip 6
    dissolves into the head of clip 1 so the whole file loops."""
    span = NF - XFADE
    total = span * len(CAST)
    parts = []
    for i in range(len(CAST)):
        f = (g - i * span) % total
        if f < NF:
            parts.append((i, f))
    parts.sort(key=lambda q: -q[1])          # outgoing clip (older) first
    if len(parts) == 1:
        return [(parts[0][0], parts[0][1], 1.0)]
    (a, fa), (b, fb) = parts
    return [(a, fa, 1.0), (b, fb, (fb + 0.5) / XFADE)]


def encoder(path, extra=()):
    return subprocess.Popen(
        ['ffmpeg', '-y', '-loglevel', 'error', '-f', 'rawvideo', '-pix_fmt', 'rgb24',
         '-s', f'{W}x{H}', '-r', str(FPS), '-i', '-', *extra,
         '-c:v', 'libx264', '-preset', 'slow', '-crf', '26',
         '-pix_fmt', 'yuv420p', '-movflags', '+faststart', path],
        stdin=subprocess.PIPE)


def render_compilation(r, out):
    span = NF - XFADE
    total = span * len(CAST)
    path = os.path.join(out, 'hilltop-dusk.mp4')
    bw = os.path.join(out, 'hilltop-dusk-bw.mp4')
    enc, enc_bw = encoder(path), encoder(bw)
    for g in range(total):
        # start XFADE frames in so the file opens on a clean Mickey and ends on
        # the Betty->Mickey dissolve that hands back to frame 0 when looped
        parts = compilation_parts((g + XFADE) % total)
        enc.stdin.write(r.compose(parts, g).tobytes())
        enc_bw.stdin.write(r.film.finish(r.out, g, mono=True).tobytes())
        if g % 96 == 0:
            print(f'  compilation {g}/{total}', flush=True)
    for e in (enc, enc_bw):
        e.stdin.close()
        e.wait()
    print(f'wrote {path} and {bw} ({total / FPS:.1f} s)')


def render_clips(r, out):
    for i, toon in enumerate(CAST):
        path = os.path.join(out, 'clips', f'{toon.slug}.mp4')
        enc = encoder(path)
        for f in range(NF):
            enc.stdin.write(r.compose([(i, f, 1.0)], f).tobytes())
        enc.stdin.close()
        enc.wait()
        print(f'wrote {path}')


def render_stills(r, out):
    from PIL import Image
    beats = [('idle', 0.6), ('drag', 3.2), ('exhale', 5.4), ('settle', 7.8)]
    tiles = []
    for i, toon in enumerate(CAST):
        row = []
        for label, t in beats:
            f = int(round(t * FPS)) // 2 * 2
            img = Image.fromarray(r.compose([(i, f, 1.0)], f))
            img.save(os.path.join(out, 'stills', f'{toon.slug}-{label}.png'))
            row.append(img.resize((W // 4, H // 4), Image.LANCZOS))
        tiles.append(row)
    sheet = Image.new('RGB', (W, H // 4 * len(CAST)))
    for y, row in enumerate(tiles):
        for x, im in enumerate(row):
            sheet.paste(im, (x * W // 4, y * H // 4))
    sheet.save(os.path.join(out, 'contact-sheet.png'))
    print(f'wrote stills and {out}/contact-sheet.png')


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('--out', default=os.path.join(os.path.dirname(os.path.abspath(__file__)), 'out'))
    ap.add_argument('--clips', action='store_true', help='also write the six loop clips')
    ap.add_argument('--stills', action='store_true', help='only write key-pose stills')
    a = ap.parse_args()
    for d in ('', 'clips', 'stills'):
        os.makedirs(os.path.join(a.out, d), exist_ok=True)
    r = Renderer()
    render_stills(r, a.out)
    if a.stills:
        return
    render_compilation(r, a.out)
    if a.clips:
        render_clips(r, a.out)


if __name__ == '__main__':
    main()
