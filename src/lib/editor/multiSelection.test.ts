import { describe, expect, it } from 'vitest';
import React, { act } from 'react';
import { createRoot } from 'react-dom/client';
import { useStudioState, type StudioState } from './useStudioState';
import { PlaybackClock } from './clock';
import { renderInteractiveSticker } from '../interactiveEngine';
import type { Icon } from '../funIsometric/fun';

function setupStudioHook() {
  const clock = new PlaybackClock();
  let state!: StudioState;

  function TestComponent() {
    state = useStudioState(clock);
    return null;
  }

  const container = document.createElement('div');
  document.body.appendChild(container);
  const root = createRoot(container);

  act(() => {
    root.render(React.createElement(TestComponent));
  });

  return {
    getState: () => state,
    cleanup: () => {
      act(() => {
        root.unmount();
      });
      container.remove();
    },
  };
}

describe('multi-layer selection and manipulation', () => {
  it('toggles selection and supports selecting all and clearing selection', () => {
    const { getState, cleanup } = setupStudioHook();

    expect(getState().selectedLayerIds.length).toBeGreaterThan(0);

    // Clear selection
    act(() => {
      getState().actions.clearSelection();
    });
    expect(getState().selectedLayerIds).toEqual([]);
    expect(getState().selectedLayerId).toBeNull();

    // Select single layer
    act(() => {
      getState().actions.toggleSelectLayer('layer-a', false);
    });
    expect(getState().selectedLayerIds).toEqual(['layer-a']);
    expect(getState().selectedLayerId).toBe('layer-a');

    // Add another layer additively
    act(() => {
      getState().actions.toggleSelectLayer('layer-b', true);
    });
    expect(getState().selectedLayerIds).toEqual(['layer-a', 'layer-b']);

    // Toggling already selected removes it
    act(() => {
      getState().actions.toggleSelectLayer('layer-a', true);
    });
    expect(getState().selectedLayerIds).toEqual(['layer-b']);

    // Select all layers
    act(() => {
      getState().actions.selectAllLayers();
    });
    const allDocLayerIds = getState().icon.layers.map((l) => l.id || '').filter(Boolean);
    expect(getState().selectedLayerIds).toEqual(allDocLayerIds);

    cleanup();
  });

  it('moves multiple selected layers together in moveLayersLive', () => {
    const { getState, cleanup } = setupStudioHook();

    const layers = getState().icon.layers;
    const l1 = layers[0];
    const l2 = layers[1];
    expect(l1).toBeDefined();
    expect(l2).toBeDefined();

    const initialP1 = Array.isArray(l1.p) ? [...l1.p] : [250, 250];
    const initialP2 = Array.isArray(l2.p) ? [...l2.p] : [250, 250];

    act(() => {
      getState().actions.moveLayersLive([l1.id!, l2.id!], 15, -10);
    });

    const updatedLayers = getState().icon.layers;
    const updatedL1 = updatedLayers.find((l) => l.id === l1.id)!;
    const updatedL2 = updatedLayers.find((l) => l.id === l2.id)!;

    expect(updatedL1.p).toEqual([initialP1[0] + 15, initialP1[1] - 10]);
    expect(updatedL2.p).toEqual([initialP2[0] + 15, initialP2[1] - 10]);

    cleanup();
  });

  it('deletes multiple selected layers simultaneously', () => {
    const { getState, cleanup } = setupStudioHook();

    const initialCount = getState().icon.layers.length;
    const idsToDelete = [getState().icon.layers[0].id!, getState().icon.layers[1].id!];

    act(() => {
      getState().actions.deleteLayers(idsToDelete);
    });

    expect(getState().icon.layers.length).toBe(initialCount - 2);
    expect(getState().icon.layers.some((l) => l.id && idsToDelete.includes(l.id))).toBe(false);

    cleanup();
  });

  it('renders interactive sticker with multiple selectedLayerIds without errors', () => {
    if (typeof globalThis.DOMMatrix === 'undefined') {
      class MockDOMMatrix {
        a = 1; b = 0; c = 0; d = 1; e = 0; f = 0;
        constructor(init?: readonly number[] | number[]) {
          if (init && init.length >= 6) {
            this.a = init[0]; this.b = init[1]; this.c = init[2];
            this.d = init[3]; this.e = init[4]; this.f = init[5];
          }
        }
        multiply() {
          return new MockDOMMatrix();
        }
      }
      // @ts-expect-error polyfill for jsdom environment test
      globalThis.DOMMatrix = MockDOMMatrix;
    }

    if (typeof globalThis.Path2D === 'undefined') {
      class MockPath2D {
        addPath() {}
      }
      // @ts-expect-error polyfill for jsdom environment test
      globalThis.Path2D = MockPath2D;
    }

    const ctx = {
      clearRect: () => {},
      save: () => {},
      restore: () => {},
      scale: () => {},
      transform: () => {},
      getTransform: () => new globalThis.DOMMatrix(),
      setTransform: () => {},
      strokeRect: () => {},
      fillRect: () => {},
      beginPath: () => {},
      closePath: () => {},
      arc: () => {},
      roundRect: () => {},
      moveTo: () => {},
      lineTo: () => {},
      stroke: () => {},
      fill: () => {},
      setLineDash: () => {},
    } as unknown as CanvasRenderingContext2D;

    const testIcon: Icon = {
      name: 'test',
      frames: 60,
      size: 500,
      layers: [
        { id: 'l1', shapes: [{ d: 'M 0 0 L 50 50 Z', fill: 'main' }], p: [250, 250] },
        { id: 'l2', shapes: [{ d: 'M 10 10 L 60 60 Z', fill: 'hot' }], p: [200, 200] },
      ],
    };

    expect(() => {
      renderInteractiveSticker(ctx, testIcon, {
        frame: 0,
        showHelpers: true,
        selectedLayerId: 'l1',
        selectedLayerIds: ['l1', 'l2'],
      });
    }).not.toThrow();
  });
});
