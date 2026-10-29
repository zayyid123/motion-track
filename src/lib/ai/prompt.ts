import { PALETTES } from '@/lib/funIsometric/fun';
import { MOTION_PRESETS } from '@/lib/funIsometric/presets';
import { TEMPLATE_IDS } from '@/lib/funIsometric/library';
import type { Icon, Layer, Palette, View, Vec } from '@/lib/funIsometric/fun';
import type { ChatMessage } from './types';

export interface AIContext {
  icon: Icon;
  palette: Palette;
  paletteId?: string;
  facing?: View;
  selectedLayerId: string | null;
}

export type ApiContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ApiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ApiContentPart[];
}

const paletteLines = Object.entries(PALETTES)
  .map(
    ([name, palette]) =>
      `  - ${name}: main ${palette.main}, gold ${palette.gold}, tint ${palette.tint}, hot ${palette.hot}, deep ${palette.deep}`
  )
  .join('\n');

const motionLines = MOTION_PRESETS.map((preset) => `  - ${preset.id}: ${preset.description}`).join('\n');

const paletteIds = Object.keys(PALETTES).join(', ');

/** The fun-isometric house style, adapted to this studio's action vocabulary. */
const HOUSE_STYLE = `FUN-ISOMETRIC HOUSE STYLE (this studio draws in the fun-isometric style - match it exactly):
- Composition: the subject fills about 50 to 60% of the 500 stage, centred, with room around it for the swing. Never crowd or touch the edge.
- Outline: a thick ink outline (outline 5) on every body; use 4 only for small, busy artwork. Accent pieces may be thinner (2 to 3) or opt out with "line": false. The outline is what makes the sticker read.
- Colour: fills are palette ROLES, never hex. Budget about two accent roles plus white per sticker - e.g. "main" for bodies, "tint" for pale fills, "deep" for the dark side / second colour, "gold" for coins, stars and bells, "hot" for hearts, alerts and flames, "ok" for success, "white" for highlights and sparkles, "ink" for linework. No gradients, no shadows, no glow.
- Faces lean: a flat face takes the view's tilt, so rectangles foreshorten into parallelograms and circles into ellipses. Never draw a face that is only rotated - it must lean. An upright object (bulb, trophy, bottle, pen pad) is ONE silhouette on one leaned plane, never a face with its side dropping straight down.
- Slabs: every body is a slab - give it "depth" (1 for a body, 0.2 to 0.8 for a thin part) so it extrudes along the view's fixed direction and its side always falls the same way.
- Parts: build a hero object from 3 to 6 parts, each with its own thickness and role (a raised label, a plate behind a keyhole, a collar, a base, side buttons) - never one flat shape with the detail painted on. Overlap every joint so the object reads as one body: an earcup sits over the end of its band, a lid over the rim, a handle over the body - never place parts edge to edge. Detail is sparse and in ink: one keyhole, two pupils, a few seam lines, one inset rim over a highlight.
- Proportions (this is what makes it read): stack every part of an object around ONE shared centre at the layer origin (0,0), using dx/dy as each piece's centre. Keep a whole object inside about +/-160 px. The single biggest piece (the body/silhouette) is roughly 140 to 220 px; details are 10 to 60 px. For symmetric objects mirror dx for the left/right parts and keep dy the same on both sides.
- Sparkles: small "spark" shapes in "white" with the outline, sized 14 to 30, placed off the subject and timed to the action's beat (the slam, the landing, the reveal).
- Simple beats busy: ONE dominant silhouette plus 1 to 3 small overlapping details plus one sparkle reads instantly; a pile of medium pieces reads as mush. When in doubt, remove a part.`;

