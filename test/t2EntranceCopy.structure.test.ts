import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * T2 入口畫面的結構護欄（票 #56）。專案沒有 jsdom，畫面上出現什麼字只能讀原始碼。
 *
 * 釘兩件事：
 * 1. 診斷方向（「医生是否已告知诊断方向」十選一）2026-09-29 依使用者要求前後端一起拿掉：
 *    入口不再問、不再打 `/api/t2/diagnosis`、伺服器也沒有那一支，付費前開放的只剩 `/plan`。
 * 2. `no_tool` 的文案是規格 §4.5 的原話，而且入口掛在報告本體的雷達圖之後、語言專項之前。
 *    6 歲以上的認知、語言、動作換成客戶的固定句（v2.1 S05）。兩句都在 `src/t2/entrance.ts`（固定句本身在
 *    `report/sentences.ts`，與報告同一個常數），元件只走 `noToolNotes`／`expertOnlyCopy`、不手抄。
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** 註解裡舉的反例不算真的文案。 */
function stripComments(source: string): string {
  return source
    .replace(/\{\/\*[\s\S]*?\*\/\}/g, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

const entrance = stripComments(read('src/components/T2Entrance.tsx'));
const entranceCopy = stripComments(read('src/t2/entrance.ts'));

describe('診斷方向拿掉了（2026-09-29）', () => {
  it('入口不再問：沒有那一格、不打 /api/t2/diagnosis、讀 plan 不帶 ?diagnosis=', () => {
    expect(entrance).not.toContain('t2-diagnosis');
    expect(entrance).not.toContain('<select');
    expect(entrance).not.toContain('/api/t2/diagnosis');
    expect(entrance).not.toContain('?diagnosis=');
    expect(entrance).not.toMatch(/diagnosis/i);
    for (const word of ['医生是否已告知诊断方向', '未告知', '自闭症', '脑瘫']) {
      expect(entrance, word).not.toContain(word);
    }
  });

  it('選項那一檔也刪了', () => {
    expect(fs.existsSync(path.join(ROOT, 'src/t2/diagnosisOptions.ts'))).toBe(false);
  });
});

describe('no_tool 的文案與位置', () => {
  it('用的是規格 §4.5 的原話（在句子層，元件不手抄）', () => {
    expect(entranceCopy).toContain('这个年龄目前没有适用的深度评估工具，建议直接预约专家');
    expect(entrance).not.toContain('这个年龄目前没有适用的深度评估工具');
  });

  // v2.1 S05：6 歲以上的認知、語言、動作用客戶的固定句 —— 清單下方與「只導專家」兩處都走句子層
  it('沒有工具的那幾段走 noToolNotes，只導專家時的標題走 expertOnlyCopy；固定句不在元件裡手抄', () => {
    expect(entrance).toMatch(/noToolNotes\(planV2\)/);
    expect(entrance).toMatch(/expertOnlyCopy\(planV2\)/);
    expect(entrance).not.toContain('家长自填工具');
    expect(entranceCopy).not.toContain('家长自填工具');
    expect(entranceCopy).toContain('SCHOOL_AGE_NO_TOOL_SENTENCE');
  });

  it('四種服務並列（走 serviceChoices，不在這裡重抄四個名字、不自己判斷哪幾種能按）', () => {
    expect(entrance).toContain('serviceChoices({ book: onBookService, openTraining: onOpenTraining })');
    expect(entrance).toContain('disabled={!c.onSelect}');
  });

  it('入口掛在報告本體的雷達圖之後、語言專項入口之前', () => {
    const body = stripComments(read('src/components/ReportBody.tsx'));
    const radar = body.indexOf('<RadarSection');
    const t2 = body.indexOf('{t2Slot}');
    const language = body.indexOf('{languageSlot}');
    expect(radar).toBeGreaterThan(-1);
    expect(t2).toBeGreaterThan(radar);
    expect(language).toBeGreaterThan(t2);
  });

  it('只掛在即時報告上，歸檔的報告沒有', () => {
    const report = stripComments(read('src/components/AnalysisReport.tsx'));
    expect(report).toMatch(/t2 && !historicalRecord \?/);
  });
});

describe('伺服器那一側', () => {
  it('付費前開放的只剩 plan（diagnosis 那一條拿掉了）', () => {
    const server = stripComments(read('server.ts'));
    expect(server).toMatch(/const T2_OPEN_PATHS = new Set\(\['\/plan'\]\);/);
  });

  it('plan 掛在 tier2Only 上（B 模式不存在）；沒有 /api/t2/diagnosis、不讀 ?diagnosis=、不讀寫 t2_intake', () => {
    const server = stripComments(read('server.ts'));
    expect(server).toContain("tier2Only.get('/api/t2/plan'");
    expect(server).not.toContain("app.get('/api/t2/plan'");
    expect(server).not.toContain("'/api/t2/diagnosis'");
    expect(server).not.toContain('req.query.diagnosis');
    expect(server).not.toMatch(/getT2Diagnosis|saveT2Diagnosis/);
    expect(stripComments(read('src/db/mysql.ts'))).not.toMatch(/t2_intake/);
  });
});

describe('完整版入口（T2 v3，T2EntranceV3）', () => {
  const v3 = stripComments(read('src/components/T2EntranceV3.tsx'));

  it('plan 是 v3 才換過去；四種服務仍由 T2Entrance 走 serviceChoices 組好傳進去', () => {
    expect(entrance).toMatch(/plan\.version === 'v3'/);
    expect(entrance).toMatch(/<T2EntranceV3/);
    expect(entrance).toMatch(/serviceButtons=\{serviceButtons\}/);
    expect(v3).not.toMatch(/serviceChoices/);
  });

  it('只畫、不組句：理由、誰填、提示、缺口、NO_T2 那一句都讀 plan 上的字', () => {
    for (const field of ['t.reason', 't.rater', 'n.text', 'g.text', 'plan.noT2Text']) expect(v3, field).toContain(field);
    expect(v3).not.toMatch(/from '\.\.\/t2\/recommend\/engine'/);
    expect(v3).not.toContain('目前不需要第二层检查');
  });

  it('第一次／第二次分組、合計分鐘、兩次才說「建议分 2 次」；NO_T2 不出 CTA', () => {
    expect(v3).toContain('第一次填写');
    expect(v3).toContain('第二次填写');
    expect(v3).toMatch(/plan\.totalMinutes/);
    expect(v3).toMatch(/plan\.sessions === 2 && <>\{' '\}问卷比较多，建议分 2 次填写/);
    const noT2 = v3.slice(v3.indexOf("plan.status === 'NO_T2'"), v3.indexOf('plan.tools.length === 0'));
    expect(noT2).not.toMatch(/onUnlock|onStart/);
  });

  it('新檔案在家長用字掃描的清單上', () => {
    expect(read('test/parentWording.structure.test.ts')).toContain("'src/components/T2EntranceV3.tsx'");
  });
});
