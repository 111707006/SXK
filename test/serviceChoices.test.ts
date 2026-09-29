import { describe, it, expect, vi, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import { SERVICE_TYPES, serviceAvailability } from '../src/utils/serviceTypes';

/**
 * 四種服務並列、沒做的先不給按（使用者 2026-09-29）。
 *
 * 1. 規則（`serviceAvailability`）：專案 A 線上諮詢說明開預約表；线上干预训练指导就是「线上干预」那一頁；
 *    線下兩種「暂未开放」。**專案 B 照舊**（「不要動到 B，B 又沒有 T2」）：四種都開預約表。
 * 2. 接到畫面（`serviceChoices`）：去那一頁要有人給出口，沒給就灰掉；人已經在那一頁上就寫「就是这一页」。
 * 3. 每一處列服務的畫面都走 `serviceChoices` —— 自己 map `serviceTypeDescriptors()` 的畫面不會知道哪幾種不能按。
 */

const product = vi.hoisted(() => ({ PRODUCT: { features: { tier2And3: true } } }));
vi.mock('../src/productConfig', () => product);

const { serviceChoices, SERVICE_NOTES, TRAINING_PAGE_DESCRIPTION } = await import('../src/components/serviceChoices');

describe('serviceAvailability', () => {
  it('專案 A：諮詢開表、线上干预训练指导去那一頁、線下兩種還沒做', () => {
    expect(SERVICE_TYPES.map(t => serviceAvailability(t, true))).toEqual(['book', 'training', 'soon', 'soon']);
  });

  it('專案 B 沒有 T2：照舊，四種都開預約表', () => {
    expect(SERVICE_TYPES.map(t => serviceAvailability(t, false))).toEqual(['book', 'book', 'book', 'book']);
  });
});

describe('serviceChoices', () => {
  beforeEach(() => {
    product.PRODUCT.features.tier2And3 = true;
  });

  it('四種永遠一起列出來，順序照 serviceTypes', () => {
    const choices = serviceChoices({ book: () => {} });
    expect(choices.map(c => c.descriptor.type)).toEqual([...SERVICE_TYPES]);
  });

  it('諮詢那一顆開預約表、帶著它自己的類型', () => {
    const book = vi.fn();
    const consult = serviceChoices({ book, openTraining: () => {} })[0];
    expect(consult.state).toBe('book');
    consult.onSelect!();
    expect(book).toHaveBeenCalledWith('online_consult');
  });

  it('线上干预训练指导：給了出口就去那一頁；在那一頁上寫「就是这一页」、不能按；沒給出口就灰掉', () => {
    const openTraining = vi.fn();
    const go = serviceChoices({ book: () => {}, openTraining })[1];
    expect(go.state).toBe('training');
    go.onSelect!();
    expect(openTraining).toHaveBeenCalledTimes(1);

    const here = serviceChoices({ book: () => {}, openTraining, inTraining: true })[1];
    expect(here.state).toBe('here');
    expect(here.onSelect).toBeNull();

    const noExit = serviceChoices({ book: () => {} })[1];
    expect(noExit.state).toBe('soon');
    expect(noExit.onSelect).toBeNull();
  });

  it('線下兩種不能按、寫「暂未开放」', () => {
    const book = vi.fn();
    for (const c of serviceChoices({ book, openTraining: () => {} }).slice(2)) {
      expect(c.state, c.descriptor.type).toBe('soon');
      expect(c.onSelect, c.descriptor.type).toBeNull();
    }
    expect(SERVICE_NOTES.soon).toBe('暂未开放');
    expect(book).not.toHaveBeenCalled();
  });

  it('專案 B：照舊四種都開預約表、帶著各自的類型，說明也是原本那幾句', () => {
    product.PRODUCT.features.tier2And3 = false;
    const book = vi.fn();
    const choices = serviceChoices({ book });
    expect(choices.map(c => c.state)).toEqual(['book', 'book', 'book', 'book']);
    for (const c of choices) {
      expect(c.description, c.descriptor.type).toBe(c.descriptor.description);
      c.onSelect!();
    }
    expect(book.mock.calls.map(([t]) => t)).toEqual([...SERVICE_TYPES]);
    expect(choices[1].description).toBe('专家连线带您做一次训练动作，看着孩子的反应即时调整做法。');
  });

  it('專案 A 的线上干预训练指导講的是「线上干预」那一頁', () => {
    expect(serviceChoices({ book: () => {}, openTraining: () => {} })[1].description).toBe(TRAINING_PAGE_DESCRIPTION);
  });
});

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripComments = (source: string) =>
  source.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');

function sourceFiles(dir: string): string[] {
  return fs.readdirSync(path.join(ROOT, dir), { withFileTypes: true }).flatMap(e =>
    e.isDirectory() ? sourceFiles(`${dir}/${e.name}`) : /\.tsx?$/.test(e.name) ? [`${dir}/${e.name}`] : [],
  );
}

describe('每一處列服務的畫面都走 serviceChoices', () => {
  it('家長端沒有別的地方自己走訪四種服務', () => {
    const offenders = sourceFiles('src')
      .filter(f => f !== 'src/utils/serviceTypes.ts' && f !== 'src/components/serviceChoices.tsx' && !f.startsWith('src/admin/'))
      .filter(f => stripComments(read(f)).includes('serviceTypeDescriptors('));
    expect(offenders).toEqual([]);
  });

  it('七處都接上了：報告的預約卡與預約表、T2 入口、T2 報告、线上干预裡的三處', () => {
    const uses: Array<[string, number]> = [
      ['src/components/AnalysisReport.tsx', 2],
      ['src/components/T2Entrance.tsx', 1],
      ['src/components/T2Report.tsx', 1],
      ['src/components/training/ReportEntry.tsx', 1],
      ['src/components/training/PlanScreen.tsx', 1],
      ['src/components/training/ExpertSheet.tsx', 1],
    ];
    for (const [file, count] of uses) {
      const source = stripComments(read(file));
      expect(source.split('serviceChoices(').length - 1, file).toBe(count);
      expect(source, file).toContain('disabled={!');
    }
  });

  it('线上干预裡的三處說 inTraining；外面的都給得出去那一頁的出口', () => {
    for (const f of ['ReportEntry', 'PlanScreen', 'ExpertSheet']) {
      expect(stripComments(read(`src/components/training/${f}.tsx`)), f).toContain('inTraining: true');
    }
    expect(stripComments(read('src/components/T2Entrance.tsx'))).toContain('openTraining: onOpenTraining');
    expect(stripComments(read('src/components/T2Report.tsx'))).toContain('openTraining: onOpenTraining');
    const report = stripComments(read('src/components/AnalysisReport.tsx'));
    expect(report).toContain('openTraining: onOpenTraining');
    expect(report).toContain('onOpenTraining={onOpenTraining}');
    // App：即時報告與歸檔報告兩處都給（B 沒有那一頁，不給）
    const app = stripComments(read('src/App.tsx'));
    expect(app.split("onOpenTraining={PRODUCT.features.tier2And3 ? () => setCurrentView('training') : undefined}").length - 1).toBe(2);
    expect(app).toContain("onOpenTraining={() => setCurrentView('training')}");
  });

  it('報告的預約卡：A 四顆並列，B 照舊一顆「预约专家」與原本的字', () => {
    const report = stripComments(read('src/components/AnalysisReport.tsx'));
    const a = report.indexOf('{PRODUCT.features.tier2And3 ? (');
    const b = report.indexOf(') : (', a);
    expect(a).toBeGreaterThan(-1);
    expect(report.slice(a, b)).toContain('serviceChoices({ book: openBookingModal, openTraining: onOpenTraining })');
    const bBranch = report.slice(b, report.indexOf('\n  );', b));
    expect(bBranch).toContain('预约 1 对 1 专家，线上或到机构都可以');
    expect(bBranch).toContain('四种可选：线上咨询说明、线上干预训练指导、线下干预训练、线下咨询。');
    expect(bBranch).toContain('onClick={() => openBookingModal()}');
    expect(bBranch).toContain('预约专家');
    expect(bBranch).not.toContain('serviceChoices');
  });

  it('預約表只為開得了表的那一種打開（別處帶來的其他種落回預設）', () => {
    const report = stripComments(read('src/components/AnalysisReport.tsx'));
    expect(report).toContain("serviceAvailability(requested, PRODUCT.features.tier2And3) === 'book' ? requested : DEFAULT_SERVICE_TYPE");
  });
});
