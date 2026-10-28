import { Palette } from './sticker';

export const PALETTES: Record<string, Palette> = {
  slush: {
    id: 'slush',
    name: 'Slush (Signature)',
    colors: {
      main: '#ff6b35', // Tangerine Orange
      gold: '#ffb703', // Warm Gold
      tint: '#dbeafe', // Sky Blue Tint
      ok: '#10b981',   // Mint
      hot: '#2563eb',  // Electric Cobalt Blue
      deep: '#1e3a8a', // Deep Navy
      paper: '#ffffff',
      ink: '#111827',  // Charcoal Ink Outline
    },
  },
  riso: {
    id: 'riso',
    name: 'Riso Classic',
    colors: {
      main: '#2563eb', // Electric Blue
      gold: '#f59e0b', // Sunflower
      tint: '#e0f2fe', // Soft Ice Blue
      ok: '#059669',   // Green
      hot: '#ea580c',  // Deep Tangerine
      deep: '#1e293b', // Slate Dark
      paper: '#ffffff',
      ink: '#0f172a',
    },
  },
  sunset: {
    id: 'sunset',
    name: 'Warm Ember',
    colors: {
      main: '#f97316', // Orange
      gold: '#fbbf24',
      tint: '#ffedd5', // Warm peach
      ok: '#0d9488',
      hot: '#2563eb',  // Blue accent
      deep: '#334155',
      paper: '#ffffff',
      ink: '#18181b',
    },
  },
  matcha: {
    id: 'matcha',
    name: 'Matcha & Blue',
    colors: {
      main: '#10b981',
      gold: '#f59e0b',
      tint: '#d1fae5',
      ok: '#059669',
      hot: '#2563eb',
      deep: '#064e3b',
      paper: '#ffffff',
      ink: '#111827',
    },
  },
  mono: {
    id: 'mono',
    name: 'Slate Minimal',
    colors: {
      main: '#3b82f6',
      gold: '#94a3b8',
      tint: '#f1f5f9',
      ok: '#64748b',
      hot: '#f97316',
      deep: '#1e293b',
      paper: '#ffffff',
      ink: '#09090b',
    },
  },
};

export const DEFAULT_AI_SETTINGS = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
};
