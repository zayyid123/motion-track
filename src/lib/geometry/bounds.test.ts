import { describe, expect, it } from 'vitest';
import { boundsCenter, expandBounds, pointInBounds } from './bounds';

describe('bounds helpers', () => {
  const box = { minX: 10, minY: 20, maxX: 30, maxY: 40 };

  it('expands on every side', () => {
    expect(expandBounds(box, 5)).toEqual({ minX: 5, minY: 15, maxX: 35, maxY: 45 });
  });

  it('tests points inclusively', () => {
    expect(pointInBounds(box, 10, 20)).toBe(true);
    expect(pointInBounds(box, 30, 40)).toBe(true);
    expect(pointInBounds(box, 9.9, 20)).toBe(false);
    expect(pointInBounds(box, 30, 40.1)).toBe(false);
  });

  it('computes the center', () => {
    expect(boundsCenter(box)).toEqual([20, 30]);
  });
});
