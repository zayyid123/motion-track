import { AISettings, ChatMessage, StickerProject } from '@/types/sticker';

export async function sendChatMessage(
  messages: ChatMessage[],
  userPrompt: string,
  settings: AISettings,
  projectContext?: StickerProject
): Promise<string> {
  if (!settings.apiKey) {
    throw new Error('API Key belum diisi. Silakan masukkan API Key di menu Settings.');
  }

  const endpoint = `${settings.baseUrl.replace(/\/+$/, '')}/chat/completions`;

  const systemPrompt = `You are Motion-Track AI Assistant, an expert in creating and styling fun isometric animated stickers (Slab stickers with thick black outlines, extruded side depth, role-based color palettes like Riso/Matcha/Candy, and After Effects-grade motion keyframes like hop, bounce, wiggle, drift, twist, float, twinkle).
Current active project:
- Name: "${projectContext?.name || 'Untitled'}"
- Facing: ${projectContext?.facing || 'right'}
- Active Palette: ${projectContext?.paletteId || 'riso'}
- Motion Preset: ${projectContext?.motion.preset || 'wiggle'} (speed: ${projectContext?.motion.speed || 1}, intensity: ${projectContext?.motion.intensity || 1})
- Total Layers: ${projectContext?.layers.length || 0}

Help the user by suggesting creative color pairings, motion presets, layer arrangements, or isometric sticker prompt ideas. Be concise, developer-friendly, and sharp.`;

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
