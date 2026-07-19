import { describe, it, expect } from 'vitest';
import { judgeArticulation, cleanSpeechText } from '../src/utils/asr';

describe('cleanSpeechText', () => {
  it('strips punctuation and whitespace', () => {
    expect(cleanSpeechText('苹果。')).toBe('苹果');
    expect(cleanSpeechText('我 想， 吃!')).toBe('我想吃');
    expect(cleanSpeechText('a, b. c…')).toBe('abc');
  });
});

describe('judgeArticulation', () => {
  it('returns "unclear" when nothing was recognized', () => {
    expect(judgeArticulation('苹果', '')).toBe('unclear');
    expect(judgeArticulation('苹果', '  ')).toBe('unclear');
  });

  it('returns "normal" on an exact match (ignoring punctuation)', () => {
    expect(judgeArticulation('苹果', '苹果')).toBe('normal');
    expect(judgeArticulation('苹果', '苹果。')).toBe('normal');
    expect(judgeArticulation('我要吃苹果', '我要吃，苹果！')).toBe('normal');
  });

  it('returns "stutter" on repeated leading syllables that lengthen the output', () => {
    expect(judgeArticulation('苹果', '苹苹苹果')).toBe('stutter');
    expect(judgeArticulation('哥哥', '哥哥哥哥哥')).toBe('stutter');
  });

  it('returns "substitute" when the sounds differ without stutter pattern', () => {
    expect(judgeArticulation('哥哥', '德德')).toBe('substitute');
    expect(judgeArticulation('苹果', '病朵')).toBe('substitute');
  });
});
