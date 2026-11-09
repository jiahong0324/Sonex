import { Muxer, ArrayBufferTarget, FileSystemWritableFileStreamTarget } from 'mp4-muxer';
import { demuxMP4 } from '../utils/demuxer';
import { drawCaptionFrame } from '../utils/captionRenderer';

let isCancelled = false;

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'CANCEL') {
    isCancelled = true;
    return;
  }

  if (type === 'START_EXPORT') {
    isCancelled = false;
    try {
      await runExportPipeline(payload);
    } catch (err) {
      self.postMessage({
        type: 'ERROR',
        payload: {
          message: err?.message || 'Video export failed.',
          stack: err?.stack,
        },
      });
    }
  }
};

async function runExportPipeline(payload) {
  const {
    videoFile,
    captions,
    styleConfig,
    exportSettings = {},
    fileWritableStream,
  } = payload;

  const {
    resolution = 'original', // 'original' | '1080p' | '720p'
    quality = 'high',        // 'high' | 'medium' | 'low'
    aspectRatio = 'original',// 'original' | '9:16' | '1:1' | '16:9'
  } = exportSettings;

  self.postMessage({
    type: 'PROGRESS',
    payload: {
      phase: 'demuxing',
      percent: 5,
      message: 'Demuxing video and audio tracks in virtual stream...',
    },
  });

  // Step 1: Demux MP4
  const demuxResult = await demuxMP4(videoFile, (prog) => {
    self.postMessage({
      type: 'PROGRESS',
      payload: {
        phase: 'demuxing',
        percent: Math.round(5 + prog * 0.1),
        message: `Extracting video samples (${prog}%)...`,
      },
    });
  });

  if (isCancelled) return;

  const {
    videoTrack,
    audioTrack,
    videoDescription,
    videoSamples,
    audioSamples,
    rotation,
  } = demuxResult;

  if (!videoSamples || videoSamples.length === 0) {
    throw new Error('No video samples extracted from source file.');
  }

  // Calculate Target Dimensions
  let srcWidth = videoTrack.video.width;
  let srcHeight = videoTrack.video.height;

  // Handle 90 or 270 degree rotation
  const isRotated = rotation === 90 || rotation === 270;
  if (isRotated) {
    const tmp = srcWidth;
    srcWidth = srcHeight;
    srcHeight = tmp;
  }

  let targetWidth = srcWidth;
  let targetHeight = srcHeight;

  if (resolution === '1080p') {
    if (srcHeight >= srcWidth) {
      // Portrait 9:16 or square
      targetHeight = 1920;
      targetWidth = Math.round((1920 * (srcWidth / srcHeight)) / 2) * 2;
    } else {
      // Landscape 16:9
      targetWidth = 1920;
      targetHeight = Math.round((1920 * (srcHeight / srcWidth)) / 2) * 2;
    }
  } else if (resolution === '720p') {
    if (srcHeight >= srcWidth) {
      targetHeight = 1280;
      targetWidth = Math.round((1280 * (srcWidth / srcHeight)) / 2) * 2;
    } else {
      targetWidth = 1280;
      targetHeight = Math.round((1280 * (srcHeight / srcWidth)) / 2) * 2;
    }
  }

  // Handle Aspect Ratio overrides
  if (aspectRatio === '9:16') {
    targetWidth = Math.round((targetHeight * (9 / 16)) / 2) * 2;
  } else if (aspectRatio === '1:1') {
    const minDim = Math.min(targetWidth, targetHeight);
    targetWidth = minDim;
    targetHeight = minDim;
  } else if (aspectRatio === '16:9') {
    targetHeight = Math.round((targetWidth * (9 / 16)) / 2) * 2;
  }

  // Ensure dimensions are even (H.264 requirement)
  targetWidth = Math.round(targetWidth / 2) * 2;
  targetHeight = Math.round(targetHeight / 2) * 2;

  // Calculate Bitrate
  const bitrates = {
    high: 10_000_000,
    medium: 6_000_000,
    low: 3_000_000,
  };
  const bitrate = bitrates[quality] || 8_000_000;

  // Step 2: Initialize Muxer
  let target;
  if (fileWritableStream) {
    target = new FileSystemWritableFileStreamTarget(fileWritableStream);
  } else {
    target = new ArrayBufferTarget();
  }

  // Check if audio track can be remuxed
  const canRemuxAudio =
    audioTrack &&
    audioTrack.codec &&
    (audioTrack.codec.startsWith('mp4a') || audioTrack.codec.startsWith('opus'));

  const audioCodecName = audioTrack?.codec?.startsWith('opus') ? 'opus' : 'aac';

  const muxer = new Muxer({
    target,
    video: {
      codec: 'avc',
      width: targetWidth,
      height: targetHeight,
    },
    audio: canRemuxAudio
      ? {
          codec: audioCodecName,
          sampleRate: audioTrack.audio.sample_rate || 44100,
          numberOfChannels: audioTrack.audio.channel_count || 2,
        }
      : undefined,
    fastStart: 'in-memory',
    firstTimestampBehavior: 'offset',
  });

  // Step 3: Initialize VideoEncoder
  let encoderConfig = {
    codec: 'avc1.640028', // H.264 High Profile Level 4.0
    width: targetWidth,
    height: targetHeight,
    bitrate,
    framerate: 30,
    avc: { format: 'avc' },
  };

  // Test encoder configuration
  let support = await VideoEncoder.isConfigSupported(encoderConfig);
  if (!support.supported) {
    // Fall back to baseline
    encoderConfig.codec = 'avc1.42001f'; // Baseline
    support = await VideoEncoder.isConfigSupported(encoderConfig);
    if (!support.supported) {
      throw new Error(`Device hardware does not support H.264 encoding at ${targetWidth}x${targetHeight}.`);
    }
  }

  const encoder = new VideoEncoder({
    output: (chunk, meta) => {
      muxer.addVideoChunk(chunk, meta);
    },
    error: (e) => {
      console.error('[WebCodecs Encoder Error]', e);
    },
  });
  encoder.configure(encoderConfig);

  // Step 4: Prepare OffscreenCanvas for Subtitle Burning
  const offscreen = new OffscreenCanvas(targetWidth, targetHeight);
  const ctx = offscreen.getContext('2d');

  // Step 5: Initialize VideoDecoder
  let encodedFrameCount = 0;
  const totalFrames = videoSamples.length;
  const startTimeMs = performance.now();

  const decoderConfig = {
    codec: videoTrack.codec,
    codedWidth: videoTrack.video.width,
    codedHeight: videoTrack.video.height,
    description: videoDescription,
  };

  const decoder = new VideoDecoder({
    output: async (frame) => {
      if (isCancelled) {
        frame.close();
        return;
      }

      const timeSec = frame.timestamp / 1_000_000;

      // Clear canvas
      ctx.clearRect(0, 0, targetWidth, targetHeight);

      // Handle rotation if source video was recorded rotated
      ctx.save();
      if (rotation === 90) {
        ctx.translate(targetWidth, 0);
        ctx.rotate((90 * Math.PI) / 180);
      } else if (rotation === 180) {
        ctx.translate(targetWidth, targetHeight);
        ctx.rotate((180 * Math.PI) / 180);
      } else if (rotation === 270) {
        ctx.translate(0, targetHeight);
        ctx.rotate((270 * Math.PI) / 180);
      }

      // Draw original video frame
      ctx.drawImage(frame, 0, 0, targetWidth, targetHeight);
      ctx.restore();

      // Find active caption
      const activeCaption = captions.find(
        (c) => timeSec >= c.startTime && timeSec <= c.endTime
      );

      // Draw Subtitle with identical WYSIWYG renderer
      if (activeCaption) {
        drawCaptionFrame(ctx, activeCaption, timeSec, styleConfig, {
          width: targetWidth,
          height: targetHeight,
          showSafeZones: false,
        });
      }

      // Release decoded input frame immediately
      frame.close();

      // Create new VideoFrame from offscreen canvas
      const renderedFrame = new VideoFrame(offscreen, {
        timestamp: frame.timestamp,
        duration: frame.duration || Math.round(1_000_000 / 30),
      });

      // Keyframe every 60 frames (2 seconds at 30fps)
      const isKeyFrame = encodedFrameCount % 60 === 0;
      encoder.encode(renderedFrame, { keyFrame: isKeyFrame });
      renderedFrame.close();
      encodedFrameCount++;

      // Progress reporting & ETA
      if (encodedFrameCount % 5 === 0 || encodedFrameCount === totalFrames) {
        const elapsedSec = (performance.now() - startTimeMs) / 1000;
        const fps = encodedFrameCount / Math.max(0.001, elapsedSec);
        const remainingFrames = Math.max(0, totalFrames - encodedFrameCount);
        const etaSeconds = Math.round(remainingFrames / Math.max(1, fps));
        const percent = Math.min(95, Math.round(15 + (encodedFrameCount / totalFrames) * 80));

        self.postMessage({
          type: 'PROGRESS',
          payload: {
            phase: 'rendering',
            currentFrame: encodedFrameCount,
            totalFrames,
            percent,
            fps: Math.round(fps * 10) / 10,
            etaSeconds,
            message: `Burning subtitles & encoding frame ${encodedFrameCount}/${totalFrames}...`,
          },
        });
      }
    },
    error: (e) => {
      console.error('[WebCodecs Decoder Error]', e);
    },
  });

  decoder.configure(decoderConfig);

  // Step 6: Feed Video Samples into Decoder with flow control
  for (let i = 0; i < videoSamples.length; i++) {
    if (isCancelled) break;
    const sample = videoSamples[i];

    const chunk = new EncodedVideoChunk({
      type: sample.is_sync ? 'key' : 'delta',
      timestamp: (sample.cts * 1_000_000) / sample.timescale,
      duration: (sample.duration * 1_000_000) / sample.timescale,
      data: sample.data,
    });

    decoder.decode(chunk);

    // Keep decoder queue manageable so worker doesn't run out of memory
    if (decoder.decodeQueueSize > 15) {
      await new Promise((r) => setTimeout(r, 10));
    }
  }

  await decoder.flush();
  decoder.close();

  if (isCancelled) {
    encoder.close();
    return;
  }

  await encoder.flush();
  encoder.close();

  // Step 7: Remux Original Audio Track directly (Zero Re-encoding Loss)
  if (canRemuxAudio && audioSamples && audioSamples.length > 0) {
    self.postMessage({
      type: 'PROGRESS',
      payload: {
        phase: 'muxing',
        percent: 96,
        message: 'Directly remuxing original audio track without quality loss...',
      },
    });

    for (const sample of audioSamples) {
      if (isCancelled) break;
      const audioChunk = new EncodedAudioChunk({
        type: sample.is_sync ? 'key' : 'delta',
        timestamp: (sample.cts * 1_000_000) / sample.timescale,
        duration: (sample.duration * 1_000_000) / sample.timescale,
        data: sample.data,
      });
      muxer.addAudioChunk(audioChunk);
    }
  }

  // Step 8: Finalize Muxing
  self.postMessage({
    type: 'PROGRESS',
    payload: {
      phase: 'muxing',
      percent: 98,
      message: 'Finalizing MP4 file container...',
    },
  });

  muxer.finalize();

  let finalBlob = null;
  if (!fileWritableStream) {
    const buffer = target.buffer;
    finalBlob = new Blob([buffer], { type: 'video/mp4' });
  }

  const durationSec = videoTrack.duration / videoTrack.timescale;

  self.postMessage({
    type: 'COMPLETE',
    payload: {
      blob: finalBlob,
      duration: durationSec,
      width: targetWidth,
      height: targetHeight,
      sizeBytes: finalBlob ? finalBlob.size : undefined,
    },
  });
}
