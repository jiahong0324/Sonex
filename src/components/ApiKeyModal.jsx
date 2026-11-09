import { useState } from 'react';
import { X, KeyRound, ExternalLink, ShieldCheck, Check } from 'lucide-react';

export default function ApiKeyModal({
  isOpen,
  onClose,
  apiKey,
  onKeyChange,
  saveKey,
  setSaveKey,
  hasEnvKey,
  showFeedback,
}) {
  const [tempKey, setTempKey] = useState(apiKey);
  const [showKey, setShowKey] = useState(false);

  if (!isOpen || hasEnvKey) return null;

  const handleSave = () => {
    onKeyChange(tempKey.trim());
    showFeedback('success', 'API Key updated.');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div className="bg-zinc-900 border border-zinc-800 rounded-2xl w-full max-w-md p-6 space-y-4 shadow-2xl">
        <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
          <div className="flex items-center gap-2">
            <KeyRound className="w-5 h-5 text-emerald-400" />
            <h3 className="text-base font-bold text-white">Groq API Key Settings</h3>
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
          <p className="text-xs text-zinc-400 leading-relaxed">
            Sonex connects directly from your browser to Groq's high-speed Whisper speech recognition endpoint. Your API key is never sent to any intermediary server.
          </p>

          <div className="relative">
            <input
              type={showKey ? 'text' : 'password'}
              placeholder="gsk_..."
              value={tempKey}
              onChange={(e) => setTempKey(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-4 pr-20 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 font-mono transition-all"
              autoFocus
            />
            <button
              type="button"
              onClick={() => setShowKey(!showKey)}
              className="absolute right-2 top-2 text-[10px] text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800"
            >
              {showKey ? 'Hide' : 'Show'}
            </button>
          </div>

          <div className="flex items-center justify-between text-xs text-zinc-400">
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={saveKey}
                onChange={(e) => setSaveKey(e.target.checked)}
                className="rounded bg-zinc-950 border-zinc-800 text-emerald-500 focus:ring-emerald-500"
              />
              <span>Remember in this browser</span>
            </label>

            <a
              href="https://console.groq.com/keys"
              target="_blank"
              rel="noreferrer"
              className="text-emerald-400 hover:underline flex items-center gap-1"
            >
              <span>Get API Key</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          </div>

          <div className="p-2.5 rounded-xl bg-zinc-950 border border-zinc-850 flex items-center gap-2 text-[11px] text-zinc-400">
            <ShieldCheck className="w-4 h-4 text-emerald-400 flex-shrink-0" />
            <span>Secure direct client-side transmission with TLS.</span>
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
            onClick={handleSave}
            className="px-4 py-2 rounded-xl text-xs font-bold bg-emerald-500 hover:bg-emerald-400 text-black flex items-center gap-1.5 transition-all shadow-lg shadow-emerald-500/20"
          >
            <Check className="w-4 h-4" />
            <span>Save Key</span>
          </button>
        </div>
      </div>
    </div>
  );
}
