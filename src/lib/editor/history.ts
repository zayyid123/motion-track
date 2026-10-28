export interface HistorySnapshot<T> {
  state: T;
  label: string;
}

export interface HistoryState<T> {
  past: HistorySnapshot<T>[];
  present: T;
  future: HistorySnapshot<T>[];
  /** Label for the current state, used by undo/redo tooltips. */
  label: string;
  /** Coalescing bookkeeping for sliders and text inputs. */
  lastKey: string | null;
  lastAt: number;
}

export type MutationMode = 'commit' | 'live' | 'coalesce';

export interface MutationOptions {
  mode?: MutationMode;
  label?: string;
  /** Identical keys within `coalesceMs` collapse into a single undo entry. */
  key?: string;
  coalesceMs?: number;
}

export const HISTORY_LIMIT = 50;

const cap = <T>(items: HistorySnapshot<T>[]): HistorySnapshot<T>[] =>
  items.length > HISTORY_LIMIT ? items.slice(items.length - HISTORY_LIMIT) : items;

export function createHistory<T>(initial: T, label = 'Initial'): HistoryState<T> {
  return { past: [], present: initial, future: [], label, lastKey: null, lastAt: 0 };
}

/**
 * Applies an immutable updater.
 *
 * - `commit` adds one undo entry.
 * - `live` updates the present without touching history (used during pointer drags).
 * - `coalesce` adds one undo entry for the first change in a short window and then
 *   keeps updating the present, which keeps sliders/typing from flooding history.
 */
export function applyMutation<T>(
  history: HistoryState<T>,
  updater: (current: T) => T,
  options: MutationOptions = {},
  now = Date.now()
): HistoryState<T> {
  const next = updater(history.present);
  if (Object.is(next, history.present)) return history;

  const { mode = 'commit', label = 'Edit', key = null, coalesceMs = 450 } = options;

  if (mode === 'live') {
    return { ...history, present: next };
  }

  if (mode === 'coalesce' && key && history.lastKey === key && now - history.lastAt <= coalesceMs) {
    return { ...history, present: next, lastAt: now, label };
  }

  return {
    past: cap([...history.past, { state: history.present, label: history.label }]),
    present: next,
    future: [],
    label,
    lastKey: key,
    lastAt: now,
  };
}

/** Starts a pointer gesture: the current state becomes one undo entry. */
export function beginGesture<T>(history: HistoryState<T>, label = 'Transform'): HistoryState<T> {
  return {
    past: cap([...history.past, { state: history.present, label: history.label }]),
    present: history.present,
    future: [],
    label,
    lastKey: null,
    lastAt: 0,
  };
}

/** Ends a gesture, dropping the undo entry when nothing actually changed. */
export function endGesture<T>(history: HistoryState<T>, label?: string): HistoryState<T> {
  const top = history.past[history.past.length - 1];
  if (top && Object.is(top.state, history.present)) {
    return {
      ...history,
      past: history.past.slice(0, -1),
      label: top.label,
    };
  }
  return { ...history, label: label ?? history.label, lastKey: null, lastAt: 0 };
}

export function undo<T>(history: HistoryState<T>): HistoryState<T> {
  const top = history.past[history.past.length - 1];
  if (!top) return history;
  return {
    past: history.past.slice(0, -1),
    present: top.state,
    future: [{ state: history.present, label: history.label }, ...history.future],
    label: top.label,
    lastKey: null,
    lastAt: 0,
  };
}

export function redo<T>(history: HistoryState<T>): HistoryState<T> {
  const next = history.future[0];
  if (!next) return history;
  return {
    past: cap([...history.past, { state: history.present, label: history.label }]),
    present: next.state,
    future: history.future.slice(1),
    label: next.label,
    lastKey: null,
    lastAt: 0,
  };
}

export const canUndo = <T>(history: HistoryState<T>): boolean => history.past.length > 0;
export const canRedo = <T>(history: HistoryState<T>): boolean => history.future.length > 0;
