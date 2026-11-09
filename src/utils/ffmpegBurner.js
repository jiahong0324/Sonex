import { FFmpeg } from '@ffmpeg/ffmpeg';
import { fetchFile, toBlobURL } from '@ffmpeg/util';
import { formatSRT } from './srtParser';
import { generateFFmpegSubStyle } from './styles';

let ffmpegInstance = null;
let isLoaded = false;

/**
 * Get or initialize FFmpeg wasm instance
 */
export async function getFFmpeg(onLog, onProgress) {
  if (ffmpegInstance && isLoaded) {
    return ffmpegInstance;
  }

  const ffmpeg = new FFmpeg();

  if (onLog) {
    ffmpeg.on('log', ({ message }) => {
      onLog(message);
    });
  }

  if (onProgress) {
    ffmpeg.on('progress', ({ progress }) => {
      onProgress(Math.min(100, Math.max(0, Math.round(progress * 100))));
    });
  }

  const baseURL = window.location.origin;
  await ffmpeg.load({
    coreURL: await toBlobURL(`${baseURL}/ffmpeg-core.js`, 'text/javascript'),
    wasmURL: await toBlobURL(`${baseURL}/ffmpeg-core.wasm`, 'application/wasm'),
  });

  ffmpegInstance = ffmpeg;
  isLoaded = true;
  return ffmpeg;
}

/**
 * Burn subtitles into video and return exported video Blob
 */
export async function burnSubtitlesToVideo({
  videoFile,
  captions,
  styleConfig,
  onProgress,
  onStatusChange,
}) {
  if (!videoFile || !captions || captions.length === 0) {
    throw new Error('Missing video or captions for rendering.');
  }

  if (onStatusChange) onStatusChange('Loading FFmpeg Video Engine (WASM)...');
  if (onProgress) onProgress(5);

  const ffmpeg = await getFFmpeg(
    (msg) => console.log('[FFmpeg]', msg),
    (prog) => {
      if (onProgress) {
        // Map FFmpeg execution 20% -> 95%
        const mapped = Math.round(20 + prog * 0.75);
        onProgress(Math.min(96, mapped));
      }
    }
  );

  if (onStatusChange) onStatusChange('Preparing video & subtitles in virtual memory...');
  if (onProgress) onProgress(15);

  const ext = videoFile.name ? videoFile.name.split('.').pop() : 'mp4';
  const inputName = `input.${ext}`;
  await ffmpeg.writeFile(inputName, await fetchFile(videoFile));

  // Write SRT
  const srtContent = formatSRT(captions, true);
  const srtBlob = new Blob([srtContent], { type: 'text/plain;charset=utf-8' });
  await ffmpeg.writeFile('subs.srt', await fetchFile(srtBlob));

  // Load font
  const baseURL = window.location.origin;
  try {
    await ffmpeg.createDir('/fonts');
  } catch {
    // Directory might already exist
  }
  await ffmpeg.writeFile('/fonts/font.ttf', await fetchFile(`${baseURL}/font.ttf`));

  if (onStatusChange) onStatusChange('Hardcoding styled subtitles onto video frames...');
  if (onProgress) onProgress(20);

  const subStyle = generateFFmpegSubStyle(styleConfig);
  const vfFilter = `subtitles=subs.srt:fontsdir=/fonts:force_style='${subStyle}'`;

  // Fast H.264 encode, keep audio copied directly for speed and original quality
  const execCode = await ffmpeg.exec([
    '-i', inputName,
    '-vf', vfFilter,
    '-c:v', 'libx264',
    '-preset', 'ultrafast',
    '-crf', '22',
    '-c:a', 'copy',
    'output.mp4',
  ]);

  if (execCode !== 0) {
    throw new Error(`FFmpeg rendering exited with error code ${execCode}.`);
  }

  if (onStatusChange) onStatusChange('Finalizing export file...');
  if (onProgress) onProgress(98);

  const data = await ffmpeg.readFile('output.mp4');
  const outputBlob = new Blob([data.buffer], { type: 'video/mp4' });

  // Cleanup virtual files to free memory
  try {
    await ffmpeg.deleteFile(inputName);
    await ffmpeg.deleteFile('subs.srt');
    await ffmpeg.deleteFile('output.mp4');
  } catch (err) {
    console.warn('Virtual file cleanup warning:', err);
  }

  if (onProgress) onProgress(100);
  if (onStatusChange) onStatusChange('Rendering complete!');

  return outputBlob;
}
