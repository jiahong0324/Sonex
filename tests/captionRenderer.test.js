import { describe, it, expect } from 'vitest';
import { getCaptionWords } from '../src/utils/captionRenderer';
import { getTrackRotation } from '../src/utils/demuxer';

describe('captionRenderer & word extraction', () => {
  it('returns existing words array if already provided', () => {
    const caption = {
      startTime: 1.0,
      endTime: 2.0,
      text: 'hello world',
      words: [
        { word: 'hello', start: 1.0, end: 1.5 },
        { word: 'world', start: 1.5, end: 2.0 },
      ],
    };
    const words = getCaptionWords(caption);
    expect(words).toEqual(caption.words);
  });

  it('synthesizes pseudo-word timestamps evenly if not provided', () => {
    const caption = {
      startTime: 2.0,
      endTime: 4.0,
      text: 'one two three four',
    };
    const words = getCaptionWords(caption);
    expect(words.length).toBe(4);
    expect(words[0].word).toBe('one');
    expect(words[0].start).toBeCloseTo(2.0, 2);
    expect(words[0].end).toBeCloseTo(2.5, 2);
    expect(words[3].word).toBe('four');
    expect(words[3].end).toBeCloseTo(4.0, 2);
  });

  it('detects video track orientation rotation from transformation matrix', () => {
    expect(getTrackRotation({ matrix: [0, 1, 0, -1, 0, 0, 0, 0, 1] })).toBe(90);
    expect(getTrackRotation({ matrix: [-1, 0, 0, 0, -1, 0, 0, 0, 1] })).toBe(180);
    expect(getTrackRotation({ matrix: [0, -1, 0, 1, 0, 0, 0, 0, 1] })).toBe(270);
    expect(getTrackRotation({ matrix: [1, 0, 0, 0, 1, 0, 0, 0, 1] })).toBe(0);
    expect(getTrackRotation(null)).toBe(0);
  });
});
