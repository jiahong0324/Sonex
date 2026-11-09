import { describe, it, expect } from 'vitest';
import {
  formatSRT,
  formatVTT,
  formatTXT,
  parseSRT,
  getWrappedText,
} from '../src/utils/srtParser';

describe('srtParser & text wrapping', () => {
  const mockCaptions = [
    {
      id: 1,
      startTime: 1.0,
      endTime: 3.5,
      startStr: '00:00:01,000',
      endStr: '00:00:03,500',
      text: 'Hello world from Sonex Studio',
    },
    {
      id: 2,
      startTime: 4.0,
      endTime: 6.2,
      startStr: '00:00:04,000',
      endStr: '00:00:06,200',
      text: '这是一个测试字幕',
    },
  ];

  it('generates valid SRT format with sequential numbering and timestamps', () => {
    const srt = formatSRT(mockCaptions);
    expect(srt).toContain('1\n00:00:01,000 --> 00:00:03,500\nHello world from Sonex\nStudio');
    expect(srt).toContain('2\n00:00:04,000 --> 00:00:06,200\n这是一个测试字幕');
  });

  it('generates valid WebVTT format', () => {
    const vtt = formatVTT(mockCaptions);
    expect(vtt.startsWith('WEBVTT\n\n')).toBe(true);
    expect(vtt).toContain('00:00:01.000 --> 00:00:03.500');
  });

  it('generates plain text transcript', () => {
    const txt = formatTXT(mockCaptions);
    expect(txt).toBe('Hello world from Sonex Studio\n这是一个测试字幕');
  });

  it('parses SRT string back into structured caption blocks', () => {
    const srtString = `1\n00:00:01,500 --> 00:00:03,800\nTest Subtitle Line\n\n2\n00:00:04,000 --> 00:00:05,500\nSecond Line`;
    const parsed = parseSRT(srtString);
    expect(parsed.length).toBe(2);
    expect(parsed[0].text).toBe('Test Subtitle Line');
    expect(parsed[0].startTime).toBeCloseTo(1.5, 3);
    expect(parsed[0].endTime).toBeCloseTo(3.8, 3);
    expect(parsed[1].text).toBe('Second Line');
  });

  it('wraps text properly according to line limit for mobile shorts', () => {
    const longEn = 'The quick brown fox jumps over the lazy dog and runs away';
    const wrappedEn = getWrappedText(longEn, 20);
    expect(wrappedEn.includes('\n')).toBe(true);

    const longZh = '这是一个超过设定字数限制的长句子用于测试自动换行排版';
    const wrappedZh = getWrappedText(longZh, 10);
    expect(wrappedZh.includes('\n')).toBe(true);
  });
});
