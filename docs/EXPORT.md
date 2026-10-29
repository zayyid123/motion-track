# Export pipeline

Export runs entirely in the browser. `src/lib/export/` has no React imports, so
the encoders can be unit tested and reused outside the studio.

## Format matrix

| Format | Encoder | Alpha | Container | Fallback |
| --- | --- | --- | --- | --- |
| GIF | `gifshot` | 1-bit palette transparency | GIF | Opaque white background |
| MP4 | WebCodecs H.264 + `mp4-muxer` | No | MP4 | MediaRecorder, which may emit WebM |
| MOV | `ffmpeg.wasm` `prores_ks` | Yes (ProRes 4444) | QuickTime MOV | `qtrle` (QuickTime Animation) |

The UI is honest about this: the export modal states that transparent output is
only available for MOV, and the result panel shows the real filename, including
a `.webm` extension when the MediaRecorder fallback produced WebM.

## Frame planning

`src/lib/export/frames.ts` maps the 60 FPS source clip to the requested output
frame rate and speed multiplier.

```ts
const count = Math.max(1, Math.round((sourceFrames * fps) / (60 * speed)));
const frame = Math.min(sourceFrames - 1, Math.round((index * sourceFrames) / count));
```

- The complete loop is always exported with seamless loop wrap-around.
- An optional speed multiplier (0.5x, 1x, 1.5x, 2x) scales planned frames and duration so that exported animations play at the chosen tempo.
- The boundary frame is not duplicated, so the loop does not stutter.
- FPS is clamped to 1–60 and the source frame count to at least 1.
- `loopDurationSeconds()` and `formatDuration()` use the 60 FPS source clock scaled by the speed multiplier.

### Minimum duration (6 seconds)

Short designs (for example a 123-frame sticker, about 2.05 s) would otherwise
export as a very short clip. `planLoop()` repeats the whole animation cycle
back-to-back until the clip lasts at least `MIN_EXPORT_SECONDS` (6 s):

```ts
const cycleCount = Math.ceil(6 / cycleSeconds); // at least 1
const frames = planFrames(icon.frames * cycleCount, fps, speed);
```

- The original motion speed and easing are preserved — the cycle is repeated, never
  stretched, so gestures do not slow down.
- `repeatIcon()` (in `repeat.ts`) tiles every keyframe track — motion tracks and
  shape `d`/`trim` tracks alike — by the design's own length, so the seam between
  repetitions is seamless instead of restarting mid-ease. Immutable data only; the
  rendering engine is untouched.
- Constant values (a fixed `p`, a static shape `d`, a fixed `extrude`) are left as is.
- The export modal footer shows the real duration and frame count, including the
  number of cycles.

Every encoder renders through `renderFrameToCanvas()` in `render.ts`, which
paints an offscreen canvas at the requested width and height with the selected
background.

### Speed options
- **Preview playback**: Multipliers (0.25x, 0.5x, 0.75x, 1x, 1.25x, 1.5x, 2x) adjustable via Timeline transport controls and Desktop toolbar.
- **Render export**: Multipliers (0.5x, 1x, 1.5x, 2x) adjustable in the Export modal, with real-time recalculation of duration and frame counts.

### Background options
- **Presets**: White (`#ffffff`), Dark (`#0f172a`), Orange (`#ff6b35`).
- **Custom**: Native color picker, hex code input (e.g. `#6366F1`), and quick palette chips.
- **Transparent**: Exclusively available for MOV (ProRes 4444). MP4 and GIF enforce an opaque or custom solid background because their encoders cannot carry alpha. In the UI, the Transparent button is disabled for MP4 and GIF.

## GIF

- Renders all planned frames to canvases, then hands them to `gifshot` with
  `numWorkers: 2` and `sampleInterval: 10`.
- Requires an opaque or custom background (cannot be transparent).
- Progress: rendering 0–30%, encoding 30–95%.
- Frames are rendered in batches with a yield every four frames so the modal
  stays responsive.

## MP4

`exportMP4()` first asks for an H.264 WebCodecs configuration.

