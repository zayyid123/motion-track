# Project format (v2)

Motion-Track saves and loads a versioned JSON envelope. The raw icon is never
written at the root anymore; wrapping it is what makes future migrations
possible.

- Serializer/parser: `src/lib/projectFile.ts`
- Current version: `2`
- Draft storage key: `motion_track_project_v2`
- File extension used by the toolbar: `.motion.json`

## Envelope

```json
{
  "version": 2,
  "icon": { "name": "padlock", "frames": 130, "layers": [] },
  "paletteId": "slush",
  "palette": {
    "main": "#ff6b35",
    "gold": "#ffb703",
    "tint": "#dbeafe",
    "ok": "#10b981",
    "hot": "#2563eb",
    "deep": "#1e3a8a",
    "white": "#ffffff",
    "grey": "#cbd5e1",
    "paper": "#f8fafc",
    "ink": "#111827"
  },
  "facing": "right",
  "outlineWidth": 5,
  "savedAt": "2026-10-28T10:00:00.000Z"
}
```

| Field | Type | Required | Notes |
| --- | --- | --- | --- |
| `version` | literal `2` | yes | Any other value is treated as a legacy file. |
| `icon` | object | yes | Scene root. See below. |
| `paletteId` | string | yes | Built-in id (`slush`, `riso`, …) or `custom`. |
| `palette` | object | yes | All ten color roles must be present when parsing v2. |
| `facing` | `right \| left \| front \| flat` | yes | Editor view direction. |
| `outlineWidth` | number 0–40 | yes | Global ink stroke. |
| `savedAt` | ISO string | no | Informational only; ignored when loading. |

## Icon

```ts
interface Icon {
  name: string;
  frames: number;          // positive integer, source frames at 60 FPS
  size?: number;           // design size, default 500
  line?: number;           // legacy outline width
  ink?: string;            // outline color override
  extrude?: unknown;       // keyframed global extrusion
  still?: number;          // still pose frame
  layers: Layer[];
}
```

`name` and `frames` are required. `frames` must be a positive integer, so a
clip can never produce a zero-length export. Everything else is optional and
falls back to engine defaults.

## Layer

Layers are loose objects (`.looseObject` in zod) so that unknown fields added by
a newer build survive a round trip instead of being stripped.

```ts
interface Layer {
  id?: string;
  name?: string;
  isGroup?: boolean;
  hidden?: boolean;
  locked?: boolean;
  groupId?: string;
  isGroupLeader?: boolean;
  motionPreset?: string;
  parent?: string;
  clip?: string;
  a?: [number, number];        // anchor
  p?: unknown;                 // position: static value or keyframe track
  r?: unknown;                 // rotation
  s?: unknown;                 // scale
  o?: unknown;                 // opacity
  tilt?: [number, number];     // isometric tilt
  tiltFromView?: boolean;      // derive tilt from the editor view
  ip?: number;                 // in point (source frames)
  op?: number;                 // out point (source frames)
  m?: unknown;                 // motion track override
  shapes: Shape[];
}
```

Motion values (`p`, `r`, `s`, `o`, `m`, `extrude`, shape `d`/`trim`) are either
a static value or a keyframe track. Tracks are validated as unknown on purpose:
the renderer already handles both shapes, and rejecting one bad keyframe would
discard an otherwise valid project.

## Shape

```ts
interface Shape {
  d: unknown;                              // SVG path or keyframed path
  fill?: string;                           // palette role or hex
  line?: boolean | number;
  depth?: number;                          // slab extrusion
  side?: string;
  edges?: Array<[number, number]>;
  crease?: boolean;
  round?: boolean;
  trim?: unknown;
}
```

## Migration

`parseProject(text)` returns `{ ok: true, doc }` or `{ ok: false, error }`
and never throws.

1. Invalid JSON → `File is not valid JSON.`
2. `version === 2` → strict envelope validation. A bad required field returns a
   readable zod message, for example an outline width outside 0–40.
3. Any other version (or no version) → legacy migration:
   - If the root has an `icon` object, that object is used as the icon;
     otherwise the whole root is treated as a bare `Icon` (the format older
     builds downloaded).
   - `facing` defaults to `right` when absent or invalid.
   - `outlineWidth` falls back to `icon.line`, then `5`.
   - `paletteId` defaults to `slush`.
   - A missing or partial palette is filled from `PALETTES.slush`.

An unrecognized document returns
`Unrecognized project format. Expected a Motion-Track project or icon JSON.`

## Draft autosave

The studio debounces writes by 700 ms and stores the same v2 envelope under
`motion_track_project_v2`. On mount it reads the draft in an effect so server
and client markup match.

- Corrupt or unavailable storage is ignored; the editor starts from the default
  template instead of crashing.
- `clearProjectDraft()` exists for explicit resets but is not wired to a toolbar
  button; downloading JSON does not clear the draft.
- The AI settings live under a different key, `motion_track_ai_settings`, and
  are described in [AI-RELAY.md](AI-RELAY.md).

## Compatibility rules for contributors

- Add new optional fields; do not rename existing ones without a version bump.
- Keep shapes and layers loose so forward-written data survives.
- When a breaking change is unavoidable, bump `PROJECT_VERSION`, keep the old
  parser branch, and add a test in `src/lib/projectFile.test.ts`.
