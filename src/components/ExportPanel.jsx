import { useState, useRef } from 'react';
import {
  FileDown,
  Video,
  FileText,
  Copy,
  Check,
  Code2,
  Sparkles,
  Loader2,
  Download,
  AlertCircle,
  Share2,
  XCircle,
  RotateCcw,
  Sliders,
} from 'lucide-react';
import { formatSRT, formatVTT, formatTXT, formatJSON } from '../utils/srtParser';
import { exportWithWebCodecs, isWebCodecsSupported } from '../utils/webcodecsExporter';
import { exportWithMediaRecorder, isMediaRecorderSupported } from '../utils/mediaRecorderExporter';
import { burnSubtitlesToVideo } from '../utils/ffmpegBurner';

export default function ExportPanel({
  videoFile,
  captions,
  styleConfig,
  showFeedback,
}) {
  const [copied, setCopied] = useState(false);

  // Export Settings
  const [resolution, setResolution] = useState('original'); // 'original' | '1080p' | '720p'
  const [quality, setQuality] = useState('high');          // 'high' | 'medium' | 'low'
  const [aspectRatio, setAspectRatio] = useState('original'); // 'original' | '9:16' | '1:1' | '16:9'
  const [exportEngine, setExportEngine] = useState('webcodecs'); // 'webcodecs' | 'mediarecorder' | 'ffmpeg'

  // Export Execution State
  const [isExporting, setIsExporting] = useState(false);
  const [exportProgress, setExportProgress] = useState(0);
  const [exportStage, setExportStage] = useState('');
  const [exportStats, setExportStats] = useState({ fps: 0, etaSeconds: 0, currentFrame: 0, totalFrames: 0 });
  const [exportError, setExportError] = useState(null);

  // Completed Video Result
  const [exportedResult, setExportedResult] = useState(null); // { blob, url, name, sizeBytes }
  const [customFileName, setCustomFileName] = useState('');

  const abortControllerRef = useRef(null);

  const cleanName = videoFile
    ? videoFile.name.substring(0, videoFile.name.lastIndexOf('.'))
    : 'captions';

  // File Download Helpers
  const downloadFile = (content, filename, mimeType) => {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showFeedback('success', `Saved ${filename}`);
  };

  const handleDownloadSRT = () => {
    if (captions.length === 0) return;
    const content = formatSRT(captions);
    downloadFile(content, `${cleanName}_Sonex.srt`, 'text/plain;charset=utf-8');
  };

  const handleDownloadVTT = () => {
    if (captions.length === 0) return;
    const content = formatVTT(captions);
    downloadFile(content, `${cleanName}_Sonex.vtt`, 'text/vtt;charset=utf-8');
  };

  const handleDownloadTXT = () => {
    if (captions.length === 0) return;
    const content = formatTXT(captions);
    downloadFile(content, `${cleanName}_Transcript.txt`, 'text/plain;charset=utf-8');
  };

  const handleDownloadJSON = () => {
    if (captions.length === 0) return;
    const content = formatJSON(captions);
    downloadFile(content, `${cleanName}_Captions.json`, 'application/json');
  };

  const handleCopyTranscript = async () => {
    if (captions.length === 0) return;
    const text = formatTXT(captions);
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      showFeedback('success', 'Transcript copied to clipboard!');
      setTimeout(() => setCopied(false), 3000);
    } catch {
      showFeedback('error', 'Clipboard access denied.');
    }
  };

  // Trigger download of exported blob
  const triggerDownload = (blob, filename) => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  };

  // Cancel ongoing export
  const handleCancelExport = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setIsExporting(false);
    setExportProgress(0);
    setExportStage('');
    showFeedback('info', 'Export cancelled.');
  };

  // Main Export Handler with automatic fallbacks
  const handleExportSubtitledVideo = async (forceEngine) => {
    if (!videoFile) {
      showFeedback('error', 'Please upload or select a video file first.');
      return;
    }
    if (captions.length === 0) {
      showFeedback('error', 'Please transcribe or import captions first.');
      return;
    }

    const engineToUse = forceEngine || exportEngine;
    setIsExporting(true);
    setExportProgress(5);
    setExportError(null);
    setExportStage('Initializing video export pipeline...');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    const exportSettings = {
      resolution,
      quality,
      aspectRatio,
    };

    const finalName = (customFileName.trim() || `${cleanName}_subtitled`) + '.mp4';

    try {
      let outputBlob = null;

      // Method 1: WebCodecs (P0 GPU Hardware Acceleration)
      if (engineToUse === 'webcodecs' && isWebCodecsSupported()) {
        try {
          const result = await exportWithWebCodecs({
            videoFile,
            captions,
            styleConfig,
            exportSettings,
            onProgress: (prog) => {
              setExportProgress(prog.percent || 0);
              setExportStage(prog.message || '');
              setExportStats({
                fps: prog.fps || 0,
                etaSeconds: prog.etaSeconds || 0,
                currentFrame: prog.currentFrame || 0,
                totalFrames: prog.totalFrames || 0,
              });
            },
            signal: abortController.signal,
          });
          outputBlob = result.blob;
        } catch (err) {
          if (err.name === 'AbortError') return;
          console.warn('[WebCodecs Export Warning] Falling back to MediaRecorder:', err);
          showFeedback('error', `${err.message}. Retrying with real-time MediaRecorder fallback...`);
          // Automatic downgrade to Level 1 Fallback
          return handleExportSubtitledVideo('mediarecorder');
        }
      }
      // Method 2: MediaRecorder (Level 1 Fallback)
      else if (engineToUse === 'mediarecorder' || isMediaRecorderSupported()) {
        try {
          const result = await exportWithMediaRecorder({
            videoFile,
            captions,
            styleConfig,
            onProgress: (prog) => {
              setExportProgress(prog.percent || 0);
              setExportStage(prog.message || '');
              setExportStats({
                fps: 30,
                etaSeconds: prog.etaSeconds || 0,
                currentFrame: 0,
                totalFrames: 0,
              });
            },
            signal: abortController.signal,
          });
          outputBlob = result.blob;
        } catch (err) {
          if (err.name === 'AbortError') return;
          console.warn('[MediaRecorder Export Warning] Falling back to FFmpeg WASM:', err);
          showFeedback('error', `${err.message}. Retrying with FFmpeg WASM fallback...`);
          // Automatic downgrade to Level 2 Fallback
          return handleExportSubtitledVideo('ffmpeg');
        }
      }
      // Method 3: FFmpeg.wasm (Level 2 Final Fallback)
      else {
        outputBlob = await burnSubtitlesToVideo({
          videoFile,
          captions,
          styleConfig,
          onProgress: (p) => setExportProgress(p),
          onStatusChange: (s) => setExportStage(s),
        });
      }

      if (outputBlob) {
        const url = URL.createObjectURL(outputBlob);
        setExportedResult({
          blob: outputBlob,
          url,
          name: finalName,
          sizeBytes: outputBlob.size,
        });

        // Trigger automatic download
        triggerDownload(outputBlob, finalName);
        showFeedback('success', 'Subtitled video successfully burned & downloaded!');
      }
    } catch (err) {
      if (err.name === 'AbortError') return;
      console.error(err);
      setExportError(err.message || 'Video export failed.');
      showFeedback('error', `Export failed: ${err.message || err}`);
    } finally {
      setIsExporting(false);
      abortControllerRef.current = null;
    }
  };

  // Web Share API (Save to Camera Roll / Share on Mobile)
  const handleShareMobile = async () => {
    if (!exportedResult?.blob) return;
    try {
      const file = new File([exportedResult.blob], exportedResult.name, { type: 'video/mp4' });
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Subtitled Video',
          text: 'Video with burned captions generated by Sonex Studio Pro',
        });
        showFeedback('success', 'Video shared / saved to Camera Roll!');
      } else {
        // Fallback: download
        triggerDownload(exportedResult.blob, exportedResult.name);
        showFeedback('info', 'Web Share not supported; downloading file directly.');
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        showFeedback('error', 'Share failed: ' + err.message);
      }
    }
  };

  const hasCaptions = captions.length > 0;
  const webCodecsAvailable = isWebCodecsSupported();

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileDown className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold text-white">Export & Hard-Sub Render Studio</h2>
          </div>
          <span className="text-[10px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 px-2.5 py-0.5 rounded-full font-bold uppercase tracking-wider">
            100% Client-Side Local
          </span>
        </div>
        <p className="text-xs text-zinc-400">
          Download complete MP4 video with styled subtitles burned directly into the frames. No watermark, pristine audio quality, zero cloud uploads. Ready for TikTok, Reels & Shorts.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Direct Video Hard-sub Burner (P0) */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-5">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                <Video className="w-4 h-4 text-emerald-400" />
                <span>1. Download Full Subtitled Video (P0)</span>
              </h3>
              <span className="text-[11px] font-mono text-emerald-400 font-bold bg-emerald-500/10 px-2 py-0.5 rounded">
                MP4 • Hardcoded Subs
              </span>
            </div>

            {/* Video Export Configuration Form */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {/* Resolution Select */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-400 flex items-center gap-1">
                  <Sliders className="w-3.5 h-3.5 text-zinc-500" />
                  <span>Resolution</span>
                </label>
                <select
                  value={resolution}
                  onChange={(e) => setResolution(e.target.value)}
                  disabled={isExporting}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="original">Original (Default)</option>
                  <option value="1080p">1080p Full HD</option>
                  <option value="720p">720p HD (Low Memory)</option>
                </select>
              </div>

              {/* Quality / Bitrate */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-400">Quality / Bitrate</label>
                <select
                  value={quality}
                  onChange={(e) => setQuality(e.target.value)}
                  disabled={isExporting}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="high">High (10 Mbps)</option>
                  <option value="medium">Balanced (6 Mbps)</option>
                  <option value="low">Compact (3 Mbps)</option>
                </select>
              </div>

              {/* Aspect Ratio */}
              <div className="space-y-1.5">
                <label className="text-[11px] font-bold text-zinc-400">Aspect Ratio</label>
                <select
                  value={aspectRatio}
                  onChange={(e) => setAspectRatio(e.target.value)}
                  disabled={isExporting}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-3 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500"
                >
                  <option value="original">Keep Original</option>
                  <option value="9:16">9:16 (Shorts/TikTok)</option>
                  <option value="1:1">1:1 (Square)</option>
                  <option value="16:9">16:9 (Landscape)</option>
                </select>
              </div>
            </div>

            {/* Acceleration Engine Selector */}
            <div className="space-y-2">
              <label className="text-[11px] font-bold text-zinc-400 flex items-center justify-between">
                <span>Rendering Engine</span>
                <span className="text-[10px] text-zinc-500">
                  {webCodecsAvailable ? 'GPU Hardware Accelerated' : 'WASM Compatible Mode'}
                </span>
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => setExportEngine('webcodecs')}
                  disabled={!webCodecsAvailable || isExporting}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                    exportEngine === 'webcodecs'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 font-bold'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                  }`}
                >
                  WebCodecs (GPU)
                </button>
                <button
                  type="button"
                  onClick={() => setExportEngine('mediarecorder')}
                  disabled={isExporting}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                    exportEngine === 'mediarecorder'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 font-bold'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                  }`}
                >
                  MediaRecorder
                </button>
                <button
                  type="button"
                  onClick={() => setExportEngine('ffmpeg')}
                  disabled={isExporting}
                  className={`py-2 px-3 rounded-xl border text-xs font-semibold text-center transition-all ${
                    exportEngine === 'ffmpeg'
                      ? 'border-emerald-500 bg-emerald-500/10 text-emerald-300 font-bold'
                      : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white'
                  }`}
                >
                  FFmpeg WASM
                </button>
              </div>
            </div>

            {/* Custom Output Filename */}
            <div className="space-y-1.5">
              <label className="text-[11px] font-bold text-zinc-400">Output Filename</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  placeholder={`${cleanName}_subtitled`}
                  value={customFileName}
                  onChange={(e) => setCustomFileName(e.target.value)}
                  disabled={isExporting}
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded-xl px-3.5 py-2 text-xs text-zinc-200 focus:outline-none focus:border-emerald-500 font-mono"
                />
                <span className="text-xs font-mono text-zinc-500">.mp4</span>
              </div>
            </div>

            {/* Progress / Status Display during Export */}
            {isExporting && (
              <div className="p-4 bg-zinc-950 border border-emerald-500/30 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-400 font-bold flex items-center gap-2">
                    <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
                    <span>{exportStage || 'Processing video frames...'}</span>
                  </span>
                  <span className="text-emerald-300 font-mono font-bold text-sm">
                    {exportProgress}%
                  </span>
                </div>

                <div className="w-full h-2.5 bg-zinc-900 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-150 rounded-full"
                    style={{ width: `${exportProgress}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono">
                  <span>
                    {exportStats.currentFrame > 0
                      ? `Frame ${exportStats.currentFrame} / ${exportStats.totalFrames} (${exportStats.fps} fps)`
                      : 'Audio Remux Synchronized'}
                  </span>
                  {exportStats.etaSeconds > 0 && (
                    <span>ETA: ~{exportStats.etaSeconds}s remaining</span>
                  )}
                </div>

                <button
                  type="button"
                  onClick={handleCancelExport}
                  className="w-full py-2 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-rose-400 border border-zinc-800 text-xs font-bold transition-all flex items-center justify-center gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  <span>Cancel Export</span>
                </button>
              </div>
            )}

            {/* Error Message with Fallback Retry Option */}
            {exportError && (
              <div className="p-4 bg-rose-500/10 border border-rose-500/30 rounded-xl space-y-3 text-xs">
                <div className="flex items-start gap-2.5 text-rose-400">
                  <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
                  <div>
                    <div className="font-bold">Export Failed</div>
                    <p className="text-[11px] text-rose-300/90 mt-0.5">{exportError}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleExportSubtitledVideo('mediarecorder')}
                    className="px-3 py-1.5 rounded-lg bg-rose-500 text-white font-bold text-xs flex items-center gap-1 hover:bg-rose-600 transition-all"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Retry with MediaRecorder</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleExportSubtitledVideo('ffmpeg')}
                    className="px-3 py-1.5 rounded-lg bg-zinc-800 text-zinc-300 font-semibold text-xs hover:bg-zinc-700"
                  >
                    Retry with FFmpeg WASM
                  </button>
                </div>
              </div>
            )}

            {/* Render CTA Button */}
            {!isExporting && (
              <button
                type="button"
                onClick={() => handleExportSubtitledVideo()}
                disabled={!videoFile || !hasCaptions}
                className={`w-full py-4 px-6 rounded-xl font-black text-sm tracking-wide shadow-xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] ${
                  videoFile && hasCaptions
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black shadow-emerald-500/20'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none'
                }`}
              >
                <Sparkles className="w-5 h-5 fill-current" />
                <span>Download Subtitled MP4 Video</span>
              </button>
            )}

            {/* Exported Result Preview & Mobile Actions */}
            {exportedResult && (
              <div className="p-4 bg-emerald-500/5 border border-emerald-500/30 rounded-2xl space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-400 font-bold text-xs">
                    <Check className="w-4 h-4 stroke-[3]" />
                    <span>Video Rendered Successfully!</span>
                  </div>
                  <span className="text-[11px] text-zinc-400 font-mono">
                    {(exportedResult.sizeBytes / (1024 * 1024)).toFixed(1)} MB
                  </span>
                </div>

                {/* In-page Video Preview */}
                <div className="rounded-xl overflow-hidden bg-black border border-zinc-800 max-h-64 flex items-center justify-center">
                  <video
                    src={exportedResult.url}
                    controls
                    playsInline
                    className="max-h-64 w-auto object-contain"
                  />
                </div>

                {/* Actions: Download Again & Mobile Share */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <button
                    type="button"
                    onClick={() => triggerDownload(exportedResult.blob, exportedResult.name)}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-black font-bold text-xs flex items-center justify-center gap-2 transition-all shadow-md"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Video Again</span>
                  </button>

                  <button
                    type="button"
                    onClick={handleShareMobile}
                    className="w-full py-2.5 px-4 rounded-xl bg-zinc-900 hover:bg-zinc-850 text-white border border-zinc-800 font-bold text-xs flex items-center justify-center gap-2 transition-all"
                  >
                    <Share2 className="w-4 h-4 text-emerald-400" />
                    <span>Save to Camera Roll / Share</span>
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right Column: Subtitle Text Formats (SRT, VTT, TXT, JSON) */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
              <FileText className="w-4 h-4 text-emerald-400" />
              <span>2. Subtitle Data Files (Free)</span>
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* SRT Button */}
              <button
                type="button"
                onClick={handleDownloadSRT}
                disabled={!hasCaptions}
                className={`p-3.5 rounded-xl border flex items-center justify-between transition-all group ${
                  hasCaptions
                    ? 'border-emerald-500/40 bg-zinc-950 hover:bg-emerald-500/10 hover:border-emerald-500'
                    : 'border-zinc-850 bg-zinc-950/40 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <div className="text-left">
                  <div className="font-bold text-xs text-white flex items-center gap-1">
                    <span>SubRip (.SRT)</span>
                    <span className="text-[9px] bg-emerald-500/20 text-emerald-400 px-1 py-0.2 rounded font-mono">
                      CapCut
                    </span>
                  </div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Premiere, DaVinci, FCPX.</p>
                </div>
                <Download className="w-4 h-4 text-emerald-400 group-hover:translate-y-0.5 transition-transform" />
              </button>

              {/* VTT Button */}
              <button
                type="button"
                onClick={handleDownloadVTT}
                disabled={!hasCaptions}
                className={`p-3.5 rounded-xl border flex items-center justify-between transition-all group ${
                  hasCaptions
                    ? 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900 hover:border-zinc-700'
                    : 'border-zinc-850 bg-zinc-950/40 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <div className="text-left">
                  <div className="font-bold text-xs text-white">WebVTT (.VTT)</div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">HTML5 video & YouTube.</p>
                </div>
                <Download className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
              </button>

              {/* TXT Button */}
              <button
                type="button"
                onClick={handleDownloadTXT}
                disabled={!hasCaptions}
                className={`p-3.5 rounded-xl border flex items-center justify-between transition-all group ${
                  hasCaptions
                    ? 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900 hover:border-zinc-700'
                    : 'border-zinc-850 bg-zinc-950/40 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <div className="text-left">
                  <div className="font-bold text-xs text-white">Plain Text (.TXT)</div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Clean script transcript.</p>
                </div>
                <FileText className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
              </button>

              {/* JSON Button */}
              <button
                type="button"
                onClick={handleDownloadJSON}
                disabled={!hasCaptions}
                className={`p-3.5 rounded-xl border flex items-center justify-between transition-all group ${
                  hasCaptions
                    ? 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900 hover:border-zinc-700'
                    : 'border-zinc-850 bg-zinc-950/40 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <div className="text-left">
                  <div className="font-bold text-xs text-white">JSON Timestamps</div>
                  <p className="text-[10px] text-zinc-400 mt-0.5">Word-level data arrays.</p>
                </div>
                <Code2 className="w-4 h-4 text-zinc-400 group-hover:text-white transition-colors" />
              </button>
            </div>

            {/* Copy Transcript Button */}
            <button
              type="button"
              onClick={handleCopyTranscript}
              disabled={!hasCaptions}
              className={`w-full py-2.5 px-4 rounded-xl border flex items-center justify-center gap-2 text-xs font-bold transition-all ${
                hasCaptions
                  ? 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900 text-zinc-200'
                  : 'border-zinc-850 bg-zinc-950/40 text-zinc-600 cursor-not-allowed'
              }`}
            >
              {copied ? (
                <>
                  <Check className="w-4 h-4 text-emerald-400" />
                  <span className="text-emerald-400">Transcript Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Full Transcript</span>
                </>
              )}
            </button>
          </div>

          {/* Privacy Guarantee Note */}
          <div className="p-4 bg-zinc-950 rounded-2xl border border-zinc-850 space-y-2 text-xs text-zinc-400">
            <div className="text-emerald-400 font-bold flex items-center gap-1.5">
              <span>🔒 100% On-Device Privacy</span>
            </div>
            <p className="text-[11px] leading-relaxed">
              Your video and audio streams are decoded, subtitled, and encoded entirely inside your browser's Web Worker. No video frames ever leave your local computer.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
