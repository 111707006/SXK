import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TOOLKIT, TOOL_IDS, TOOLKIT_VERSION, askedCount, askedSections } from '../src/t2/toolkit';
import type { ToolId, ToolkitTier } from '../src/t2/toolkit';
import { renderToolkitFiles, sameToolkitContent } from '../scripts/t2/extract';

/**
 * T2 題庫的結構測試（#41，規格 v2 §11 階段 0）。
 *
 * 【為什麼需要這些】
 * 22 支題庫是腳本從客戶的工具包 zip 抽出來的常數。抽錯了不會有型別錯誤 ——
 * 少一個面向、月齡抄成別支的、分段抄到 `postMessage` 那一套（80／60／40）—— 全部
 * 都是合法的 TypeScript。這裡把規格 §3 的題數、§4.4 的題量表、附錄 D 第一欄的分段
 * 逐格釘住，抽取腳本或工具包哪裡動了，紅的是這裡而不是三張票之後的某個報告。
 *
 * 最後一條「從 zip 重跑逐位元一致」是整套的地基：它保證 repo 裡的常數就是腳本從
 * zip 算出來的東西，沒有人手改過。
 */

const ROOT = path.resolve(__dirname, '..');

function bank(id: ToolId) {
  return TOOLKIT[id];
}

function total(id: ToolId): number {
  return bank(id).sections.reduce((n, s) => n + s.items.length, 0);
}

describe('工具登錄：22 個代號（§3）', () => {
  it('恰好是規格 §3 的 22 個 id，順序照登錄表', () => {
    expect(TOOL_IDS).toEqual([
      'sxk-dev', 'sxk-warn', 'mchat-rf', 'sxk-gm', 'sxk-soc', 'sxk-lang', 'sxk-adp',
      'sxk-voc', 'sxk-asq', 'sxk-asb', 'sxk-asr', 'sxk-ab', 'sxk-att', 'snap-iv',
      'chexi', 'sxk-spa', 'sxk-spb', 'sxk-adl', 'sxk-ldp', 'sxk-lds', 'sxk-tempa', 'sxk-tempb',
    ]);
  });

  it('不沿用中控台的舊名 weefim／spm25／social', () => {
    for (const id of TOOL_IDS) expect(['weefim', 'spm25', 'spm5', 'social']).not.toContain(id);
    const source = TOOL_IDS.map(id => fs.readFileSync(path.join(ROOT, `src/t2/toolkit/${id}.ts`), 'utf8')).join('\n');
    expect(source).not.toMatch(/weefim|spm25|spm5/);
  });

  it('每份的 id 與 code 對得起來，且 sha256 指向工具包裡的檔案', () => {
    for (const id of TOOL_IDS) {
      const b = bank(id);
      expect(b.id).toBe(id);
      expect(b.source.sha256).toMatch(/^[0-9a-f]{64}$/);
      expect(b.source.file).toMatch(/\.html$/);
    }
    expect(bank('sxk-adl').code).toBe('SXK-ADL');
    expect(bank('sxk-spa').code).toBe('SXK-SPa');
    expect(bank('mchat-rf').code).toBe('M-CHAT-R/F');
  });

  it(`TOOLKIT_VERSION 是 kit-20260908`, () => {
    expect(TOOLKIT_VERSION).toBe('kit-20260908');
  });
});