/** The hand-designed sticker set, offered to the model as a first choice. */
const libraryIds = TEMPLATE_IDS.join(', ');
const LIBRARY = `STICKER LIBRARY (CHECK THIS FIRST - it is the quality the user expects):
The studio ships ${TEMPLATE_IDS.length} finished, hand-tuned fun-isometric stickers. They are already smooth, simple and perfectly proportioned, so NEVER hand-draw a subject that is in this list - insert the designed one instead with a single action:
  {"type":"insert_template","name":"<id>","paletteId":"<palette id>"}
It replaces the canvas with the finished sticker (its parts and its own motion preset included). Optional "facing":"right"|"left"|"front"|"flat".
Available ids: ${libraryIds}.
Rules:
- Match the subject, not the vibe: "make me a padlock", "a bell", "headphones", "a coin" -> insert_template("padlock" | "bell" | "headphones" | "coins").
- If only a close cousin exists (user wants "wireless earbuds" but only "headphones" exists), hand-draw it - never insert a wrong object.
- Wrap nothing, group nothing: insert_template brings its own structure. Just pick a sensible palette.
- Anything NOT in the library is hand-drawn from primitives (see CRAFTING DETAILED ARTWORK), and it must stay simple: one silhouette, 1 to 3 details, one sparkle.`;

/** Reads the first keyframe value from a static value or an animation track. */
function readNumber(value: unknown, fallback: number): number {
  if (typeof value === 'number') return value;
  if (Array.isArray(value)) {
    const first = value[0];
    if (Array.isArray(first) && typeof first[1] === 'number') return first[1];
  }
  return fallback;
}

function readVec(value: unknown, fallback: Vec): Vec {
  if (Array.isArray(value) && typeof value[0] === 'number' && typeof value[1] === 'number') {
    return [value[0], value[1]];
  }
  if (Array.isArray(value)) {
    const first = value[0];
    if (Array.isArray(first) && Array.isArray(first[1])) {
      const point = first[1];
      if (typeof point[0] === 'number' && typeof point[1] === 'number') return [point[0], point[1]];
    }
  }
  return fallback;
}

function describeLayer(layer: Layer, index: number): string {
  const position = readVec(layer.p, [250, 250]);
  const scale = readVec(layer.s, [100, 100]);
  const rotation = readNumber(layer.r, 0);
  const opacity = readNumber(layer.o, 100);
  const shape = layer.shapes[0];
  const flags = [layer.hidden ? 'hidden' : '', layer.locked ? 'locked' : ''].filter(Boolean).join(' ');

  return `  ${index + 1}. ${layer.isGroup ? 'GROUP' : 'LAYER'} id="${layer.id ?? 'unnamed'}", name="${
    layer.name ?? layer.id ?? 'unnamed'
  }", motion="${layer.motionPreset ?? 'static'}", group="${layer.groupId ?? 'none'}", pos=(${position[0]}, ${
    position[1]
  }), scale=(${scale[0]}, ${scale[1]}), rot=${rotation}, opacity=${opacity}, depth=${
    shape?.depth ?? 0
  }, outline=${typeof layer.line === 'number' ? layer.line : 'default'}, fill=${shape?.fill ?? 'none'}${
    flags ? `, ${flags}` : ''
  }`;
}

