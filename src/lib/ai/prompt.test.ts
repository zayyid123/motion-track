import { describe, expect, it } from 'vitest';
import { padlock } from '@/lib/funIsometric/icons';
import { PALETTES } from '@/lib/funIsometric/fun';
import { buildChatPayload, buildSystemPrompt, toApiMessages } from './prompt';
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

  it('maps chat history and appends the new user turn', () => {
    const apiMessages = toApiMessages(messages, 'New request', context);

    expect(apiMessages[0].role).toBe('system');
    expect(apiMessages[1]).toEqual({ role: 'assistant', content: 'Hello' });
    expect(apiMessages[2]).toEqual({ role: 'user', content: 'Make it warmer' });
    expect(apiMessages[apiMessages.length - 1]).toEqual({ role: 'user', content: 'New request' });
  });

  it('builds an OpenAI-compatible payload with a model fallback', () => {
    const payload = buildChatPayload('', messages, 'Hello', context);

    expect(payload.model).toBe('gpt-4o-mini');
    expect(payload.temperature).toBe(0.7);
    expect(payload.stream).toBe(false);
    expect(payload.messages[0].role).toBe('system');
  });
});
