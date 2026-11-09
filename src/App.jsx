import { useState, useRef, useEffect, useCallback } from 'react';
import localforage from 'localforage';
import Header from './components/Header';
import VideoPlayer from './components/VideoPlayer';
import VisualTimeline from './components/VisualTimeline';
import CaptionList from './components/CaptionList';
import StyleConfigurator from './components/StyleConfigurator';
import TranscriptionSettings from './components/TranscriptionSettings';
import ExportPanel from './components/ExportPanel';
import BatchFindReplaceModal from './components/BatchFindReplaceModal';
import ImportSubtitleModal from './components/ImportSubtitleModal';
import KeyboardShortcutModal from './components/KeyboardShortcutModal';
import ApiKeyModal from './components/ApiKeyModal';
import Toast from './components/Toast';
import { useHistory } from './hooks/useHistory';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { performAudioExtraction } from './utils/audioExtractor';
import { secondsToTimeStr } from './utils/timeUtils';
import { getWrappedText } from './utils/srtParser';
import { DEFAULT_STYLE } from './utils/styles';

export default function App() {
  const envApiKey = import.meta.env.VITE_GROQ_API_KEY || '';
  const [apiKey, setApiKey] = useState(() => envApiKey || localStorage.getItem('groq_api_key') || '');
  const [saveKey, setSaveKey] = useState(true);

  // Workflow Tabs: 'studio', 'style', 'transcribe', 'export'
  const [activeTab, setActiveTab] = useState('studio');

  // Video State
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [videoAspectRatio, setVideoAspectRatio] = useState('16/9');
  const [currentTime, setCurrentTime] = useState(0);
  const [videoDuration, setVideoDuration] = useState(0);

  // Subtitles State with Undo / Redo
  const [captions, setCaptions, { undo, redo, canUndo, canRedo, reset: resetCaptions }] = useHistory([]);
  const [autoScrollEnabled, setAutoScrollEnabled] = useState(true);
  const [styleConfig, setStyleConfig] = useState(DEFAULT_STYLE);

  // Transcription Configuration
  const [selectedModel, setSelectedModel] = useState('whisper-large-v3');
  const [selectedLanguage, setSelectedLanguage] = useState('auto');
  const [extractionMethod, setExtractionMethod] = useState('extract');
  const [customPrompt, setCustomPrompt] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState('');
  const [processProgress, setProcessProgress] = useState(0);

  // Feedback Notification
  const [feedback, setFeedback] = useState({ type: '', msg: '' });

  // Modals
  const [isFindReplaceOpen, setIsFindReplaceOpen] = useState(false);
  const [isImportOpen, setIsImportOpen] = useState(false);
  const [isShortcutsOpen, setIsShortcutsOpen] = useState(false);
  const [isApiKeyOpen, setIsApiKeyOpen] = useState(false);

  const videoRef = useRef(null);

  const showFeedback = useCallback((type, msg) => {
    setFeedback({ type, msg });
    setTimeout(() => {
      setFeedback({ type: '', msg: '' });
    }, 6000);
  }, []);

  // Update & Store API Key
  const handleKeyChange = (val) => {
    setApiKey(val);
    if (saveKey) {
      localStorage.setItem('groq_api_key', val);
    } else {
      localStorage.removeItem('groq_api_key');
    }
  };

  // Restore State from IndexedDB on initial mount
  useEffect(() => {
    async function restoreOfflineState() {
      try {
        const storedCaptions = await localforage.getItem('sonex_captions');
        if (storedCaptions && Array.isArray(storedCaptions) && storedCaptions.length > 0) {
          resetCaptions(storedCaptions);
        }

        const storedStyle = await localforage.getItem('sonex_style');
        if (storedStyle) {
          setStyleConfig(storedStyle);
        }

        const storedFile = await localforage.getItem('sonex_videoFile');
        if (storedFile) {
          setVideoFile(storedFile);
          setVideoUrl(URL.createObjectURL(storedFile));
        }
      } catch (err) {
        console.error('Failed to restore offline state:', err);
      }
    }
    restoreOfflineState();
  }, [resetCaptions]);

  // Auto-persist captions & styleConfig
  useEffect(() => {
    if (captions.length > 0) {
      localforage.setItem('sonex_captions', captions).catch(() => {});
    }
  }, [captions]);

  useEffect(() => {
    localforage.setItem('sonex_style', styleConfig).catch(() => {});
  }, [styleConfig]);

  // Video File Selection Handler
  const handleFileSelect = (file) => {
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      showFeedback('error', 'Please select a valid video file (MP4, MOV, WebM).');
      return;
    }

    setVideoFile(file);
    localforage.setItem('sonex_videoFile', file).catch(() => {});

    const url = URL.createObjectURL(file);
    setVideoUrl(url);
    setCurrentTime(0);

    showFeedback('success', `Loaded: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`);

    // Auto toggle extraction method if file > 25MB
    if (file.size > 25 * 1024 * 1024) {
      setExtractionMethod('extract');
    }
  };

  // Drag and drop handlers on document window
  const handleGlobalDragOver = (e) => e.preventDefault();
  const handleGlobalDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('video/')) {
      handleFileSelect(file);
    }
  };

  // Reset Project
  const handleResetProject = async () => {
    if (window.confirm('Are you sure you want to reset current video and captions?')) {
      setVideoFile(null);
      setVideoUrl('');
      resetCaptions([]);
      setCurrentTime(0);
      setVideoDuration(0);
      await localforage.removeItem('sonex_videoFile').catch(() => {});
      await localforage.removeItem('sonex_captions').catch(() => {});
      showFeedback('success', 'Project cleared.');
    }
  };

  // Seek video
  const handleSeekVideo = (time) => {
    if (videoRef.current) {
      videoRef.current.currentTime = time;
    }
  };

  // Jump to next or previous caption
  const handlePrevCaption = () => {
    if (captions.length === 0) return;
    const prev = [...captions].reverse().find((c) => c.startTime < currentTime - 0.2);
    if (prev) handleSeekVideo(prev.startTime);
    else handleSeekVideo(captions[0].startTime);
  };

  const handleNextCaption = () => {
    if (captions.length === 0) return;
    const next = captions.find((c) => c.startTime > currentTime + 0.2);
    if (next) handleSeekVideo(next.startTime);
  };

  // Global Keyboard Shortcuts
  useKeyboardShortcuts({
    onTogglePlay: () => {
      if (!videoRef.current) return;
      if (videoRef.current.paused) videoRef.current.play().catch(() => {});
      else videoRef.current.pause();
    },
    onSeekBackward: (delta) => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.max(0, videoRef.current.currentTime - delta);
      }
    },
    onSeekForward: (delta) => {
      if (videoRef.current) {
        videoRef.current.currentTime = Math.min(
          videoDuration || 999999,
          videoRef.current.currentTime + delta
        );
      }
    },
    onPrevCaption: handlePrevCaption,
    onNextCaption: handleNextCaption,
    onUndo: undo,
    onRedo: redo,
    onOpenFindReplace: () => setIsFindReplaceOpen(true),
    onOpenShortcuts: () => setIsShortcutsOpen(true),
  });

  // Track video duration
  useEffect(() => {
    const vid = videoRef.current;
    if (!vid) return;

    const onLoadedMetadata = () => {
      setVideoDuration(vid.duration || 0);
    };
    vid.addEventListener('loadedmetadata', onLoadedMetadata);
    return () => vid.removeEventListener('loadedmetadata', onLoadedMetadata);
  }, [videoUrl]);

  // AI Transcription Handler
  const handleGenerateCaptions = async () => {
    if (!apiKey.trim()) {
      showFeedback('error', 'Please provide a Groq API Key first.');
      setIsApiKeyOpen(true);
      return;
    }
    if (!videoFile) {
      showFeedback('error', 'Please upload or select a video file first.');
      return;
    }

    setIsProcessing(true);
    setProcessProgress(5);
    setProcessStep('Starting AI transcription pipeline...');

    try {
      let fileToSend = videoFile;

      // In-browser Audio Extraction
      if (extractionMethod === 'extract') {
        setProcessStep('Extracting audio track in browser (16kHz WAV)...');
        try {
          const audioBlob = await performAudioExtraction(videoFile, (prog, step) => {
            setProcessProgress(Math.round(5 + prog * 0.4));
            setProcessStep(step);
          });
          fileToSend = new File([audioBlob], 'audio.wav', { type: 'audio/wav' });
          showFeedback('success', `Extracted compact audio track: ${(fileToSend.size / (1024 * 1024)).toFixed(2)} MB`);
        } catch (err) {
          console.warn('Audio extraction warning:', err);
          showFeedback('error', `${err.message}. Retrying with direct file upload...`);
          fileToSend = videoFile;
        }
      }

      // Check Groq 25MB limit
      if (fileToSend.size > 25 * 1024 * 1024) {
        throw new Error(
          'Payload exceeds 25MB limit. Please ensure "In-Browser Audio Extraction" is checked.'
        );
      }

      setProcessStep('Sending payload to Groq Whisper LPU™...');
      setProcessProgress(50);

      const formData = new FormData();
      formData.append('file', fileToSend);
      formData.append('model', selectedModel);
      formData.append('response_format', 'verbose_json');

      if (selectedLanguage && selectedLanguage !== 'auto') {
        formData.append('language', selectedLanguage);
      }

      let promptText = customPrompt.trim();
      if (!promptText) {
        if (selectedLanguage === 'zh') {
          promptText = '输出标准的专业字幕标点符号和语句。';
        } else {
          promptText = 'Export with standard professional subtitling punctuation and phrasing.';
        }
      }
      formData.append('prompt', promptText);

      const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey.trim()}`,
        },
        body: formData,
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `API error (${response.status})`);
      }

      setProcessStep('Structuring sentences & formatting timestamps...');
      setProcessProgress(88);

      const resJson = await response.json();
      if (!resJson.segments || !Array.isArray(resJson.segments)) {
        throw new Error('API returned successfully but no transcription segments were found.');
      }

      // Intelligent post-processing: split long segments into punchy social media subtitle chunks
      const refinedSegments = [];
      resJson.segments.forEach((seg) => {
        const text = seg.text.trim();
        if (!text) return;

        // Split by standard punctuation to keep ideas grouped
        const chunks = text.match(/(.*?[，。？！,.?!；;]+|.+)/g) || [text];
        const finalChunks = [];

        chunks.forEach((chunk) => {
          const c = chunk.trim();
          if (!c) return;
          const hasChinese = /[\u4e00-\u9fa5]/.test(c);
          const maxLen = hasChinese ? 14 : 26;

          if (c.length <= maxLen) {
            finalChunks.push(c);
          } else {
            if (hasChinese) {
              const parts = Math.ceil(c.length / maxLen);
              const splitLen = Math.ceil(c.length / parts);
              for (let i = 0; i < c.length; i += splitLen) {
                finalChunks.push(c.substring(i, i + splitLen));
              }
            } else {
              const words = c.split(/\s+/);
              let currentChunk = '';
              for (let word of words) {
                if ((currentChunk + ' ' + word).trim().length <= maxLen) {
                  currentChunk = (currentChunk + ' ' + word).trim();
                } else {
                  if (currentChunk) finalChunks.push(currentChunk);
                  currentChunk = word;
                }
              }
              if (currentChunk) finalChunks.push(currentChunk);
            }
          }
        });

        const totalChars = finalChunks.reduce((acc, c) => acc + c.length, 0);
        const duration = seg.end - seg.start;
        let segTime = seg.start;

        finalChunks.forEach((chunk) => {
          const chunkDuration = totalChars > 0 ? (chunk.length / totalChars) * duration : duration;
          const cleanText = chunk.replace(/[，。？！,.?!；;]+$/, '').trim();

          if (cleanText) {
            refinedSegments.push({
              start: segTime,
              end: segTime + chunkDuration,
              text: cleanText,
            });
          }
          segTime += chunkDuration;
        });
      });

      // Construct structured caption blocks
      const parsed = refinedSegments.map((seg, index) => {
        return {
          id: index + 1,
          startTime: seg.start,
          endTime: seg.end,
          startStr: secondsToTimeStr(seg.start),
          endStr: secondsToTimeStr(seg.end),
          text: getWrappedText(seg.text),
        };
      });

      setCaptions(parsed);
      setProcessProgress(100);
      showFeedback('success', `Generated ${parsed.length} accurate captions successfully!`);

      // Switch to Studio tab immediately for editing
      setActiveTab('studio');
    } catch (err) {
      console.error(err);
      showFeedback('error', err.message || 'Transcription failed.');
    } finally {
      setIsProcessing(false);
      setProcessStep('');
    }
  };

  return (
    <div
      onDragOver={handleGlobalDragOver}
      onDrop={handleGlobalDrop}
      className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased selection:bg-emerald-500 selection:text-black flex flex-col"
    >
      {/* Toast Alert */}
      <Toast feedback={feedback} onClose={() => setFeedback({ type: '', msg: '' })} />

      {/* Header */}
      <Header
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        captionsCount={captions.length}
        videoFile={videoFile}
        apiKey={apiKey}
        onOpenShortcuts={() => setIsShortcutsOpen(true)}
        onOpenImport={() => setIsImportOpen(true)}
        onResetProject={handleResetProject}
        onOpenApiKeyModal={() => setIsApiKeyOpen(true)}
      />

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-6 flex-1 w-full">
        {/* TAB 1: STUDIO (Video Player + Timeline + Subtitle Block Editor) */}
        {activeTab === 'studio' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            {/* Left Column: Player & Interactive Timeline */}
            <div className="lg:col-span-7 space-y-4 lg:sticky lg:top-20">
              <VideoPlayer
                videoRef={videoRef}
                videoUrl={videoUrl}
                videoFile={videoFile}
                captions={captions}
                currentTime={currentTime}
                setCurrentTime={setCurrentTime}
                styleConfig={styleConfig}
                videoAspectRatio={videoAspectRatio}
                setVideoAspectRatio={setVideoAspectRatio}
                onFileSelect={handleFileSelect}
              />

              {videoUrl && (
                <VisualTimeline
                  captions={captions}
                  currentTime={currentTime}
                  duration={videoDuration}
                  onSeek={handleSeekVideo}
                  onSelectCaption={(id) => {
                    const el = document.getElementById(`cap-card-${id}`);
                    el?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                  }}
                />
              )}
            </div>

            {/* Right Column: Caption List Editor */}
            <div className="lg:col-span-5 h-[calc(100vh-120px)] min-h-[500px]">
              <CaptionList
                captions={captions}
                setCaptions={setCaptions}
                currentTime={currentTime}
                onSeek={handleSeekVideo}
                onOpenFindReplace={() => setIsFindReplaceOpen(true)}
                autoScrollEnabled={autoScrollEnabled}
                setAutoScrollEnabled={setAutoScrollEnabled}
                canUndo={canUndo}
                canRedo={canRedo}
                onUndo={undo}
                onRedo={redo}
                showFeedback={showFeedback}
              />
            </div>
          </div>
        )}

        {/* TAB 2: STYLES & PRESETS */}
        {activeTab === 'style' && (
          <StyleConfigurator
            styleConfig={styleConfig}
            setStyleConfig={setStyleConfig}
            showFeedback={showFeedback}
          />
        )}

        {/* TAB 3: AI TRANSCRIBE */}
        {activeTab === 'transcribe' && (
          <TranscriptionSettings
            apiKey={apiKey}
            onKeyChange={handleKeyChange}
            saveKey={saveKey}
            setSaveKey={setSaveKey}
            selectedModel={selectedModel}
            setSelectedModel={setSelectedModel}
            selectedLanguage={selectedLanguage}
            setSelectedLanguage={setSelectedLanguage}
            extractionMethod={extractionMethod}
            setExtractionMethod={setExtractionMethod}
            customPrompt={customPrompt}
            setCustomPrompt={setCustomPrompt}
            isProcessing={isProcessing}
            processStep={processStep}
            processProgress={processProgress}
            onGenerateCaptions={handleGenerateCaptions}
            videoFile={videoFile}
          />
        )}

        {/* TAB 4: EXPORT & HARD-SUB BURN */}
        {activeTab === 'export' && (
          <ExportPanel
            videoFile={videoFile}
            captions={captions}
            styleConfig={styleConfig}
            showFeedback={showFeedback}
          />
        )}
      </main>

      {/* Modals */}
      <BatchFindReplaceModal
        isOpen={isFindReplaceOpen}
        onClose={() => setIsFindReplaceOpen(false)}
        captions={captions}
        setCaptions={setCaptions}
        showFeedback={showFeedback}
      />

      <ImportSubtitleModal
        isOpen={isImportOpen}
        onClose={() => setIsImportOpen(false)}
        setCaptions={setCaptions}
        showFeedback={showFeedback}
      />

      <KeyboardShortcutModal
        isOpen={isShortcutsOpen}
        onClose={() => setIsShortcutsOpen(false)}
      />

      <ApiKeyModal
        isOpen={isApiKeyOpen}
        onClose={() => setIsApiKeyOpen(false)}
        apiKey={apiKey}
        onKeyChange={handleKeyChange}
        saveKey={saveKey}
        setSaveKey={setSaveKey}
        showFeedback={showFeedback}
      />

      {/* Footer */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-4 text-center text-[11px] text-zinc-500 mt-auto">
        <p>Sonex Studio Pro &copy; 2026. High-performance offline audio extraction & AI speech transcription.</p>
      </footer>
    </div>
  );
}