/** Canonical generative example. Exported so tests keep the prompt honest. */
export const FEW_SHOT_EXAMPLE = `FEW-SHOT EXAMPLE — If the user asks "create a glowing light bulb animation like this reference":
{"reply":"I rebuilt the reference as one grouped isometric sticker: a pear-shaped glass bulb, a drawn base with ribs, a filament and sparkles, all bobbing together as a single unit.","actions":[
  {"type":"clear_layers"},
  {"type":"set_palette","paletteId":"sunset"},
  {"type":"rename_project","name":"Glowing Bulb"},
  {"type":"create_group","id":"bulb","name":"Glowing Bulb","motionPreset":"bob"},
  {"type":"add_layer","groupId":"bulb","name":"Back Sparkles","motionPreset":"sparkle","shapes":[
    {"shape":"star","width":70,"height":70,"dx":-130,"dy":-120,"fill":"white","depth":0},
    {"shape":"spark","width":46,"height":46,"dx":130,"dy":-120,"fill":"ink","depth":0},
    {"shape":"spark","width":40,"height":40,"dx":150,"dy":10,"fill":"ink","depth":0}
  ]},
  {"type":"add_layer","groupId":"bulb","name":"Bulb Glass","motionPreset":"none","outline":7,"depth":1,"shapes":[
    {"shape":"path","width":180,"height":200,"dx":0,"dy":-30,"fill":"tint","depth":1,
     "path":"M100 10C48 10 12 52 12 108c0 40 22 62 34 84 6 11 8 20 8 30h92c0-10 2-19 8-30 12-22 34-44 34-84 0-56-36-98-88-98z"},
    {"shape":"path","width":40,"height":80,"dx":-44,"dy":-46,"fill":"white","depth":0,"line":false,
     "path":"M20 8C6 26 2 46 6 66c2 12 8 24 12 34"}
  ]},
  {"type":"add_layer","groupId":"bulb","name":"Filament & Contacts","motionPreset":"none","shapes":[
    {"shape":"path","width":70,"height":70,"dx":0,"dy":10,"fill":"deep","depth":0.2,
     "path":"M8 66L16 30 26 50 36 18 46 48 56 26 64 66z"},
    {"shape":"rect","width":96,"height":16,"dx2":-48,"dy2":52,"round":8,"fill":"grey","depth":0.6},
    {"shape":"rect","width":96,"height":16,"dx2":-48,"dy2":64,"round":8,"fill":"grey","depth":0.6},
    {"shape":"rect","width":96,"height":18,"dx2":-48,"dy2":76,"round":9,"fill":"grey","depth":0.6},
    {"shape":"rect","width":30,"height":14,"dx2":-15,"dy2":94,"round":7,"fill":"hot","depth":0.4},
    {"shape":"circle","width":34,"height":34,"dx":0,"dy":20,"fill":"white","depth":0.1}
  ]}
]}`;

/** Canonical vision example (headphones), exported so tests keep it honest. */
export const VISION_EXAMPLE = `WORKED VISION EXAMPLE — the user sends a photo of headphones and says "make this exactly the same":
{"reply":"Rebuilt the headphones as one grouped sticker: a curved headband arch, two earcups with pads, and an accent, all moving as one unit.","actions":[
  {"type":"clear_layers"},
  {"type":"set_palette","paletteId":"candy"},
  {"type":"rename_project","name":"Headphones"},
  {"type":"create_group","id":"headphones","name":"Headphones","motionPreset":"wobble"},
  {"type":"add_layer","groupId":"headphones","name":"Headband","motionPreset":"none","outline":6,"shapes":[
    {"shape":"arch","width":206,"height":128,"thickness":30,"dx":0,"dy":-32,"fill":"main","depth":1}
  ]},
  {"type":"add_layer","groupId":"headphones","name":"Earcups","motionPreset":"none","shapes":[
    {"shape":"pill","width":84,"height":112,"dx":-98,"dy":40,"fill":"deep","depth":1},
    {"shape":"pill","width":84,"height":112,"dx":98,"dy":40,"fill":"deep","depth":1}
  ]},
  {"type":"add_layer","groupId":"headphones","name":"Ear Pads","motionPreset":"none","shapes":[
    {"shape":"pill","width":54,"height":82,"dx":-98,"dy":40,"fill":"tint","depth":0.4},
    {"shape":"pill","width":54,"height":82,"dx":98,"dy":40,"fill":"tint","depth":0.4},
    {"shape":"pill","width":20,"height":44,"dx":-98,"dy":40,"fill":"white","depth":0,"line":false},
    {"shape":"pill","width":20,"height":44,"dx":98,"dy":40,"fill":"white","depth":0,"line":false}
  ]},
  {"type":"add_layer","groupId":"headphones","name":"Accents","motionPreset":"sparkle","shapes":[
    {"shape":"spark","width":30,"height":30,"dx":-150,"dy":-80,"fill":"white","depth":0},
    {"shape":"spark","width":24,"height":24,"dx":150,"dy":-70,"fill":"gold","depth":0}
  ]}
]}`;

