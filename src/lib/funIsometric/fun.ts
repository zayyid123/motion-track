// fun-isometric runtime: slab stickers drawn on canvas, keyed exactly like lottie-web plays After Effects keys.

export type Vec = readonly [number, number]
export type Ease = readonly [number, number, number, number]
export type Key<T> = readonly [t: number, v: T, e?: Ease | 0, arc?: readonly [Vec, Vec]]
export type Track<T> = ReadonlyArray<Key<T>>
export type Anim<T> = T | Track<T>

export type Motion = {
  r?: Track<number>
  p?: Track<Vec>
  s?: Track<Vec>
  o?: Track<number>
  x?: Track<number>
  at?: number
  k?: number
  loop?: number
}

export type Palette = { main: string; gold: string; tint: string; ok: string; hot: string; deep: string; white: string; grey: string; paper: string; ink: string }
export const RISO: Palette = { main: '#ff6b35', gold: '#ffb703', tint: '#dbeafe', ok: '#10b981', hot: '#2563eb', deep: '#1e3a8a', white: '#ffffff', grey: '#cbd5e1', paper: '#f8fafc', ink: '#111827' }
export const ACCENTS = ['main', 'gold', 'tint', 'ok', 'hot', 'deep'] as const

export const PALETTES = {
  slush: { ...RISO, main: '#ff6b35', gold: '#ffb703', tint: '#dbeafe', ok: '#10b981', hot: '#2563eb', deep: '#1e3a8a' },
  riso: { ...RISO, main: '#ff58a8', gold: '#ffe14a', tint: '#ffd4e8', ok: '#15b9a6', hot: '#ff7a1a', deep: '#2b50e0' },
  candy: { ...RISO, main: '#b49bff', gold: '#ffd9a8', tint: '#ece5ff', ok: '#7fdcc0', hot: '#ff8fb1', deep: '#6a5cff' },
  matcha: { ...RISO, main: '#6cc46f', gold: '#f2d16b', tint: '#e2f4d6', ok: '#2bb39a', hot: '#ff8a5b', deep: '#1f6b55' },
  sunset: { ...RISO, main: '#ff7a3d', gold: '#ffc94a', tint: '#ffe2d1', ok: '#2ec4b6', hot: '#ff4d6d', deep: '#6b2d91' },
  clay: { ...RISO, main: '#f0845f', gold: '#f4c463', tint: '#fde3d6', ok: '#7fb894', hot: '#e0533d', deep: '#3d5a80' },
} satisfies Record<string, Palette>
export type PaletteName = keyof typeof PALETTES
export type Swatch = keyof Palette | `#${string}`

export const VIEWS = {
  right: { tilt: [-18, 36], extrude: [-4, 18] },
  left: { tilt: [18, 36], extrude: [4, 18] },
  front: { tilt: [0, 30], extrude: [0, 18] },
  flat: { tilt: [-45, 55], extrude: [0, 20] },
} as const satisfies Record<string, { tilt: Vec; extrude: Vec }>
export type View = keyof typeof VIEWS

export type Shape = {
  d: Anim<string>
  fill?: Swatch
  line?: boolean | number
  depth?: number
  side?: Swatch
  edges?: ReadonlyArray<Vec>
  crease?: boolean
  round?: boolean
  trim?: Anim<number>
}

export type Layer = {
  id?: string
  name?: string
  isGroup?: boolean // Empty group container (no direct shapes, holds children)
  hidden?: boolean
  locked?: boolean
  groupId?: string
  isGroupLeader?: boolean
  motionPreset?: string
  parent?: string
  clip?: string
  a?: Vec
  p?: Anim<Vec>
  r?: Anim<number>
  s?: Anim<Vec>
  o?: Anim<number>
  /** Per-layer ink outline width in px; overrides `icon.line` for this layer's shapes. */
  line?: number
  tilt?: Vec
  /** True when `tilt` came from the selected view and should follow facing changes. */
  tiltFromView?: boolean
  ip?: number
  op?: number
  m?: Motion | ReadonlyArray<Motion>
  shapes: ReadonlyArray<Shape>
}

export type Icon = {
  name: string
  frames: number
  size?: number
  line?: number
  ink?: Swatch
  extrude?: Anim<Vec>
  still?: number
  layers: ReadonlyArray<Layer>
}

export const FPS = 60