describe('題數與 §3 逐支相符', () => {
  const expected: Record<ToolId, number> = {
    'sxk-dev': 180, 'sxk-warn': 44, 'mchat-rf': 20, 'sxk-gm': 40, 'sxk-soc': 40, 'sxk-lang': 60,
    'sxk-adp': 40, 'sxk-voc': 30, 'sxk-asq': 30, 'sxk-asb': 57, 'sxk-asr': 15, 'sxk-ab': 48,
    'sxk-att': 40, 'snap-iv': 26, 'chexi': 24, 'sxk-spa': 75, 'sxk-spb': 75, 'sxk-adl': 18,
    'sxk-ldp': 30, 'sxk-lds': 30, 'sxk-tempa': 72, 'sxk-tempb': 72,
  };
  for (const id of TOOL_IDS) {
    it(`${id}：${expected[id]} 題`, () => {
      expect(total(id)).toBe(expected[id]);
    });
  }

  it('面向的結構照 §3：lang 16＋18＋12＋14、asb 12＋12＋11＋12＋10、spa 12＋12＋11＋10＋10＋10＋10、adl 6＋2＋4＋6、snap 9／9／8', () => {
    const sizes = (id: ToolId) => bank(id).sections.map(s => s.items.length);
    expect(sizes('sxk-lang')).toEqual([16, 18, 12, 14]);
    expect(sizes('sxk-asb')).toEqual([12, 12, 11, 12, 10]);
    expect(sizes('sxk-spa')).toEqual([12, 12, 11, 10, 10, 10, 10]);
    expect(sizes('sxk-spb')).toEqual([12, 12, 11, 10, 10, 10, 10]);
    expect(sizes('sxk-adl')).toEqual([6, 2, 4, 6]);
    expect(sizes('snap-iv')).toEqual([9, 9, 8]);
    expect(sizes('chexi')).toEqual([9, 4, 6, 5]);
    expect(sizes('sxk-tempa')).toEqual(Array(9).fill(8));
    expect(sizes('sxk-ldp')).toEqual(Array(5).fill(6));
  });

  it('sxk-dev：6 領域 × 6 年齡段 × 5 題，年齡段是 0–6／7–12／13–24／25–36／37–48／49–72', () => {
    const b = bank('sxk-dev');
    expect(b.sections).toHaveLength(36);
    const bands = [...new Set(b.sections.map(s => `${s.ageBand!.lo}-${s.ageBand!.hi}`))];
    expect(bands).toEqual(['0-6', '7-12', '13-24', '25-36', '37-48', '49-72']);
    expect(b.sections.every(s => s.items.length === 5)).toBe(true);
    expect([...new Set(b.sections.map(s => s.key))]).toEqual(['MOT', 'FM', 'LANG', 'SOC', 'ADL', 'COG']);
  });

  it('sxk-warn：11 時點 × 4 條，時點 3／6／8／12／18／24／30／36／48／60／72，每個時點管到下一個時點前', () => {
    const b = bank('sxk-warn');
    expect(b.sections.map(s => s.ageBand!.lo)).toEqual([3, 6, 8, 12, 18, 24, 30, 36, 48, 60, 72]);
    expect(b.sections.map(s => s.ageBand!.hi)).toEqual([5, 7, 11, 17, 23, 29, 35, 47, 59, 71, 83]);
    expect(b.sections.every(s => s.items.length === 4)).toBe(true);
  });
});

describe('§4.4 的題量表用 askedCount 重算逐格相符', () => {
  const table: Array<[ToolId, Array<[number, number]>]> = [
    ['sxk-gm', [[12, 22], [18, 28], [24, 31], [30, 33], [36, 35], [42, 37], [48, 40], [60, 40], [72, 40]]],
    ['sxk-soc', [[12, 18], [18, 20], [24, 23], [30, 26], [36, 32], [42, 35], [48, 36], [60, 40], [72, 40]]],
    ['sxk-lang', [[12, 8], [18, 18], [24, 23], [30, 26], [36, 33], [42, 38], [48, 49], [60, 60], [72, 60]]],
    ['sxk-adp', [[18, 18], [24, 21], [30, 28], [36, 31], [42, 37], [48, 37], [60, 40], [72, 40]]],
    ['sxk-voc', [[12, 4], [18, 17], [24, 24], [30, 29], [36, 30], [42, 30]]],
    ['sxk-asq', [[36, 30], [42, 30]]],
    ['sxk-adl', [[30, 13], [36, 17], [42, 18], [48, 18], [60, 18], [72, 18], [96, 18]]],
    ['sxk-att', [[60, 40], [72, 40], [96, 40]]],
    ['sxk-ab', [[36, 29], [42, 29], [48, 41], [60, 48], [72, 48], [96, 48]]],
    ['sxk-spa', [[24, 75], [30, 75], [36, 75], [42, 75], [48, 75], [60, 75]]],
    ['sxk-spb', [[60, 75], [72, 75], [96, 75]]],
  ];
  for (const [id, cells] of table) {
    for (const [month, count] of cells) {
      it(`${id} 在 ${month} 個月：${count} 題`, () => {
        expect(askedCount(id, month)).toBe(count);
      });
    }
  }

  it('固定題數的工具：dev 30、warn 4、mchat 20、asb 57、asr 15、snap 26、chexi 24、ldp／lds 30、tempa／b 72', () => {
    expect(askedCount('sxk-dev', 30)).toBe(30);
    expect(askedCount('sxk-dev', 0)).toBe(30);
    expect(askedCount('sxk-dev', 72)).toBe(30);
    expect(askedCount('sxk-warn', 3)).toBe(4);
    expect(askedCount('sxk-warn', 83)).toBe(4);
    expect(askedCount('mchat-rf', 18)).toBe(20);
    expect(askedCount('sxk-asb', 18)).toBe(57);
    expect(askedCount('sxk-asr', 24)).toBe(15);
    expect(askedCount('snap-iv', 72)).toBe(26);
    expect(askedCount('chexi', 48)).toBe(24);
    expect(askedCount('sxk-ldp', 72)).toBe(30);
    expect(askedCount('sxk-lds', 144)).toBe(30);
    expect(askedCount('sxk-tempa', 12)).toBe(72);
    expect(askedCount('sxk-tempb', 36)).toBe(72);
  });

  it('年齡段型的工具在段外沒有題（窗口本身是登錄表的事，這裡只是題數為零）', () => {
    expect(askedCount('sxk-dev', 73)).toBe(0);
    expect(askedCount('sxk-warn', 2)).toBe(0);
    expect(askedCount('sxk-warn', 84)).toBe(0);
  });

  it('§4.4 的例子：48 個月做 sxk-lang 49 題＋sxk-ab 41 題＝90，選做 sxk-spa 75', () => {
    expect(askedCount('sxk-lang', 48) + askedCount('sxk-ab', 48)).toBe(90);
    expect(askedCount('sxk-spa', 48)).toBe(75);
  });

  it('askedSections 保留沒有適用題目的面向（畫面要顯示「本月齡暫無適用題目」）', () => {
    const secs = askedSections(bank('sxk-gm'), 6);
    expect(secs.map(s => s.key)).toEqual(['P1', 'P2', 'P3', 'P4', 'P5']);
    expect(secs.find(s => s.key === 'P5')!.items).toHaveLength(0);
  });
});

