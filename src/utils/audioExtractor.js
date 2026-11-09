// Client-side Audio Extraction & Processing

/**
 * Standard PCM WAV encoder to convert decoded browser AudioBuffer to 16kHz mono WAV
 */
export function bufferToWav(buffer) {
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

/**
 * Extract audio track from video file in-browser using Web Audio API
 */
export async function performAudioExtraction(file, onProgress) {
  if (onProgress) onProgress(15, "Reading video raw bytes...");
  const arrayBuffer = await file.arrayBuffer();

  if (onProgress) onProgress(30, "Initializing audio decoder...");
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

  if (onProgress) onProgress(55, "Decoding audio track (client-side)...");
  try {
    const audioBuffer = await audioCtx.decodeAudioData(arrayBuffer);
    if (onProgress) onProgress(85, "Encoding to compact 16kHz mono WAV...");
    const wavBlob = bufferToWav(audioBuffer);
    if (onProgress) onProgress(100, "Audio extraction complete!");
    return wavBlob;
  } catch (err) {
    console.error('Audio decoding error:', err);
    throw new Error(
      'Client-side audio extraction failed. If the video is very large, try a smaller clip or direct mode.',
      { cause: err }
    );
  } finally {
    if (audioCtx && audioCtx.close) {
      audioCtx.close().catch(() => {});
    }
  }
}
