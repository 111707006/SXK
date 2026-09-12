import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { DIAGNOSIS_OPTIONS, DIAGNOSIS_QUESTION, NO_DIAGNOSIS_LABEL } from '../src/t2/diagnosisOptions';

/**
 * T2 入口畫面的結構護欄（票 #56）。專案沒有 jsdom，畫面上出現什麼字只能讀原始碼。
 *
 * 釘三件事：
 * 1. 診斷方向的十個名稱與問句**只存在於** `src/t2/diagnosisOptions.ts`，元件只 import。
 *    那一檔刻意不進家長用字掃描（理由在它檔頭）；元件進。少了這一條，下一個人在元件裡
 *    順手寫一個「自闭症」，掃描會抓到 —— 但把整個元件加進豁免清單也就一行的事，這一條
 *    讓那一行變成看得見的動作。
 * 2. 沒填診斷方向不是缺漏（§4.3）：畫面上沒有「未提供」「未填写」「缺少」這種字樣，
 *    第十一個選項就是「未告知」。
 * 3. `no_tool` 的文案是規格 §4.5 的原話，而且入口掛在報告本體的雷達圖之後、語言專項之前。
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

describe('診斷方向的字只在 diagnosisOptions.ts', () => {
  it('元件 import 那一檔', () => {
    expect(entrance).toMatch(/from '\.\.\/t2\/diagnosisOptions'/);
    for (const name of ['DIAGNOSIS_OPTIONS', 'DIAGNOSIS_QUESTION', 'NO_DIAGNOSIS_LABEL']) {
      expect(entrance, name).toContain(name);
    }
  });

  it('元件裡沒有手抄任何一個診斷名，也沒有手抄問句', () => {
    for (const o of DIAGNOSIS_OPTIONS) {
      expect(entrance, `「${o.label}」不該出現在元件裡`).not.toContain(o.label);
    }
    expect(entrance).not.toContain(DIAGNOSIS_QUESTION);
    expect(entrance).not.toContain(NO_DIAGNOSIS_LABEL);
  });
});

describe('沒填不是缺漏（§4.3）', () => {
  it.each(['未提供', '未填写', '未填寫', '缺少', '尚未选择', '请选择'])('畫面上沒有「%s」', word => {
    expect(entrance).not.toContain(word);
  });

  it('第十一個選項是「未告知」，它是 select 的空值那一項', () => {
    expect(NO_DIAGNOSIS_LABEL).toBe('未告知');
    expect(entrance).toMatch(/<option value="">\{NO_DIAGNOSIS_LABEL\}<\/option>/);
  });
});

describe('no_tool 的文案與位置', () => {
  it('用的是規格 §4.5 的原話', () => {
    expect(entrance).toContain('这个年龄目前没有适用的深度评估工具，建议直接预约专家');
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
  it('plan 與 diagnosis 兩條路徑在 T2 閘門的白名單上，而且只有這兩條', () => {
    const server = stripComments(read('server.ts'));
    expect(server).toMatch(/const T2_OPEN_PATHS = new Set\(\['\/plan', '\/diagnosis'\]\);/);
  });

  it('兩支端點都掛在 tier2Only 上（B 模式不存在）', () => {
    const server = stripComments(read('server.ts'));
    expect(server).toContain("tier2Only.get('/api/t2/plan'");
    expect(server).toContain("tier2Only.put('/api/t2/diagnosis'");
    expect(server).not.toContain("app.get('/api/t2/plan'");
    expect(server).not.toContain("app.put('/api/t2/diagnosis'");
  });
});