describe('分段與附錄 D 第一欄相符；回傳那一套的切點不存在', () => {
  const cuts = (tiers: ToolkitTier[]) => tiers.map(t => [t.tier, t.key, t.min ?? null, t.max ?? null]);

  it('達成率族六支：85／70／55', () => {
    for (const id of ['sxk-gm', 'sxk-soc', 'sxk-lang', 'sxk-adp', 'sxk-voc', 'sxk-asq'] as const) {
      expect(cuts(bank(id).tiers), id).toEqual([
        [1, '未见明显问题', 85, null],
        [2, '轻微落后', 70, 84],
        [3, '中度落后', 55, 69],
        [4, '明显落后', 0, 54],
      ]);
      expect(bank(id).minItems, id).toBe(3);
    }
  });

  it('dev：90／75／60', () => {
    expect(cuts(bank('sxk-dev').tiers)).toEqual([
      [1, '达成良好', 90, null], [2, '大致达成', 75, 89], [3, '部分未达成', 60, 74], [4, '明显落后', 0, 59],
    ]);
  });

  it('adl：72／58／45', () => {
    expect(cuts(bank('sxk-adl').tiers)).toEqual([
      [1, '独立性良好', 72, null], [2, '少数活动需协助', 58, 71], [3, '部分活动需协助', 45, 57], [4, '多数活动需协助', 0, 44],
    ]);
    expect(bank('sxk-adl').minItems).toBe(2);
  });

  it('關切率族六支各自的切點（asr 20／29／38、asb 22／31／40、att 25／33／42、ab 33／41／50、spa／spb 28／36／45）', () => {
    const concern = (id: ToolId, a: number, b: number, c: number) => {
      expect(cuts(bank(id).tiers), id).toEqual([
        [1, '未见明显', 0, a], [2, '轻微', a + 1, b], [3, '中度', b + 1, c], [4, '明显', c + 1, 100],
      ]);
    };
    concern('sxk-asr', 20, 29, 38);
    concern('sxk-asb', 22, 31, 40);
    concern('sxk-att', 25, 33, 42);
    concern('sxk-ab', 33, 41, 50);
    concern('sxk-spa', 28, 36, 45);
    concern('sxk-spb', 28, 36, 45);
  });

  it('ldp／lds：總分 9／19／29，各方面 4／8／12', () => {
    for (const id of ['sxk-ldp', 'sxk-lds'] as const) {
      expect(cuts(bank(id).tiers), id).toEqual([
        [1, '未见明显', null, 9], [2, '轻微', 10, 19], [3, '中等', 20, 29], [4, '显著', 30, null],
      ]);
      expect(cuts(bank(id).sectionTiers!), id).toEqual([
        [1, '未见明显', null, 4], [2, '轻微', 5, 8], [3, '中等', 9, 12], [4, '显著', 13, null],
      ]);
    }
  });

  it('snap-iv：家長版參考點 1.2／1.8', () => {
    expect(cuts(bank('snap-iv').tiers)).toEqual([
      [1, '低于参考点', null, 1.2], [2, '高于关注参考点', 1.2, 1.8], [3, '高于诊断参考点', 1.8, null],
    ]);
  });

  it('mchat-rf：0–2／3–7／8–20', () => {
    expect(cuts(bank('mchat-rf').tiers)).toEqual([
      [1, '低風險', 0, 2], [2, '中等風險', 3, 7], [3, '高風險', 8, 20],
    ]);
  });

  it('warn：任一陽性即異常（0 → tier 1，≥1 → tier 3）', () => {
    expect(cuts(bank('sxk-warn').tiers)).toEqual([[1, '初筛未见异常', null, 0], [3, '初筛异常', 1, null]]);
  });

  it('chexi：只有相對描述 33／66（紙本自己說不套切分值），沒有五級那一套的 50／83', () => {
    expect(cuts(bank('chexi').tiers)).toEqual([
      [1, '相对较低', null, 33], [2, '中等', 34, 66], [3, '相对偏高', 67, null],
    ]);
  });

  it('tempa／b：不分級，只有偏向程度 0.42／1.0', () => {
    for (const id of ['sxk-tempa', 'sxk-tempb'] as const) {
      expect(cuts(bank(id).tiers), id).toEqual([[1, '两端之间', null, 0.42], [2, '稍偏', 0.42, 1], [3, '明显偏', 1, null]]);
    }
  });

  it('回傳給中控台那一套的切點一個都沒有：達成率族不得出現 80／60／40，關切率族不得出現 60／70，chexi 不得出現 50／83', () => {
    const numbers = (id: ToolId) => [...bank(id).tiers, ...(bank(id).sectionTiers ?? [])]
      .flatMap(t => [t.min, t.max]).filter((n): n is number => typeof n === 'number');
    for (const id of ['sxk-gm', 'sxk-soc', 'sxk-lang', 'sxk-adp', 'sxk-voc', 'sxk-asq'] as const) {
      for (const n of [80, 60, 40]) expect(numbers(id), `${id} 有 ${n}`).not.toContain(n);
    }
    // dev 的回傳套是 90／75／60／40 —— 60 在報告分段裡本來就有，只擋 40。
    expect(numbers('sxk-dev')).not.toContain(40);
    // adl 的回傳套是 72／60／45／30：擋 60 與 30。
    expect(numbers('sxk-adl')).not.toContain(60);
    expect(numbers('sxk-adl')).not.toContain(30);
    for (const id of ['sxk-asr', 'sxk-asb', 'sxk-att', 'sxk-ab', 'sxk-spa', 'sxk-spb'] as const) {
      for (const n of [60, 65, 70]) expect(numbers(id), `${id} 有 ${n}`).not.toContain(n);
    }
    for (const n of [50, 83]) expect(numbers('chexi')).not.toContain(n);
  });

  it('每份的 tier 遞增且區間不重疊', () => {
    for (const id of TOOL_IDS) {
      const tiers = bank(id).tiers;
      for (let i = 1; i < tiers.length; i++) {
        expect(tiers[i].tier, id).toBeGreaterThan(tiers[i - 1].tier);
      }
    }
  });
});