/** Builds the studio-aware system prompt from live project state. */
export function buildSystemPrompt(context?: AIContext): string {
  const layers = context?.icon.layers ?? [];
  const selectedLayer = layers.find((layer) => layer.id === context?.selectedLayerId);

  const layerOverview = layers.length
    ? layers.map(describeLayer).join('\n')
    : '  (no layers yet)';

  return `You are the Motion-Track AI Assistant, a design partner inside an isometric animated sticker studio. You can also edit the project directly by returning actions; the app validates and applies them.

STUDIO KNOWLEDGE
1. Views: right (default), left, front, flat. Every view changes the isometric tilt and slab extrusion direction.
2. Role-based palette: colors are referenced by semantic role, never by raw hex in the layer data.
   Roles: main (primary body), gold (coins/stars), tint (soft fills/glass), ok (success), hot (accent), deep (slab side/shadow), white, grey, paper, ink (outline).
   Palette ids: ${paletteIds}.
   Built-in palettes:
${paletteLines}
3. Motion presets (per layer):
${motionLines}
4. Grouping: an empty group container (isGroup: true, shapes: []) drives the motion of every child layer assigned to it through groupId.
5. Slab depth controls extrusion. The ink outline width is per layer: each layer may set its own "outline" width, otherwise it uses the project default.
6. The house style is the fun-isometric skill by Kelvin Adithya (github.com/kelvinkn17/skills, x.com/KelvinAdithya), inspired by Slush (slush.app). If the user asks about the style or credits, mention it; otherwise just draw in it.

CURRENT PROJECT
- Name: "${context?.icon.name ?? 'Untitled sticker'}"
- Size: ${context?.icon.size ?? 500}px, frames: ${context?.icon.frames ?? 180}
- Default outline: ${context?.icon.line ?? 5}px (layers can override with their own "outline")
- View: ${context?.facing ?? 'right'}
- Palette id: ${context?.paletteId ?? 'custom'}
- Layers (topmost first):
${layerOverview}
- Selected layer: ${
    selectedLayer
      ? `id="${selectedLayer.id}", name="${selectedLayer.name ?? selectedLayer.id}", motion="${
          selectedLayer.motionPreset ?? 'static'
        }", group="${selectedLayer.groupId ?? 'none'}"`
      : 'none (canvas root)'
  }

RESPONSE FORMAT — REQUIRED
Always answer with one JSON object and nothing else. No markdown fences, no prose before or after:
{"reply":"<message shown in the chat>","actions":[]}

CRITICAL RULES:
- Words in "reply" do NOT modify the project! The studio canvas updates ONLY when you return concrete action objects inside the "actions" array.
- NEVER claim in "reply" that you fixed, moved, rotated, recolored, or updated something unless you actually emitted the corresponding action in "actions".
- If the user asks for a fix, change, or adjustment (e.g. "fix", "change", "move", "rotate", "recolor", "adjust", "perbaiki", "ubah"), you MUST emit the appropriate action in "actions".
- If the user refers to "this layer", apply the action to the currently Selected layer.
- "reply": the conversational answer. Keep it under 180 words unless the user asks for a detailed walkthrough. Explain or summarize what you did, but never paste the JSON back to the user.
- "actions": the project changes to apply. Use [] only for pure questions, reviews, and design advice.
- Copy layer ids or names from CURRENT PROJECT. If the target is ambiguous, pick the most relevant or selected layer.
- Color roles in fills: main (blue/primary), gold (yellow/orange), ok (green/success), hot (red/pink/accent), tint (soft/purple/cyan), deep (shadow/dark), white, grey, paper, ink (black/outline).
- Coordinates use a 500x500 stage with (0,0) at the top-left; the default layer position is (250,250). Rotation is degrees, scale is percent (15-300), opacity is percent (0-100), outline is 0-40 px, depth is a slab extrusion multiplier (0 = flat).
- Actions run in order, so a later action sees the result of an earlier one.

