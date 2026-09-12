import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 單維度深度報告端點（`POST /api/specialized-report`）的提示（票 #59，規格 v2 §6）。
 *
 * 【為什麼要有這一條】
 * 這支端點原本的提示要模型「用专业脑神经突触偶联、脑功能定位（前额叶、小脑精细区、前庭反射、
 * Broca/Wernicke 言语区）与神经可塑性概念严密解析」，並且「可自然融入森心康智能穿戴硬件
 *（脑电反馈带、精细OT手套、步态腰带等）」。兩者都與 §6 直接衝突：
 *
 * - **神經解剖那一串**：模型手上只有兩個百分比。要它從兩個百分比談突觸與傳導，寫出來的是
 *   看起來很專業的猜測，而家長讀不出那是猜的。§6.2 的界線是「AI 只寫字，不判斷」。
 * - **穿戴硬體**：報告正文裡的帶貨。家長付錢買的是一份評估結果。
 *
 * 這種字不會讓型別或建置變紅 —— 只有這一條測試看得見。把提示換掉而沒有這條測試，
 * 下一次有人「順手」把神經那段加回去，同樣不會有任何聲音。
 *
 * 【為什麼掃的是原始碼而不是回應】
 * 提示是送給模型的，不會出現在任何回應裡；要驗它只能讀 `server.ts`。
 * 註解要先去掉 —— 上面那段話本身就把禁字舉了一遍（與 `parentWording.structure.test.ts` 同一招）。
 *
 * 【豁免】
 * `neuralPathwayAnalysis` 這個 **JSON 欄位名**留著：`SpecializedReportView.tsx` 照它渲染，
 * 改名是 T3 那半的事（票 #63 之後）。這條測試要的是「模型被要求寫什麼」，不是欄位叫什麼。
 */

const ROOT = path.resolve(__dirname, '..');

function stripComments(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^[ \t]*\/\/.*$/gm, '');
}

/** `server.ts` 裡 `/api/specialized-report` 那一段（到下一個端點為止）。 */
function specializedSection(): string {
  const source = stripComments(fs.readFileSync(path.join(ROOT, 'server.ts'), 'utf8'));
  const start = source.indexOf("tier2Only.post('/api/specialized-report'");
  expect(start, '找不到 /api/specialized-report 的處理函式').toBeGreaterThan(-1);
  const end = source.indexOf("tier2Only.post('/api/motion-eval'", start);
  expect(end, '找不到下一個端點，切不出這一段').toBeGreaterThan(start);
  return source.slice(start, end);
}

/** 神經解剖的說法。`neuralPathwayAnalysis`（欄位名）不在內，見檔頭「豁免」。 */
const BRAIN_TALK = [
  '脑神经', '突触', '偶联', '神经可塑性', '可塑性', '反射弧', '前庭反射',
  '脑功能定位', '前额叶', '小脑', 'Broca', 'Wernicke', '神经信号', '脑网络',
];

/** 硬體帶貨。 */
const HARDWARE_TALK = ['穿戴', '硬件', '脑电反馈带', 'OT手套', '步态腰带', '设备'];

describe('/api/specialized-report 的提示（#59）', () => {
  const section = specializedSection();

  it.each(BRAIN_TALK)('不再要模型談「%s」', word => {
    expect(section).not.toContain(word);
  });

  it.each(HARDWARE_TALK)('不再要模型融入「%s」', word => {
    expect(section).not.toContain(word);
  });

  it('欄位名留著（T3 的畫面照它渲染）', () => {
    expect(section).toContain('neuralPathwayAnalysis');
  });

  it('仍然帶著家長用字規範', () => {
    expect(section).toContain('PARENT_WORDING_CLAUSE');
  });

  /**
   * 這裡**不**對整段提示跑《對照表》的禁字掃描。提示是寫給模型的，裡面有「你必须严格返回
   * 以下 JSON 结构」這種對格式的要求 —— 「必须」在家長讀的句子裡是禁字，在對模型講的格式
   * 要求裡不是。為了讓掃描變綠去改那一句，改的是一句沒有家長會讀到的話。
   *
   * 家長真正會讀到的那一份，護欄在 `PARENT_WORDING_CLAUSE`（上一條測試盯著它還在），
   * 以及模型回來之後的那一關 —— T2 的新報告走 `src/t2/report/blacklist.ts`。
   */
  it('家長用字規範是整份帶進去的，不是抄一半', () => {
    expect(section).toContain('${PARENT_WORDING_CLAUSE}');
  });
});