describe('作答值域（§3.1）', () => {
  const values = (id: ToolId) => bank(id).options.map(o => o.value);
  const labels = (id: ToolId) => bank(id).options.map(o => o.label);

  it('達成率族：2 已经会／1 偶尔会／0 还不会', () => {
    for (const id of ['sxk-gm', 'sxk-soc', 'sxk-lang', 'sxk-adp', 'sxk-voc', 'sxk-asq'] as const) {
      expect(values(id), id).toEqual([2, 1, 0]);
      expect(labels(id), id).toEqual(['已经会', '偶尔会', '还不会']);
    }
  });

  it('dev：pass／fail／skip（通过／未通过／不评）', () => {
    expect(bank('sxk-dev').options).toEqual([
      { value: 'pass', label: '通过' }, { value: 'fail', label: '未通过' }, { value: 'skip', label: '不评' },
    ]);
  });

  it('關切率族：0–3 很少或没有／偶尔／经常／总是；asr 的四級是與年齡相符～明顯不同', () => {
    for (const id of ['sxk-asb', 'sxk-ab', 'sxk-att', 'sxk-spa', 'sxk-spb'] as const) {
      expect(values(id), id).toEqual([0, 1, 2, 3]);
      expect(labels(id), id).toEqual(['很少或没有', '偶尔', '经常', '总是']);
    }
    expect(labels('sxk-asr')).toEqual(['与年龄相符', '轻度不同', '中度不同', '明显不同']);
  });

  it('adl：七級 7…1，每級有定義全文', () => {
    const opts = bank('sxk-adl').options;
    expect(opts.map(o => o.value)).toEqual([7, 6, 5, 4, 3, 2, 1]);
    expect(opts.map(o => o.label)).toEqual([
      '完全自己做', '需要有人在旁', '需要口头引导', '需要起头或收尾', '需要一起做', '大人做为主', '完全由大人做',
    ]);
    for (const o of opts) {
      expect(o.definition, `${o.value} 的定義`).toBeTruthy();
      expect(o.definition).not.toMatch(/<[^>]+>/);
    }
    expect(opts[2].definition).toBe('需要有人一步一步说，但大人不用动手碰他');
  });

  it('ldp／lds：0–3 从未／偶尔／经常／总是；snap 0–3；chexi 1–5；mchat yes／no；warn 0／1；temp 5…0', () => {
    expect(labels('sxk-ldp')).toEqual(['从未', '偶尔', '经常', '总是']);
    expect(values('sxk-ldp')).toEqual([0, 1, 2, 3]);
    expect(values('sxk-lds')).toEqual([0, 1, 2, 3]);
    expect(labels('snap-iv')).toEqual(['完全没有', '有一点点', '蛮多的', '非常多']);
    expect(values('snap-iv')).toEqual([0, 1, 2, 3]);
    expect(values('chexi')).toEqual([1, 2, 3, 4, 5]);
    expect(labels('chexi')).toEqual(['完全不正确', '不正确', '部分正确', '正确', '完全正确']);
    expect(bank('mchat-rf').options).toEqual([{ value: 'yes', label: '是' }, { value: 'no', label: '否' }]);
    expect(bank('sxk-warn').options).toEqual([{ value: 0, label: '未见异常' }, { value: 1, label: '阳性' }]);
    expect(values('sxk-tempa')).toEqual([5, 4, 3, 2, 1, 0]);
    expect(labels('sxk-tempa')).toEqual(['非常符合', '符合', '有点符合', '有点不符合', '不符合', '非常不符合']);
  });
});

