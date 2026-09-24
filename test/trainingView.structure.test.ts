import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 線上干預新畫面（`src/components/training/`，Keep 規格 K11、K12）的結構護欄。專案沒有 jsdom，
 * 畫面上出現什麼只能讀原始碼。頁面堆疊與返回鍵的行為在 `test/trainingLayerStack.test.ts`（假歷史），
 * 資料整形在 `test/trainingData.test.ts`，句子在 `test/trainingCopy.test.ts`。
 *
 * 這裡釘的是「畫面照搬樣品，資料與狀態重寫」那一句的後半：
 * 1. 字在 `trainingCopy.ts`，畫面裡沒有手寫的中文（K16）。
 * 2. 資料來自 API 與報告快照，不 import 樣品、不帶樣品的配圖與影片、沒有 toast 佔位按鈕（§1 不做）。
 * 3. 只有 `layerStack.ts` 碰 `history`：各頁一律經 `nav`，返回鍵與畫面上的 ‹ 才會是同一個出口。
 */

const ROOT = path.resolve(__dirname, '..');
const DIR = 'src/components/training';
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function stripComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

const files = fs
  .readdirSync(path.join(ROOT, DIR))
  .filter(f => /\.tsx?$/.test(f))
  .map(f => ({ name: f, source: stripComments(read(`${DIR}/${f}`)) }));

describe('字在 trainingCopy.ts', () => {
  it.each(files.map(f => [f.name, f.source]))('%s 沒有手寫的中文字（標點可以）', (_name, source) => {
    const hits = source.match(/[一-鿿]+/g) ?? [];
    expect(hits).toEqual([]);
  });
});

describe('資料與狀態重寫，不搬樣品', () => {
  const all = files.map(f => f.source).join('\n');

  it('不 import 樣品的任何一檔、不帶樣品的圖與影片', () => {
    expect(all).not.toMatch(/prototype/);
    expect(all).not.toMatch(/\.(mp4|jpe?g|png|webp)['"]/);
    expect(all).not.toMatch(/plan-card|hero-poster|cover-|faq-portrait|poster-0/);
  });

  it('沒有 toast 佔位（想练、一起练、分享、更多、筛选都不做）', () => {
    expect(all).not.toMatch(/toast/i);
    expect(all).not.toMatch(/Share2|Ellipsis|Filter\b|ListPlus/);
  });

  it('每週活動與打卡從 API 來；畫面不配對、不重算週次', () => {
    const data = stripComments(read(`${DIR}/useTrainingData.ts`));
    expect(data).toContain('/api/t2/weekly-plan');
    expect(data).toContain('/api/t2/checkins?from=');
    expect(data).toContain('weekPractice(');
    expect(all).not.toContain('matchWeeklyActivities');
    expect(all).not.toContain('planPosition(');
  });

  it('評估結果走報告快照（gridDimensions → dimensionStatus），不自己寫三級的字', () => {
    const data = stripComments(read(`${DIR}/trainingData.ts`));
    expect(data).toContain('gridDimensions(findings)');
    expect(data).toContain('dimensionStatus(d, ageMonth)');
    // 沒有判定的顏色照 tone（v2.1 S02：沒做的帶 T1 紅／黃），與報告九宮格同一個出口
    expect(stripComments(read(`${DIR}/PlanScreen.tsx`))).toContain("STATUS_TEXT[s.kind === 'band' ? s.status : s.tone]");
  });

  it('圖只來自活動庫的欄位（posterUrl、步驟的 imageUrl）', () => {
    const srcs = all.match(/src=\{[^}]+\}/g) ?? [];
    for (const s of srcs) expect(s, s).toMatch(/src=\{(src|photo|a\.posterUrl|activity\.posterUrl|step\.imageUrl|s\.imageUrl)\}/);
  });
});

describe('導覽只經過 layerStack', () => {
  it.each(files.filter(f => f.name !== 'layerStack.ts').map(f => [f.name, f.source]))('%s 不直接碰 history', (_name, source) => {
    expect(source).not.toMatch(/\bhistory\./);
    expect(source).not.toMatch(/popstate/);
  });

  it('T2Report 只掛 TrainingSection（入口＋蓋在上面的幾層）', () => {
    const report = stripComments(read('src/components/T2Report.tsx'));
    expect(report).toContain("import TrainingSection from './training/TrainingSection'");
    expect(report).not.toContain('T2WeeklyPlan');
    expect(fs.existsSync(path.join(ROOT, 'src/components/T2WeeklyPlan.tsx'))).toBe(false);
  });
});

describe('規格點名的幾件事在畫面上', () => {
  const entry = stripComments(read(`${DIR}/ReportEntry.tsx`));
  const plan = stripComments(read(`${DIR}/PlanScreen.tsx`));

  it('沒有示範片的活動標「示范片制作中 · 先看图文」', () => {
    expect(entry).toMatch(/hasClip\(activity\) \? CLIP_STATE\.has : CLIP_STATE\.none/);
  });

  it('換著玩走 alternateRows（舊週次沒有 alternates 就是空的，不出）', () => {
    expect(entry).toContain('alternateRows(plan)');
  });

  it('片庫、打卡日曆（票 8）的入口是「即将开放」，點不動', () => {
    expect(entry).toMatch(/<TabWord label=\{ENTRY\.tabs\.library\} disabled \/>/);
    expect(entry).toMatch(/<TabWord label=\{ENTRY\.tabs\.calendar\} disabled \/>/);
    expect(entry).not.toMatch(/openPage\(\{ name: '(library|calendar)' \}\)/);
  });

  it('計劃頁的第幾週與「已满 12 周」走 planWeekLabel，12 週的格子走 planGrid', () => {
    expect(plan).toContain('planWeekLabel(position)');
    expect(plan).toContain('planGrid(firstWeekStart)');
  });

  it('打卡讀不出來時不寫 0 次：次數與 x/4 都要先確定 practice 存在', () => {
    expect(entry).toMatch(/practice \? practicedTimes\(/);
    expect(entry).toMatch(/practice \? practice\.sessions : null/);
    expect(plan).toMatch(/\{practice && \(/);
  });
});