const curves = new Map<string, (x: number) => number>()

export function bezier(x1: number, y1: number, x2: number, y2: number) {
  const key = `${x1},${y1},${x2},${y2}`
  const hit = curves.get(key)
  if (hit) return hit
  const [ax, bx, cx] = [1 + 3 * x1 - 3 * x2, 3 * x2 - 6 * x1, 3 * x1]
  const [ay, by, cy] = [1 + 3 * y1 - 3 * y2, 3 * y2 - 6 * y1, 3 * y1]
  const sx = (s: number) => ((ax * s + bx) * s + cx) * s
  const sy = (s: number) => ((ay * s + by) * s + cy) * s
  const dx = (s: number) => (3 * ax * s + 2 * bx) * s + cx
  const fn = (x: number) => {
    if (x <= 0) return 0
    if (x >= 1) return 1
    if (x1 === y1 && x2 === y2) return x
    let s = x
    for (let i = 0; i < 8; i++) {
      const [e, d] = [sx(s) - x, dx(s)]
      if (Math.abs(e) < 1e-7) return sy(s)
      if (Math.abs(d) < 1e-6) break
      s -= e / d
    }
    let [lo, hi] = [0, 1]
    s = x
    for (let i = 0; i < 40 && Math.abs(sx(s) - x) > 1e-7; i++) {
      if (sx(s) < x) lo = s
      else hi = s
      s = (lo + hi) / 2
    }
    return sy(s)
  }
  curves.set(key, fn)
  return fn
}

const parsed = new Map<string, [Array<string>, Array<number>]>()
const NUM = /-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/gi

function parse(d: string) {
  let hit = parsed.get(d)
  if (!hit) {
    const nums = (d.match(NUM) ?? []).map(Number)
    hit = [d.split(NUM), nums]
    if (parsed.size > 4000) parsed.clear()
    parsed.set(d, hit)
  }
  return hit
}

function mix<T>(a: T, b: T, y: number): T {
  if (typeof a === 'number') return (a + ((b as number) - a) * y) as T
  if (typeof a === 'string') {
    if (y === 0 || a === b) return a
    const [bits, na] = parse(a)
    const nb = parse(b as string)[1]
    let out = bits[0]
    for (let i = 0; i < na.length; i++) out += +(na[i] + ((nb[i] ?? na[i]) - na[i]) * y).toFixed(3) + bits[i + 1]
    return out as T
  }
  const [va, vb] = [a as Vec, b as Vec]
  return [va[0] + (vb[0] - va[0]) * y, va[1] + (vb[1] - va[1]) * y] as unknown as T
}

const isTrack = <T>(v: Anim<T>): v is Track<T> => Array.isArray(v) && Array.isArray(v[0])

const arcs = new WeakMap<object, { pts: Array<Vec>; lens: Array<number> }>()
function along(key: Key<unknown>, a: Vec, b: Vec, y: number): Vec {
  let hit = arcs.get(key)
  if (!hit) {
    const [to, ti] = key[3] as readonly [Vec, Vec]
    const [c1, c2]: [Vec, Vec] = [[a[0] + to[0], a[1] + to[1]], [b[0] + ti[0], b[1] + ti[1]]]
    const pts: Array<Vec> = []
    const lens = [0]
    for (let i = 0; i <= 150; i++) {
      const s = i / 150
      const u = 1 - s
      const [w0, w1, w2, w3] = [u * u * u, 3 * u * u * s, 3 * u * s * s, s * s * s]
      pts.push([w0 * a[0] + w1 * c1[0] + w2 * c2[0] + w3 * b[0], w0 * a[1] + w1 * c1[1] + w2 * c2[1] + w3 * b[1]])
      if (i) lens.push(lens[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]))
    }
    hit = { pts, lens }
    arcs.set(key, hit)
  }
  const { pts, lens } = hit
  const goal = lens[150] * y
  if (goal <= 0) return pts[0]
  if (goal >= lens[150]) return pts[150]
  let i = 1
  while (lens[i] < goal) i++
  const k = (goal - lens[i - 1]) / (lens[i] - lens[i - 1] || 1)
  return [pts[i - 1][0] + (pts[i][0] - pts[i - 1][0]) * k, pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * k]
}