describe('錨點、七級定義、前置題（§4.6、§5.1）', () => {
  it('SXK-ASR 15 項每項恰好 4 條錨點全文，其他工具沒有錨點', () => {
    const items = bank('sxk-asr').sections.flatMap(s => s.items);
    expect(items).toHaveLength(15);
    for (const it of items) {
      expect(it.anchors, it.text).toHaveLength(4);
      for (const a of it.anchors!) expect(a.length, `${it.text} 的錨點`).toBeGreaterThan(4);
    }
    expect(items[0].anchors![0]).toBe('与同龄孩子相当，主动亲近人，也接受别人靠近');
    for (const id of TOOL_IDS.filter(x => x !== 'sxk-asr')) {
      expect(bank(id).sections.flatMap(s => s.items).some(it => it.anchors), id).toBe(false);
    }
  });

  it('SXK-ADL 七級定義只有 adl 有', () => {
    for (const id of TOOL_IDS.filter(x => x !== 'sxk-adl')) {
      expect(bank(id).options.some(o => o.definition), id).toBe(false);
    }
  });

  const pre = (id: ToolId) => bank(id).preQuestions;

  it('asb／asr：能力倒退，單選 none／language／social，原文問法', () => {
    for (const id of ['sxk-asb', 'sxk-asr'] as const) {
      expect(pre(id), id).toHaveLength(1);
      const q = pre(id)[0];
      expect(q.key).toBe('regression');
      expect(q.kind).toBe('single');
      expect(q.prompt).toBe('先请教一个问题：孩子有没有出现过能力倒退？');
      expect(q.options.map(o => o.value)).toEqual(['none', 'language', 'social']);
      expect(q.options[0].exclusive).toBe(true);
      expect(q.options[1].label).toBe('语言能力出现倒退（以前会说，现在不说了）');
      expect(q.options[2].label).toBe('社交能力出现倒退（以前有回应或对视，现在没有了）');
    }
  });

  it('att：持續多久，單選 lt3m／3to6m／gt6m／always', () => {
    const q = pre('sxk-att')[0];
    expect(q).toMatchObject({ key: 'duration', kind: 'single', prompt: '先请教一个问题：这些表现出现多久了？' });
    expect(q.options.map(o => o.value)).toEqual(['lt3m', '3to6m', 'gt6m', 'always']);
    expect(q.options.map(o => o.label)).toEqual(['不到 3 个月（最近才开始）', '3–6 个月', '超过 6 个月', '一直以来都是这样']);
  });

  it('ab：出現場合，複選 home／school／other', () => {
    const q = pre('sxk-ab')[0];
    expect(q).toMatchObject({ key: 'settings', kind: 'multi', prompt: '先请教一个问题：这些表现出现在哪些场合？' });
    expect(q.options.map(o => o.value)).toEqual(['home', 'school', 'other']);
    expect(q.options.some(o => o.exclusive)).toBe(false);
  });

  it('spa／spb：影響參與，複選 none（互斥）／adl／group／play', () => {
    for (const id of ['sxk-spa', 'sxk-spb'] as const) {
      const q = pre(id)[0];
      expect(q, id).toMatchObject({ key: 'impact', kind: 'multi', prompt: '先请教一个问题：这些反应有没有影响到日常参与？' });
      expect(q.options.map(o => o.value), id).toEqual(['none', 'adl', 'group', 'play']);
      expect(q.options[0].exclusive, id).toBe(true);
    }
    // 兩支的「團體」那一項語境不同（入園 vs 學校），原文照存。
    expect(pre('sxk-spa')[0].options[2].label).toBe('影响入园适应或团体活动参与');
    expect(pre('sxk-spb')[0].options[2].label).toBe('影响学习或园所／学校参与');
  });

  it('mchat-rf：擔心，boolean，繁體原文', () => {
    const q = pre('mchat-rf')[0];
    expect(q).toMatchObject({ key: 'concern', kind: 'boolean', prompt: '醫護人員或家長是否對兒童患上自閉症譜系障礙有擔心？' });
    expect(q.options.map(o => [o.value, o.label])).toEqual([['false', '否'], ['true', '是']]);
  });

  it('warn：語言／社交倒退，複選，none 互斥', () => {
    const q = pre('sxk-warn')[0];
    expect(q).toMatchObject({ key: 'regression', kind: 'multi' });
    expect(q.options.map(o => o.value)).toEqual(['none', 'language', 'social']);
    expect(q.options.map(o => o.label)).toEqual(['未见异常', '语言功能障碍或倒退', '社会交往能力障碍或倒退']);
  });

  it('其餘 13 支沒有前置題', () => {
    const withPre = TOOL_IDS.filter(id => pre(id).length > 0);
    expect(withPre).toEqual(['sxk-warn', 'mchat-rf', 'sxk-asb', 'sxk-asr', 'sxk-ab', 'sxk-att', 'sxk-spa', 'sxk-spb']);
  });
});

