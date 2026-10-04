"""Cut the approved icons out of the UTRGV icon sheet (upper 4x4 grid only; the blue
panels in the lower portion are deliberately ignored) and save them with transparency.
Usage: python3 scripts/extract-icons.py path/to/icon-sheet.jpg"""
import sys
import numpy as np
from PIL import Image
from scipy import ndimage

src = np.array(Image.open(sys.argv[1]).convert('RGB')).astype(np.float32)
bg = np.median(src[:30].reshape(-1, 3), axis=0)
dist = np.sqrt(((src - bg) ** 2).sum(-1))

# cells: 4 columns x 4 rows, all above y=1180 (blue panels start below ~1200)
rows = [(30, 335), (335, 620), (620, 885), (885, 1180)]
names = [
    ['hand', 'hand2', 'palmpot', 'ball'],
    ['crate', 'lantern', 'stool', 'hat'],
    ['star', 'emblem', 'book', 'lasso'],
    ['hatPlain', None, None, None],  # the rest of this row duplicates earlier icons
]
LO, HI = 10.0, 30.0
for r, (y0, y1) in enumerate(rows):
    for c in range(4):
        name = names[r][c]
        if not name:
            continue
        x0, x1 = c * 288, (c + 1) * 288
        cell = src[y0:y1, x0:x1]
        d = dist[y0:y1, x0:x1]
        bgish = d < HI
        # only background-like pixels connected to the cell border are removed
        lab, _ = ndimage.label(bgish)
        border = set(np.unique(np.concatenate([lab[0], lab[-1], lab[:, 0], lab[:, -1]]))) - {0}
        outside = np.isin(lab, list(border))
        alpha = np.ones_like(d)
        ramp = np.clip((d - LO) / (HI - LO), 0, 1)
        alpha[outside] = ramp[outside]
        # enclosed holes (e.g. inside the lasso coil) that are pure background
        hole = (d < 10) & ~outside & (name == 'lasso')
        lab3, n3 = ndimage.label(hole)
        if n3:
            sizes3 = ndimage.sum(hole, lab3, range(1, n3 + 1))
            big = np.isin(lab3, [i + 1 for i, s_ in enumerate(sizes3) if s_ > 300])
            big = ndimage.binary_dilation(big, iterations=2) & (d < HI)
            alpha[big] = ramp[big]
        # keep only the largest opaque component (drops stray specks)
        solid = alpha > 0.5
        lab2, n = ndimage.label(solid)
        if n > 1:
            sizes = ndimage.sum(solid, lab2, range(1, n + 1))
            keep = np.isin(lab2, [i + 1 for i, s in enumerate(sizes) if s > sizes.max() * 0.04])
            near = ndimage.binary_dilation(keep, iterations=3)
            alpha[~near] = 0
        # un-mix the navy background from soft edges (no dark halo)
        a = np.clip(alpha, 1e-3, 1)[..., None]
        rgb = np.clip((cell - (1 - a) * bg) / a, 0, 255)
        out = np.dstack([rgb, alpha * 255]).astype(np.uint8)
        ys, xs = np.where(alpha > 0.02)
        pad = 4
        crop = out[max(0, ys.min() - pad): ys.max() + pad + 1, max(0, xs.min() - pad): xs.max() + pad + 1]
        im = Image.fromarray(crop, 'RGBA')
        im.thumbnail((180, 180), Image.LANCZOS)
        im.save(f'src/assets/icons/{name}.webp', 'WEBP', quality=90, method=6)
        print(name, im.size)
