import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { T2ReportSnapshot, type T2ReportActions, type T2ReportEntry } from '../src/components/T2Report';
import { buildFindingsV3 } from '../src/t2/findingsV3';
import { templateProseV3 } from '../src/t2/report';
import { DIMENSION_CODES } from '../src/t2/types';
import type { DimensionCode, T1Flag } from '../src/t2/types';
import { REPORT_TRAINING_LINK } from '../src/t2/trainingCopy';
import { t2FindingsFixture } from './helpers/t2Fixtures';

/**
 * T2 報告的只讀模式（#67，規格 client-changes-2026-10-17 §2.2 第 5 點）：後台的家長詳情與列印畫同一份報告，
 * 但沒有「生成／重新生成」、預約、線上干預的按鈕 —— 那些是家長的動作，後台按下去不是替家長生成一份，就是打到
 * 家長端的端點。
 *
 * 只讀＝不給 `actions`。對照組給了 `actions`，證明這兩份快照真的走得到那幾個按鈕的位置（不然「沒有按鈕」
 * 只是快照剛好沒有那幾段）。
 */

const T1_ALL_RED = Object.fromEntries(DIMENSION_CODES.map(d => [d, 2])) as Record<DimensionCode, T1Flag>;

/** 舊題庫：一個維度留意（逐維度段）、一個沒有問卷（導向預約那一段）。 */
const legacy: T2ReportEntry = {
  id: 1,
  createdAt: '2026-09-20T02:00:00.000Z',
  findings: t2FindingsFixture({ MOT: { band: 'watch', drivenBy: 'sxk-gm' }, COG: { band: 'no_tool' } }),
  prose: null,
  isAiGenerated: false,
  aiEngine: 'template:all_engines_failed',
};

/** 完整版：一份問卷都沒做、T1 全紅，最上方有附預約的提示、有沒有問卷的方面。 */
const v3Findings = buildFindingsV3({
  t1: T1_ALL_RED,
  t1Notices: [{ kind: 'safety', text: '最上方的提示', book: true }],
  recommended: [],
  records: [],
  fallbackAgeMonth: 30,
  now: new Date('2026-10-10T02:00:00Z'),
});
const v3: T2ReportEntry = {
  id: 2,
  createdAt: '2026-10-10T02:00:00.000Z',
  findings: v3Findings,
  prose: templateProseV3({ findings: v3Findings }),
  isAiGenerated: false,
  aiEngine: 'template:qwen',
};

const ACTIONS: T2ReportActions = {
  regenerate: createElement('button', { type: 'button' }, 'MARK-REGENERATE'),
  errorLine: null,
  serviceButtons: createElement('button', { type: 'button' }, 'MARK-SERVICE'),
  onOpenTraining: () => {},
};

const render = (entry: T2ReportEntry, actions?: T2ReportActions) =>
  renderToStaticMarkup(createElement(T2ReportSnapshot, { entry, childName: '小明', actions }));

describe.each([
  ['舊題庫的快照', legacy],
  ['完整版的快照', v3],
])('%s', (_label, entry) => {
  it('對照組：家長端給了動作，生成、預約、線上干預都在', () => {
    const html = render(entry, ACTIONS);
    expect(html).toContain('MARK-REGENERATE');
    expect(html).toContain('MARK-SERVICE');
    expect(html).toContain(REPORT_TRAINING_LINK.action);
  });

  it('只讀：報告照畫，沒有生成、預約、線上干預，也沒有講「生成」的那一行', () => {
    const html = render(entry);
    expect(html).toContain('深度评估报告');
    expect(html).not.toContain(REPORT_TRAINING_LINK.action);
    expect(html).not.toContain('生成报告');
    expect(html).not.toContain('重新生成');
    expect(html).not.toContain('每次生成都会另存一份');
    // 只剩作答回顧那一顆摺疊鈕；只讀一打開就是展開的（列印頁沒有人去點它）
    const buttons = html.match(/<button[^>]*>/g) ?? [];
    expect(buttons).toHaveLength(1);
    expect(buttons[0]).toContain('aria-expanded="true"');
  });
});

describe('後台的家長詳情與列印（結構）', () => {
  const ROOT = path.resolve(__dirname, '..');
  const strip = (s: string) =>
    s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

  it.each(['src/admin/panels/ParentsPanel.tsx', 'src/admin/panels/ParentReportPrint.tsx'])(
    '%s：在 T1 報告下面畫 T2 報告，只讀（不傳 actions），有快照才畫',
    rel => {
      const src = strip(fs.readFileSync(path.join(ROOT, rel), 'utf8'));
      const t1 = src.indexOf('<ReportBody');
      const t2 = src.indexOf('<T2ReportSnapshot');
      expect(t1).toBeGreaterThan(0);
      expect(t2).toBeGreaterThan(t1);
      const tag = src.slice(t2, src.indexOf('/>', t2));
      expect(tag).not.toContain('actions');
      // 沒有快照（`null`，或專案 B 根本沒有這一欄）就整段不出，不留空區塊
      expect(src).toMatch(/\.t2Report\s*&&/);
    },
  );
});
