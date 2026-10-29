# README artwork

The images in this folder are not stock art or screenshots pasted from a design
tool. They are rendered by Motion-Track's own engine, so they always match what
the app actually draws.

| File | What it shows |
| --- | --- |
| `hero.png` | 1280 × 460 banner: wordmark plus six stickers from the library. |
| `sticker-library.gif` | The full 24-sticker set animating as one seamless 24-frame loop. |
| `sticker-sheet.png` | The full 24-sticker set at rest, with names. |
| `editor.png` | The studio: canvas, sticker library, motion presets, palette and timeline. |
| `ai-chat.png` | The AI assistant panel with its greeting and quick prompts. |

## How they were produced

**`hero.png`, `sticker-sheet.png`, `sticker-library.gif`** — the SVGs are built by
running `scene(icon, frame)` from `src/lib/funIsometric/fun.ts` over the icons in
`src/lib/funIsometric/library.ts` and turning each `Part` into an SVG `<path>`
(pose matrix, plus the extrusion offset `sc.ext * depth` for the slab sides).
Each sticker is scaled from `compositionBounds()` so the set reads evenly. The
SVGs are then rasterised with headless Chrome:

```bash
"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" \
  --headless=new --disable-gpu --hide-scrollbars \
  --force-device-scale-factor=1 --window-size=1280,460 \
  --screenshot=hero.png "file://$PWD/hero.svg"
```

The 24 animation frames of the GIF come from the same sheet generator with each
sticker advanced to `round(f * icon.frames / 24)`, which makes the loop seamless.
They are assembled with `ffmpeg` (no dithering keeps the flat colours crisp and
the file small):

```bash
ffmpeg -y -framerate 14 -i frame-%02d.png \
  -vf "fps=14,scale=1024:-1:flags=lanczos,split[s0][s1];\
[s0]palettegen=max_colors=192:stats_mode=diff[p];\
[s1][p]paletteuse=dither=none:diff_mode=rectangle" \
  -loop 0 sticker-library.gif
```

**`editor.png`, `ai-chat.png`** — captured from a production build
(`npm run build && npx next start`) with Chrome DevTools Protocol at a device
pixel ratio of 2, so there is no development overlay in the frame.
