import { pipeline, env } from '@huggingface/transformers';

// Configure transformers.js environment for browser worker
env.allowLocalModels = false;
env.useBrowserCache = true;

let currentTranscriber = null;
let currentModelId = null;
let currentDevice = null;

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'TRANSCRIBE') {
    try {
      await runTranscription(payload);
    } catch (err) {
      self.postMessage({
        type: 'ERROR',
        payload: {
          message: err?.message || 'Transcription failed in worker.',
          stack: err?.stack,
        },
      });
    }
  }
};

async function runTranscription(payload) {
  const {
    audioData, // Float32Array at 16kHz mono
    modelName = 'onnx-community/whisper-tiny_timestamped',
    device = 'webgpu', // 'webgpu' | 'wasm'
    language = 'auto',
    task = 'transcribe',
  } = payload;

  self.postMessage({
    type: 'PROGRESS',
    payload: {
      phase: 'loading-model',
      percent: 5,
      message: `Loading AI Whisper model (${device.toUpperCase()})...`,
    },
  });

  // Re-use model instance if same model and device
  if (!currentTranscriber || currentModelId !== modelName || currentDevice !== device) {
    const isWebGPU = device === 'webgpu';

    currentTranscriber = await pipeline('automatic-speech-recognition', modelName, {
      device,
      dtype: isWebGPU ? 'fp32' : 'q8',
      progress_callback: (prog) => {
        if (prog.status === 'progress' && typeof prog.progress === 'number') {
          const file = prog.file || 'model';
          self.postMessage({
            type: 'MODEL_LOAD_PROGRESS',
            payload: {
              phase: 'downloading-model',
              file,
              loaded: prog.loaded,
              total: prog.total,
              percent: Math.round(prog.progress),
              message: `Downloading ${file} (${Math.round(prog.progress)}%)...`,
            },
          });
        }
      },
    });

    currentModelId = modelName;
    currentDevice = device;
  }

  self.postMessage({
    type: 'PROGRESS',
    payload: {
      phase: 'transcribing',
      percent: 30,
      message: 'Running high-precision Whisper neural inference...',
    },
  });

  const options = {
    chunk_length_s: 30,
    stride_length_s: 5,
    return_timestamps: 'word',
    task: task === 'translate' ? 'translate' : 'transcribe',
  };

  if (language && language !== 'auto') {
    options.language = language;
  }

  const startTime = performance.now();
  const output = await currentTranscriber(audioData, options);
  const durationSec = (performance.now() - startTime) / 1000;

  self.postMessage({
    type: 'PROGRESS',
    payload: {
      phase: 'structuring',
      percent: 90,
      message: 'Formatting timestamps and word-level social media blocks...',
    },
  });

  // Parse output into structured chunks with words
  const parsedCaptions = structureWhisperOutput(output);

  self.postMessage({
    type: 'COMPLETE',
    payload: {
      captions: parsedCaptions,
      rawText: output.text,
      durationSec,
      device: currentDevice,
    },
  });
}

/**
 * Convert Whisper word timestamps into punchy, mobile-optimized social media subtitle blocks
 */
function structureWhisperOutput(output) {
  const rawChunks = output.chunks || [];
  if (rawChunks.length === 0 && output.text) {
    return [
      {
        id: 1,
        startTime: 0,
        endTime: 4,
        startStr: '00:00:00,000',
        endStr: '00:00:04,000',
        text: output.text.trim(),
        words: [],
      },
    ];
  }

  const words = [];
  rawChunks.forEach((item) => {
    const text = (item.text || '').trim();
    if (!text) return;
    const start = Array.isArray(item.timestamp) ? item.timestamp[0] : 0;
    const end = Array.isArray(item.timestamp) ? (item.timestamp[1] ?? start + 0.3) : start + 0.3;

    words.push({
      word: text,
      start: typeof start === 'number' ? start : 0,
      end: typeof end === 'number' ? end : (typeof start === 'number' ? start + 0.3 : 0.3),
    });
  });

  if (words.length === 0) return [];

  // Group words into punchy lines (max ~14 chars for Chinese, ~24 chars for English)
  const blocks = [];
  let currentGroup = [];
  let currentChars = 0;

  words.forEach((w) => {
    const hasChinese = /[\u4e00-\u9fa5]/.test(w.word);
    const maxLen = hasChinese ? 14 : 26;
    const isPunctuationEnd = /[，。？！,.?!；;]$/.test(w.word);

    if (currentGroup.length > 0 && (currentChars + w.word.length > maxLen || isPunctuationEnd)) {
      currentGroup.push(w);
      blocks.push(buildCaptionBlock(blocks.length + 1, currentGroup));
      currentGroup = [];
      currentChars = 0;
    } else {
      currentGroup.push(w);
      currentChars += w.word.length + 1;
    }
  });

  if (currentGroup.length > 0) {
    blocks.push(buildCaptionBlock(blocks.length + 1, currentGroup));
  }

  return blocks;
}

function buildCaptionBlock(id, group) {
  const startTime = group[0].start;
  const endTime = group[group.length - 1].end || startTime + 1;
  const text = group.map((g) => g.word).join(' ').trim();

  return {
    id,
    startTime,
    endTime,
    startStr: secondsToTimeStr(startTime),
    endStr: secondsToTimeStr(endTime),
    text,
    words: group,
  };
}

function secondsToTimeStr(seconds) {
  const s = Math.max(0, seconds || 0);
  const hrs = Math.floor(s / 3600);
  const mins = Math.floor((s % 3600) / 60);
  const secs = Math.floor(s % 60);
  const ms = Math.floor((s % 1) * 1000);

  const pad = (n, len = 2) => String(n).padStart(len, '0');
  return `${pad(hrs)}:${pad(mins)}:${pad(secs)},${pad(ms, 3)}`;
}
