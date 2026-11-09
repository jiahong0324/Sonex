import { describe, it, expect } from 'vitest';
import { secondsToTimeStr, timeStrToSeconds, formatDisplayTime } from '../src/utils/timeUtils';

describe('timeUtils', () => {
  it('formats seconds into standard SRT timestamp with comma', () => {
    expect(secondsToTimeStr(0)).toBe('00:00:00,000');
    expect(secondsToTimeStr(1.234)).toBe('00:00:01,234');
    expect(secondsToTimeStr(65.5)).toBe('00:01:05,500');
    expect(secondsToTimeStr(3661.02)).toBe('01:01:01,020');
  });

  it('formats seconds with period delimiter for WebVTT', () => {
    expect(secondsToTimeStr(5.678, '.')).toBe('00:00:05.678');
  });

  it('parses timestamp strings back into float seconds accurately', () => {
    expect(timeStrToSeconds('00:00:01,234')).toBeCloseTo(1.234, 3);
    expect(timeStrToSeconds('00:01:05.500')).toBeCloseTo(65.5, 3);
    expect(timeStrToSeconds('01:01:01,020')).toBeCloseTo(3661.02, 3);
  });

  it('formats display time for video player', () => {
    expect(formatDisplayTime(15)).toBe('00:15');
    expect(formatDisplayTime(75)).toBe('01:15');
    expect(formatDisplayTime(3665)).toBe('01:01:05');
  });
});
