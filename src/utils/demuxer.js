import * as MP4Box from 'mp4box';

/**
 * Helper to extract codec description (avcC, hvcC, vpcC, av1C) from MP4Box sample entry
 */
export function getCodecDescription(entry) {
  if (!entry) return undefined;
  const box = entry.avcC || entry.hvcC || entry.vpcC || entry.av1C;
  if (!box) return undefined;

  const stream = new MP4Box.DataStream(undefined, 0, MP4Box.DataStream.BIG_ENDIAN);
  box.write(stream);
  // Strip 8-byte box header (4 bytes length + 4 bytes fourcc)
  return new Uint8Array(stream.buffer, 8);
}

/**
 * Detect video orientation from MP4 track matrix
 */
export function getTrackRotation(track) {
  if (!track || !track.matrix) return 0;
  const [a, b, , c, d] = track.matrix;
  if (a === 0 && b === 1 && c === -1 && d === 0) return 90;
  if (a === -1 && b === 0 && c === 0 && d === -1) return 180;
  if (a === 0 && b === -1 && c === 1 && d === 0) return 270;
  return 0;
}

/**
 * Parse MP4 file using MP4Box and extract video/audio tracks and sample buffers
 */
export async function demuxMP4(fileOrBuffer, onProgress) {
  return new Promise((resolve, reject) => {
    const mp4boxFile = MP4Box.createFile();
    let videoTrack = null;
    let audioTrack = null;
    let videoSamples = [];
    let audioSamples = [];
    let trackInfo = null;

    mp4boxFile.onError = (e) => {
      reject(new Error(`MP4Box demux error: ${e?.message || e}`));
    };

    mp4boxFile.onReady = (info) => {
      trackInfo = info;
      videoTrack = info.tracks.find((t) => t.video);
      audioTrack = info.tracks.find((t) => t.audio);

      if (!videoTrack) {
        reject(new Error('No video track found in the media file.'));
        return;
      }

      mp4boxFile.setExtractionOptions(videoTrack.id, null, { nbSamples: 1000 });
      if (audioTrack) {
        mp4boxFile.setExtractionOptions(audioTrack.id, null, { nbSamples: 1000 });
      }
      mp4boxFile.start();
    };

    mp4boxFile.onSamples = (trackId, ref, samples) => {
      if (videoTrack && trackId === videoTrack.id) {
        videoSamples.push(...samples);
      } else if (audioTrack && trackId === audioTrack.id) {
        audioSamples.push(...samples);
      }
    };

    // Feed buffer to mp4box
    const processBuffer = async () => {
      try {
        let arrayBuffer;
        if (fileOrBuffer instanceof ArrayBuffer) {
          arrayBuffer = fileOrBuffer;
        } else if (fileOrBuffer instanceof Blob || fileOrBuffer instanceof File) {
          arrayBuffer = await fileOrBuffer.arrayBuffer();
        } else {
          throw new Error('Unsupported input format for demuxing.');
        }

        const chunkSize = 2 * 1024 * 1024; // 2MB chunk
        let offset = 0;
        const total = arrayBuffer.byteLength;

        while (offset < total) {
          const slice = arrayBuffer.slice(offset, offset + chunkSize);
          slice.fileStart = offset;
          mp4boxFile.appendBuffer(slice);
          offset += chunkSize;
          if (onProgress) {
            onProgress(Math.min(99, Math.round((offset / total) * 100)));
          }
        }

        mp4boxFile.flush();

        // Get video description
        let videoDescription;
        if (videoTrack) {
          const rawTrack = mp4boxFile.getTrackById(videoTrack.id);
          const entry = rawTrack?.mdia?.minf?.stbl?.stsd?.entries?.[0];
          videoDescription = getCodecDescription(entry);
        }

        // Get audio description
        let audioDescription;
        if (audioTrack) {
          const rawTrack = mp4boxFile.getTrackById(audioTrack.id);
          const entry = rawTrack?.mdia?.minf?.stbl?.stsd?.entries?.[0];
          audioDescription = getCodecDescription(entry);
        }

        const rotation = getTrackRotation(videoTrack);

        resolve({
          info: trackInfo,
          videoTrack,
          audioTrack,
          videoDescription,
          audioDescription,
          videoSamples,
          audioSamples,
          rotation,
        });
      } catch (err) {
        reject(err);
      }
    };

    processBuffer();
  });
}
