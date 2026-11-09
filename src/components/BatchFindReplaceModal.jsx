import { useState } from 'react';
import { X, SlidersHorizontal, Check } from 'lucide-react';

export default function BatchFindReplaceModal({
  isOpen,
  onClose,
  captions,
  setCaptions,
  showFeedback,
}) {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [matchCase, setMatchCase] = useState(false);

  if (!isOpen) return null;

  // Calculate occurrences
  let matchCount = 0;
  if (findText.trim()) {
    captions.forEach((c) => {
      if (matchCase) {
        const matches = c.text.split(findText).length - 1;
        matchCount += matches;
      } else {
        const regex = new RegExp(findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
        const matches = (c.text.match(regex) || []).length;
        matchCount += matches;
      }
    });
  }

  const handleReplaceAll = () => {
    if (!findText.trim()) return;

    const regex = new RegExp(
      findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'),
      matchCase ? 'g' : 'gi'
    );

    const updated = captions.map((cap) => {
      if (regex.test(cap.text)) {
        const newText = cap.text.replace(regex, replaceText);
        return { ...cap, text: newText };
      }
      return cap;
    });

    setCaptions(updated);
    showFeedback('success', `Replaced ${matchCount} occurrence(s) across subtitles.`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Batch Find & Replace</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-zinc-400 font-semibold mb-1 block">Find text</label>
            <input
              type="text"
              placeholder="Word to search for..."
              value={findText}
              onChange={(e) => setFindText(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
              autoFocus
            />
          </div>

          <div>
            <label className="text-xs text-zinc-400 font-semibold mb-1 block">Replace with</label>
            <input
              type="text"
              placeholder="Replacement word..."
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-sm text-white focus:outline-none focus:ring-2 focus:ring-emerald-500 font-medium"
            />
          </div>

          <div className="flex items-center justify-between pt-1">
            <label className="flex items-center gap-2 text-xs text-zinc-300 cursor-pointer">
              <input
                type="checkbox"
                checked={matchCase}
                onChange={(e) => setMatchCase(e.target.checked)}
                className="rounded bg-zinc-950 border-zinc-800 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Match Case</span>
            </label>

            <span className="text-xs text-zinc-400 font-mono">
              Found: <strong className="text-emerald-400">{matchCount}</strong> match(es)
            </span>
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-800">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl text-xs font-semibold text-zinc-400 hover:text-white"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleReplaceAll}
            disabled={matchCount === 0}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              matchCount > 0
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Replace All ({matchCount})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
