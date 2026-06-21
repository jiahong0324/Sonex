import { useState, useRef, useEffect } from 'react';
import localforage from 'localforage';
import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';

// --- Global Config & Helpers ---

const createSmoothOutline = (thickness, color) => {
  const steps = 64;
  const arr = [];
  for (let i = 0; i < steps; i++) {
    const theta = (i * 2 * Math.PI) / steps;
    const x = (thickness * Math.cos(theta)).toFixed(2);
    const y = (thickness * Math.sin(theta)).toFixed(2);
    arr.push(`${x}px ${y}px 1.2px ${color}`);
  }
  return arr.join(', ');
};

const SMOOTH_OUTLINE_FULLSCREEN = createSmoothOutline(4, '#fff');
const SMOOTH_OUTLINE_NORMAL = createSmoothOutline(3, '#fff');

// Standard PCM WAV encoder to convert decoded browser AudioBuffer to 16kHz mono WAV
function bufferToWav(buffer) {
  const numOfChan = buffer.numberOfChannels;
  const sampleRate = buffer.sampleRate;
  const format = 1; // 1 = Raw PCM
  const bitDepth = 16;
  
  let result;
  if (numOfChan === 2) {
    // Merge channels to mono
    const c0 = buffer.getChannelData(0);
    const c1 = buffer.getChannelData(1);
    const len = buffer.length;
    result = new Float32Array(len);
    for (let i = 0; i < len; i++) {
      result[i] = (c0[i] + c1[i]) / 2;
    }
  } else {
    result = buffer.getChannelData(0);
  }

  const bufferLength = result.length * 2; // 16-bit is 2 bytes per sample
  const wavBuffer = new ArrayBuffer(44 + bufferLength);
  const view = new DataView(wavBuffer);

  const writeString = (offset, string) => {
    for (let i = 0; i < string.length; i++) {
      view.setUint8(offset + i, string.charCodeAt(i));
    }
  };

  writeString(0, 'RIFF');
  view.setUint32(4, 36 + bufferLength, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, format, true);
  view.setUint16(22, 1, true); // Mono channel
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, sampleRate * 2, true); // Byte rate
  view.setUint16(32, 2, true); // Block align
  view.setUint16(34, bitDepth, true);
  writeString(36, 'data');
  view.setUint32(40, bufferLength, true);

  // Write samples
  let offset = 44;
  const len = result.length;
  for (let i = 0; i < len; i++) {
    let sample = Math.max(-1, Math.min(1, result[i]));
    sample = sample < 0 ? sample * 0x8000 : sample * 0x7FFF;
    view.setInt16(offset, sample, true);
    offset += 2;
  }

  return new Blob([view], { type: 'audio/wav' });
}


// Convert seconds back to "HH:MM:SS,mmm" formatted exactly
function secondsToTimeStr(seconds) {
  if (seconds < 0) seconds = 0;
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  const ms = Math.floor((seconds % 1) * 1000);

  const h = String(hours).padStart(2, '0');
  const m = String(minutes).padStart(2, '0');
  const s = String(secs).padStart(2, '0');
  const msStr = String(ms).padStart(3, '0');

  return `${h}:${m}:${s},${msStr}`;
}

// Helper to automatically wrap text to multiple lines for visual balance
function getWrappedText(text) {
  if (!text) return text;
  return text.split('\n').map(line => {
    const hasChinese = /[\u4e00-\u9fa5]/.test(line);
    const limit = hasChinese ? 10 : 20; // Break aggressively at 10 chars for Chinese, 20 for English for vertical videos
    if (line.length <= limit) return line;

    const formattedLines = [];
    if (hasChinese) {
      // Split evenly into 2 lines for best aesthetic, or more if extremely long
      // Clean up whitespace to prevent edge cases
      const cleanLine = line.trim();
      if (cleanLine.length <= limit * 2) {
        const mid = Math.ceil(cleanLine.length / 2);
        formattedLines.push(cleanLine.substring(0, mid));
        formattedLines.push(cleanLine.substring(mid));
      } else {
        for (let i = 0; i < cleanLine.length; i += limit) {
          formattedLines.push(cleanLine.substring(i, i + limit));
        }
      }
    } else {
      const words = line.split(' ');
      let currentLine = '';
      for (let word of words) {
        if ((currentLine + ' ' + word).trim().length <= limit) {
          currentLine = (currentLine + ' ' + word).trim();
        } else {
          if (currentLine) formattedLines.push(currentLine);
          currentLine = word;
        }
      }
      if (currentLine) formattedLines.push(currentLine);
    }
    return formattedLines.join('\n');
  }).join('\n');
}

// Formatter to recreate SRT
function formatSRT(captions, addSpacing = false) {
  return captions
    .map((cap, index) => {
      let wrappedText = getWrappedText(cap.text);
      if (addSpacing) {
        wrappedText = wrappedText.replace(/\n/g, '\n<font size="8"> </font>\n');
      }
      return `${index + 1}\n${cap.startStr} --> ${cap.endStr}\n${wrappedText}`;
    })
    .join('\n\n');
}