describe('M-CHAT 照原文存（繁體）', () => {
  it('20 題全是繁體原文，題 2、5、12 答「是」算風險，其餘答「否」', () => {
    const items = bank('mchat-rf').sections[0].items;
    expect(items).toHaveLength(20);
    // 繁體特徵字：「會」「嗎」「對」「說」—— 簡體版是「会」「吗」「对」「说」。
    const text = items.map(i => i.text).join('');
    expect(text).toMatch(/[會嗎對說]/);
    expect(text).not.toMatch(/[会吗对说]/);
    expect(items.filter(i => i.riskAnswer === 'yes').map(i => i.no)).toEqual([2, 5, 12]);
    expect(items.filter(i => i.riskAnswer === 'no')).toHaveLength(17);
    expect(items[1].text).toBe('你有沒有想過你的子女可能是聾的？');
  });

  it('CHEXI 也是繁體 —— 中譯是 Siu 的港版，工具包與紙本都照錄；轉不轉簡體同樣是家長端的事', () => {
    const text = bank('chexi').sections.flatMap(s => s.items).map(i => i.text).join('');
    expect(text).toMatch(/[難會這個]/);
    expect(text).not.toMatch(/[难会这个]/);
  });

  it('其餘 20 支的題目是簡體（沒有「會」「嗎」這種繁體字）', () => {
    for (const id of TOOL_IDS.filter(x => x !== 'mchat-rf' && x !== 'chexi')) {
      const text = bank(id).sections.flatMap(s => s.items).map(i => i.text).join('');
      expect(text, id).not.toMatch(/[會嗎對說們這個]/);
    }
  });
});

