import { useEffect } from 'react';

/**
 * Global keyboard shortcuts handler for Sonex Studio
 */
export function useKeyboardShortcuts({
  onTogglePlay,
  onSeekBackward,
  onSeekForward,
  onPrevCaption,
  onNextCaption,
  onUndo,
  onRedo,
  onOpenFindReplace,
  onOpenShortcuts,
}) {
  useEffect(() => {
    const handleKeyDown = (e) => {
      const activeTag = document.activeElement ? document.activeElement.tagName.toLowerCase() : '';
      const isInput = activeTag === 'input' || activeTag === 'textarea' || document.activeElement.isContentEditable;

      // Global shortcut: Ctrl+F (or Cmd+F) for Find & Replace
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        onOpenFindReplace?.();
        return;
      }

      // Global shortcut: Ctrl+Z for Undo
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'z') {
        if (!isInput) {
          e.preventDefault();
          onUndo?.();
          return;
        }
      }

      // Global shortcut: Ctrl+Y or Ctrl+Shift+Z for Redo
      if ((e.ctrlKey || e.metaKey) && (e.key.toLowerCase() === 'y' || (e.shiftKey && e.key.toLowerCase() === 'z'))) {
        if (!isInput) {
          e.preventDefault();
          onRedo?.();
          return;
        }
      }

      // If typing in input or textarea, don't trigger media player controls
      if (isInput) return;

      // Space: Play / Pause
      if (e.code === 'Space') {
        e.preventDefault();
        onTogglePlay?.();
        return;
      }

      // Left arrow: Seek backward 2s
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        onSeekBackward?.(2);
        return;
      }

      // Right arrow: Seek forward 2s
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        onSeekForward?.(2);
        return;
      }

      // [ or Alt+ArrowUp: Jump to previous caption
      if (e.key === '[' || (e.altKey && e.key === 'ArrowUp')) {
        e.preventDefault();
        onPrevCaption?.();
        return;
      }

      // ] or Alt+ArrowDown: Jump to next caption
      if (e.key === ']' || (e.altKey && e.key === 'ArrowDown')) {
        e.preventDefault();
        onNextCaption?.();
        return;
      }

      // ? key: Open shortcuts modal
      if (e.key === '?') {
        e.preventDefault();
        onOpenShortcuts?.();
        return;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    onTogglePlay,
    onSeekBackward,
    onSeekForward,
    onPrevCaption,
    onNextCaption,
    onUndo,
    onRedo,
    onOpenFindReplace,
    onOpenShortcuts,
  ]);
}
