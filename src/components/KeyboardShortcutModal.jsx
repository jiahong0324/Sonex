import { X, Keyboard } from 'lucide-react';

export default function KeyboardShortcutModal({ isOpen, onClose }) {
  if (!isOpen) return null;

  const shortcuts = [
    { key: 'Space', desc: 'Play / Pause Video' },
    { key: '← / →', desc: 'Seek Backward / Forward 2 Seconds' },
    { key: '[ / ]', desc: 'Jump to Previous / Next Subtitle Block' },
    { key: 'Ctrl + Z', desc: 'Undo Subtitle Edit' },
    { key: 'Ctrl + Y', desc: 'Redo Subtitle Edit' },
    { key: 'Ctrl + F', desc: 'Open Batch Find & Replace' },
    { key: '?', desc: 'Show Keyboard Shortcuts' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <Keyboard className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Keyboard Shortcuts</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="divide-y divide-zinc-850 text-xs">
          {shortcuts.map((s) => (
            <div key={s.key} className="py-2.5 flex items-center justify-between">
              <span className="text-zinc-300 font-medium">{s.desc}</span>
              <kbd className="px-2 py-1 rounded-lg bg-zinc-950 border border-zinc-800 font-mono text-emerald-400 font-bold shadow-sm">
                {s.key}
              </kbd>
            </div>
          ))}
        </div>

        <div className="pt-2 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-zinc-800 hover:bg-zinc-700 text-white transition-all"
          >
            Got it
          </button>
        </div>
      </div>
    </div>
  );
}
