/**
 * In-Browser Whisper Speech Recognition Controller
 * Powered by @huggingface/transformers
 * Features: WebGPU first, WASM fallback, 45s hang detection watchdog, 16kHz audio preprocessing.
 */

import { secondsToTimeStr } from './timeUtils';

export async function checkWebGPU() {
  if (typeof navigator === 'undefined' || !navigator.gpu) return false;
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return adapter !== null;
  } catch {
    return false;
  }
}

/**
 * Decode video file into 16kHz mono Float32Array using Web Audio API
 */
export async function extractAudioFloat32(videoFile, onProgress) {
  if (onProgress) onProgress(10, 'Reading video audio track bytes...');
  const arrayBuffer = await videoFile.arrayBuffer();

  if (onProgress) onProgress(30, 'Initializing Web Audio resampler (16kHz)...');
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let audioCtx;
  try {
    audioCtx = new AudioContextClass({ sampleRate: 16000 });
  } catch {
    audioCtx = new AudioContextClass();
  }

  if (audioCtx.state === 'suspended') {
    await audioCtx.resume().catch(() => {});
  }

  if (onProgress) onProgress(50, 'Decoding and resampling audio track...');
  let audioBuffer;
  try {
    audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
  } finally {
    if (audioCtx.close) audioCtx.close().catch(() => {});
  }

  if (onProgress) onProgress(80, 'Converting channels to 16kHz mono Float32Array...');

  const numChannels = audioBuffer.numberOfChannels;
  const length = audioBuffer.length;
  let monoFloat32;

  if (numChannels === 1) {
    monoFloat32 = audioBuffer.getChannelData(0);
  } else {
    monoFloat32 = new Float32Array(length);
    const c0 = audioBuffer.getChannelData(0);
    const c1 = audioBuffer.getChannelData(1);
    for (let i = 0; i < length; i++) {
      monoFloat32[i] = (c0[i] + c1[i]) / 2;
    }
  }

  if (onProgress) onProgress(100, 'Audio preprocessing ready.');
  return monoFloat32;
}

/**
 * Run Local Whisper Speech Recognition in Web Worker
 */
export async function transcribeWithWhisper({
  videoFile,
  modelName = 'onnx-community/whisper-tiny_timestamped',
  language = 'auto',
  task = 'transcribe',
  preferredDevice, // 'webgpu' | 'wasm' | 'auto'
  onProgress,
  signal,
}) {
  let device = preferredDevice;
  if (!device || device === 'auto') {
    const hasWebGPU = await checkWebGPU();
    device = hasWebGPU ? 'webgpu' : 'wasm';
  }

  // Preprocess Audio to 16kHz Float32
  const audioData = await extractAudioFloat32(videoFile, (p, msg) => {
    if (onProgress) {
      onProgress({
        phase: 'preprocessing',
        percent: Math.round(p * 0.15),
        message: msg,
      });
    }
  });

  return runWorkerTranscription({
    audioData,
    modelName,
    device,
    language,
    task,
    onProgress,
    signal,
  });
}

function runWorkerTranscription({
  audioData,
  modelName,
  device,
  language,
  task,
  onProgress,
  signal,
}) {
  return new Promise((resolve, reject) => {
    let worker = new Worker(
      new URL('../workers/whisper.worker.js', import.meta.url),
      { type: 'module' }
    );

    let isCleanedUp = false;
    let watchdogTimer = null;

    const resetWatchdog = () => {
      if (watchdogTimer) clearTimeout(watchdogTimer);
      // 45s watchdog timer for WebGPU hang detection
      watchdogTimer = setTimeout(async () => {
        if (device === 'webgpu') {
          console.warn('[Whisper] WebGPU hang detected (>45s). Falling back to WASM...');
          cleanup();
          try {
            if (onProgress) {
              onProgress({
                phase: 'fallback',
                percent: 20,
                message: 'WebGPU stalled. Automatically retrying on CPU/WASM...',
              });
            }
            const fallbackResult = await runWorkerTranscription({
              audioData,
              modelName,
              device: 'wasm',
              language,
              task,
              onProgress,
              signal,
            });
            resolve(fallbackResult);
          } catch (err) {
            reject(err);
          }
        }
      }, 45000);
    };

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      if (watchdogTimer) clearTimeout(watchdogTimer);
      if (worker) {
        worker.terminate();
        worker = null;
      }
    };

    if (signal) {
      signal.addEventListener('abort', () => {
        cleanup();
        reject(new DOMException('Transcription cancelled by user.', 'AbortError'));
      });
    }

    worker.onmessage = (e) => {
      resetWatchdog();
      const { type, payload } = e.data;

      if (type === 'PROGRESS' || type === 'MODEL_LOAD_PROGRESS') {
        if (onProgress) onProgress(payload);
      } else if (type === 'COMPLETE') {
        cleanup();
        resolve(payload);
      } else if (type === 'ERROR') {
        cleanup();
        if (device === 'webgpu') {
          console.warn('[Whisper WebGPU Error] Retrying on WASM:', payload.message);
          runWorkerTranscription({
            audioData,
            modelName,
            device: 'wasm',
            language,
            task,
            onProgress,
            signal,
          }).then(resolve).catch(reject);
        } else {
          reject(new Error(payload?.message || 'Whisper transcription failed.'));
        }
      }
    };

    worker.onerror = (err) => {
      cleanup();
      if (device === 'webgpu') {
        console.warn('[Whisper Worker Error] Retrying on WASM:', err);
        runWorkerTranscription({
          audioData,
          modelName,
          device: 'wasm',
          language,
          task,
          onProgress,
          signal,
        }).then(resolve).catch(reject);
      } else {
        reject(new Error(`Whisper worker error: ${err.message || err}`));
      }
    };

    resetWatchdog();

    // Start transcription
    worker.postMessage({
      type: 'TRANSCRIBE',
      payload: {
        audioData,
        modelName,
        device,
        language,
        task,
      },
    });
  });
}

/**
 * Optional Groq Cloud Turbo Transcription (for users providing their own Groq Key)
 */
export async function transcribeWithGroq({
  audioBlob,
  apiKey,
  model = 'whisper-large-v3',
  language = 'auto',
  prompt = '',
  onProgress,
}) {
  if (!apiKey) throw new Error('Groq API Key is required for cloud mode.');

  if (onProgress) onProgress(30, 'Uploading audio to Groq Whisper LPU™...');

  const formData = new FormData();
  formData.append('file', audioBlob, 'audio.wav');
  formData.append('model', model);
  formData.append('response_format', 'verbose_json');

  if (language && language !== 'auto') {
    formData.append('language', language);
  }

  if (prompt) {
    formData.append('prompt', prompt);
  }

  const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey.trim()}`,
    },
    body: formData,
  });

  if (!response.ok) {
    const errJson = await response.json().catch(() => ({}));
    throw new Error(errJson.error?.message || `Groq API Error (${response.status})`);
  }

  if (onProgress) onProgress(80, 'Formatting segments and timestamps...');
  const resJson = await response.json();
  const segments = resJson.segments || [];

  return segments.map((seg, idx) => ({
    id: idx + 1,
    startTime: seg.start,
    endTime: seg.end,
    startStr: secondsToTimeStr(seg.start),
    endStr: secondsToTimeStr(seg.end),
    text: seg.text.trim(),
    words: seg.words || [],
  }));
}
