# Motion-Track

Motion-Track is a browser-based studio for building animated isometric slab stickers. It combines a layered canvas editor, a multi-track timeline, role-based palettes, motion presets, an optional AI assistant, and client-side video export (GIF, MP4, and ProRes 4444 MOV with alpha).

The app is a Next.js 16 App Router project. Everything runs locally in the browser; there is no account system or database.

## Features

- **Isometric editor** with four viewing directions (`right`, `left`, `front`, `flat`), precise hit testing, draggable/rotatable/scalable layers, zoom, and keyboard nudging.
- **Multi-track timeline** with per-layer in/out points, trimming, reordering, hide/lock controls, and a seamless loop.
- **Role-based palettes** (`main`, `gold`, `tint`, `ok`, `hot`, `deep`, `white`, `grey`, `paper`, `ink`) with six built-in themes and custom color editing.
- **16 motion presets** shared by the inspector and the AI prompt, with unknown ids safely treated as still.
- **Group containers** that drive the motion of their child layers.
- **Transactional undo/redo** with coalesced slider edits and a 50-entry history.
- **Autosave and versioned project files** (v2) with legacy icon-JSON migration.
- **Export pipeline**:
  - GIF through `gifshot`
  - MP4 through WebCodecs + `mp4-muxer`, with an honest MediaRecorder fallback
  - MOV through lazy-loaded `ffmpeg.wasm` (`prores_ks`, falling back to `qtrle`), preserving alpha
- **Hybrid AI assistant** with direct browser transport by default and an opt-in, hardened server relay.
- **AI auto-apply**: the assistant returns validated actions (layers, colors, motion, view, outline, naming) that are applied to the project as a single undo step.
- **Accessibility basics**: focus-trapped modals, labelled controls, visible focus rings, reduced-motion handling, toasts, and an error boundary.

## Quick start

Requirements: Node.js 22+ and npm.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>. The editor lives at `/dashboard`.

The `predev` and `prebuild` scripts copy the ffmpeg.wasm ESM wrapper into `public/ffmpeg/` so it can run same-origin. That directory is generated and git-ignored.

### Scripts

| Script | Purpose |
| --- | --- |
| `npm run dev` | Start the development server. |
| `npm run build` | Production build. |
| `npm start` | Serve the production build. |
| `npm run lint` | ESLint (Next.js core-web-vitals + TypeScript rules). |
| `npm run typecheck` | `tsc --noEmit`. |
| `npm test` | Vitest unit tests. |
| `npm run test:watch` | Vitest in watch mode. |

## Configuration

### AI relay

Direct mode is the default: the browser calls the OpenAI-compatible provider and the API key never leaves the tab. Relay mode sends the key through `/api/ai-proxy` and is only used after the user grants consent in **AI Settings**.

The relay only talks to HTTPS hosts on an allowlist. Set `AI_PROXY_ALLOWED_HOSTS` to a comma-separated list (wildcards such as `*.example.com` are supported) or to `*` to allow any public HTTPS host:

```bash
# .env.local
AI_PROXY_ALLOWED_HOSTS="api.openai.com,api.groq.com,*.example.com"
```

If the variable is unset, a curated list of public AI providers is used. Private IPs, loopback, link-local, multicast, and `.local`/`.internal` hostnames are always rejected. See [docs/AI-RELAY.md](docs/AI-RELAY.md).

Self-hosted gateways that only expose plain HTTP can be relayed by setting an explicit host entry plus `AI_PROXY_ALLOW_HTTP=1`. Traffic to that host is unencrypted; use it only on a trusted network. `*` never enables HTTP.

## Project structure

```
src/
  app/                 Next.js routes and the AI relay route handler
  components/editor/   Studio shell, canvas, timeline, sidebars, modals
  components/landing/  Marketing page
  components/ui/       Modal, toast provider, error boundary
  hooks/               Playback clock subscriptions
  lib/ai/              AI settings, prompt builder, transport, relay guard
  lib/editor/          History, playback clock, central studio state
  lib/export/          Frame planning and GIF/MP4/MOV encoders
  lib/funIsometric/    Rendering engine, icons, motions, presets
  lib/geometry/        Path bounds and precise hit testing
```

Read [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) for the data flow and design decisions, [docs/PROJECT_FORMAT.md](docs/PROJECT_FORMAT.md) for the v2 file schema, and [docs/EXPORT.md](docs/EXPORT.md) for the format matrix and limitations.

## Export notes

| Format | Encoder | Alpha | Fallback |
| --- | --- | --- | --- |
| GIF | `gifshot` | 1-bit palette transparency; white fallback | — |
| MP4 | WebCodecs H.264 + `mp4-muxer` | No | MediaRecorder (may produce WebM) |
| MOV | `ffmpeg.wasm` `prores_ks` | Yes (ProRes 4444) | `qtrle` (QuickTime Animation) |

The first MOV export downloads the ffmpeg core from unpkg (about 31 MB). MP4 export requires WebCodecs for a true MP4; older browsers fall back to MediaRecorder and may produce WebM.

## Browser support

Target browsers are current Chrome, Edge, Safari, and Firefox. MOV export needs WebAssembly, Workers, and enough memory for the ffmpeg core. MP4 export is best in Chromium-based browsers where WebCodecs H.264 is available.
