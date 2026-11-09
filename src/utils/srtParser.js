import { secondsToTimeStr, timeStrToSeconds } from './timeUtils';

/**
 * Enforce clean line wrapping for subtitles
 */
export function getWrappedText(text, limit = 26) {
  if (!text) return '';
  const cleanText = text.replace(/\s+/g, ' ').trim();
  if (cleanText.length <= limit) return cleanText;

  const hasChinese = /[\u4e00-\u9fa5]/.test(cleanText);
  const lines = [];

  if (hasChinese) {
    for (let i = 0; i < cleanText.length; i += limit) {
      lines.push(cleanText.substring(i, i + limit));
    }
  } else {
    const words = cleanText.split(' ');
    let currentLine = '';
    for (let word of words) {
      if ((currentLine + ' ' + word).trim().length <= limit) {
        currentLine = (currentLine + ' ' + word).trim();
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
  }

  return lines.join('\n');
}

/**
 * Generate SRT format string
 */
export function formatSRT(captions, addSpacing = false) {
  return captions
    .map((cap, index) => {
      let wrappedText = getWrappedText(cap.text);
      if (addSpacing) {
        wrappedText = wrappedText.replace(/\n/g, '\n{\\alpha&HFF&}{\\fs24}.{\\fs24}{\\alpha&H00&}\n');
      }
      const startStr = secondsToTimeStr(cap.startTime, ',');
      const endStr = secondsToTimeStr(cap.endTime, ',');
      return `${index + 1}\n${startStr} --> ${endStr}\n${wrappedText}`;
    })
    .join('\n\n');
}

/**
 * Generate WebVTT format string
 */
export function formatVTT(captions) {
  let vtt = 'WEBVTT\n\n';
  vtt += captions
    .map((cap, index) => {
      const startStr = secondsToTimeStr(cap.startTime, '.');
      const endStr = secondsToTimeStr(cap.endTime, '.');
      return `${index + 1}\n${startStr} --> ${endStr}\n${cap.text}`;
    })
    .join('\n\n');
  return vtt;
}

/**
 * Generate plain text transcription
 */
export function formatTXT(captions) {
  return captions.map((cap) => cap.text).join('\n');
}

/**
 * Generate JSON formatted transcription
 */
export function formatJSON(captions) {
  return JSON.stringify(captions, null, 2);
}

/**
 * Parse an SRT string into structured caption objects
 */
export function parseSRT(srtString) {
  if (!srtString) return [];
  const normalized = srtString.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
  const blocks = normalized.trim().split(/\n\s*\n/);
  const captions = [];

  let autoId = 1;

  for (let block of blocks) {
    const lines = block.trim().split('\n');
    if (lines.length < 2) continue;

    let timeLineIndex = lines[0].includes('-->') ? 0 : 1;
    if (lines.length <= timeLineIndex) continue;

    const timeLine = lines[timeLineIndex];
    const match = timeLine.match(/(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})\s*-->\s*(\d{1,2}:\d{2}:\d{2}[,.]\d{1,3})/);
    if (!match) continue;

    const startStr = match[1];
    const endStr = match[2];
    const startTime = timeStrToSeconds(startStr);
    const endTime = timeStrToSeconds(endStr);

    const textLines = lines.slice(timeLineIndex + 1);
    const text = textLines.join('\n').replace(/\{[^}]+\}/g, '').trim();

    if (text) {
      captions.push({
        id: autoId++,
        startTime,
        endTime,
        startStr: secondsToTimeStr(startTime),
        endStr: secondsToTimeStr(endTime),
        text
      });
    }
  }

  return captions;
}

/**
 * Parse VTT or SRT file content automatically
 */
export function parseSubtitleFile(content) {
  if (!content) return [];
  if (content.includes('WEBVTT')) {
    // Strip header
    const cleanContent = content.replace(/^WEBVTT[^\n]*\n+/g, '');
    return parseSRT(cleanContent);
  }
  return parseSRT(content);
}
