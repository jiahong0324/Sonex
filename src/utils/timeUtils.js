// Time manipulation and conversion utilities

/**
 * Convert seconds into "HH:MM:SS,mmm" (SRT) or "HH:MM:SS.mmm" (VTT)
 */
export function secondsToTimeStr(seconds, delimiter = ',') {
  if (seconds < 0 || isNaN(seconds)) seconds = 0;
  const totalMs = Math.round(seconds * 1000);
  const hours = Math.floor(totalMs / 3600000);
  const minutes = Math.floor((totalMs % 3600000) / 60000);
  const secs = Math.floor((totalMs % 60000) / 1000);
  const ms = totalMs % 1000;

  const h = String(hours).padStart(2, '0');
  const m = String(minutes).padStart(2, '0');
  const s = String(secs).padStart(2, '0');
  const msStr = String(ms).padStart(3, '0');

  return `${h}:${m}:${s}${delimiter}${msStr}`;
}

/**
 * Convert time string "HH:MM:SS,mmm" or "HH:MM:SS.mmm" or "MM:SS" into seconds
 */
export function timeStrToSeconds(str) {
  if (!str) return 0;
  const clean = str.trim().replace(',', '.');
  const parts = clean.split(':');

  if (parts.length === 3) {
    const hours = parseFloat(parts[0]) || 0;
    const minutes = parseFloat(parts[1]) || 0;
    const seconds = parseFloat(parts[2]) || 0;
    return hours * 3600 + minutes * 60 + seconds;
  } else if (parts.length === 2) {
    const minutes = parseFloat(parts[0]) || 0;
    const seconds = parseFloat(parts[1]) || 0;
    return minutes * 60 + seconds;
  }
  return parseFloat(clean) || 0;
}

/**
 * Format seconds for player display, e.g. "01:24" or "01:02:15"
 */
export function formatDisplayTime(seconds) {
  if (seconds < 0 || isNaN(seconds)) return '00:00';
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);

  const mStr = String(minutes).padStart(2, '0');
  const sStr = String(secs).padStart(2, '0');

  if (hours > 0) {
    const hStr = String(hours).padStart(2, '0');
    return `${hStr}:${mStr}:${sStr}`;
  }
  return `${mStr}:${sStr}`;
}
