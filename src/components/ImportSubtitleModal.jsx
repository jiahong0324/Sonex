import { useState, useRef } from 'react';
import { X, UploadCloud, FileText, Check } from 'lucide-react';
import { parseSubtitleFile } from '../utils/srtParser';

export default function ImportSubtitleModal({
  isOpen,
  onClose,
  setCaptions,
  showFeedback,
}) {
  const [fileName, setFileName] = useState('');
  const [parsedCaptions, setParsedCaptions] = useState([]);
  const fileInputRef = useRef(null);

  if (!isOpen) return null;

  const handleFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        const parsed = parseSubtitleFile(text);
        setParsedCaptions(parsed);
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = () => {
    if (parsedCaptions.length === 0) {
      showFeedback('error', 'Could not parse any valid subtitle blocks from this file.');
      return;
    }

    setCaptions(parsedCaptions);
    showFeedback('success', `Imported ${parsedCaptions.length} captions from ${fileName}`);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-lg p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <UploadCloud className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Import Subtitles (.SRT / .VTT)</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-zinc-400 hover:text-white hover:bg-zinc-800 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* File Dropzone */}
        <div
          onClick={() => fileInputRef.current?.click()}
          className="border-2 border-dashed border-zinc-700 hover:border-emerald-500/50 bg-zinc-950 p-6 rounded-2xl text-center cursor-pointer transition-all space-y-2"
        >
          <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-zinc-800 flex items-center justify-center text-emerald-400 mx-auto">
            <FileText className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs font-bold text-white">
              {fileName || 'Click to select or drop .srt or .vtt file'}
            </p>
            <p className="text-[11px] text-zinc-500 mt-0.5">
              Load existing subtitles directly into Sonex without re-transcribing
            </p>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileChange}
            accept=".srt,.vtt,text/plain"
            className="hidden"
          />
        </div>

        {/* Parsed Preview */}
        {parsedCaptions.length > 0 && (
          <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between text-xs text-zinc-300 font-semibold">
              <span>Preview Subtitles:</span>
              <span className="text-emerald-400 font-mono font-bold">
                {parsedCaptions.length} Blocks Detected
              </span>
            </div>
            <div className="max-h-28 overflow-y-auto custom-scrollbar text-[11px] text-zinc-400 space-y-1 pr-1 font-mono">
              {parsedCaptions.slice(0, 5).map((c) => (
                <div key={c.id} className="truncate">
                  #{c.id} [{c.startStr}] {c.text}
                </div>
              ))}
              {parsedCaptions.length > 5 && (
                <div className="text-zinc-600 italic">
                  ...and {parsedCaptions.length - 5} more blocks
                </div>
              )}
            </div>
          </div>
        )}

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
            onClick={handleConfirmImport}
            disabled={parsedCaptions.length === 0}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
              parsedCaptions.length > 0
                ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-lg shadow-emerald-500/20'
                : 'bg-zinc-800 text-zinc-500 cursor-not-allowed'
            }`}
          >
            <Check className="w-4 h-4" />
            <span>Load into Studio ({parsedCaptions.length})</span>
          </button>
        </div>
      </div>
    </div>
  );
}