- Codec candidates: `avc1.640033`, `avc1.640032`, `avc1.640028` above 1080p;
  `avc1.640028`, `avc1.4d0028`, `avc1.42001f` at or below 1080p.
- Bitrate: `width * height * fps * 0.12`, clamped to 4–24 Mbps.
- Muxing: `mp4-muxer` with `fastStart: 'in-memory'`.
- Keyframe interval: one per second (`index % fps === 0`).
- H.264 has no alpha channel. MP4 enforces an opaque or custom background.

If no WebCodecs configuration is supported, the MediaRecorder path records a
live canvas stream:

- MIME preference: `video/mp4;codecs=avc1.42E01E`, `video/mp4`, VP9 WebM, WebM.
- The file extension is derived from `recorder.mimeType`, not from the requested
  format. Safari and Firefox frequently produce WebM here.
- The canvas is advanced with `requestFrame()` and paced at `1000 / fps` ms.
- The fallback is a real-time recording, so it is slower and less frame-accurate
  than WebCodecs.

## MOV

MOV preserves alpha and is the only editing-grade output.

1. The first export lazily loads the `ffmpeg.wasm` wrapper and core.
2. Every planned frame is rendered to a canvas, encoded as PNG, and written to
   the ffmpeg virtual filesystem as `frame00001.png` …
3. ffmpeg runs:

   ```text
   -framerate <fps> -i frame%05d.png
   -c:v prores_ks -profile:v 4 -pix_fmt yuva444p10le
   -vendor apl0 -alpha_bits 16 -an -y motion-track.mov
   ```

4. If `prores_ks` exits non-zero, it retries with
   `-c:v qtrle -pix_fmt argb`, which also carries alpha.
5. The output is read back, copied into a plain `ArrayBuffer`, and wrapped in a
   `video/quicktime` blob. Temporary files are deleted in `finally`.

### Wrapper and core loading

- `scripts/sync-ffmpeg.mjs` copies both the ESM wrapper from
  `node_modules/@ffmpeg/ffmpeg/dist/esm` and the ESM core from
  `node_modules/@ffmpeg/core/dist/esm` into `public/ffmpeg/` on `predev` and
  `prebuild`. That directory is generated and git-ignored.
- `mov.ts` imports `/ffmpeg/index.js` with a Turbopack ignore comment. Bundling
  the package breaks on its `new URL('./worker.js', import.meta.url)` bootstrap,
  and a CDN worker would be cross-origin.
- The core files (`ffmpeg-core.js` and `ffmpeg-core.wasm`) are loaded locally
  from `/ffmpeg/` using `toBlobURL()`. Serving them same-origin prevents
  external CDN latency, CORS failures, rate limits, and network blockages.
- The core is roughly 31 MB. The first MOV export loads this once into memory,
  and the modal shows “Loading ProRes encoder (first run only)” while it initializes.
- A loaded instance is cached for the session. A successful export reuses it; a
  cancelled export terminates and resets it so the next attempt starts clean.

### Cost and limits

MOV is the heaviest path: each frame is a full-resolution PNG in memory plus
WebAssembly heap. At 1440p and 60 FPS a long clip can exhaust memory on low-end
machines. Prefer 720p/1080p for MOV unless the target NLE needs more.

## Progress and cancellation

`ExportProgress` has three stages: `rendering`, `encoding`, `ready`. The modal
renders a `role="progressbar"` with the numeric value and a detail string.

`ExportModal` owns one `AbortController` per run:

- Every loop calls `assertNotCancelled(signal)`.
- The signal is passed to `ffmpeg.exec`, so a long encode aborts in the worker.
- Cancelling during MOV terminates the ffmpeg instance.
- Closing the modal while exporting aborts the run.
- A cancelled run produces `ExportCancelledError`, which the modal reports as
  “Export cancelled. No file was created.”

Object URLs are revoked when the result is replaced and when the modal unmounts.

## Practical recommendations

| Target | Setting |
| --- | --- |
| Chat sticker / web | GIF, 500–720 px, 30 FPS |
| Social video | MP4, 1080 px, 30 FPS |
| Editing / compositing | MOV, 1080 px, 30 FPS |
| High-resolution master | MOV, 1440 px, 60 FPS (desktop only) |
