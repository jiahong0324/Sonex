import { useState, useCallback } from 'react';

/**
 * Hook to manage state with Undo / Redo history
 */
export function useHistory(initialPresent) {
  const [past, setPast] = useState([]);
  const [present, setPresent] = useState(initialPresent);
  const [future, setFuture] = useState([]);

  const canUndo = past.length > 0;
  const canRedo = future.length > 0;

  const undo = useCallback(() => {
    if (!canUndo) return;

    const previous = past[past.length - 1];
    const newPast = past.slice(0, past.length - 1);

    setPast(newPast);
    setFuture([present, ...future]);
    setPresent(previous);
  }, [canUndo, past, present, future]);

  const redo = useCallback(() => {
    if (!canRedo) return;

    const next = future[0];
    const newFuture = future.slice(1);

    setPast([...past, present]);
    setPresent(next);
    setFuture(newFuture);
  }, [canRedo, past, present, future]);

  const set = useCallback(
    (newPresent, recordHistory = true) => {
      if (typeof newPresent === 'function') {
        setPresent((current) => {
          const resolved = newPresent(current);
          if (recordHistory) {
            setPast((prevPast) => [...prevPast.slice(-30), current]); // keep up to 30 history steps
            setFuture([]);
          }
          return resolved;
        });
      } else {
        if (recordHistory) {
          setPast((prevPast) => [...prevPast.slice(-30), present]);
          setFuture([]);
        }
        setPresent(newPresent);
      }
    },
    [present]
  );

  const reset = useCallback((newPresent) => {
    setPast([]);
    setFuture([]);
    setPresent(newPresent);
  }, []);

  return [present, set, { undo, redo, canUndo, canRedo, reset }];
}
