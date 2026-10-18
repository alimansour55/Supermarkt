import { useCallback, useRef, useState } from 'react';

const LIMIT = 30;
/** Edits closer together than this (e.g. typing a label) become one undo step. */
const COALESCE_MS = 800;

/**
 * Undo / redo over one state value. `set` accepts a value or an updater.
 * `reset` replaces the value and clears history (used after load / discard).
 */
export default function useEditorHistory(initial) {
  const [state, setState] = useState({ past: [], present: initial, future: [] });
  const lastPush = useRef(0);

  const set = useCallback((next) => {
    setState((s) => {
      const value = typeof next === 'function' ? next(s.present) : next;
      if (value === s.present) return s;
      const now = Date.now();
      const coalesce = now - lastPush.current < COALESCE_MS && s.past.length > 0;
      lastPush.current = now;
      return {
        past: coalesce ? s.past : [...s.past, s.present].slice(-LIMIT),
        present: value,
        future: [],
      };
    });
  }, []);

  const undo = useCallback(() => {
    lastPush.current = 0;
    setState((s) => (s.past.length ? {
      past: s.past.slice(0, -1),
      present: s.past[s.past.length - 1],
      future: [s.present, ...s.future],
    } : s));
  }, []);

  const redo = useCallback(() => {
    lastPush.current = 0;
    setState((s) => (s.future.length ? {
      past: [...s.past, s.present],
      present: s.future[0],
      future: s.future.slice(1),
    } : s));
  }, []);

  const reset = useCallback((value) => {
    lastPush.current = 0;
    setState({ past: [], present: value, future: [] });
  }, []);

  return {
    value: state.present,
    set,
    undo,
    redo,
    reset,
    canUndo: state.past.length > 0,
    canRedo: state.future.length > 0,
  };
}
