# Hilltop at Dusk

A silent 54-second rubber-hose compilation. Six early public-domain cartoon
characters each stand alone on a hill at dusk, smoke, and watch a lit farmhouse.
The characters are 1928 Mickey, 1927 Oswald, silent-era Felix, 1929 comic-strip
Popeye, silent-era Koko and 1930 *Dizzy Dishes* Betty.

Everything is drawn procedurally, frame by frame, with pycairo. No footage or
studio artwork is used. numpy adds the film look (grain, flicker, weave, dust,
scratches, vignette) and ffmpeg encodes the result.

| Output | |
|---|---|
| `out/hilltop-dusk.mp4` | the compilation in limited early colour: 54 s, 960×720, 24 fps, seamless loop |
| `out/hilltop-dusk-bw.mp4` | the same cut in black and white |
| `out/clips/*.mp4` | the six 9.5 s clips, each a seamless loop on its own |
| `out/contact-sheet.png` | idle / drag / exhale / settle key poses for every character |

[SHOTLIST.md](SHOTLIST.md) holds the per-clip design and pose notes, the
frame-by-frame beat table, the smoke paths, the camera, and the edit order with
timecodes.

## Rendering

```bash
pip install pycairo numpy pillow      # ffmpeg with libx264 must be on PATH
python3 render.py --stills            # key-pose PNGs + contact sheet (seconds)
python3 render.py                     # compilation, colour + B&W (a few minutes)
python3 render.py --clips             # ...plus the six individual loops
```

Edit the `CAST` list in `render.py` to reorder, drop, or add characters. The
compilation timing adjusts itself.
