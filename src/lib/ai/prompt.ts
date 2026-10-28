import { PALETTES } from '@/lib/funIsometric/fun';
import { MOTION_PRESETS } from '@/lib/funIsometric/presets';
import type { Icon, Layer, Palette, View, Vec } from '@/lib/funIsometric/fun';
import type { ChatMessage } from './types';

export interface AIContext {
  icon: Icon;
  palette: Palette;
  paletteId?: string;
  facing?: View;
  selectedLayerId: string | null;
}

export interface ApiChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
}

const paletteLines = Object.entries(PALETTES)
  .map(
    ([name, palette]) =>
      `  - ${name}: main ${palette.main}, gold ${palette.gold}, tint ${palette.tint}, hot ${palette.hot}, deep ${palette.deep}`
  )
  .join('\n');

const motionLines = MOTION_PRESETS.map((preset) => `  - ${preset.id}: ${preset.description}`).join('\n');

const paletteIds = Object.keys(PALETTES).join(', ');

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
  }, fill=${shape?.fill ?? 'none'}${flags ? `, ${flags}` : ''}`;
}

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
5. Slab depth controls extrusion. The outline width is a global ink stroke.

CURRENT PROJECT
- Name: "${context?.icon.name ?? 'Untitled sticker'}"
- Size: ${context?.icon.size ?? 500}px, frames: ${context?.icon.frames ?? 180}
- Outline: ${context?.icon.line ?? 5}px
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

- "reply": the conversational answer. Keep it under 180 words unless the user asks for a detailed walkthrough. Explain or summarize what you did, but never paste the JSON back to the user.
- "actions": the project changes to apply. Use [] for questions, reviews, and advice.
- Include actions only when the user explicitly asks for a change (for example "make it blue", "add a star", "rotate the body 15 degrees", "use the matcha palette", "switch to the front view", "delete the glint").
- Copy layer ids exactly from CURRENT PROJECT. Never invent ids. If the target is ambiguous, ask a clarifying question in "reply" and leave "actions" empty.
- Coordinates use a 500x500 stage with (0,0) at the top-left; the default layer position is (250,250). Rotation is degrees, scale is percent (15-300), opacity is percent (0-100), outline is 0-40 px, depth is a slab extrusion multiplier (0 = flat).
- Actions run in order, so a later action sees the result of an earlier one.

ACTIONS
{"type":"update_layer","layerId":"<id>","name"?:string,"position"?:[x,y],"rotation"?:number,"scale"?:[sx,sy],"opacity"?:number,"tilt"?:[x,y],"hidden"?:boolean,"locked"?:boolean,"motionPreset"?:"<preset id>","fill"?:"<role>","depth"?:number}
{"type":"add_layer","shape":"rect"|"circle"|"spark","name"?:string,"width"?:number,"height"?:number,"position"?:[x,y],"fill"?:"<role>","depth"?:number,"motionPreset"?:"<preset id>","groupId"?:"<group id>"}
{"type":"delete_layer","layerId":"<id>"}
{"type":"select_layer","layerId":"<id>"}
{"type":"set_palette","paletteId":"<palette id>"}
{"type":"set_palette_color","role":"<role>","color":"#rrggbb"}
{"type":"set_outline","width":number}
{"type":"set_facing","facing":"right"|"left"|"front"|"flat"}
{"type":"rename_project","name":"<name>"}

The app applies the whole batch atomically as one undo step and reports skipped items to the user. Mirror the user's language: answer in English unless they write in another language.`;
}

/** Converts the in-app chat history plus the new prompt into OpenAI-compatible messages. */
export function toApiMessages(messages: ChatMessage[], userPrompt: string, context?: AIContext): ApiChatMessage[] {
  const history = messages
    .filter((message) => message.sender !== 'system')
    .map<ApiChatMessage>((message) => ({
      role: message.sender === 'user' ? 'user' : 'assistant',
      content: message.text,
    }));

  return [{ role: 'system', content: buildSystemPrompt(context) }, ...history, { role: 'user', content: userPrompt }];
}

export function buildChatPayload(model: string, messages: ChatMessage[], userPrompt: string, context?: AIContext) {
  return {
    model: model || 'gpt-4o-mini',
    messages: toApiMessages(messages, userPrompt, context),
    temperature: 0.7,
    // Ask for a single JSON body. Some gateways stream by default, so the
    // transport also parses SSE defensively.
    stream: false,
  };
}