// Exponential backoff wrapper for reliable API execution
async function fetchWithBackoff(url, options, maxRetries = 5) {
  let delay = 1000;
  for (let i = 0; i < maxRetries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      // Fail fast on typical client authentication/parameter issues
      if (response.status === 400 || response.status === 401 || response.status === 403) {
        return response;
      }
    } catch (err) {
      if (i === maxRetries - 1) throw err;
    }
    await new Promise(resolve => setTimeout(resolve, delay));
    delay *= 2;
  }
  throw new Error("Failed after multiple automatic retry attempts.");
}

export default function App() {
  const envApiKey = import.meta.env.VITE_GROQ_API_KEY || '';
  const [apiKey, setApiKey] = useState(() => envApiKey || localStorage.getItem('groq_api_key') || '');
  const [saveKey, setSaveKey] = useState(true);
  const [videoFile, setVideoFile] = useState(null);
  const [videoUrl, setVideoUrl] = useState('');
  const [captions, setCaptions] = useState([]);
  const [isStateRestored, setIsStateRestored] = useState(false);

  // Restore state from IndexedDB on mount
  useEffect(() => {
    async function restoreState() {
      try {
        const storedCaptions = await localforage.getItem('sonex_captions');
        if (storedCaptions) setCaptions(storedCaptions);

        const storedFile = await localforage.getItem('sonex_videoFile');
        if (storedFile) {
          setVideoFile(storedFile);
          setVideoUrl(URL.createObjectURL(storedFile));
        }
      } catch (err) {
        console.error('Failed to restore offline state', err);
      }
      setIsStateRestored(true);
    }
    restoreState();
  }, []);

  // Auto-save state changes
  useEffect(() => {
    if (isStateRestored) {
      localforage.setItem('sonex_captions', captions);
    }
  }, [captions, isStateRestored]);


  const [extractionMethod, setExtractionMethod] = useState('extract'); // 'extract' or 'direct'
  const [selectedModel, setSelectedModel] = useState('whisper-large-v3'); // 'whisper-large-v3' or 'whisper-large-v3-turbo'
  const [isProcessing, setIsProcessing] = useState(false);
  const [processStep, setProcessStep] = useState('');
  const [processProgress, setProcessProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [searchQuery, setSearchQuery] = useState('');
  const [timeOffset, setTimeOffset] = useState(0);
  const [editCapId, setEditCapId] = useState(null);
  const [editText, setEditText] = useState('');
  const [feedback, setFeedback] = useState({ type: '', msg: '' });
  const [isFullscreen, setIsFullscreen] = useState(false);

  const videoRef = useRef(null);
  const listContainerRef = useRef(null);
  const fileInputRef = useRef(null);
  const playerContainerRef = useRef(null);

  // Store key to localStorage when updated
  const handleKeyChange = (val) => {
    setApiKey(val);
    if (saveKey) {
      localStorage.setItem('groq_api_key', val);
    } else {
      localStorage.removeItem('groq_api_key');
    }
  };

  // Video handle events
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setVideoFile(file);
      localforage.setItem('sonex_videoFile', file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setCaptions([]);
      showFeedback('success', `Successfully loaded: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB)`);
      
      // Auto toggle default extraction if large file (> 25MB requires client-side extraction)
      if (file.size > 25 * 1024 * 1024) {
        setExtractionMethod('extract');
      }
    }
  };

  const handleDragOver = (e) => {
    e.preventDefault();
  };

  const handleDrop = (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file && file.type.startsWith('video/')) {
      setVideoFile(file);
      localforage.setItem('sonex_videoFile', file);
      const url = URL.createObjectURL(file);
      setVideoUrl(url);
      setCaptions([]);
      showFeedback('success', `Dropped and loaded: ${file.name}`);
      if (file.size > 25 * 1024 * 1024) {
        setExtractionMethod('extract');
      }
    } else {
      showFeedback('error', 'Please drop a valid video file (MP4, MOV, WebM).');
    }
  };

  const showFeedback = (type, msg) => {
    setFeedback({ type, msg });
    setTimeout(() => {
      setFeedback({ type: '', msg: '' });
    }, 6000);
  };

  // Extract sound track locally
  const performAudioExtraction = async (file) => {
    setProcessStep("Reading video raw bytes...");
    setProcessProgress(15);
    const arrayBuffer = await file.arrayBuffer();

    setProcessStep("Initializing local AudioContext...");
    setProcessProgress(30);
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    const audioCtx = new AudioContextClass({ sampleRate: 16000 }); // Optimize size to perfect speech rate (16kHz)

    setProcessStep("Extracting and decoding audio track (client-side)...");
    setProcessProgress(55);
    try {
      const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
      setProcessStep("Encoding audio to robust mono WAV...");
      setProcessProgress(85);
      const wavBlob = bufferToWav(audioBuffer);
      setProcessProgress(100);
      return wavBlob;
    } catch (err) {
      console.error(err);
      throw new Error("Client-side video audio decoding failed. Please use a smaller clip or try direct upload.", { cause: err });
    }
  };

  // Generate captions logic using Groq API
  const handleGenerateCaptions = async () => {
    if (!apiKey.trim()) {
      showFeedback('error', 'Please provide a valid API Key first.');
      return;
    }
    if (!videoFile) {
      showFeedback('error', 'Please select or drop a video file.');
      return;
    }

    setIsProcessing(true);
    setProcessProgress(5);
    
    try {
      let fileToSend = videoFile;

      if (extractionMethod === 'extract') {
        setProcessStep("Starting client-side audio extraction...");
        try {
          const audioBlob = await performAudioExtraction(videoFile);
          fileToSend = new File([audioBlob], 'audio.wav', { type: 'audio/wav' });
          showFeedback('success', `Extracted compact audio track: ${(fileToSend.size / (1024 * 1024)).toFixed(2)} MB`);
        } catch (err) {
          showFeedback('error', err.message + ' Attempting to continue with direct file.');
          fileToSend = videoFile;
        }
      }

      // Check max limits for Groq API (usually 25MB)
      if (fileToSend.size > 25 * 1024 * 1024) {
        throw new Error("The target file exceeds the 25MB hard limit. Please check 'Extract audio client-side' or upload a smaller file.");
      }

      setProcessStep("Connecting and sending audio payload to API...");
      setProcessProgress(50);

      const formData = new FormData();
      formData.append('file', fileToSend);
      formData.append('model', selectedModel);
      formData.append('response_format', 'verbose_json');
      formData.append('prompt', 'Export with standard professional subtitling punctuation and phrasing.');

      const response = await fetchWithBackoff('https://api.groq.com/openai/v1/audio/transcriptions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`
        },
        body: formData
      });

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error?.message || `API responded with code: ${response.status}`);
      }

      setProcessStep("Processing output returned from API...");
      setProcessProgress(90);

      const resJson = await response.json();
      if (!resJson.segments || !Array.isArray(resJson.segments)) {
        throw new Error("API succeeded but did not return any time-segmented transcription blocks.");
      }

      // Post-process to break long segments into short chunks for Shorts/Reels format
      let refinedSegments = [];
      resJson.segments.forEach(seg => {
        let text = seg.text.trim();
        if (!text) return;
        
        // Split by standard punctuation to keep ideas grouped
        const chunks = text.match(/(.*?[，。？！,.?!；;]+|.+)/g) || [text];
        
        const finalChunks = [];
        chunks.forEach(chunk => {
          let c = chunk.trim();
          if (!c) return;
          // Split long chunks > 18 characters (great for Chinese and English shorts)
          while (c.length > 18) {
             let splitIdx = 18;
             const spaceIdx = c.lastIndexOf(' ', 18);
             if (spaceIdx > 10) splitIdx = spaceIdx; // split at space if available
             finalChunks.push(c.substring(0, splitIdx).trim());
             c = c.substring(splitIdx).trim();
          }
          if (c) finalChunks.push(c);
        });

        const totalChars = finalChunks.reduce((acc, c) => acc + c.length, 0);
        const duration = seg.end - seg.start;
        let currentTime = seg.start;

        finalChunks.forEach(chunk => {
          const chunkDuration = totalChars > 0 ? (chunk.length / totalChars) * duration : duration;
          
          // Clean up the text by stripping ending punctuation (looks much nicer on short videos)
          const cleanText = chunk.replace(/[，。？！,.?!；;]+$/, '').trim();
          
          if (cleanText) {
            refinedSegments.push({
              start: currentTime,
              end: currentTime + chunkDuration,
              text: cleanText
            });
          }
          currentTime += chunkDuration;
        });
      });

      // Convert segments directly into structured SRT formats
      const parsed = refinedSegments.map((seg, index) => {
        let text = getWrappedText(seg.text);

        return {
          id: index + 1,
          startTime: seg.start,
          endTime: seg.end,
          startStr: secondsToTimeStr(seg.start),
          endStr: secondsToTimeStr(seg.end),
          text: text
        };
      });

      setCaptions(parsed);
      setProcessProgress(100);
      showFeedback('success', `Generated ${parsed.length} accurate captions successfully!`);
    } catch (err) {
      console.error(err);
      showFeedback('error', err.message);
    } finally {
      setIsProcessing(false);
      setProcessStep('');
    }
  };

  // Offset shifting logic
  const handleApplyShift = () => {
    if (captions.length === 0) return;
    const shift = parseFloat(timeOffset);
    if (isNaN(shift) || shift === 0) return;

    const updated = captions.map(cap => {
      let newStart = Math.max(0, cap.startTime + shift);
      let newEnd = Math.max(0, cap.endTime + shift);
      return {
        ...cap,
        startTime: newStart,
        endTime: newEnd,
        startStr: secondsToTimeStr(newStart),
        endStr: secondsToTimeStr(newEnd)
      };
    });

    setCaptions(updated);
    setTimeOffset(0);
    showFeedback('success', `Shifted all caption timestamps by ${shift > 0 ? '+' : ''}${shift} seconds.`);
  };

  // Editing logic
  const handleStartEdit = (cap) => {
    setEditCapId(cap.id);
    setEditText(cap.text);
  };

  const handleSaveEdit = (id) => {
    setCaptions(prev => prev.map(cap => cap.id === id ? { ...cap, text: editText } : cap));
    setEditCapId(null);
  };

  // Fix native fullscreen hijacking
  useEffect(() => {
    const handleFullscreenChange = () => {
      const isFs = !!document.fullscreenElement;
      setIsFullscreen(isFs);

      if (document.fullscreenElement === videoRef.current) {
        document.exitFullscreen().then(() => {
          if (playerContainerRef.current) {
            playerContainerRef.current.requestFullscreen();
          }
        }).catch(e => console.error(e));
      }
    };
    
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    
    return () => {
      document.removeEventListener('fullscreenchange', handleFullscreenChange);
      document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
    };
  }, []);

  const lastActiveIdRef = useRef(null);

  // Auto scroll caption list with video playing status
  useEffect(() => {
    const active = captions.find(cap => currentTime >= cap.startTime && currentTime <= cap.endTime);
    if (active && active.id !== lastActiveIdRef.current) {
      lastActiveIdRef.current = active.id;
      const element = document.getElementById(`cap-block-${active.id}`);
      if (element && listContainerRef.current) {
        const container = listContainerRef.current;
        const rect = element.getBoundingClientRect();
        const containerRect = container.getBoundingClientRect();
        
        if (rect.top < containerRect.top || rect.bottom > containerRect.bottom) {
          element.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
      }
    } else if (!active) {
      lastActiveIdRef.current = null;
    }
  }, [currentTime, captions]);

  // Download logic (UTF-8, No BOM as requested)
  const handleDownloadSRT = () => {
    if (captions.length === 0) return;
    const finalSrtContent = formatSRT(captions);
    const blob = new Blob([finalSrtContent], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    const cleanName = videoFile ? videoFile.name.substring(0, videoFile.name.lastIndexOf('.')) : 'captions';
    a.download = `${cleanName}_Sonex.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showFeedback('success', 'SRT Captions file successfully generated and saved!');
  };

  // Burn subtitles into video directly using FFmpeg.wasm
  const handleBurnSubtitles = async () => {
    if (!videoFile || captions.length === 0) return;
    setIsProcessing(true);
    setProcessStep("Loading FFmpeg Video Engine...");
    setProcessProgress(5);

    try {
      const ffmpeg = new FFmpeg();
      
      ffmpeg.on('progress', ({ progress }) => {
        setProcessProgress(Math.max(10, Math.floor(progress * 100)));
      });

      // Load bundled core from our own static server (bypasses unpkg blockers entirely)
      const baseURL = window.location.origin;
      await ffmpeg.load({
        coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
        wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm')
      });

      setProcessStep("Preparing video & subtitles in virtual file system...");
      setProcessProgress(15);

      const ext = videoFile.name ? videoFile.name.split('.').pop() : 'mp4';
      const inputName = `input.${ext}`;
      await ffmpeg.writeFile(inputName, await fetchFile(videoFile));
      
      const srtContent = formatSRT(captions, true);
      const srtBlob = new Blob([srtContent], { type: 'text/plain' });
      await ffmpeg.writeFile('subs.srt', await fetchFile(srtBlob));

      setProcessStep("Loading fonts for subtitle rendering...");
      await ffmpeg.createDir('/fonts');
      await ffmpeg.writeFile('/fonts/font.ttf', await fetchFile(`${baseURL}/font.ttf`));

      setProcessStep("Rendering social media ready video (this may take a while)...");
      setProcessProgress(20);

      ffmpeg.on('log', ({ message }) => {
        console.log('[FFmpeg]', message);
      });

      // Burn the subtitles directly into the video frames (hard subs)
      const execCode = await ffmpeg.exec([
        '-i', inputName,
        '-vf', "subtitles=subs.srt:fontsdir=/fonts:force_style='PrimaryColour=&H00000000,OutlineColour=&H00FFFFFF,Outline=2,Shadow=1,MarginV=25,Alignment=2,FontSize=24,Bold=1'",
        '-c:v', 'libx264',
        '-preset', 'ultrafast',
        '-c:a', 'copy',
        'output.mp4'
      ]);

      if (execCode !== 0) {
        throw new Error(`FFmpeg processing failed (code ${execCode}). See console for details.`);
      }

      setProcessStep("Finalizing video export...");
      setProcessProgress(99);

      const data = await ffmpeg.readFile('output.mp4');
      const videoBlob = new Blob([data.buffer], { type: 'video/mp4' });
      const exportUrl = URL.createObjectURL(videoBlob);
      
      const a = document.createElement('a');
      a.href = exportUrl;
      const cleanName = videoFile.name ? videoFile.name.substring(0, videoFile.name.lastIndexOf('.')) : 'export';
      a.download = `${cleanName}_Subtitled.mp4`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(exportUrl);

      // Download SRT alongside the video
      const finalSrtContent = formatSRT(captions);
      const srtBlobObj = new Blob([finalSrtContent], { type: 'text/plain;charset=utf-8' });
      const srtUrl = URL.createObjectURL(srtBlobObj);
      const srtA = document.createElement('a');
      srtA.href = srtUrl;
      srtA.download = `${cleanName}_Sonex.srt`;
      document.body.appendChild(srtA);
      srtA.click();
      document.body.removeChild(srtA);
      URL.revokeObjectURL(srtUrl);

      showFeedback('success', 'Video and Captions successfully downloaded!');
    } catch (err) {
      console.error(err);
      const errMsg = err?.message || (typeof err === 'string' ? err : 'Unknown FFmpeg execution error');
      showFeedback('error', 'Failed to render subtitles: ' + errMsg);
    } finally {
      setIsProcessing(false);
      setProcessStep('');
    }
  };

  // Highlight matches in list
  const filteredCaptions = captions.filter(cap => 
    cap.text.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100 font-sans antialiased selection:bg-emerald-500 selection:text-black">
      
      {/* Top Header / Branding */}
      <header className="border-b border-zinc-900 bg-zinc-950/80 backdrop-blur sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex-shrink-0 overflow-hidden rounded-xl shadow-lg shadow-emerald-500/10">
              <img src="/logo.png" alt="Sonex Logo" className="w-10 h-10 object-cover" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold tracking-tight text-white flex items-center gap-2">
                Sonex Caption Master
              </h1>
              <p className="text-xs text-zinc-400">Generate, customize & clean up video speech captions instantaneously</p>
            </div>
          </div>
          
          {/* Global Alert / Toast Notifications */}
          {feedback.msg && (
            <div className={`px-4 py-2.5 rounded-xl text-sm border flex items-center gap-2 animate-fade-in ${
              feedback.type === 'success' 
                ? 'bg-emerald-950/40 text-emerald-300 border-emerald-800/60 shadow-lg shadow-emerald-500/5' 
                : 'bg-rose-950/40 text-rose-300 border-rose-800/60 shadow-lg shadow-rose-500/5'
            }`}>
              <div className={`w-2 h-2 rounded-full ${feedback.type === 'success' ? 'bg-emerald-400' : 'bg-rose-400'} animate-pulse`} />
              <span>{feedback.msg}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 py-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
        
        {/* Left Side: Setup, Video Player, controls */}
        <section className="lg:col-span-7 space-y-6">
          
          {/* Box 1: Configuration & API Key */}
          {!envApiKey && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-400 flex items-center gap-2">
                  <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                  </svg>
                  1. API Authorization
                </h2>
                <label className="flex items-center gap-2 text-xs text-zinc-500 cursor-pointer">
                  <input 
                    type="checkbox" 
                    checked={saveKey} 
                    onChange={(e) => {
                      setSaveKey(e.target.checked);
                      if (!e.target.checked) localStorage.removeItem('groq_api_key');
                    }}
                    className="rounded bg-zinc-950 border-zinc-800 text-emerald-500 focus:ring-emerald-500 focus:ring-offset-zinc-900"
                  />
                  Remember key in this browser
                </label>
              </div>
              
              <div className="relative">
                <input
                  type="password"
                  placeholder="gsk_..."
                  value={apiKey}
                  onChange={(e) => handleKeyChange(e.target.value)}
                  className="w-full bg-zinc-950 border border-zinc-800 rounded-xl px-4 py-2.5 text-sm text-zinc-100 placeholder-zinc-600 focus:outline-none focus:ring-2 focus:ring-emerald-500/40 focus:border-emerald-500 transition-all font-mono"
                />
                <span className="absolute right-3 top-3 text-[10px] bg-zinc-855 text-emerald-400 px-2 py-0.5 rounded font-mono uppercase tracking-wider font-bold">
                  API SECURE
                </span>
              </div>
              <p className="text-xs text-zinc-500">
                Your API keys are never stored on external servers. All connections occur directly inside your browser to the high-speed endpoint.
              </p>
            </div>
          )}

          {/* Box 2: Drag & Drop Media Upload Area */}
          {captions.length === 0 && (
            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className={`border-2 border-dashed rounded-2xl p-8 text-center transition-all cursor-pointer ${
                videoFile 
                  ? 'border-emerald-500/40 bg-emerald-500/[0.02]' 
                  : 'border-zinc-800 hover:border-zinc-700 bg-zinc-900/20'
              }`}
              onClick={() => fileInputRef.current.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="video/mp4, video/quicktime, video/webm" 
                className="hidden" 
              />
              
              <div className="max-w-md mx-auto space-y-3">
                <div className="mx-auto w-12 h-12 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-semibold text-zinc-200">
                    {videoFile ? videoFile.name : 'Drag & Drop Video here, or click to browse'}
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Supports MP4, MOV, and WebM video containers
                  </p>
                </div>

                {videoFile && (
                  <div className="inline-flex items-center gap-2 bg-zinc-800 text-zinc-300 px-3 py-1 rounded-full text-xs">
                    <span className="w-2 h-2 rounded-full bg-emerald-400"></span>
                    {(videoFile.size / (1024 * 1024)).toFixed(1)} MB
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Box 3: Model Selector, Extraction Mode Switch & Captions Generator Action */}
          {videoFile && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-4">
              <h2 className="text-sm font-semibold tracking-wide uppercase text-zinc-400 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                </svg>
                2. Transcription Settings
              </h2>

              {/* Model Choice */}
              <div className="space-y-1.5">
                <label className="text-xs text-zinc-400 font-semibold">Select Whisper Model</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedModel('whisper-large-v3')}
                    className={`px-3 py-2 text-xs rounded-xl font-medium border text-left transition-all ${
                      selectedModel === 'whisper-large-v3'
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-bold text-sm">Pro Max</div>
                    <div className="text-[10px] text-zinc-500 mt-1">Maximum accuracy & multilingual support. The ultimate transcription model.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedModel('whisper-large-v3-turbo')}
                    className={`px-3 py-2 text-xs rounded-xl font-medium border text-left transition-all ${
                      selectedModel === 'whisper-large-v3-turbo'
                        ? 'border-emerald-500 bg-emerald-500/10 text-white'
                        : 'border-zinc-800 bg-zinc-950 text-zinc-400 hover:border-zinc-700'
                    }`}
                  >
                    <div className="font-bold text-sm">Pro</div>
                    <div className="text-[10px] text-zinc-500 mt-1">Blazing speeds & responsive translation for rapid processing.</div>
                  </button>
                </div>
              </div>



              {!isProcessing ? (
                <button
                  type="button"
                  onClick={handleGenerateCaptions}
                  className="w-full bg-gradient-to-r from-emerald-500 to-teal-600 hover:from-emerald-400 hover:to-teal-500 text-black py-3.5 px-6 rounded-xl font-bold tracking-wide shadow-xl shadow-emerald-950/20 active:scale-[0.98] transition-all flex items-center justify-center gap-2 mt-4"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                  Generate Captions
                </button>
              ) : (
                <div className="space-y-3 p-4 bg-zinc-950 border border-zinc-800 rounded-xl mt-4">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-emerald-400 font-semibold animate-pulse">
                      {processStep || 'Processing... Please wait'}
                    </span>
                    <span className="text-zinc-500">{processProgress}%</span>
                  </div>
                  <div className="w-full h-1.5 bg-zinc-850 rounded-full overflow-hidden">
                    <div 
                      className="h-full bg-emerald-500 transition-all duration-300"
                      style={{ width: `${processProgress}%` }}
                    />
                  </div>
                  <p className="text-[10px] text-zinc-500 text-center italic">
                    Note: Audio transcription takes roughly 2-5 seconds on the server. Keep this page open.
                  </p>
                </div>
              )}
            </div>
          )}

          {/* Box 4: Interactive Video Preview Player */}
          {videoUrl && (
            <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 space-y-3">
              <h3 className="text-sm font-semibold uppercase tracking-wider text-zinc-400 flex items-center gap-2">
                <svg className="w-4 h-4 text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Media Preview & Player
              </h3>
              <div ref={playerContainerRef} className={`relative rounded-xl overflow-hidden bg-black border border-zinc-800 group ${isFullscreen ? 'w-full h-full flex flex-col justify-center' : 'aspect-video'}`}>
                <video
                  ref={videoRef}
                  src={videoUrl}
                  controls
                  controlsList="nofullscreen"
                  className="w-full h-full object-contain"
                  onTimeUpdate={(e) => setCurrentTime(e.target.currentTime)}
                />
                
                {/* Custom Fullscreen Button that preserves overlays */}
                <button
                  type="button"
                  onClick={() => {
                    if (document.fullscreenElement) {
                      document.exitFullscreen();
                    } else if (playerContainerRef.current) {
                      playerContainerRef.current.requestFullscreen();
                    }
                  }}
                  className="absolute top-4 right-4 bg-black/70 hover:bg-black text-white p-2 rounded-lg transition-opacity z-10 shadow-lg"
                  title="Fullscreen with Captions"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                  </svg>
                </button>
                
                {/* On-screen visual subtitle layer to test visual flow */}
                {captions.length > 0 && (
                  <div className={`absolute left-4 right-4 text-center pointer-events-none drop-shadow-[0_4px_8px_rgba(0,0,0,0.9)] ${
                    isFullscreen ? 'bottom-44 md:bottom-52' : 'bottom-24 md:bottom-28'
                  }`}>
                    {captions.map((cap) => {
                      if (currentTime >= cap.startTime && currentTime <= cap.endTime) {
                        return (
                          <span key={cap.id} 
                                className={`text-black font-black inline-block break-words whitespace-pre-wrap leading-[1.5] tracking-[0.1em] ${
                                  isFullscreen
                                    ? 'text-3xl md:text-4xl max-w-[90%] md:max-w-2xl'
                                    : 'text-xl md:text-2xl max-w-[90%] md:max-w-lg'
                                }`}
                                style={{
                                  textShadow: isFullscreen
                                    ? SMOOTH_OUTLINE_FULLSCREEN
                                    : SMOOTH_OUTLINE_NORMAL
                                }}>
                            {getWrappedText(cap.text)}
                          </span>
                        );
                      }
                      return null;
                    })}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Quick instructions / tips box */}
          <div className="bg-zinc-950 border border-zinc-900 rounded-2xl p-5 space-y-3">
            <h4 className="text-xs font-bold text-emerald-400 uppercase tracking-widest">
              Pro workflow for Sonex:
            </h4>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-[11px] text-zinc-400">
              <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/40">
                <div className="text-zinc-300 font-bold mb-1">Step 1</div>
                Generate and edit captions using this web app.
              </div>
              <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/40">
                <div className="text-zinc-300 font-bold mb-1">Step 2</div>
                Click the prominent green download button below.
              </div>
              <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/40">
                <div className="text-zinc-300 font-bold mb-1">Step 3</div>
                In your video editor: Go to <span className="text-zinc-200 font-semibold">Text</span> &rarr; <span className="text-zinc-200 font-semibold">Local Captions</span>.
              </div>
              <div className="p-3 bg-zinc-900/40 rounded-xl border border-zinc-800/40">
                <div className="text-zinc-300 font-bold mb-1">Step 4</div>
                Click <span className="text-zinc-200 font-semibold">Import</span> and load the generated .srt file.
              </div>
            </div>
          </div>

          {/* Bottom Upload Area for New Video */}
          {captions.length > 0 && (
            <div 
              onDragOver={handleDragOver}
              onDrop={handleDrop}
              className="border-2 border-dashed border-zinc-800 hover:border-emerald-500/50 bg-zinc-900/20 hover:bg-emerald-500/5 rounded-2xl p-6 text-center transition-all cursor-pointer"
              onClick={() => fileInputRef.current.click()}
            >
              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="video/mp4, video/quicktime, video/webm" 
                className="hidden" 
              />
              
              <div className="max-w-md mx-auto space-y-3">
                <div className="mx-auto w-10 h-10 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                  </svg>
                </div>
                <div>
                  <p className="text-sm font-bold text-zinc-200">
                    Upload a new video
                  </p>
                  <p className="text-xs text-zinc-500 mt-1">
                    Drag & Drop Video here, or click to browse
                  </p>
                </div>
              </div>
            </div>
          )}
        </section>

        {/* Right Side: Caption Editor & Export Tools */}
        <section className="lg:col-span-5 flex flex-col h-[calc(100vh-140px)] min-h-[500px]">
          
          <div className="bg-zinc-900/60 border border-zinc-800 rounded-2xl p-5 flex flex-col h-full space-y-4">
            
            {/* Download SRT Button block */}
            {captions.length > 0 ? (
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  onClick={handleDownloadSRT}
                  className="group relative w-full py-3.5 px-6 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 active:scale-[0.98] text-black font-extrabold tracking-wide text-center rounded-xl flex items-center justify-center gap-3 shadow-[0_0_20px_rgba(16,185,129,0.15)] hover:shadow-[0_0_30px_rgba(16,185,129,0.3)] transition-all duration-300 transform hover:-translate-y-0.5 text-base overflow-hidden"
                >
                  <div className="absolute inset-0 bg-white/20 translate-y-full group-hover:translate-y-0 transition-transform duration-300 ease-in-out"></div>
                  <svg className="w-5 h-5 stroke-current fill-none stroke-2 relative z-10" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  <span className="relative z-10">Download SRT File</span>
                </button>
                <button
                  type="button"
                  disabled
                  className="group relative w-full py-3.5 px-6 bg-zinc-900/50 text-emerald-400/50 font-bold tracking-wide text-center rounded-xl flex items-center justify-center gap-3 border border-emerald-500/20 text-base overflow-hidden cursor-not-allowed"
                >
                  <svg className="w-5 h-5 text-emerald-500/50 relative z-10" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                  </svg>
                  <span className="relative z-10">Render for Social Media (coming)</span>
                </button>
              </div>
            ) : (
              <div className="p-4 bg-zinc-950 border border-dashed border-zinc-800 rounded-xl text-center text-xs text-zinc-500">
                No captions generated yet. Fill in your API Key and upload a video to generate captions.
              </div>
            )}

            {/* Timestamps Global Offset Adjuster */}
            {captions.length > 0 && (
              <div className="bg-zinc-950 border border-zinc-800 p-3.5 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-400">Shift Timestamps (Seconds)</label>
                  <span className="text-[10px] text-zinc-500">Fix out of sync audio</span>
                </div>
                <div className="flex gap-2">
                  <input
                    type="number"
                    step="0.1"
                    placeholder="-1.5 or 0.5"
                    value={timeOffset || ''}
                    onChange={(e) => setTimeOffset(parseFloat(e.target.value) || 0)}
                    className="flex-1 bg-zinc-900 border border-zinc-850 rounded-lg px-3 py-1.5 text-xs text-white focus:outline-none focus:ring-1 focus:ring-emerald-500"
                  />
                  <button
                    type="button"
                    onClick={handleApplyShift}
                    className="bg-zinc-800 hover:bg-zinc-700 text-zinc-100 text-xs px-3.5 py-1.5 rounded-lg transition-all font-semibold"
                  >
                    Apply Offset
                  </button>
                </div>
              </div>
            )}

            {/* Captions search bar / counters */}
            <div className="flex items-center justify-between gap-4">
              <h3 className="text-sm font-bold text-zinc-300">
                Captions List ({filteredCaptions.length})
              </h3>
              {captions.length > 0 && (
                <input
                  type="text"
                  placeholder="Search word..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="bg-zinc-950 border border-zinc-800 rounded-lg px-3 py-1 text-xs text-zinc-200 placeholder-zinc-600 focus:outline-none focus:ring-1 focus:ring-emerald-500 w-32 focus:w-44 transition-all"
                />
              )}
            </div>

            {/* Captions scrollable list */}
            <div 
              ref={listContainerRef}
              className="flex-1 overflow-y-auto pr-1 space-y-2.5 custom-scrollbar"
            >
              {filteredCaptions.map((cap) => {
                const isActive = currentTime >= cap.startTime && currentTime <= cap.endTime;
                const isEditing = editCapId === cap.id;

                return (
                  <div
                    key={cap.id}
                    id={`cap-block-${cap.id}`}
                    onClick={() => {
                      if (videoRef.current && !isEditing) {
                        videoRef.current.currentTime = cap.startTime;
                      }
                    }}
                    className={`p-3.5 rounded-xl transition-all border cursor-pointer ${
                      isActive 
                        ? 'bg-emerald-500/10 border-emerald-500 shadow-md shadow-emerald-500/5' 
                        : 'bg-zinc-950 hover:bg-zinc-900 border-zinc-800'
                    }`}
                  >
                    <div className="flex items-center justify-between text-[11px] text-zinc-400 mb-1.5">
                      <div className="flex items-center gap-2">
                        <span className="font-mono bg-zinc-850 px-1.5 py-0.5 rounded text-zinc-300">
                          #{cap.id}
                        </span>
                        <span className={`font-mono ${isActive ? 'text-emerald-400 font-bold' : ''}`}>
                          {cap.startStr} &rarr; {cap.endStr}
                        </span>
                      </div>
                      
                      <div className="flex items-center gap-1.5">
                        {isEditing ? (
                          <>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleSaveEdit(cap.id);
                              }}
                              className="text-emerald-400 hover:text-emerald-300 px-1.5 py-0.5 rounded bg-emerald-950/40"
                            >
                              Save
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setEditCapId(null);
                              }}
                              className="text-zinc-400 hover:text-zinc-200 px-1.5"
                            >
                              Cancel
                            </button>
                          </>
                        ) : (
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleStartEdit(cap);
                            }}
                            className="text-zinc-500 hover:text-zinc-300 p-1 rounded hover:bg-zinc-800"
                            title="Edit this block"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                            </svg>
                          </button>
                        )}
                      </div>
                    </div>

                    {isEditing ? (
                      <textarea
                        value={editText}
                        onChange={(e) => setEditText(e.target.value)}
                        onClick={(e) => e.stopPropagation()}
                        className="w-full bg-zinc-900 border border-zinc-700 rounded-lg p-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none font-medium h-20"
                      />
                    ) : (
                      <p className={`text-sm leading-relaxed ${isActive ? 'text-white font-medium' : 'text-zinc-300'}`}>
                        {cap.text}
                      </p>
                    )}

                    {/* CapCut layout preview guideline indicator */}
                    {!isEditing && cap.text.length > 42 && (
                      <div className="mt-1.5 text-[10px] text-amber-500/80 flex items-center gap-1">
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                        </svg>
                        <span>Exceeds optimal length (~42 chars). Text will wrap automatically on import.</span>
                      </div>
                    )}
                  </div>
                );
              })}

              {captions.length > 0 && filteredCaptions.length === 0 && (
                <div className="py-12 text-center text-zinc-500 text-sm">
                  No matching words found for search query "{searchQuery}".
                </div>
              )}

              {captions.length === 0 && (
                <div className="flex flex-col items-center justify-center h-full py-16 text-zinc-600">
                  <svg className="w-10 h-10 mb-2 stroke-current opacity-40" fill="none" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.5" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                  </svg>
                  <p className="text-xs">Your transcriptions will appear in this sidebar panel.</p>
                </div>
              )}
            </div>

            {/* Bottom info stats bar */}
            {captions.length > 0 && (
              <div className="pt-3 border-t border-zinc-850 flex items-center justify-between text-[11px] text-zinc-500 font-mono">
                <span>Total Dur: {secondsToTimeStr(captions[captions.length - 1].endTime)}</span>
                <span>Blocks: {captions.length}</span>
                <span className="flex items-center gap-1 text-emerald-400">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                  Sonex Ready
                </span>
              </div>
            )}

          </div>
        </section>
        
      </main>
      
      {/* Footer Info */}
      <footer className="border-t border-zinc-900 bg-zinc-950 py-8 text-center text-xs text-zinc-600 mt-12 space-y-1">
        <p>Built exclusively for rapid video subtitling workflows. All formatting matches exact local text importing engines.</p>
        <p>&copy; 2026 Sonex Workspace. Local offline audio extraction.</p>
      </footer>
    </div>
  );
}
