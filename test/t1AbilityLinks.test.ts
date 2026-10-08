import { describe, it, expect } from 'vitest';
import { DIMENSIONS_DATA } from '../src/data';
import { T1_AGE_BANDS } from '../src/t1Data';
import { findBannedWords } from '../src/utils/parentWording';
import type { AssessmentStatus } from '../src/types';
import {
  ABILITY_LINKS, ABILITY_MAP_COPY, ABILITY_RING, abilityLinksFor, abilityName, linkSentences, pairSupportSentence,
} from '../src/t1report/abilityLinks';

/**
 * 九大能力关联图（使用者 2026-10-08）：十二條線、每個能力 2–3 條、粗線規則、句子沒有禁字也沒有腦區／百分比／題目。
 * 畫面只在新版（A）出現、舊版照舊畫拓撲圖：`test/t1ReportView.structure.test.ts`。
 */

const IDS = DIMENSIONS_DATA.map(d => d.id);

describe('十二條線', () => {
  it('恰好 12 條，兩端都是網站的九個維度，沒有重複、沒有自己連自己', () => {
    expect(ABILITY_LINKS).toHaveLength(12);
    const keys = new Set<string>();
    for (const l of ABILITY_LINKS) {
      expect(IDS).toContain(l.a);
      expect(IDS).toContain(l.b);
      expect(l.a).not.toBe(l.b);
      const k = [l.a, l.b].sort().join('|');
      expect(keys.has(k), k).toBe(false);
      keys.add(k);
    }
  });

  it('每個能力 2–3 條', () => {
    expect(IDS).toHaveLength(9);
    for (const id of IDS) {
      const n = ABILITY_LINKS.filter(l => l.a === id || l.b === id).length;
      expect(n, id).toBeGreaterThanOrEqual(2);
      expect(n, id).toBeLessThanOrEqual(3);
    }
  });

  it('圓周順序涵蓋九個能力各一次', () => {
    expect([...ABILITY_RING].sort()).toEqual([...IDS].sort());
  });

  it('名字走網站的維度名稱', () => {
    for (const d of DIMENSIONS_DATA) expect(abilityName(d.id)).toBe(d.name);
    expect(abilityName('language')).toBe('语言沟通');
  });

  it('句子照使用者給的原文（抽兩條對）', () => {
    const find = (a: string, b: string) => ABILITY_LINKS.find(l => l.a === a && l.b === b)!.why;
    expect(find('emotion_behavior', 'attention')).toBe('管住冲动和管住情绪，用的是同一种「刹车」能力');
    expect(find('gross_motor', 'self_care')).toBe('穿衣、吃饭、如厕都要用到大小动作');
  });
});

describe('粗線規則：兩端都被標記才粗', () => {
  const statuses = (m: Record<string, AssessmentStatus>) => (id: string) => m[id] ?? 'normal';

  it('全綠：沒有粗線', () => {
    expect(abilityLinksFor(() => 'normal').filter(l => l.bold)).toEqual([]);
  });

  it('只有一端被標記：不粗', () => {
    const links = abilityLinksFor(statuses({ language: 'delay' }));
    expect(links.filter(l => l.bold)).toEqual([]);
  });

  it('語言紅、社交黃：語言—社交粗（紅），別的不粗；多一句兩項一起進步', () => {
    const links = abilityLinksFor(statuses({ language: 'delay', social_emotional: 'borderline' }));
    const bold = links.filter(l => l.bold);
    expect(bold.map(l => l.key)).toEqual(['language--social_emotional']);
    expect(bold[0].tone).toBe('delay');
    const s = linkSentences(bold[0]);
    expect(s).toHaveLength(2);
    expect(s[1]).toBe(pairSupportSentence('language', 'social_emotional'));
    expect(s[1]).toContain('语言沟通和社交互动都需要支持');
  });

  it('兩端都黃：粗、黃色', () => {
    const [l] = abilityLinksFor(statuses({ cognitive: 'borderline', learning_ability: 'borderline' })).filter(x => x.bold);
    expect(l.key).toBe('cognitive--learning_ability');
    expect(l.tone).toBe('borderline');
  });

  it('不粗的線只有一句', () => {
    for (const l of abilityLinksFor(() => 'normal')) expect(linkSentences(l)).toHaveLength(1);
  });

  it('讀不到的維度當作沒被標記', () => {
    expect(abilityLinksFor(() => undefined).some(l => l.bold)).toBe(false);
  });
});

describe('句子：沒有禁字、腦區、百分比、題目原文', () => {
  const all = [
    ...ABILITY_LINKS.flatMap(l => linkSentences({ ...l, key: '', bold: true, tone: 'delay' })),
    ABILITY_MAP_COPY.title, ABILITY_MAP_COPY.subtitle, ABILITY_MAP_COPY.hint, ABILITY_MAP_COPY.linksOf('认知'),
  ];

  it('《用语对照表》禁字', () => {
    for (const t of all) expect(findBannedWords(t), t).toEqual([]);
  });

  it('沒有腦區、神經、百分比', () => {
    for (const t of all) expect(t).not.toMatch(/脑区|大脑|神经|突触|前额叶|皮层|%|％|百分/);
  });

  it('沒有任何一題的原文', () => {
    const questions = T1_AGE_BANDS.flatMap(b => b.questions.map(q => q.text));
    for (const t of all) for (const q of questions) expect(t.includes(q), q).toBe(false);
  });
});