export function at<T>(v: Anim<T>, f: number): T {
  if (!isTrack(v)) return v
  if (f <= v[0][0]) return v[0][1]
  for (let i = 0; i < v.length - 1; i++) {
    const [t0, a, e, bend] = v[i]
    const [t1, b] = v[i + 1]
    if (f >= t1) continue
    if (e === 0) return a
    const x = (f - t0) / (t1 - t0)
    const y = e ? bezier(e[0], e[1], e[2], e[3])(x) : x
    return bend ? (along(v[i], a as Vec, b as Vec, y) as T) : mix(a, b, y)
  }
  return v[v.length - 1][1]
}

export const shift = <T>(track: Track<T>, by: number): Track<T> => track.map(([t, v, e, bend]) => [t + by, v, e, bend] as const)

type M = [number, number, number, number, number, number]
const mul = (m: M, n: M): M => [
  m[0] * n[0] + m[2] * n[1],
  m[1] * n[0] + m[3] * n[1],
  m[0] * n[2] + m[2] * n[3],
  m[1] * n[2] + m[3] * n[3],
  m[0] * n[4] + m[2] * n[5] + m[4],
  m[1] * n[4] + m[3] * n[5] + m[5],
]

const mod = (a: number, n: number) => ((a % n) + n) % n
const r2 = (v: number) => +v.toFixed(2)
const pt = (p: Vec) => `${r2(p[0])} ${r2(p[1])}`

export type Pose = { m: M; o: number; x: number; k: number }

const lean = ([spin, by]: Vec): M => {
  const [a, k] = [(spin * Math.PI) / 180, Math.cos((by * Math.PI) / 180)]
  return [Math.cos(a), Math.sin(a) * k, -Math.sin(a), Math.cos(a) * k, 0, 0]
}

export const onFace = (tilt: Vec, [x, y]: Vec): Vec => {
  const t = lean(tilt)
  return [r2(t[0] * x + t[2] * y), r2(t[1] * x + t[3] * y)]
}

function poseOf(L: Layer, f: number, frames: number, ignoreScale = false): Pose {
  let [p, r, s, o, x] = [at(L.p ?? [0, 0], f), at(L.r ?? 0, f), at(L.s ?? [100, 100], f), at(L.o ?? 100, f), 0]
  if (ignoreScale) {
    s = [100, 100]
  }

  // Support both single Motion object, array of Motion objects, or preset string
  const rawList = L.m ? (Array.isArray(L.m) ? L.m : [L.m]) : []
  for (const m of rawList as ReadonlyArray<Motion>) {
    if (!m) continue
    const g = mod(f - (m.at ?? 0), m.loop ?? frames)
    const k = m.k ?? 1
    if (m.r) r += at(m.r, g) * k
    if (m.p) {
      const d = at(m.p, g)
      p = [p[0] + d[0] * k, p[1] + d[1] * k]
    }
    if (m.s && !ignoreScale) {
      const [curSX, curSY] = at(m.s, g)
      s = [(s[0] * curSX) / 100, (s[1] * curSY) / 100]
    }
    if (m.o) o *= at(m.o, g) / 100
    if (m.x) x += at(m.x, g) * k
  }
  const [a, rad] = [L.a ?? [0, 0], (r * Math.PI) / 180]
  const [cos, sin, sx, sy] = [Math.cos(rad), Math.sin(rad), s[0] / 100, s[1] / 100]
  let m: M = [cos * sx, sin * sx, -sin * sy, cos * sy, 0, 0]
  const k = L.tilt ? Math.cos((L.tilt[1] * Math.PI) / 180) : 1
  if (L.tilt) m = mul(m, lean(L.tilt))
  m[4] = p[0] - (m[0] * a[0] + m[2] * a[1])
  m[5] = p[1] - (m[1] * a[0] + m[3] * a[1])
  return { m, o, x, k }
}

const paths = new Map<string, Path2D>()
const pathOf = (d: string) => {
  let hit = paths.get(d)
  if (!hit) {
    if (paths.size > 4000) paths.clear()
    hit = new Path2D(d)
    paths.set(d, hit)
  }
  return hit
}

