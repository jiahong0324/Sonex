import { useState } from 'react';
import {
  Sparkles,
  KeyRound,
  Cpu,
  Globe2,
  FileText,
  ExternalLink,
  ShieldCheck,
  Zap,
  HardDrive,
} from 'lucide-react';
import { LANGUAGES } from '../utils/constants';

export default function TranscriptionSettings({
  transcriptionMode,
  setTranscriptionMode,
  apiKey,
  onKeyChange,
  saveKey,
  setSaveKey,
  hasEnvKey,
  localModel,
  setLocalModel,
  preferredDevice,
  setPreferredDevice,
  transcriptionTask,
  setTranscriptionTask,
  selectedModel,
  setSelectedModel,
  selectedLanguage,
  setSelectedLanguage,
  customPrompt,
  setCustomPrompt,
  isProcessing,
  processStep,
  processProgress,
  onGenerateCaptions,
  videoFile,
}) {
  const [showKey, setShowKey] = useState(false);

  return (
    <div className="space-y-6">
      {/* Intro Card */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">AI Transcription Engine</h2>
          </div>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
            WebGPU + Whisper
          </span>
        </div>
        <p className="text-xs text-zinc-400">
          Run OpenAI Whisper directly inside your web browser. Zero server upload, zero cost, no registration required. Optional Groq Cloud mode available for users with their own API keys.
        </p>
      </div>

      {/* Engine Mode Toggle (Local WebGPU vs Groq Cloud) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <button
          type="button"
          onClick={() => setTranscriptionMode('local')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            transcriptionMode === 'local'
              ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/5'
              : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <HardDrive className="w-4 h-4 text-emerald-400" />
              <span className="font-bold text-sm text-white">Browser Local Mode</span>
            </div>
            <span className="text-[10px] bg-emerald-500/20 text-emerald-300 px-2 py-0.5 rounded-full font-bold">
              Recommended • Free
            </span>
          </div>
          <p className="text-xs text-zinc-400 leading-snug">
            Runs client-side via WebGPU/WASM. Audio never leaves your computer. No API Key or account needed.
          </p>
        </button>

        <button
          type="button"
          onClick={() => setTranscriptionMode('cloud')}
          className={`p-4 rounded-2xl border text-left transition-all ${
            transcriptionMode === 'cloud'
              ? 'border-emerald-500 bg-emerald-500/10 shadow-lg shadow-emerald-500/5'
              : 'border-zinc-800 bg-zinc-900/40 text-zinc-400 hover:border-zinc-700'
          }`}
        >
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-2">
              <Zap className="w-4 h-4 text-teal-400" />
              <span className="font-bold text-sm text-white">Groq Cloud Turbo Mode</span>
            </div>
            <span className="text-[10px] bg-zinc-800 text-zinc-300 px-2 py-0.5 rounded-full font-bold">
              Requires API Key
            </span>
          </div>
          <p className="text-xs text-zinc-400 leading-snug">
            Ultra-fast sub-second recognition using Whisper Large v3 on Groq LPU™. Requires your own free key.
          </p>
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Local or Cloud Settings */}
        <div className="lg:col-span-7 space-y-5">
          {/* LOCAL MODE CONFIGURATION */}
          {transcriptionMode === 'local' ? (
            <>
              {/* Local Model Selector */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>1. Select Local Whisper Model</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setLocalModel('onnx-community/whisper-tiny_timestamped')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      localModel === 'onnx-community/whisper-tiny_timestamped'
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-bold text-xs text-white mb-0.5">Whisper Tiny</div>
                    <div className="text-[10px] text-emerald-400 font-mono">~40 MB • Fast</div>
                    <p className="text-[10px] text-zinc-500 mt-1">Recommended for mobile and quick previews.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLocalModel('onnx-community/whisper-base_timestamped')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      localModel === 'onnx-community/whisper-base_timestamped'
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-bold text-xs text-white mb-0.5">Whisper Base</div>
                    <div className="text-[10px] text-teal-400 font-mono">~75 MB • Balanced</div>
                    <p className="text-[10px] text-zinc-500 mt-1">Great balance of accuracy and speed.</p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setLocalModel('onnx-community/whisper-small_timestamped')}
                    className={`p-3 rounded-xl border text-left transition-all ${
                      localModel === 'onnx-community/whisper-small_timestamped'
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-bold text-xs text-white mb-0.5">Whisper Small</div>
                    <div className="text-[10px] text-purple-400 font-mono">~240 MB • High Acc</div>
                    <p className="text-[10px] text-zinc-500 mt-1">Highest accuracy for dense speech.</p>
                  </button>
                </div>
              </div>

              {/* Hardware Acceleration & Task Selection */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Hardware Device */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400">Hardware Acceleration</label>
                    <select
                      value={preferredDevice}
                      onChange={(e) => setPreferredDevice(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="auto">Auto (WebGPU first, WASM fallback)</option>
                      <option value="webgpu">Force WebGPU (Hardware GPU)</option>
                      <option value="wasm">Force CPU / WASM</option>
                    </select>
                  </div>

                  {/* Task (Transcribe vs Translate) */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-bold text-zinc-400">Task Mode</label>
                    <select
                      value={transcriptionTask}
                      onChange={(e) => setTranscriptionTask(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                    >
                      <option value="transcribe">Transcribe (Speech to same language)</option>
                      <option value="translate">Translate (Translate audio to English)</option>
                    </select>
                  </div>
                </div>

                <div className="flex items-center gap-2 text-[11px] text-emerald-400 bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/20">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>Word-level timestamps & automatic 45s hang recovery are active.</span>
                </div>
              </div>
            </>
          ) : (
            /* CLOUD MODE CONFIGURATION */
            <>
              {!hasEnvKey && (
                <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                      <KeyRound className="w-4 h-4 text-emerald-400" />
                      <span>Groq API Key</span>
                    </label>
                    <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveKey}
                        onChange={(e) => setSaveKey(e.target.checked)}
                        className="rounded bg-zinc-950 border-zinc-800 text-emerald-500 focus:ring-emerald-500"
                      />
                      <span>Remember key</span>
                    </label>
                  </div>

                  <div className="relative">
                    <input
                      type={showKey ? 'text' : 'password'}
                      placeholder="gsk_..."
                      value={apiKey}
                      onChange={(e) => onKeyChange(e.target.value)}
                      className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-4 pr-24 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:border-emerald-500 font-mono"
                    />
                    <div className="absolute right-2 top-2 flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setShowKey(!showKey)}
                        className="text-[10px] text-zinc-400 hover:text-white px-2 py-1 rounded bg-zinc-800"
                      >
                        {showKey ? 'Hide' : 'Show'}
                      </button>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[11px] text-zinc-500">
                    <div className="flex items-center gap-1 text-emerald-400/90">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      <span>Stored only in browser localStorage</span>
                    </div>
                    <a
                      href="https://console.groq.com/keys"
                      target="_blank"
                      rel="noreferrer"
                      className="text-zinc-400 hover:text-emerald-400 flex items-center gap-1 underline underline-offset-2"
                    >
                      <span>Get Free Groq Key</span>
                      <ExternalLink className="w-3 h-3" />
                    </a>
                  </div>
                </div>
              )}

              {/* Cloud Model Selector */}
              <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
                <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                  <Cpu className="w-4 h-4 text-emerald-400" />
                  <span>Select Cloud Model</span>
                </label>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setSelectedModel('whisper-large-v3')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      selectedModel === 'whisper-large-v3'
                        ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-md'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-white">Whisper Large v3</span>
                      <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                        Pro Max
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      Maximum multilingual accuracy for complex audio.
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedModel('whisper-large-v3-turbo')}
                    className={`p-3.5 rounded-xl border text-left transition-all ${
                      selectedModel === 'whisper-large-v3-turbo'
                        ? 'border-emerald-500 bg-emerald-500/10 text-white shadow-md'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="font-bold text-sm text-white">Whisper v3 Turbo</span>
                      <span className="text-[10px] bg-teal-500/20 text-teal-300 px-2 py-0.5 rounded-full font-bold">
                        Turbo
                      </span>
                    </div>
                    <p className="text-[11px] text-zinc-400 leading-snug">
                      Blazing sub-second inference response speed.
                    </p>
                  </button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Right Column: Spoken Language, Glossary & Trigger */}
        <div className="lg:col-span-5 space-y-5">
          {/* Language Selection */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-emerald-400" />
              <span>Target Spoken Language</span>
            </label>

            <select
              value={selectedLanguage}
              onChange={(e) => setSelectedLanguage(e.target.value)}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2.5 text-xs text-white focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
            >
              {LANGUAGES.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.name}
                </option>
              ))}
            </select>
          </div>

          {/* Custom Vocabulary / Prompt */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>Custom Glossary / Names (Optional)</span>
            </label>

            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Sonex, CapCut, TikTok, Reels, Antigravity, ChatGPT..."
              rows={3}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
            />
          </div>

          {/* Generate Button / Progress Bar */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
            {!isProcessing ? (
              <button
                type="button"
                onClick={onGenerateCaptions}
                disabled={!videoFile}
                className={`w-full py-3.5 px-6 rounded-xl font-black text-sm tracking-wide shadow-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] ${
                  videoFile
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black shadow-emerald-500/20'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none'
                }`}
              >
                <Sparkles className="w-5 h-5 fill-current" />
                <span>
                  {transcriptionMode === 'local' ? 'Run Local Whisper (Free)' : 'Run Groq Cloud Turbo'}
                </span>
              </button>
            ) : (
              <div className="space-y-3 p-4 bg-zinc-950 border border-emerald-500/30 rounded-xl">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-400 font-bold animate-pulse">
                    {processStep || 'Transcribing audio...'}
                  </span>
                  <span className="text-emerald-300 font-mono font-bold text-sm">
                    {processProgress}%
                  </span>
                </div>
                <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-200 rounded-full"
                    style={{ width: `${processProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-500 text-center">
                  {transcriptionMode === 'local'
                    ? 'Processing on your device via Web Worker. Please keep this tab active.'
                    : 'Processing on Groq LPU™.'}
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