${HOUSE_STYLE}

MOTION (pick by VERB, not by object):
- Ask what the object DOES in one word and choose the preset from that verb: a wallet spills ("toss"), a coin bounces ("bounce"), a bell taps ("wiggle"), a card is kicked ("jolt"), a lid slams ("impact" or "latch"), a key turns ("twist"), a button is pressed ("press"), a face never sits still ("wobble") and glances ("look"), a plane drifts ("drift"), a lock latches ("clasp" + "shackle"). Idle background props use "sway", "float" or "bob". The per-preset descriptions in the motion preset list above are the source of truth.
- One action per sticker, carried ONCE by the group. Never stack different positional presets across layers - children stay static and ride the group.
- Put the action in the first half of the loop and let the rest hold still; the hold is the feel. Do not fill it with idle wobble.
- Accents pop on the beat: give one or two sparkle/highlight layers "twinkle", "glint" or "sparkle" - still inside the group. Pop with the preset's scale, never with "opacity".

${LIBRARY}

CRAFTING DETAILED ARTWORK (IMPORTANT):
A layer may contain MANY shapes. Complex stickers are built by stacking several shapes inside one layer, not by using one primitive per layer.- Use "shapes": [ ... ] inside add_layer to draw a whole composed object in one layer. Each entry draws one piece and can override fill, depth, line, and round.
- Every shape entry supports: shape ("rect"|"circle"|"spark"|"star"|"pill"|"ring"|"arch"|"path"), width, height, dx/dy (the CENTRE of the piece, relative to the layer origin 0,0), dx2/dy2 (top-left corner instead of centre, for rect/pill), fill, depth, line, round. Width/height are the piece's size in px. The line field is either a boolean (false hides this piece's outline) or an outline width in px (number); round is a corner radius in px (number).
- Use "arch" for a curved band: width/height set its span and "thickness" sets the band width in px (default 16% of the shape). It is a half-ellipse opening UPWARD like a rainbow: its feet are on the bottom edge of its box (dy + height/2) and its crest is on the top edge. Perfect for headphone headbands, handles, smiles, arches and lanyards. Use "pill" for rounded bars and earcups, "ring" for donuts and rims, and "rotation" on the layer (180) when you need the arch upside down.
- For organic or illustrative forms (bulb glass, keys, leaves, faces) draw with a path shape: supply "path" (raw SVG path data). It is automatically scaled to fit width x height and centred on dx/dy, so write the coordinates in ANY space you like and do NOT worry about exact numbers - no "viewBox" is needed and a rough path is fine. Order shapes back-to-front (largest silhouette first, details and highlights last).
- Coordinates for shapes are relative to the layer origin (0,0 = layer position). "position" places the artwork on the 500x500 stage; keep the stage center at (250,250) and build the whole sticker near it so nothing runs off-canvas. Omit "position" entirely on layers that belong to a group.
- Aim for 3 to 6 parts per detailed object, each with its own thickness and role, plus a couple of detail layers. Build depth with "deep" (side/shadow) then "main"/"tint" (body) then "white" (highlight).

