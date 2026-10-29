import { describe, expect, it } from 'vitest';
import { padlock } from '@/lib/funIsometric/icons';
import { PALETTES } from '@/lib/funIsometric/fun';
import type { StudioDoc } from '@/lib/projectFile';
import { applyAIActionsToDoc, centerComposition, parseAIResponse } from './actions';
import { FEW_SHOT_EXAMPLE, VISION_EXAMPLE, buildChatPayload, buildSystemPrompt, toApiMessages } from './prompt';
import type { ChatMessage } from './types';

const context = {
  icon: padlock,
  palette: PALETTES.slush,
  selectedLayerId: 'body',
};

const messages: ChatMessage[] = [
  { id: 'welcome', sender: 'ai', text: 'Hello', timestamp: 0 },
  { id: 'one', sender: 'user', text: 'Make it warmer', timestamp: 1 },
];

describe('AI prompt', () => {
  it('includes live project context and the preset catalogue', () => {
    const prompt = buildSystemPrompt(context);

    expect(prompt).toContain('Motion-Track AI Assistant');
    expect(prompt).toContain('padlock');
    expect(prompt).toContain('wiggle');
    expect(prompt).toContain('slush');
    expect(prompt).toContain('Selected layer');
    expect(prompt).toContain('body');
    expect(prompt).toContain('RESPONSE FORMAT — REQUIRED');
    expect(prompt).toContain('update_layer');
  });

  it('works without a project context', () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain('Untitled sticker');
    expect(prompt).toContain('no layers yet');
  });

  it('documents the fun-isometric house style and its presets', () => {
    const prompt = buildSystemPrompt(context);

    expect(prompt).toContain('FUN-ISOMETRIC HOUSE STYLE');
    expect(prompt).toContain('Faces lean');
    expect(prompt).toContain('50 to 60%');
    expect(prompt).toContain('MOTION (pick by VERB');
    // Presets added from the skill are offered to the model.
    expect(prompt).toContain('toss');
    expect(prompt).toContain('press');
    expect(prompt).toContain('jolt');
    expect(prompt).toContain('impact');
    expect(prompt).toContain('latch');
  });

  it('maps chat history and appends the new user turn', () => {
    const apiMessages = toApiMessages(messages, 'New request', context);

    expect(apiMessages[0].role).toBe('system');
    expect(apiMessages[1]).toEqual({ role: 'assistant', content: 'Hello' });
    expect(apiMessages[2]).toEqual({ role: 'user', content: 'Make it warmer' });
    expect(apiMessages[apiMessages.length - 1]).toEqual({ role: 'user', content: 'New request' });
  });

  it('uses message.raw for assistant history when available', () => {
    const rawJson = '{"reply":"Done","actions":[]}';
    const rawMessages: ChatMessage[] = [
      { id: '1', sender: 'ai', text: 'Done', raw: rawJson, timestamp: 1 },
    ];
    const apiMessages = toApiMessages(rawMessages, 'Next request', context);
    expect(apiMessages[1]).toEqual({ role: 'assistant', content: rawJson });
  });

  it('builds an OpenAI-compatible payload with a model fallback', () => {
    const payload = buildChatPayload('', messages, 'Hello', context);

    expect(payload.model).toBe('gpt-4o-mini');
    expect(payload.temperature).toBe(0.7);
    expect(payload.stream).toBe(false);
    expect(payload.messages[0].role).toBe('system');
  });

  it('formats user image into multimodal content in payload and history', () => {
    const historyWithImage: ChatMessage[] = [
      {
        id: 'img-1',
        sender: 'user',
        text: 'Look at this',
        image: 'data:image/png;base64,aaa',
        timestamp: 1,
      },
    ];

    const apiMessages = toApiMessages(
      historyWithImage,
      'Make a sticker from this',
      context,
      'data:image/png;base64,bbb'
    );

    // History item with image
    expect(apiMessages[1]).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'Look at this' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,aaa' } },
      ],
    });

    // Current turn with image
    expect(apiMessages[apiMessages.length - 1]).toEqual({
      role: 'user',
      content: [
        { type: 'text', text: 'Make a sticker from this' },
        { type: 'image_url', image_url: { url: 'data:image/png;base64,bbb' } },
      ],
    });
  });

  const applyExample = (example: string) => {
    const json = example.slice(example.indexOf('{'));
    const parsed = parseAIResponse(json);
    expect(parsed.warnings).toEqual([]);

    const doc: StudioDoc = {
      icon: { name: 'Untitled', frames: 180, line: 5, layers: [] },
      paletteId: 'slush',
      palette: { ...PALETTES.slush },
      facing: 'right',
      outlineWidth: 5,
    };

    let n = 0;
    const result = applyAIActionsToDoc(doc, parsed.actions, (prefix) => `${prefix}-${(n += 1)}`);
    expect(result.skipped).toEqual([]);

    const group = result.doc.icon.layers.find((layer) => layer.isGroup);
    expect(group).toBeDefined();

    const art = result.doc.icon.layers.filter((layer) => !layer.isGroup);
    expect(art.length).toBeGreaterThan(0);
    for (const layer of art) {
      expect(layer.groupId).toBe(group?.id);
      // Children omit position and sit at the local origin so they ride the group.
      expect(layer.p).toEqual([0, 0]);
    }

    // The generative batch fits and centers the composition on (250,250).
    expect(centerComposition(result.doc.icon)).toBe(result.doc.icon);
    return result;
  };

  it('keeps the generative few-shot example valid, grouped and centered', () => {
    applyExample(FEW_SHOT_EXAMPLE);
  });

  it('keeps the vision few-shot example valid, grouped and centered', () => {
    const result = applyExample(VISION_EXAMPLE);
    // The headphone recipe uses the arch band.
    expect(result.doc.icon.layers.some((layer) => layer.shapes.some((shape) => String(shape.d).includes('A')))).toBe(true);
  });
});
