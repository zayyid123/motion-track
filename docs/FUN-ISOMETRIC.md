# fun-isometric house style

Motion-Track draws in the **fun-isometric** style: flat slabs with a thick ink
outline, leaned isometric faces, and motion played from a library of After
Effects–grade keyframe presets. This document records how that style is applied
to the in-app AI assistant so generated stickers look like the rest of the set.

> Style and presets adapted from the **fun-isometric** agent skill by
> [Kelvin Adithya](https://x.com/KelvinAdithya) —
> [github.com/kelvinkn17/skills](https://github.com/kelvinkn17/skills) ·
> [skills.klvn.dev/fun-isometric](https://skills.klvn.dev/fun-isometric) —
> heavily inspired by the stickers in [Slush](https://slush.app). MIT licensed.

## Where it lives

- `src/lib/ai/prompt.ts` — the system prompt carries the **HOUSE STYLE** and
  **MOTION (pick by VERB)** sections, so every generation follows the rules
  below. The few-shot example is exported as `FEW_SHOT_EXAMPLE` and covered by a
  test so it can never drift.
- `src/lib/funIsometric/presets.ts` — the single source of truth for motion
  presets, shared by the inspector UI, project validation, and the AI prompt.
- `src/lib/funIsometric/motions.ts` — the keyframe data the presets replay.

## Drawing rules (baked into the prompt)

- **Composition.** Subject fills about 50–60% of the 500 stage, centred, with
  room for the swing. Never crowd or touch the edge.
- **Outline.** Thick ink outline (`outline: 5`) on every body; `4` only for
  small, busy art. Accents may be thinner (2–3) or opt out with `"line": false`.
- **Colour.** Fills are palette **roles**, never hex. Budget two accent roles
  plus white: `main` bodies, `tint` pale fills, `deep` dark side / second
  colour, `gold` coins/stars/bells, `hot` hearts/alerts/flames, `ok` success,
  `white` highlights and sparkles, `ink` linework. No gradients, shadows or glow.
- **Faces lean.** A flat face takes the view tilt, so rectangles foreshorten
  into parallelograms and circles into ellipses. Never a face that is only
  rotated; an upright object (bulb, trophy, bottle) is one silhouette on one
  leaned plane.
- **Slabs.** Every body is a slab — `depth` 1 for a body, 0.2–0.8 for thin
  parts, extruded along the view's fixed direction so every side falls the same
  way.
- **Parts.** A hero object is 3–6 parts, each with its own thickness and role
  (raised label, plate behind a keyhole, collar, base, side buttons), never one
  flat shape with detail painted on. Every joint overlaps — an earcup sits over
  the end of its band, a lid over the rim — so the object reads as one body.
  Detail is sparse and in ink.
- **Sparkles.** Small `spark` shapes in `white` with the outline, 14–30, placed
  off the subject and timed to the action's beat.

## Engine support for the style

The AI's action vocabulary was extended so these rules are drawable, not just
advisory:

- **`path` pieces self-normalise.** A path is measured by its own geometry,
  fitted to `width`×`height` (preserving aspect), and its bounds centred on
  `dx`/`dy`. The model can write coordinates in any space and a wrong or missing
  `viewBox` can no longer blow a piece up or fling it off-canvas. `viewBox` is
  only a fallback when the path cannot be parsed.
- **`dx`/`dy` is a centre** for every piece (`dx2`/`dy2` is the top-left corner),
  matching primitives. Parts of one object are composed around the layer origin.
- **`arch`** draws a half-ellipse band (headbands, handles, smiles, lanyards)
  with `thickness`; it opens upward with its feet on the bottom edge of its box.
- **Auto-fit and auto-centre.** Generative batches (those that start with
  `clear_layers`) are shrunk about their own centre to fit a 380 px box, then
  shifted so the composition bounds centre on the 250,250 stage.
- **Reference images.** Vision requests follow the same pipeline: one dominant
  silhouette first, 2–4 overlapping parts, then small ink details, all inside a
  single group.

## Motion by verb

Pick the preset from what the object **does**, not what it is. The inspector and
the AI read the same list from `MOTION_PRESETS`.

| Verb (the object…) | Preset | Typical subjects |
| --- | --- | --- |
| throws / spills | `toss` | wallet, folder, bag |
| rises and slams | `hop` | badge, heart, reward, pin |
| springs to a spot | `bounce` | coin, token, chip |
| rocks and taps | `wiggle` | bell, thumb, hand |
| is kicked and holds | `jolt` | card, calendar, mailbox |
| is pushed in | `press` | button, key, shutter |
| slams shut | `impact`, `latch` | lid, stamp, cap |
| latches | `clasp` + `shackle` | lock, clip, toggle |
| never sits still | `wobble` | face, character, headphones |
| glances | `look` | any face with pupils |
| floats lazily | `drift` | plane, balloon |
| turns out and back | `twist` | key, magnifier, wand |
| idles | `sway`, `float`, `bob` | background props |
| pops on the beat | `sparkle`, `twinkle`, `glint` | accents, highlights |

House rules that go with the table:

- **One action per sticker**, carried once by the **group**. Children stay
  static and ride the group; never stack different positional presets across
  layers (that is what scatters a sticker).
- The action runs in the **first half** of the loop; the hold after it is the
  feel. Do not fill the hold with idle wobble.
- Accents (1–2 layers) may keep a `sparkle` / `twinkle` / `glint` beat inside
  the group. Pop with the preset's **scale**, never with `opacity`.

## Presets added from the skill

`toss`, `press`, `jolt`, `impact`, and `latch` were already implemented in
`motions.ts`; they are now exposed as first-class presets so the AI's motion
vocabulary matches the skill's table.

## Not applied

The skill's build tooling (`bin/fi.mjs` checks, PNG sheets, video export) and
its `brand()` / `mono()` / `hue()` colour helpers are not part of this studio,
which uses its own six named palettes and role-based fills.
