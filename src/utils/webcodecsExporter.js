/**
 * Main Thread Controller for WebCodecs GPU Video Export
 */

export function isWebCodecsSupported() {
  return (
    typeof window !== 'undefined' &&
    typeof window.VideoDecoder === 'function' &&
    typeof window.VideoEncoder === 'function' &&
    typeof window.OffscreenCanvas === 'function'
  );
}

/**
 * Run WebCodecs Export in Dedicated Worker
 */
export async function exportWithWebCodecs({
  videoFile,
  captions,
  styleConfig,
  exportSettings,
  onProgress,
  signal,
}) {
  if (!isWebCodecsSupported()) {
    throw new Error('WebCodecs (VideoDecoder/VideoEncoder) is not supported in this browser.');
  }

  return new Promise((resolve, reject) => {
    const worker = new Worker(
      new URL('../workers/videoExport.worker.js', import.meta.url),
      { type: 'module' }
    );

    let isCleanedUp = false;

    const cleanup = () => {
      if (isCleanedUp) return;
      isCleanedUp = true;
      worker.terminate();
    };

    if (signal) {
      signal.addEventListener('abort', () => {
        worker.postMessage({ type: 'CANCEL' });
        cleanup();
        reject(new DOMException('Export cancelled by user.', 'AbortError'));
      });
    }

    worker.onmessage = (e) => {
      const { type, payload } = e.data;

      if (type === 'PROGRESS') {
        if (onProgress) onProgress(payload);
      } else if (type === 'COMPLETE') {
        cleanup();
        resolve(payload);
      } else if (type === 'ERROR') {
        cleanup();
        reject(new Error(payload?.message || 'WebCodecs export failed.'));
      }
    };

    worker.onerror = (err) => {
      cleanup();
      reject(new Error(`Worker fatal error: ${err.message || err}`));
    };

    // Start export
    worker.postMessage({
      type: 'START_EXPORT',
      payload: {
        videoFile,
        captions,
        styleConfig,
        exportSettings,
      },
    });
  });
}
