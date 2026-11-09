/**
 * Fallback 1 Video Export: Canvas.captureStream + MediaRecorder + Web Audio API
 * Real-time hardware/software recording with 100% synchronized canvas subtitles.
 */

import { drawCaptionFrame } from './captionRenderer';

export function isMediaRecorderSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof HTMLCanvasElement.prototype.captureStream === 'function' &&
    typeof window.MediaRecorder === 'function'
  );
}

export async function exportWithMediaRecorder({
  videoFile,
  captions,
  styleConfig,
  onProgress,
  signal,
}) {
  if (!isMediaRecorderSupported()) {
    throw new Error('Canvas captureStream or MediaRecorder is not supported in this browser.');
  }

  const videoUrl = URL.createObjectURL(videoFile);
  const video = document.createElement('video');
  video.src = videoUrl;
  video.muted = false;
  video.playsInline = true;
  video.crossOrigin = 'anonymous';

  // Wait for metadata
  await new Promise((resolve, reject) => {
    video.onloadedmetadata = () => resolve();
    video.onerror = () => reject(new Error('Failed to load video metadata for MediaRecorder export.'));
  });

  const width = Math.round(video.videoWidth / 2) * 2;
  const height = Math.round(video.videoHeight / 2) * 2;
  const duration = video.duration || 1;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Setup Audio Capture
  const AudioContextClass = window.AudioContext || window.webkitAudioContext;
  let audioCtx = null;
  let audioDest = null;
  try {
    audioCtx = new AudioContextClass();
    if (audioCtx.state === 'suspended') {
      await audioCtx.resume().catch(() => {});
    }
    const source = audioCtx.createMediaElementSource(video);
    audioDest = audioCtx.createMediaStreamDestination();
    source.connect(audioDest);
  } catch (err) {
    console.warn('Audio capture setup warning:', err);
  }

  const canvasStream = canvas.captureStream(30);
  const tracks = [...canvasStream.getVideoTracks()];
  if (audioDest && audioDest.stream.getAudioTracks().length > 0) {
    tracks.push(...audioDest.stream.getAudioTracks());
  }
  const combinedStream = new MediaStream(tracks);

  // Pick supported mime type
  const mimeTypes = [
    'video/mp4;codecs=avc1,mp4a.40.2',
    'video/mp4;codecs=avc1',
    'video/mp4',
    'video/webm;codecs=vp9,opus',
    'video/webm;codecs=vp8,opus',
    'video/webm',
  ];
  let selectedMime = mimeTypes.find((m) => MediaRecorder.isTypeSupported(m)) || '';

  const recorderOptions = selectedMime
    ? { mimeType: selectedMime, videoBitsPerSecond: 8_000_000 }
    : { videoBitsPerSecond: 8_000_000 };

  const recorder = new MediaRecorder(combinedStream, recorderOptions);
  const chunks = [];

  recorder.ondataavailable = (e) => {
    if (e.data && e.data.size > 0) {
      chunks.push(e.data);
    }
  };

  return new Promise((resolve, reject) => {
    let animId = null;
    let isFinished = false;

    const cleanup = () => {
      if (animId) cancelAnimationFrame(animId);
      video.pause();
      URL.revokeObjectURL(videoUrl);
      if (audioCtx) audioCtx.close().catch(() => {});
      combinedStream.getTracks().forEach((t) => t.stop());
    };

    if (signal) {
      signal.addEventListener('abort', () => {
        cleanup();
        if (recorder.state !== 'inactive') recorder.stop();
        reject(new DOMException('MediaRecorder export cancelled by user.', 'AbortError'));
      });
    }

    recorder.onstop = () => {
      cleanup();
      const outputType = selectedMime.split(';')[0] || 'video/mp4';
      const blob = new Blob(chunks, { type: outputType });
      resolve({
        blob,
        duration,
        width,
        height,
        sizeBytes: blob.size,
      });
    };

    recorder.onerror = (err) => {
      cleanup();
      reject(new Error(`MediaRecorder error: ${err.error?.message || err}`));
    };

    // Frame rendering loop
    const renderLoop = () => {
      if (isFinished) return;

      const currentTime = video.currentTime;

      // Draw original video frame
      ctx.drawImage(video, 0, 0, width, height);

      // Find active caption
      const activeCaption = captions.find(
        (c) => currentTime >= c.startTime && currentTime <= c.endTime
      );

      // Draw Subtitle with identical WYSIWYG renderer
      if (activeCaption) {
        drawCaptionFrame(ctx, activeCaption, currentTime, styleConfig, {
          width,
          height,
          showSafeZones: false,
        });
      }

      // Progress reporting
      const percent = Math.min(98, Math.round((currentTime / duration) * 100));
      if (onProgress) {
        onProgress({
          phase: 'recording',
          percent,
          etaSeconds: Math.round(duration - currentTime),
          message: `Recording real-time video frames (${Math.round(currentTime)}s / ${Math.round(duration)}s)...`,
        });
      }

      if (!video.ended && !video.paused) {
        animId = requestAnimationFrame(renderLoop);
      }
    };

    video.onended = () => {
      isFinished = true;
      if (onProgress) {
        onProgress({
          phase: 'finalizing',
          percent: 99,
          message: 'Finalizing recorded stream...',
        });
      }
      setTimeout(() => {
        if (recorder.state !== 'inactive') {
          recorder.stop();
        }
      }, 300);
    };

    // Start playback and recording
    recorder.start(1000);
    video.play().then(() => {
      renderLoop();
    }).catch((err) => {
      cleanup();
      reject(new Error(`Failed to play video for capture: ${err.message}`));
    });
  });
}
