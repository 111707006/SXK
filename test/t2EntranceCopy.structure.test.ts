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
    expect(entrance).toContain('noToolNotes(plan)');
    expect(entrance).toContain('expertOnlyCopy(plan)');
    expect(entrance).not.toContain('家长自填工具');
    expect(entranceCopy).not.toContain('家长自填工具');
    expect(entranceCopy).toContain('SCHOOL_AGE_NO_TOOL_SENTENCE');
  });

  it('四種服務都導得到（走 serviceTypeDescriptors，不在這裡重抄四個名字）', () => {
    expect(entrance).toContain('serviceTypeDescriptors()');
    expect(entrance).toContain('onBookService(d.type)');
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
