import { Palette } from './sticker';

export const PALETTES: Record<string, Palette> = {
  riso: {
    id: 'riso',
    name: 'Riso (Default)',
    colors: {
      main: '#ff58a8', // Hot pink
      gold: '#ffe14a', // Sun yellow
      tint: '#ffd4e8', // Pale pink
      ok: '#15b9a6',   // Mint teal
      hot: '#ff7a1a',  // Bright orange
      deep: '#2b50e0', // Electric cobalt
      white: '#ffffff',
      grey: '#cccccc',
      paper: '#f7f7f7',
      ink: '#000000',
    },
  },
  candy: {
    id: 'candy',
    name: 'Candy (Lilac)',
    colors: {
      main: '#b49bff',
      gold: '#ffd9a8',
      tint: '#ece5ff',
      ok: '#7fdcc0',
      hot: '#ff8fb1',
      deep: '#6a5cff',
      white: '#ffffff',
      grey: '#cccccc',
      paper: '#f7f7f7',
      ink: '#000000',
    },
  },
  matcha: {
    id: 'matcha',
    name: 'Matcha (Pine)',
    colors: {
      main: '#6cc46f',
      gold: '#f2d16b',
      tint: '#e2f4d6',
      ok: '#2bb39a',
      hot: '#ff8a5b',
      deep: '#1f6b55',
      white: '#ffffff',
      grey: '#cccccc',
      paper: '#f7f7f7',
      ink: '#000000',
    },
  },
  sunset: {
    id: 'sunset',
    name: 'Sunset (Plum)',
    colors: {
      main: '#ff7a3d',
      gold: '#ffc94a',
      tint: '#ffe2d1',
      ok: '#2ec4b6',
      hot: '#ff4d6d',
      deep: '#6b2d91',
      white: '#ffffff',
      grey: '#cccccc',
      paper: '#f7f7f7',
      ink: '#000000',
    },
  },
  clay: {
    id: 'clay',
    name: 'Clay (Slate)',
    colors: {
      main: '#f0845f',
      gold: '#f4c463',
      tint: '#fde3d6',
      ok: '#7fb894',
      hot: '#e0533d',
      deep: '#3d5a80',
      white: '#ffffff',
      grey: '#cccccc',
      paper: '#f7f7f7',
      ink: '#000000',
    },
  },
  aqua: {
    id: 'aqua',
    name: 'Aqua (Teal)',
    colors: {
      main: '#22c3d3',
      gold: '#ffd75e',
      tint: '#d3f4f7',
      ok: '#3fc46a',
      hot: '#ff6f61',
      deep: '#0f5f73',
      white: '#ffffff',
      grey: '#cccccc',
      paper: '#f7f7f7',
      ink: '#000000',
    },
  },
  slush: {
    id: 'slush',
    name: 'Slush (Orange & Cobalt)',
    colors: {
      main: '#ff6b35', // Tangerine Orange
      gold: '#ffb703', // Warm Gold
      tint: '#dbeafe', // Sky Blue Tint
      ok: '#10b981',   // Mint
      hot: '#2563eb',  // Electric Cobalt Blue
      deep: '#1e3a8a', // Deep Navy
      white: '#ffffff',
      grey: '#cbd5e1',
      paper: '#ffffff',
      ink: '#111827',  // Charcoal Ink Outline
    },
  },
};

export const DEFAULT_AI_SETTINGS = {
  baseUrl: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o-mini',
};