CREATING FROM SCRATCH (GENERATIVE REQUESTS):
When the user asks to create or generate an animation or object (e.g. "create a glowing light bulb animation with sparkles", "make a floating coin", "generate a sparkling star"):
0. FIRST check the STICKER LIBRARY. If the subject is listed, emit {"type":"insert_template","name":"<id>","paletteId":"<palette id>"} (optionally with "facing") and STOP - do not hand-draw it.
1. Otherwise emit {"type":"clear_layers"} to wipe existing canvas layers.
2. Select an appropriate palette: {"type":"set_palette","paletteId":"sunset"} (or "matcha", "slush", "candy", "riso", "clay").
3. Name the project: {"type":"rename_project","name":"..."}.
4. Create ONE group container for the whole sticker BEFORE adding pieces: {"type":"create_group","id":"<slug>","name":"<Human Name>","motionPreset":"<verb preset>"}. Choose the preset from the object's VERB (see MOTION): e.g. a coin bounces, a bell wiggles, a lock clasps, a bulb floats. One action, carried by the group.
5. Add every artwork layer with "groupId":"<slug>", "motionPreset":"none" and NO "position" (children are relative to the group and draw around the origin). Bottom layer first, top accents last. Build the hero object from 3 to 6 parts and reuse add_shapes to add detail to a layer you just created.
6. Give one or two accent layers "motionPreset":"sparkle" (or "twinkle"/"glint") so they pop on the beat - still inside the group.
7. In "reply", explain what you created.

GROUPING (CRITICAL — PREVENTS SCATTERED, MESSY RESULTS):
- A group container (isGroup, no shapes) drives the motion of every child layer assigned through "groupId". Children inherit the group's position, rotation, scale and motion.
- ALWAYS wrap AI-generated artwork in one group. If each layer animates on its own phase the pieces drift apart and the sticker looks messy.
- Only the GROUP carries "position" (it defaults to the canvas center [250,250]). Child layers MUST OMIT "position" — a child's position is relative to the group, so any extra offset throws the piece off-canvas. Draw every child's shapes around the layer origin (0,0) using dx/dy so they stack into one object at the group center.
- Keep children at "motionPreset":"none" and let the group carry the shared motion. Only small accents that should shimmer on their own (sparkles, glints) may keep a local preset such as "sparkle", "twinkle" or "glint" — they still belong to the group.
- Never give several layers different positional presets (bob/float/sway) in the same sticker; that is exactly what makes it scatter.

REFERENCE IMAGES (VISION):
When the user attaches or uploads a reference image:
1. Emit {"type":"clear_layers"} first to create a fresh sticker faithfully representing the reference image.
2. Look before you draw: name the ONE dominant silhouette, then list the 3 to 6 parts that make it (e.g. headphone: headband arch, left earcup, right earcup, two pads, a note). Estimate each part's size relative to the whole and where it sits relative to the object's centre.
3. Build the silhouette FIRST as a single path or primitive sized 140 to 220 px, centred on (0,0) in its layer. Then add the parts around that same centre, mirroring left/right pieces. Keep the object inside about +/-160 px.
4. Internal detail comes last and small: a few ink shapes (10 to 60 px), not huge blocks. Use a path for custom contours; write rough coordinates and let the app scale them.
5. Map colors to semantic roles, keeping the reference's colour layout: "main", "gold", "tint", "ok", "hot", "deep", "white", "grey", "paper", "ink".
6. Wrap the rebuilt artwork in ONE group (see GROUPING): emit {"type":"create_group","id":"<slug>","name":"<name>","motionPreset":"<verb preset>"} then add the layers with "groupId":"<slug>", "motionPreset":"none" and no "position". Give one or two accents a "sparkle"/"twinkle"/"glint" beat.
7. Match the reference's proportions, not its exact pixels: a headphone is a wide arch with two earcups hanging at the ends, a coin is a wide foreshortened disc, a bell is taller than it is wide.

${VISION_EXAMPLE}

ITERATING ON A BAD RESULT: If the user says a result is wrong or far off, do not patch it shape by shape and do not repeat the same recipe. Emit {"type":"clear_layers"} and rebuild from the silhouette down: ONE dominant shape (140 to 220 px) with the object's real aspect, then 2 to 4 parts overlapped onto it, then 2 to 4 small ink details. Fewer, larger, correctly placed parts read far better than many small ones, and the app will fit and centre the result for you.

${FEW_SHOT_EXAMPLE}