const samples = new Map<string, Array<Vec>>()
function lengthOf(d: string, m: M) {
  let pts = samples.get(d)
  if (!pts) {
    if (typeof document !== 'undefined') {
      const el = document.createElementNS('http://www.w3.org/2000/svg', 'path')
      el.setAttribute('d', d)
      const l = el.getTotalLength()
      pts = Array.from({ length: 65 }, (_, i): Vec => {
        const q = el.getPointAtLength((l * i) / 64)
        return [q.x, q.y]
      })
      if (samples.size > 4000) samples.clear()
      samples.set(d, pts)
    } else {
      pts = []
    }
  }
  let sum = 0
  for (let i = 1; i < pts.length; i++) {
    const [dx, dy] = [pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]]
    sum += Math.hypot(m[0] * dx + m[2] * dy, m[1] * dx + m[3] * dy)
  }
  return sum
}

type Ctx = CanvasRenderingContext2D
export type Part = { L: Layer; pose: Pose; ds: Array<string>; trims: Array<number> }
export type Scene = { f: number; ext: Vec; parts: Array<Part>; world: (L: Layer) => Pose; byId: Map<string, Layer> }

export function scene(icon: Icon, frame: number): Scene {
  const f = mod(frame, icon.frames)
  const byId = new Map(icon.layers.filter((l) => l.id).map((l) => [l.id as string, l]))

  const memo = new Map<Layer, Pose>()
  const world = (L: Layer): Pose => {
    let hit = memo.get(L)
    if (!hit) {
      hit = poseOf(L, f, icon.frames)

      // 1. If layer has a local parent (e.g. shackle anchored to body's tilted plane)
      if (L.parent) {
        const up = byId.get(L.parent)
        if (up && up !== L) {
          const upPose = world(up)
          hit = { ...hit, m: mul(upPose.m, hit.m), k: upPose.k * hit.k }
        }
      } else if (L.groupId) {
        // 2. If layer is assigned to a Group Container, it follows the Group Container's position & motion
        const up = byId.get(L.groupId)
        if (up && up !== L) {
          const upPose = world(up)
          hit = { ...hit, m: mul(upPose.m, hit.m), k: upPose.k * hit.k }
        }
      }

      memo.set(L, hit)
    }
    return hit
  }
  const parts: Array<Part> = []
  for (const L of icon.layers) {
    // If it's an empty group folder container, it has no shapes so it won't render directly, only drives children
    if (L.hidden || (L.ip !== undefined && f < L.ip) || (L.op !== undefined && f >= L.op) || !L.shapes.length) continue
    const p = world(L)
    if (p.o > 0) parts.push({ L, pose: p, ds: L.shapes.map((S) => at(S.d, f)), trims: L.shapes.map((S) => (S.trim === undefined ? 1 : at(S.trim, f))) })
  }
  return { f, ext: at(icon.extrude ?? [-4, 14], f), parts, world, byId }
}

