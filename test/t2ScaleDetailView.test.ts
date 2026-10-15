import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ScaleDetailCard from '../src/components/ScaleDetailCard';
import { KITV3_BANKS } from '../src/t2/kitv3';
import { askedItems, scoreKitV3 } from '../src/t2/kitv3/score';
import { hasScaleDetail, scaleDetailOf } from '../src/t2/scaleDetail';
import type { ScaleDetailEntry } from '../src/t2/findingsV3';
import { findBannedWords } from '../src/utils/parentWording';

/** 量表详解的畫面（規格 §6、票 D-7）：快照裡的 ScaleDetail 照畫，不算、不組句。 */

const AGE: Record<string, number> = {
  'SXK-GM': 48, 'SXK-SOC': 48, 'SXK-ADP': 48, 'SXK-PLC': 24, 'SXK-LANG': 48, 'SXK-LQ': 36, 'M-CHAT-R/F': 24, 'SXK-ASQ3': 30,
  'SXK-VOC': 30, 'SXK-ASB': 48, 'SXK-ASR': 48, 'SXK-QOL': 72, 'SXK-AB': 72, 'SXK-ATT': 72, 'SNAP-IV': 96, CHEXI: 96,
  'SXK-LDP': 96, 'SXK-LDS': 160, 'SXK-SP': 48, 'SXK-SPb': 96, 'SXK-ADL': 48, 'SXK-EMO': 72, 'SXK-TIC': 96,
};

/** 每題輪流選各個選項 —— 每一張卡都有三種作答、有需要練的面向。 */
function entryFor(code: string): ScaleDetailEntry {
  const bank = KITV3_BANKS[code];
  const context = { ageM: AGE[code], inSchool: true };
  const answers: Record<string, number | null> = {};
  askedItems(bank, context).forEach(({ section, item }, i) => {
    const sec = bank.forms.flatMap(f => f.sections).find(s => s.key === section)!;
    const vals = bank.options[sec.options].map(o => o.value).filter((v): v is number => typeof v === 'number');
    answers[item.key] = vals[i % vals.length];
  });
  const detail = scaleDetailOf({ bank, answers, score: scoreKitV3(bank, answers, context), context })!;
  return { toolId: code, detail };
}

const text = (html: string) => html.replace(/<[^>]+>/g, '\n');

/**
 * 畫面上我們寫的字（題目原文除外）。題目是客戶的原文、照引用（規格 §4；舊的「作答回顾」也這樣；M-CHAT／SNAP-IV／CHEXI 的授權不許改題目），
 * 有的題目本身就有「异常」「困难」—— 那不是我們對孩子下的判斷。掃描前把引用的題目拿掉。
 */
function ourText(html: string, e: ScaleDetailEntry): string {
  const quoted = e.detail.focus.flatMap(f => [...f.items.map(i => i.text), ...f.strengths, f.next ?? '']).filter(Boolean);
  let t = text(html).replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&amp;/g, '&');
  for (const q of quoted.sort((a, b) => b.length - a.length)) t = t.split(q).join('');
  return t;
}

describe('量表详解的卡', () => {
  const codes = Object.values(KITV3_BANKS).filter(hasScaleDetail).map(b => b.code);

  it('23 支都有月齡可以試', () => {
    expect(codes.sort()).toEqual(Object.keys(AGE).sort());
  });

  it.each(Object.keys(AGE))('%s：畫得出來、總覽句在、畫面上沒有禁字', code => {
    const e = entryFor(code);
    const html = renderToStaticMarkup(createElement(ScaleDetailCard, { entry: e }));
    expect(html).toContain(e.detail.displayName);
    expect(html).toContain(e.detail.overall.slice(0, 10));
    expect(findBannedWords(ourText(html, e))).toEqual([]);
  });

  it('有上一次的作答：面向那一條寫「上次」', () => {
    const e = entryFor('SXK-GM');
    const withPrev: ScaleDetailEntry = { ...e, previous: { computedAt: '2026-07-01T00:00:00Z', facets: e.detail.facets.map(f => ({ key: f.key, counts: [1, 0, 0] as [number, number, number] })) } };
    expect(renderToStaticMarkup(createElement(ScaleDetailCard, { entry: withPrev }))).toContain('上次 1/1');
  });

  it('M-CHAT 沒有中間那種作答：不畫空的那一顆', () => {
    const html = renderToStaticMarkup(createElement(ScaleDetailCard, { entry: entryFor('M-CHAT-R/F') }));
    expect(html).not.toMatch(/> \d+ 题<\/span>/);
  });
});

describe('報告頁接線', () => {
  const page = readFileSync(path.join(__dirname, '..', 'src/components/T2ReportV3.tsx'), 'utf8');

  it('快照有 scaleDetails 才畫，放在「各方面」之後、「没有问卷的方面」之前', () => {
    expect(page).toContain('const scaleDetails = findings.scaleDetails ?? [];');
    const detail = page.indexOf('id="t2v3-scale-details"');
    expect(detail).toBeGreaterThan(page.indexOf('id="t2v3-per-dimension"'));
    expect(detail).toBeLessThan(page.indexOf('id="t2v3-no-tool"'));
  });

  it('生活品質有详解時不再出「日常生活」那一句', () => {
    expect(page).toMatch(/!scaleDetails\.some\(e => e\.toolId === QOL_TOOL\)/);
  });

  it('前端不載整套題庫算详解（算的那一支只給伺服器）', () => {
    const card = readFileSync(path.join(__dirname, '..', 'src/components/ScaleDetailCard.tsx'), 'utf8');
    expect(card).not.toMatch(/from '\.\.\/t2\/kitv3'|scaleDetailEntries/);
    expect(card).toMatch(/import type \{[^}]*\} from '\.\.\/t2\/scaleDetail';/);
    expect(page).not.toMatch(/scaleDetailEntries/);
  });
});
