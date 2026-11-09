import {
  Sparkles,
  Layers,
  Palette,
  FileDown,
  UploadCloud,
  Keyboard,
  RotateCcw,
  KeyRound,
} from 'lucide-react';

export default function Header({
  activeTab,
  setActiveTab,
  captionsCount,
  videoFile,
  apiKey,
  onOpenShortcuts,
  onOpenImport,
  onResetProject,
  onOpenApiKeyModal,
}) {
  return (
    <header className="border-b border-zinc-800/80 bg-zinc-950/90 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-7xl mx-auto px-4 py-3 flex flex-wrap items-center justify-between gap-4">
        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="relative group cursor-pointer" onClick={() => setActiveTab('studio')}>
            <div className="w-10 h-10 rounded-xl overflow-hidden shadow-lg shadow-emerald-500/20 border border-emerald-500/30 group-hover:scale-105 transition-transform">
              <img src="/logo.png" alt="Sonex Logo" className="w-full h-full object-cover" />
            </div>
            <span className="absolute -bottom-1 -right-1 w-3 h-3 bg-emerald-500 border-2 border-zinc-950 rounded-full" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-lg font-black tracking-tight text-white flex items-center gap-1.5">
                Sonex <span className="text-emerald-400">Studio Pro</span>
              </h1>
              <span className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                v2.0
              </span>
            </div>
            <p className="text-[11px] text-zinc-400 font-medium">
              Next-Gen AI Subtitles & Social Media Video Studio
            </p>
          </div>
        </div>

        {/* Workflow Tabs */}
        <nav className="flex items-center bg-zinc-900/90 p-1 rounded-xl border border-zinc-800 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('studio')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'studio'
                ? 'bg-emerald-500 text-black shadow-md font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Studio</span>
            {captionsCount > 0 && (
              <span
                className={`text-[10px] px-1.5 rounded-full ${
                  activeTab === 'studio' ? 'bg-black/30 text-black' : 'bg-zinc-800 text-zinc-300'
                }`}
              >
                {captionsCount}
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('style')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'style'
                ? 'bg-emerald-500 text-black shadow-md font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Palette className="w-3.5 h-3.5" />
            <span>Styles</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('transcribe')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'transcribe'
                ? 'bg-emerald-500 text-black shadow-md font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5" />
            <span>AI Transcribe</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('export')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all ${
              activeTab === 'export'
                ? 'bg-emerald-500 text-black shadow-md font-bold'
                : 'text-zinc-400 hover:text-zinc-200'
            }`}
          >
            <FileDown className="w-3.5 h-3.5" />
            <span>Export & Burn</span>
          </button>
        </nav>

        {/* Global Toolbar Actions */}
        <div className="flex items-center gap-2">
          {/* API Key Status Pill */}
          <button
            type="button"
            onClick={onOpenApiKeyModal}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border text-xs transition-all ${
              apiKey
                ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20'
                : 'border-amber-500/30 bg-amber-500/10 text-amber-400 hover:bg-amber-500/20 animate-pulse'
            }`}
            title="Configure Groq Whisper API Key"
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span className="hidden sm:inline font-mono">
              {apiKey ? 'API Connected' : 'Set API Key'}
            </span>
          </button>

          {/* Import SRT/VTT */}
          <button
            type="button"
            onClick={onOpenImport}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-300 hover:text-white hover:border-zinc-700 text-xs transition-all"
            title="Import existing SRT or VTT file"
          >
            <UploadCloud className="w-3.5 h-3.5" />
            <span className="hidden md:inline">Import Subtitles</span>
          </button>

          {/* Keyboard Shortcuts */}
          <button
            type="button"
            onClick={onOpenShortcuts}
            className="p-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-white hover:border-zinc-700 transition-all"
            title="Keyboard shortcuts (?)"
          >
            <Keyboard className="w-4 h-4" />
          </button>

          {/* Reset Project */}
          {(videoFile || captionsCount > 0) && (
            <button
              type="button"
              onClick={onResetProject}
              className="p-1.5 rounded-xl border border-zinc-800 bg-zinc-900 text-zinc-400 hover:text-rose-400 hover:border-rose-900/60 transition-all"
              title="Reset current project"
            >
              <RotateCcw className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