export function render(ctx: Ctx, icon: Icon, sc: Scene, palette: Palette) {
  const base = ctx.getTransform()
  const colour = (c: Swatch) => (c[0] === '#' ? c : palette[c as keyof Palette])
  const [W, ink, { ext, world, byId, f }] = [icon.line ?? 4, colour(icon.ink ?? 'ink'), sc]
  const len = Math.hypot(ext[0], ext[1]) || 1
  const dev = Math.sqrt(Math.abs(base.a * base.d - base.b * base.c)) || 1
  const step = new DOMMatrix()
  ctx.save()
  ctx.miterLimit = 4
  for (const { L, pose, ds, trims } of sc.parts) {
    const { m, o, x, k } = pose
    const [det, dm] = [m[0] * m[3] - m[1] * m[2], new DOMMatrix(m)]
    const grow = Math.sqrt(Math.abs(det) / Math.abs(k || 1))
    // Per-layer outline width overrides the icon default; a shape can still opt
    // out with line:false or set its own explicit width.
    const layerW = typeof L.line === 'number' ? L.line : W
    ctx.globalAlpha = Math.min(1, o / 100)
    const mask = L.clip ? byId.get(L.clip) : undefined
    if (mask) {
      ctx.save()
      const region = new Path2D()
      const mm = new DOMMatrix(world(mask).m)
      for (const s of mask.shapes) region.addPath(pathOf(at(s.d, f)), mm)
      ctx.setTransform(base)
      ctx.clip(region)
    }
    L.shapes.forEach((S, i) => {
      const d = ds[i]
      const path = new Path2D()
      path.addPath(pathOf(d), dm)
      const w = (S.line === false ? 0 : typeof S.line === 'number' ? S.line : layerW) * grow
      ctx.setTransform(base)
      ctx.lineCap = S.round ? 'round' : 'butt'
      ctx.lineJoin = S.round ? 'round' : 'miter'
      const depth = S.depth ?? 0
      if (depth && S.fill) {
        const kk = depth + x / len
        const [vx, vy] = [ext[0] * kk, ext[1] * kk]
        const n = Math.min(64, Math.max(2, Math.ceil((Math.hypot(vx, vy) * dev) / 0.8)))
        const sweep = new Path2D()
        for (let j = n; j >= 0; j--) {
          step.e = (vx * j) / n
          step.f = (vy * j) / n
          sweep.addPath(path, step)
        }
        if (w) {
          ctx.strokeStyle = ink
          ctx.lineWidth = w * 2
          ctx.stroke(sweep)
        }
        ctx.fillStyle = colour(S.side ?? S.fill)
        ctx.fill(sweep)
        const auto = S.crease === false ? undefined : corners.get(d)
        if (w && (S.edges || auto)) {
          const vl = Math.hypot(vx, vy) || 1
          const lines: Array<Vec> = [...(S.edges ?? [])]
          const faces = (nx: number, ny: number) => {
            const [wx, wy] = [(m[3] * nx - m[1] * ny) * Math.sign(det), (m[0] * ny - m[2] * nx) * Math.sign(det)]
            return (wx * vx + wy * vy) / (Math.hypot(wx, wy) * vl) > 0.05
          }
          for (const [cx, cy, ax, ay, bx, by] of auto ?? []) if (faces(ax, ay) && faces(bx, by)) lines.push([cx, cy])
          ctx.strokeStyle = ink
          ctx.lineWidth = w
          ctx.beginPath()
          for (const [ex, ey] of lines) {
            const [px, py] = [m[0] * ex + m[2] * ey + m[4], m[1] * ex + m[3] * ey + m[5]]
            ctx.moveTo(px, py)
            ctx.lineTo(px + vx, py + vy)
          }
          ctx.stroke()
        }
      }
      if (S.fill) {
        if (w) {
          ctx.strokeStyle = ink
          ctx.lineWidth = w * 2
          ctx.stroke(path)
        }
        ctx.fillStyle = colour(S.fill)
        ctx.fill(path)
      } else if (w && trims[i] > 0) {
        ctx.strokeStyle = ink
        ctx.lineWidth = w
        if (trims[i] < 1) {
          const l = lengthOf(d, m)
          ctx.setLineDash([l * trims[i], l])
        }
        ctx.stroke(path)
        ctx.setLineDash([])
      }
    })
    if (mask) ctx.restore()
  }
  ctx.restore()
}

export function draw(ctx: Ctx, icon: Icon, frame: number, palette?: Partial<Palette>) {
  const p = { ...RISO, ...(palette || {}) }
  render(ctx, icon, scene(icon, frame), p)
}

export const rect = (x: number, y: number, w: number, h: number, r = 0) => poly([[x, y], [x + w, y], [x + w, y + h], [x, y + h]], r)
export const pill = (x: number, y: number, w: number, h: number) => rect(x, y, w, h, Math.min(w, h) / 2)

export const ellipse = (cx: number, cy: number, rx: number, ry = rx) =>
  `M${pt([cx - rx, cy])}A${r2(rx)} ${r2(ry)} 0 1 1 ${pt([cx + rx, cy])}A${r2(rx)} ${r2(ry)} 0 1 1 ${pt([cx - rx, cy])}Z`

type Corner = readonly [x: number, y: number, ax: number, ay: number, bx: number, by: number]
const corners = new Map<string, ReadonlyArray<Corner>>()