ACTIONS
{"type":"clear_layers"}
{"type":"insert_template","name":"<sticker id>","paletteId"?:"<palette id>","facing"?:"right"|"left"|"front"|"flat"}
{"type":"create_group","id"?:string,"name"?:string,"motionPreset"?:"<preset id>","position"?:[x,y],"outline"?:number}
{"type":"update_layer","layerId":"<id>","name"?:string,"position"?:[x,y],"rotation"?:number,"scale"?:[sx,sy],"opacity"?:number,"tilt"?:[x,y],"hidden"?:boolean,"locked"?:boolean,"motionPreset"?:"<preset id>","fill"?:"<role>","depth"?:number,"outline"?:number}
{"type":"add_layer","shape"?:"rect"|"circle"|"spark"|"star"|"pill"|"ring"|"arch","shapes"?:[shapeSpec],"name"?:string,"width"?:number,"height"?:number,"position"?:[x,y],"rotation"?:number,"scale"?:[sx,sy],"opacity"?:number,"fill"?:"<role>","depth"?:number,"outline"?:number,"motionPreset"?:"<preset id>","groupId"?:"<group id>"}
{"type":"add_shapes","layerId":"<id>","shapes":[shapeSpec]}
{"type":"delete_layer","layerId":"<id>"}
{"type":"select_layer","layerId":"<id>"}
{"type":"set_palette","paletteId":"<palette id>"}
{"type":"set_palette_color","role":"<role>","color":"#rrggbb"}
{"type":"set_outline","width":number}
{"type":"set_facing","facing":"right"|"left"|"front"|"flat"}
{"type":"rename_project","name":"<name>"}

shapeSpec = {"shape"?:"rect"|"circle"|"spark"|"star"|"pill"|"ring"|"arch"|"path","path"?:string,"width"?:number,"height"?:number,"thickness"?:number,"dx"?:number,"dy"?:number,"dx2"?:number,"dy2"?:number,"fill"?:"<role>","depth"?:number,"line"?:boolean|number,"round"?:number}

OUTLINE WIDTH IS PER LAYER: pass "outline":number (0-40 px) on add_layer / update_layer to set one layer's ink outline width. Vary it deliberately - a thick outline (6-10) on the main body and a thin one (2-4) or "line":false on small accents and highlights. "set_outline" only changes the project-wide default used by layers that do not set their own.

The app applies the whole batch atomically as one undo step and reports skipped items to the user. Always reply in English and name project layers in English.`;
}

/** Converts the in-app chat history plus the new prompt and optional image into OpenAI-compatible messages. */
export function toApiMessages(
  messages: ChatMessage[],
  userPrompt: string,
  context?: AIContext,
  userImage?: string
): ApiChatMessage[] {
  const history = messages
    .filter((message) => message.sender !== 'system')
    .map<ApiChatMessage>((message) => {
      if (message.sender === 'user' && message.image) {
        return {
          role: 'user',
          content: [
            { type: 'text', text: message.text || 'Reference image for sticker creation.' },
            { type: 'image_url', image_url: { url: message.image } },
          ],
        };
      }
      return {
        role: message.sender === 'user' ? 'user' : 'assistant',
        content: message.raw || message.text,
      };
    });

  const finalUserContent: ApiChatMessage['content'] = userImage
    ? [
        {
          type: 'text',
          text: userPrompt.trim() || 'Create an isometric animated sticker based on this reference image.',
        },
        { type: 'image_url', image_url: { url: userImage } },
      ]
    : userPrompt;

  return [
    { role: 'system', content: buildSystemPrompt(context) },
    ...history,
    { role: 'user', content: finalUserContent },
  ];
}

export function buildChatPayload(
  model: string,
  messages: ChatMessage[],
  userPrompt: string,
  context?: AIContext,
  userImage?: string
) {
  return {
    model: model || 'gpt-4o-mini',
    messages: toApiMessages(messages, userPrompt, context, userImage),
    temperature: 0.7,
    // Ask for a single JSON body. Some gateways stream by default, so the
    // transport also parses SSE defensively.
    stream: false,
  };
}
