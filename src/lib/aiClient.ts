import { Icon, Palette } from '@/lib/funIsometric';
import { AISettings, ChatMessage } from '@/types/sticker';

export interface AIContext {
  icon: Icon;
  palette: Palette;
  selectedLayerId: string | null;
}

export async function sendChatMessage(
  messages: ChatMessage[],
  userPrompt: string,
  settings: AISettings,
  context?: AIContext
): Promise<string> {
  if (!settings.apiKey) {
    throw new Error('API Key belum diisi. Silakan masukkan API Key di menu Settings.');
  }

  const endpoint = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const selectedLayer = context?.icon.layers.find((l) => l.id === context.selectedLayerId);

  const systemPrompt = `You are the Motion-Track AI Assistant, a studio assistant for an interactive isometric animated sticker engine.

STATION RULES & KNOWLEDGE BASE:
1. Isometric View System: 4 available views: 'right' (default), 'left', 'front', 'flat'.
2. Role-Based Palettes: Colors follow semantic roles:
   - 'main': Primary body slab
   - 'gold': Coins, stars, bells
   - 'tint': Light/soft fills and glass highlights
   - 'ok': Success green
   - 'hot': Cobalt blue / alert accents
   - 'deep': Extruded slab side color / dark shadow
   - 'white', 'grey', 'paper', 'ink' (black outline 5px)
   Named Themes: 'slush' (warm orange #ff6b35 + cobalt blue #2563eb), 'riso', 'candy', 'matcha', 'sunset', 'clay'.
3. 16 Motion Presets: 'none', 'wiggle', 'hop', 'bounce', 'clasp', 'shackle', 'drift', 'twist', 'wobble', 'look', 'sparkle', 'twinkle', 'glint', 'sway', 'float', 'bob'.
4. Multi-Track Grouping System:
   - Empty group containers (isGroup: true, shapes: []) drive all child layers assigned to them.
   - Children layers (groupId: string) automatically inherit the group's motion, rotation, and translation.
   - Layers can also be independent.

CURRENT STUDIO STATE:
- Project Sticker Name: "${context?.icon.name || 'padlock'}"
- Total Layers: ${context?.icon.layers.length || 0}
- Active Layers Overview:
${context?.icon.layers.map((l, i) => `  ${i + 1}. [${l.isGroup ? 'GROUP CONTAINER' : 'LAYER'}] id="${l.id}", name="${l.name || l.id}", motion="${l.motionPreset || 'static'}", group="${l.groupId || 'none'}", depth=${l.shapes[0]?.depth ?? 0}`).join('\n')}
- Currently Selected Layer: ${selectedLayer ? `id="${selectedLayer.id}", name="${selectedLayer.name}", motion="${selectedLayer.motionPreset || 'static'}", group="${selectedLayer.groupId || 'none'}"` : 'None (Canvas root)'}

INSTRUCTIONS FOR ANSWERS:
- Speak in friendly Indonesian or English based on user query.
- When giving design ideas, refer specifically to the real tools in this studio: role slots (main, tint, gold, etc.), motion presets, grouping containers, slab depth, and canvas dragging/scaling.
- Keep answers practical, structured, and developer-friendly.`;

  const apiMessages = [
    { role: 'system', content: systemPrompt },
    ...messages
      .filter((m) => m.sender !== 'system')
      .map((m) => ({
        role: m.sender === 'user' ? 'user' : 'assistant',
        content: m.text,
      })),
    { role: 'user', content: userPrompt },
  ];

  const response = await fetch(endpoint, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${settings.apiKey}`,
    },
    body: JSON.stringify({
      model: settings.model || 'gpt-4o-mini',
      messages: apiMessages,
      temperature: 0.7,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`AI API Error (${response.status}): ${errorText}`);
  }

  const data = await response.json();
  const reply = data.choices?.[0]?.message?.content || 'Tidak ada balasan dari AI.';
  return reply;
}
