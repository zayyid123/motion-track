import { VIEWS, arc, ellipse, onFace, pill, poly, rect, ring, spark, star, view } from './fun'
import { bounce, clasp, drift, glint, look, shackle, sparkle, twinkle, twist, wobble } from './motions'
import type { Icon, Layer, Motion, Vec } from './fun'

const LINE = 5
const { tilt: FACE, extrude: EXT } = VIEWS.right

const glow = (groupId: string, p: Vec, r: number, m: Motion | ReadonlyArray<Motion>, extra: { ip?: number; op?: number } = {}): Layer => ({
  groupId,
  a: p,
  p,
  m,
  ...extra,
  shapes: [{ d: spark(p[0], p[1], r), fill: 'white' }],
})

const KEYHOLE = ellipse(0, -4, 17) + poly([[-8, 6], [8, 6], [13, 42], [-13, 42]], 3)
const SHACKLE = 'M-74 -40L-74 -122A74 74 0 0 1 74 -122L74 -40L42 -40L42 -122A42 42 0 0 0 -42 -122L-42 -40Z'

export const padlock: Icon = {
  name: 'padlock',
  frames: 130,
  line: LINE,
  extrude: EXT,
  layers: [
    {
      id: 'lock',
      name: 'Padlock Group',
      isGroup: true,
      motionPreset: 'clasp',
      p: [256, 300],
      m: clasp,
      shapes: [],
    },
    {
      id: 'body-grp',
      name: 'Padlock Body Group',
      groupId: 'lock',
      isGroup: true,
      p: [0, 0],
      tilt: FACE,
      tiltFromView: true,
      shapes: [],
    },
    {
      id: 'shackle',
      name: 'Steel Shackle',
      groupId: 'body-grp',
      motionPreset: 'shackle',
      a: [-58, -62],
      p: [-58, -62],
      r: 15,
      tilt: FACE,
      tiltFromView: true,
      m: shackle,
      shapes: [{ d: SHACKLE, fill: 'tint', depth: 0.7 }],
    },
    {
      id: 'body',
      name: 'Padlock Body',
      groupId: 'body-grp',
      p: [0, 0],
      shapes: [
        { d: rect(-112, -80, 224, 176, 24), fill: 'main', depth: 1 },
        { d: ellipse(0, 8, 36, 50), fill: 'white', depth: 0.25 },
        { d: KEYHOLE, fill: 'ink', line: false },
      ],
    },
    { ...glow('lock', [-142, -70], 30, twinkle(0, true), { op: 30 }), id: 'glint1', name: 'Glint Left', motionPreset: 'twinkle' },
    { ...glow('lock', [-142, -70], 30, twinkle(75), { ip: 75 }), id: 'glint2', name: 'Glint Left Rest', motionPreset: 'twinkle' },
  ],
}

const BUBBLE = poly([[-132, -96], [132, -96], [132, 74], [-36, 74], [-96, 120], [-80, 74], [-132, 74]], [30, 30, 30, 4, 6, 4, 30])
const BOT: Vec = [-16, 30]
const ROCK = onFace(BOT, [0, 74])

export const chat: Icon = {
  name: 'chat',
  frames: 180,
  line: LINE,
  extrude: EXT,
  layers: [
    {
      id: 'bot',
      name: 'Chat Bot Group',
      isGroup: true,
      motionPreset: 'wobble',
      a: ROCK,
      p: [252 + ROCK[0], 216 + ROCK[1]],
      m: wobble,
      shapes: [],
    },
    {
      id: 'face',
      name: 'Chat Face Slab',
      groupId: 'bot',
      tilt: BOT,
      tiltFromView: true,
      shapes: [
        { d: pill(-8, -150, 16, 60), fill: 'grey', depth: 0.5 },
        { d: ellipse(0, -152, 20), fill: 'main', depth: 0.6 },
        { d: BUBBLE, fill: 'hot', depth: 1 },
        { d: rect(-104, -70, 208, 118, 26), fill: 'tint' },
        { d: arc(0, 4, 30, 25, 155) },
      ],
    },
    { id: 'eyeL', name: 'Left Eye Mask', groupId: 'bot', shapes: [{ d: ellipse(-46, -20, 26, 30), fill: 'white' }] },
    { id: 'eyeR', name: 'Right Eye Mask', groupId: 'bot', shapes: [{ d: ellipse(46, -20, 26, 30), fill: 'white' }] },
    { id: 'pupilL', name: 'Left Pupil', groupId: 'bot', motionPreset: 'look', clip: 'eyeL', m: { ...look, k: 1.6 }, shapes: [{ d: ellipse(-40, -14, 15), fill: 'ink', line: false }] },
    { id: 'pupilR', name: 'Right Pupil', groupId: 'bot', motionPreset: 'look', clip: 'eyeR', m: { ...look, k: 1.6 }, shapes: [{ d: ellipse(52, -14, 15), fill: 'ink', line: false }] },
    { ...glow('bot', [150, -118], 26, sparkle(16)), id: 'spark1', name: 'Top Sparkle', motionPreset: 'sparkle' },
    { ...glow('bot', [-156, -60], 16, sparkle(92)), id: 'spark2', name: 'Side Sparkle', motionPreset: 'sparkle' },
  ],
}

