import { describe, expect, it } from 'vitest';
import {
  applyMutation,
  beginGesture,
  canRedo,
  canUndo,
  createHistory,
  endGesture,
  redo,
  undo,
} from './history';

describe('history', () => {
  it('adds one undo entry per commit', () => {
    const start = createHistory({ value: 0 });
    const next = applyMutation(start, (state) => ({ value: state.value + 1 }), { label: 'Increment' }, 1000);

    expect(next.present.value).toBe(1);
    expect(next.past).toHaveLength(1);
    expect(next.label).toBe('Increment');
  });

  it('does not add history for live updates', () => {
    const start = createHistory({ value: 0 });
    const next = applyMutation(start, () => ({ value: 5 }), { mode: 'live' }, 1000);

    expect(next.present.value).toBe(5);
    expect(next.past).toHaveLength(0);
  });

  it('coalesces rapid changes with the same key', () => {
    let history = createHistory({ value: 0 });
    history = applyMutation(history, () => ({ value: 1 }), { mode: 'coalesce', key: 'slider' }, 1000);
    history = applyMutation(history, () => ({ value: 2 }), { mode: 'coalesce', key: 'slider' }, 1100);
    history = applyMutation(history, () => ({ value: 3 }), { mode: 'coalesce', key: 'slider' }, 1200);

    expect(history.present.value).toBe(3);
    expect(history.past).toHaveLength(1);
  });

  it('starts a new undo entry after the coalesce window', () => {
    let history = createHistory({ value: 0 });
    history = applyMutation(history, () => ({ value: 1 }), { mode: 'coalesce', key: 'slider' }, 1000);
    history = applyMutation(history, () => ({ value: 2 }), { mode: 'coalesce', key: 'slider' }, 2000);

    expect(history.past).toHaveLength(2);
  });

  it('drops a gesture that did not change anything', () => {
    const start = createHistory({ value: 0 });
    const began = beginGesture(start, 'Drag');
    const ended = endGesture(began);

    expect(ended.past).toHaveLength(0);
    expect(ended.present).toBe(start.present);
  });

  it('keeps a gesture that changed the project', () => {
    const start = createHistory({ value: 0 });
    const began = beginGesture(start, 'Drag');
    const moved = applyMutation(began, () => ({ value: 10 }), { mode: 'live' });
    const ended = endGesture(moved);

    expect(ended.past).toHaveLength(1);
    expect(undo(ended).present.value).toBe(0);
  });

  it('undoes and redoes with labels', () => {
    let history = createHistory({ value: 0 });
    history = applyMutation(history, () => ({ value: 1 }), { label: 'One' });
    history = applyMutation(history, () => ({ value: 2 }), { label: 'Two' });

    expect(canUndo(history)).toBe(true);
    const back = undo(history);
    expect(back.present.value).toBe(1);
    expect(canRedo(back)).toBe(true);

    const forward = redo(back);
    expect(forward.present.value).toBe(2);
  });

  it('caps history at 50 entries', () => {
    let history = createHistory({ value: 0 });
    for (let index = 1; index <= 60; index += 1) {
      history = applyMutation(history, () => ({ value: index }), { label: `Edit ${index}` });
    }

    expect(history.present.value).toBe(60);
    expect(history.past).toHaveLength(50);
  });

  it('ignores mutations that return the same reference', () => {
    const start = createHistory({ value: 0 });
    const next = applyMutation(start, (state) => state);

    expect(next).toBe(start);
  });
});
