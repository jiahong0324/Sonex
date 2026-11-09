import { useState } from 'react';
import {
  Sparkles,
  KeyRound,
  FileAudio,
  Cpu,
  Globe2,
  FileText,
  ExternalLink,
  ShieldCheck,
} from 'lucide-react';
import { LANGUAGES } from '../utils/constants';

export default function TranscriptionSettings({
  apiKey,
  onKeyChange,
  saveKey,
  setSaveKey,
  selectedModel,
  setSelectedModel,
  selectedLanguage,
  setSelectedLanguage,
  extractionMethod,
  setExtractionMethod,
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
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold text-white">AI Transcription Engine</h2>
        </div>
        <p className="text-xs text-zinc-400">
          Powered by state-of-the-art OpenAI Whisper on Groq LPU™ for instantaneous speech recognition with millisecond timestamp alignment.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: API & Model Settings */}
        <div className="lg:col-span-7 space-y-5">
          {/* API Key Box */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-emerald-400" />
                <span>1. Groq Whisper API Key</span>
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
                className="w-full bg-zinc-950 border border-zinc-800 rounded-xl pl-4 pr-24 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 font-mono transition-all"
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
                <span>Runs client-side directly to API endpoint</span>
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

          {/* Whisper Model Selector */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Cpu className="w-4 h-4 text-emerald-400" />
              <span>2. Select Whisper Model</span>
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
                  Maximum accuracy and vocabulary recognition. Best for nuanced accents and bilingual speech.
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
                    Pro Turbo
                  </span>
                </div>
                <p className="text-[11px] text-zinc-400 leading-snug">
                  Blazing fast generation (sub-second speed), optimized for rapid video workflows.
                </p>
              </button>
            </div>
          </div>

          {/* Audio Extraction Method */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <FileAudio className="w-4 h-4 text-emerald-400" />
              <span>3. Audio Extraction Engine</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <label
                className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  extractionMethod === 'extract'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
                }`}
              >
                <input
                  type="radio"
                  name="extraction"
                  checked={extractionMethod === 'extract'}
                  onChange={() => setExtractionMethod('extract')}
                  className="mt-0.5 text-emerald-500 focus:ring-emerald-500"
                />
                <div>
                  <div className="text-xs font-bold text-white">In-Browser Audio Extraction</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Extracts 16kHz mono WAV locally. Bypasses 25MB upload limits and saves bandwidth.
                  </div>
                </div>
              </label>

              <label
                className={`p-3.5 rounded-xl border flex items-start gap-3 cursor-pointer transition-all ${
                  extractionMethod === 'direct'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-zinc-800 bg-zinc-950 hover:border-zinc-700'
                }`}
              >
                <input
                  type="radio"
                  name="extraction"
                  checked={extractionMethod === 'direct'}
                  onChange={() => setExtractionMethod('direct')}
                  className="mt-0.5 text-emerald-500 focus:ring-emerald-500"
                />
                <div>
                  <div className="text-xs font-bold text-white">Direct Video Upload</div>
                  <div className="text-[11px] text-zinc-400 mt-0.5">
                    Uploads original video directly. Only supports video files smaller than 25MB.
                  </div>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Right Column: Language, Glossary & Action */}
        <div className="lg:col-span-5 space-y-5">
          {/* Language Selection */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <label className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
              <Globe2 className="w-4 h-4 text-emerald-400" />
              <span>4. Target Spoken Language</span>
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
              <span>5. Custom Glossary / Proper Nouns (Optional)</span>
            </label>

            <textarea
              value={customPrompt}
              onChange={(e) => setCustomPrompt(e.target.value)}
              placeholder="e.g. Sonex, CapCut, Antigravity, TikTok, Reels, DeepMind, ChatGPT..."
              rows={3}
              className="w-full bg-zinc-950 border border-zinc-800 rounded-xl p-3 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 resize-none"
            />
            <p className="text-[10px] text-zinc-500">
              Provide uncommon brand names, slang, or technical jargon to guide Whisper's spelling recognition.
            </p>
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
                <span>Generate Captions with AI</span>
              </button>
            ) : (
              <div className="space-y-3 p-4 bg-zinc-950 border border-zinc-800 rounded-xl">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-400 font-bold animate-pulse">
                    {processStep || 'Transcribing...'}
                  </span>
                  <span className="text-zinc-400 font-mono font-bold">{processProgress}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-300 rounded-full"
                    style={{ width: `${processProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-500 text-center">
                  Running fast inference on Groq LPU™. Please keep this tab active.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