export const search: Icon = {
  name: 'search',
  frames: 180,
  line: LINE,
  extrude: EXT,
  layers: [
    {
      id: 'lens',
      name: 'Search Lens Group',
      isGroup: true,
      motionPreset: 'twist',
      p: [222, 226],
      m: twist,
      shapes: [],
    },
    {
      id: 'magnifier',
      name: 'Glass and Rim',
      groupId: 'lens',
      tilt: [-20, 28],
      tiltFromView: false,
      shapes: [
        { d: poly([[54, 90], [90, 54], [178, 142], [142, 178]], [0, 0, 24, 24]), fill: 'main', depth: 1 },
        { d: poly([[48, 93], [93, 48], [113, 68], [68, 113]], 6), fill: 'grey', depth: 1 },
        { d: ellipse(0, 0, 80), fill: 'tint' },
        { d: ring(0, 0, 104, 78), fill: 'hot', depth: 1 },
        { d: arc(0, 0, 56, 200, 255) },
      ],
    },
    { ...glow('lens', [30, -26], 22, sparkle(20)), id: 'lensSpark1', name: 'Lens Sparkle A', motionPreset: 'sparkle' },
    { ...glow('lens', [-32, 30], 14, sparkle(96)), id: 'lensSpark2', name: 'Lens Sparkle B', motionPreset: 'sparkle' },
  ],
}

const COIN = (cx: number, cy: number) => ellipse(cx, cy, 112, 80)
export const coins: Icon = {
  name: 'coins',
  frames: 180,
  line: LINE,
  extrude: [-2, 18],
  layers: [
    { id: 'coin-bot1', name: 'Bottom Coin 1', p: [252, 352], r: -10, shapes: [{ d: COIN(0, 0), fill: 'gold', depth: 1 }] },
    { id: 'coin-bot2', name: 'Bottom Coin 2', p: [246, 318], r: -10, shapes: [{ d: COIN(0, 0), fill: 'gold', depth: 1 }] },
    { id: 'coin-grp', name: 'Springing Coin Group', isGroup: true, motionPreset: 'bounce', p: [240, 278], r: -10, m: bounce, shapes: [] },
    {
      id: 'coin',
      name: 'Springing Coin',
      groupId: 'coin-grp',
      p: [0, 0],
      shapes: [{ d: COIN(0, 0), fill: 'gold', depth: 1 }, { d: ellipse(0, 0, 86, 58) }, { d: star(0, 2, 40, 0.46, 5, 4), fill: 'ink', line: false }],
    },
    { ...glow('coin-grp', [96, -66], 26, glint(2, 98)), id: 'cg1', name: 'Glint 1', motionPreset: 'glint' },
    { ...glow('coin-grp', [-104, -48], 26, glint(6, 122)), id: 'cg2', name: 'Glint 2', motionPreset: 'glint' },
  ],
}

const fly = view(50, 30)
const [NOSE, TAIL, KEEL, FAR, NEAR] = [fly([172, 0, 0]), fly([-128, 0, 0]), fly([-104, 0, -112]), fly([-144, 116, 20]), fly([-144, -116, -44])]
const MID: Vec = [(Math.min(FAR[0], KEEL[0], NEAR[0]) + NOSE[0]) / 2, (NOSE[1] + Math.max(NEAR[1], KEEL[1])) / 2]

export const plane: Icon = {
  name: 'plane',
  frames: 180,
  line: LINE,
  extrude: [-4, 13],
  layers: [
    {
      id: 'plane-wing',
      name: 'Paper Plane',
      a: MID,
      p: [256, 250],
      motionPreset: 'drift',
      m: drift,
      shapes: [
        { d: poly([NOSE, FAR, TAIL], 3), fill: 'paper', side: 'white', depth: 1 },
        { d: poly([NOSE, TAIL, KEEL], 3), fill: 'grey', side: 'white', depth: 1 },
        { d: poly([NOSE, TAIL, NEAR], 3), fill: 'tint', side: 'white', depth: 1 },
      ],
    },
  ],
}

export const blankProject: Icon = {
  name: 'Blank Sticker',
  frames: 180,
  line: LINE,
  extrude: EXT,
  layers: [
    {
      id: 'base-rect',
      name: 'Initial Slab',
      p: [250, 250],
      tilt: FACE,
      tiltFromView: true,
      motionPreset: 'wiggle',
      shapes: [
        {
          d: rect(-60, -60, 120, 120, 16),
          fill: 'main',
          depth: 1,
        },
      ],
    },
  ],
}

export const ICONS: ReadonlyArray<Icon> = [padlock, chat, search, coins, plane, blankProject]
