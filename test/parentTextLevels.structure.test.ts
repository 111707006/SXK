import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import path from 'node:path';

/**
 * 家長端的灰字與字級（#74，規格 docs/specs/client-changes-2026-10-17.md §4；客戶 10/17：淺灰字加深、有些字太小）。
 *
 * - 灰字只留兩級：`text-brand-charcoal`（100％）與 `text-brand-charcoal/80`。低於 /80 的透明度、`text-slate-300～500` 都不行。
 * - 最小 12px：`text-[Npx]` 的 N 不能小於 12（`text-xs` 就是 12px）。
 *
 * 只看家長端（`src/` 底下、`src/admin/` 以外）；後台不在此列。`hover:`、`disabled:` 這類狀態色不算（那是狀態，不是正文）。
 * 例外都列在下面，各附理由；新增一處小字或淡字就紅。
 */

const ROOT = path.resolve(__dirname, '..');
const SRC = path.join(ROOT, 'src');
const ADMIN = path.join(SRC, 'admin') + path.sep;

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) {
      if (!(full + path.sep).startsWith(ADMIN)) out.push(...sourceFiles(full));
    } else if (/\.(ts|tsx)$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

const rel = (f: string) => path.relative(ROOT, f).split(path.sep).join('/');
const FILES = sourceFiles(SRC);

const FAINT_CHARCOAL = /(?<![\w:/-])text-brand-charcoal\/([0-7]\d)\b/g;
const SLATE = /(?<![\w:/-])text-slate-(300|400|500)\b/g;
const SMALL = /(?<![\w:/-])text-\[(\d+(?:\.\d+)?)px\]/g;

/** 小於 12px 的例外：檔案 → 允許的處數與理由。 */
const SMALL_ALLOWED: Record<string, { count: number; why: string }> = {
  'src/components/ReportCharts.tsx': { count: 9, why: 'SVG 的 <text>，單位是 viewBox 的座標，不是螢幕上的 px' },
  'src/components/SpecializedReportView.tsx': { count: 4, why: 'SVG 的 <text>（viewBox 100×100），同上' },
  'src/components/training/PlanScreen.tsx': { count: 6, why: '計劃頁的三支示意小手機（aria-hidden 的縮圖）' },
  'src/components/LanguageSpecialAssessment.tsx': { count: 3, why: '報告上的圓形印章圖樣' },
};

/** 淡灰（slate）的例外。 */
const SLATE_ALLOWED: Record<string, { why: string }> = {
  'src/components/LanguageSpecialAssessment.tsx': { why: '深色操控台介面（bg-slate-900 上的淡色字），規格 §4.2 深色底不在此列' },
};

describe('家長端灰字只留兩級、最小 12px（#74）', () => {
  it('掃得到家長端的檔案', () => {
    expect(FILES.map(rel)).toContain('src/components/ReportBody.tsx');
    expect(FILES.some(f => f.startsWith(ADMIN))).toBe(false);
  });

  it('沒有低於 /80 的 charcoal 透明度', () => {
    const hits = FILES.flatMap(f => [...readFileSync(f, 'utf8').matchAll(FAINT_CHARCOAL)].map(m => `${rel(f)}: ${m[0]}`));
    expect(hits).toEqual([]);
  });

  it('沒有 text-slate-300～500（列出的深色底例外除外）', () => {
    const hits = FILES.filter(f => !SLATE_ALLOWED[rel(f)]).flatMap(f =>
      [...readFileSync(f, 'utf8').matchAll(SLATE)].map(m => `${rel(f)}: ${m[0]}`)
    );
    expect(hits).toEqual([]);
  });

  it('沒有小於 12px 的字級（例外的處數一處不多）', () => {
    const counts: Record<string, number> = {};
    for (const f of FILES) {
      const n = [...readFileSync(f, 'utf8').matchAll(SMALL)].filter(m => Number(m[1]) < 12).length;
      if (n > 0) counts[rel(f)] = n;
    }
    const allowed = Object.fromEntries(Object.entries(SMALL_ALLOWED).map(([k, v]) => [k, v.count]));
    expect(counts).toEqual(allowed);
  });

  it('新版 T1 報告沒有「不和其他孩子比较」那半句（D14）', () => {
    expect(readFileSync(path.join(SRC, 'components/ReportRealBlocks.tsx'), 'utf8')).not.toContain('不和其他孩子比较');
  });
});