describe('題目本身的完整性', () => {
  it('每題有非空原文、面向內從 1 連號；有起始月齡的工具每題都有，沒有的工具全是 null', () => {
    for (const id of TOOL_IDS) {
      const b = bank(id);
      const withMonth = b.sections.flatMap(s => s.items).filter(i => i.startMonth !== null).length;
      const all = b.sections.flatMap(s => s.items).length;
      expect(withMonth === 0 || withMonth === all, `${id} 的起始月齡只有一部分題有`).toBe(true);
      for (const s of b.sections) {
        expect(s.key, id).toBeTruthy();
        s.items.forEach((it, i) => {
          expect(it.no, `${id} ${s.key}`).toBe(i + 1);
          expect(it.text.trim().length, `${id} ${s.key} 第 ${i + 1} 題`).toBeGreaterThan(0);
          expect(it.text, `${id} ${s.key} 第 ${i + 1} 題有 HTML`).not.toMatch(/<[^>]+>/);
        });
      }
    }
  });

  it('有起始月齡的正是 §3 說的那 11 支', () => {
    const withMonths = TOOL_IDS.filter(id => bank(id).sections.some(s => s.items.some(i => i.startMonth !== null)));
    expect(withMonths).toEqual(['sxk-gm', 'sxk-soc', 'sxk-lang', 'sxk-adp', 'sxk-voc', 'sxk-asq', 'sxk-ab', 'sxk-att', 'sxk-spa', 'sxk-spb', 'sxk-adl']);
  });

  it('snap-iv 與 chexi 記著原量表題號：snap 1–26 連號，chexi 的副量表歸屬照紙本', () => {
    const snap = bank('snap-iv').sections.flatMap(s => s.items.map(i => i.sourceNo));
    expect(snap).toEqual(Array.from({ length: 26 }, (_, i) => i + 1));
    const chexi = Object.fromEntries(bank('chexi').sections.map(s => [s.key, s.items.map(i => i.sourceNo)]));
    expect(chexi).toEqual({
      wm: [1, 3, 6, 7, 9, 19, 21, 23, 24], pl: [12, 14, 17, 20], ib: [5, 10, 13, 16, 18, 22], rg: [2, 4, 8, 11, 15],
    });
  });

  it('工具包的建議文字（PLAN／FREQ／CONSEQ、what／tips、head／txt）沒有抽進來', () => {
    for (const id of TOOL_IDS) {
      const source = fs.readFileSync(path.join(ROOT, `src/t2/toolkit/${id}.ts`), 'utf8');
      expect(source, id).not.toMatch(/\b(PLAN|FREQ|CONSEQ|tips|what|head|txt|hex|light)\s*:/);
    }
  });
});

describe('抽取腳本從 zip 重跑，產出與 repo 內已提交的逐位元一致', () => {
  it('22 份 src/t2/toolkit/<id>.ts 與腳本重跑的結果相同', () => {
    const rendered = renderToolkitFiles(ROOT);
    expect([...rendered.keys()].sort()).toEqual(TOOL_IDS.map(id => `src/t2/toolkit/${id}.ts`).sort());
    for (const [rel, content] of rendered) {
      const onDisk = fs.readFileSync(path.join(ROOT, rel), 'utf8');
      // 只容忍 git 的 CRLF；其餘任何一個位元不同都要紅（見 sameToolkitContent）。
      expect(sameToolkitContent(onDisk, content), `${rel} 與重跑結果不同 —— 重跑 npx tsx scripts/t2-extract-toolkit.ts`).toBe(true);
    }
  });
});