export function poly(points: ReadonlyArray<Vec>, r: number | ReadonlyArray<number> = 0) {
  const n = points.length
  let d = ''
  let area = 0
  for (let i = 0; i < n; i++) area += points[i][0] * points[(i + 1) % n][1] - points[(i + 1) % n][0] * points[i][1]
  const marks: Array<Corner> = []
  for (let i = 0; i < n; i++) {
    const [P, A, B] = [points[i], points[(i + n - 1) % n], points[(i + 1) % n]]
    const rad = typeof r === 'number' ? r : (r[i] ?? 0)
    const [ua, ub] = [[A[0] - P[0], A[1] - P[1]], [B[0] - P[0], B[1] - P[1]]]
    const [la, lb] = [Math.hypot(ua[0], ua[1]), Math.hypot(ub[0], ub[1])]
    const cos = (ua[0] * ub[0] + ua[1] * ub[1]) / (la * lb)
    const half = Math.acos(Math.max(-1, Math.min(1, cos))) / 2
    let t = rad && half > 1e-3 ? rad / Math.tan(half) : 0
    t = Math.min(t, la / 2, lb / 2)
    const rr = t * Math.tan(half)
    const T1: Vec = [P[0] + (ua[0] / la) * t, P[1] + (ua[1] / la) * t]
    const T2: Vec = [P[0] + (ub[0] / lb) * t, P[1] + (ub[1] / lb) * t]
    const cross = ua[0] * ub[1] - ua[1] * ub[0]
    const sweep = cross < 0 ? 1 : 0
    d += `${i ? 'L' : 'M'}${pt(T1)}A${r2(rr)} ${r2(rr)} 0 0 ${sweep} ${pt(T2)}`
    const round = rad > 0 && t >= Math.min(la, lb) / 2 - 1e-6
    if (Math.sign(cross) === -Math.sign(area) && !round) {
      let [bx, by] = [ua[0] / la + ub[0] / lb, ua[1] / la + ub[1] / lb]
      const bl = Math.hypot(bx, by) || 1
      ;[bx, by] = [bx / bl, by / bl]
      const k = half > 1e-3 ? rr / Math.sin(half) - rr : 0
      const out = (u: ReadonlyArray<number>, l: number): Vec => {
        const [nx, ny] = [-u[1] / l, u[0] / l]
        return nx * bx + ny * by > 0 ? [-nx, -ny] : [nx, ny]
      }
      const [na, nb] = [out(ua, la), out(ub, lb)]
      marks.push([P[0] + bx * k, P[1] + by * k, na[0], na[1], nb[0], nb[1]])
    }
  }
  d += 'Z'
  if (corners.size > 4000) corners.clear()
  corners.set(d, marks)
  return d
}

export function spark(cx: number, cy: number, r: number, pinch = 0.28) {
  const q = r * pinch
  return `M${pt([cx, cy - r])}Q${pt([cx + q, cy - q])} ${pt([cx + r, cy])}Q${pt([cx + q, cy + q])} ${pt([cx, cy + r])}Q${pt([cx - q, cy + q])} ${pt([cx - r, cy])}Q${pt([cx - q, cy - q])} ${pt([cx, cy - r])}Z`
}

export const ring = (cx: number, cy: number, r: number, hole: number) =>
  ellipse(cx, cy, r) + `M${pt([cx - hole, cy])}A${r2(hole)} ${r2(hole)} 0 1 0 ${pt([cx + hole, cy])}A${r2(hole)} ${r2(hole)} 0 1 0 ${pt([cx - hole, cy])}Z`

export const star = (cx: number, cy: number, r: number, inner = 0.48, n = 5, round = 3) =>
  poly(
    Array.from({ length: n * 2 }, (_, i): Vec => {
      const [a, k] = [(i / (n * 2)) * Math.PI * 2 - Math.PI / 2, i % 2 ? inner : 1]
      return [cx + Math.cos(a) * r * k, cy + Math.sin(a) * r * k]
    }),
    round,
  )

export function view(yaw: number, pitch: number) {
  const [a, e] = [(yaw * Math.PI) / 180, (pitch * Math.PI) / 180]
  return ([x, y, z]: readonly [number, number, number]): Vec => [
    r2(x * Math.cos(a) - y * Math.sin(a)),
    r2(-((x * Math.sin(a) + y * Math.cos(a)) * Math.sin(e) + z * Math.cos(e))),
  ]
}

export const line = (...points: ReadonlyArray<Vec>) => points.map((p, i) => `${i ? 'L' : 'M'}${pt(p)}`).join('')

export function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const [a, b] = [(from * Math.PI) / 180, (to * Math.PI) / 180]
  const large = Math.abs(to - from) > 180 ? 1 : 0
  return `M${pt([cx + Math.cos(a) * r, cy + Math.sin(a) * r])}A${r2(r)} ${r2(r)} 0 ${large} ${to > from ? 1 : 0} ${pt([cx + Math.cos(b) * r, cy + Math.sin(b) * r])}`
}
