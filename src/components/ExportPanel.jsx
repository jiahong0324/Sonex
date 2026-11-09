import { useState } from 'react';
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
} from 'lucide-react';
import { formatSRT, formatVTT, formatTXT, formatJSON } from '../utils/srtParser';
import { burnSubtitlesToVideo } from '../utils/ffmpegBurner';

export default function ExportPanel({
  videoFile,
  captions,
  styleConfig,
  showFeedback,
}) {
  const [copied, setCopied] = useState(false);
  const [isRenderingVideo, setIsRenderingVideo] = useState(false);
  const [renderProgress, setRenderProgress] = useState(0);
  const [renderStatus, setRenderStatus] = useState('');

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

  // Video Hard-Sub Burner using FFmpeg.wasm
  const handleBurnAndExportVideo = async () => {
    if (!videoFile) {
      showFeedback('error', 'Please upload a video file first.');
      return;
    }
    if (captions.length === 0) {
      showFeedback('error', 'Please generate or load captions before rendering.');
      return;
    }

    setIsRenderingVideo(true);
    setRenderProgress(0);
    setRenderStatus('Initializing FFmpeg Video Engine...');

    try {
      const outputBlob = await burnSubtitlesToVideo({
        videoFile,
        captions,
        styleConfig,
        onProgress: (p) => setRenderProgress(p),
        onStatusChange: (s) => setRenderStatus(s),
      });

      // Download rendered video
      const url = URL.createObjectURL(outputBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${cleanName}_Subtitled.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      showFeedback('success', 'Subtitled video successfully rendered and saved!');
    } catch (err) {
      console.error(err);
      showFeedback('error', `Render failed: ${err.message || err}`);
    } finally {
      setIsRenderingVideo(false);
      setRenderProgress(0);
      setRenderStatus('');
    }
  };

  const hasCaptions = captions.length > 0;

  return (
    <div className="space-y-6">
      {/* Intro Banner */}
      <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-2">
        <div className="flex items-center gap-2">
          <FileDown className="w-5 h-5 text-emerald-400" />
          <h2 className="text-base font-bold text-white">Export & Hard-Sub Render Studio</h2>
        </div>
        <p className="text-xs text-zinc-400">
          Export industry-standard subtitle formats for video editors or burn hardcoded subtitles directly into your MP4 video with custom styles.
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Subtitle File Formats */}
        <div className="lg:col-span-7 space-y-5">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400">
              1. Download Subtitle Files
            </h3>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* SRT Button */}
              <button
                type="button"
                onClick={handleDownloadSRT}
                disabled={!hasCaptions}
                className={`p-4 rounded-xl border flex items-center justify-between transition-all group ${
                  hasCaptions
                    ? 'border-emerald-500/40 bg-zinc-950 hover:bg-emerald-500/10 hover:border-emerald-500'
                    : 'border-zinc-850 bg-zinc-950/40 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <div className="text-left">
                  <div className="font-bold text-sm text-white flex items-center gap-1.5">
                    <span>SubRip (.SRT)</span>
                    <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded font-mono">
                      Recommended
                    </span>
                  </div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Standard format for CapCut, Premiere, DaVinci, FCPX.
                  </p>
                </div>
                <Download className="w-5 h-5 text-emerald-400 group-hover:translate-y-0.5 transition-transform" />
              </button>

              {/* VTT Button */}
              <button
                type="button"
                onClick={handleDownloadVTT}
                disabled={!hasCaptions}
                className={`p-4 rounded-xl border flex items-center justify-between transition-all group ${
                  hasCaptions
                    ? 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900 hover:border-zinc-700'
                    : 'border-zinc-850 bg-zinc-950/40 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <div className="text-left">
                  <div className="font-bold text-sm text-white">WebVTT (.VTT)</div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Ideal for web video players, HTML5 video, YouTube.
                  </p>
                </div>
                <Download className="w-5 h-5 text-zinc-400 group-hover:text-white group-hover:translate-y-0.5 transition-all" />
              </button>

              {/* TXT Button */}
              <button
                type="button"
                onClick={handleDownloadTXT}
                disabled={!hasCaptions}
                className={`p-4 rounded-xl border flex items-center justify-between transition-all group ${
                  hasCaptions
                    ? 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900 hover:border-zinc-700'
                    : 'border-zinc-850 bg-zinc-950/40 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <div className="text-left">
                  <div className="font-bold text-sm text-white">Plain Text (.TXT)</div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Clean transcript without timestamps for articles or summaries.
                  </p>
                </div>
                <FileText className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
              </button>

              {/* JSON Button */}
              <button
                type="button"
                onClick={handleDownloadJSON}
                disabled={!hasCaptions}
                className={`p-4 rounded-xl border flex items-center justify-between transition-all group ${
                  hasCaptions
                    ? 'border-zinc-800 bg-zinc-950 hover:bg-zinc-900 hover:border-zinc-700'
                    : 'border-zinc-850 bg-zinc-950/40 text-zinc-600 cursor-not-allowed'
                }`}
              >
                <div className="text-left">
                  <div className="font-bold text-sm text-white">Developer JSON (.JSON)</div>
                  <p className="text-[11px] text-zinc-400 mt-1">
                    Raw structured objects with numeric milliseconds.
                  </p>
                </div>
                <Code2 className="w-5 h-5 text-zinc-400 group-hover:text-white transition-colors" />
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
                  <span className="text-emerald-400">Transcript Copied to Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Copy Full Transcript Text</span>
                </>
              )}
            </button>
          </div>

          {/* Video Editor Workflow Guide */}
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold uppercase tracking-wider text-emerald-400">
              Quick CapCut / Premiere Import Guide:
            </h4>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs text-zinc-400">
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-850">
                <div className="font-bold text-white mb-1">Step 1</div>
                Download the <span className="text-emerald-400 font-semibold">.SRT</span> file above.
              </div>
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-850">
                <div className="font-bold text-white mb-1">Step 2</div>
                In CapCut, navigate to <span className="text-zinc-200 font-semibold">Text</span> &gt;{' '}
                <span className="text-zinc-200 font-semibold">Local Captions</span>.
              </div>
              <div className="p-3 bg-zinc-950 rounded-xl border border-zinc-850">
                <div className="font-bold text-white mb-1">Step 3</div>
                Click <span className="text-zinc-200 font-semibold">Import</span> and select your .SRT. All phrases snap to audio automatically.
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Direct Video Hard-sub Burner */}
        <div className="lg:col-span-5 space-y-5">
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-xs font-bold uppercase tracking-wider text-zinc-400 flex items-center gap-1.5">
                <Video className="w-4 h-4 text-emerald-400" />
                <span>2. In-Browser Video Burner</span>
              </h3>
              <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-2 py-0.5 rounded-full font-bold">
                FFmpeg WASM
              </span>
            </div>

            <p className="text-xs text-zinc-400 leading-relaxed">
              Burn your chosen subtitle style directly onto the video frames. No video editor required — ready to post immediately to TikTok, Reels, or Shorts.
            </p>

            {/* Current Active Style Summary */}
            <div className="p-3.5 bg-zinc-950 rounded-xl border border-zinc-850 space-y-1.5 text-xs">
              <div className="text-zinc-400 font-semibold">Active Subtitle Styling:</div>
              <div className="flex flex-wrap gap-2 text-[11px]">
                <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800 font-mono">
                  Preset: {styleConfig.presetId}
                </span>
                <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800 font-mono">
                  Size: {styleConfig.fontSize.toUpperCase()}
                </span>
                <span className="px-2 py-0.5 rounded bg-zinc-900 text-zinc-300 border border-zinc-800 font-mono">
                  Y-Pos: {styleConfig.verticalPosition}%
                </span>
              </div>
            </div>

            {/* Render CTA Button */}
            {!isRenderingVideo ? (
              <button
                type="button"
                onClick={handleBurnAndExportVideo}
                disabled={!videoFile || !hasCaptions}
                className={`w-full py-4 px-6 rounded-xl font-black text-sm tracking-wide shadow-xl flex items-center justify-center gap-2.5 transition-all active:scale-[0.98] ${
                  videoFile && hasCaptions
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-black shadow-emerald-500/20'
                    : 'bg-zinc-800 text-zinc-500 cursor-not-allowed shadow-none'
                }`}
              >
                <Sparkles className="w-5 h-5 fill-current" />
                <span>Render Subtitled MP4 Video</span>
              </button>
            ) : (
              <div className="p-4 bg-zinc-950 border border-zinc-800 rounded-xl space-y-3">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-emerald-400 font-bold flex items-center gap-2 animate-pulse">
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>{renderStatus || 'Rendering video frames...'}</span>
                  </span>
                  <span className="text-zinc-400 font-mono font-bold">{renderProgress}%</span>
                </div>
                <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-teal-400 transition-all duration-200 rounded-full"
                    style={{ width: `${renderProgress}%` }}
                  />
                </div>
                <p className="text-[10px] text-zinc-500 text-center">
                  FFmpeg is encoding inside your browser. Please keep this tab active until complete.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
