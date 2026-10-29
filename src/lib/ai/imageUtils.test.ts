import { describe, expect, it } from 'vitest';
import { fileToDataUrl } from './imageUtils';

describe('fileToDataUrl', () => {
  it('converts a File to a data URL string', async () => {
    const file = new File(['mock content'], 'test.png', { type: 'image/png' });
    const dataUrl = await fileToDataUrl(file);
    expect(dataUrl).toMatch(/^data:image\/png;base64,/);
  });
});
