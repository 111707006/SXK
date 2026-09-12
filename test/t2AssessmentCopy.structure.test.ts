import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { TOOLKIT, TOOL_IDS } from '../src/t2/toolkit';

/**
 * 逐支作答畫面的結構護欄（票 #58）。專案沒有 jsdom，畫面上出現什麼字只能讀原始碼。
 *
 * 釘四件事：
 * 1. **題目不手抄。** 22 支的題目、前置題問法只存在於 `src/t2/toolkit/`（腳本產出、不進家長用字掃描），
 *    畫面元件只 import。題目原文含《對照表》禁字（「异常」「困难」……）是客戶原文，是在問一件事，不是
 *    系統在說孩子 —— 與 T1 題庫同一個豁免理由；但豁免只到題庫檔為止，元件與 `answering.ts` 裡系統自己
 *    寫的每一句（AI／模板文案更是）都進掃描。少了這一條，下一個人在元件裡順手抄一題，掃描會抓到，
 *    而把整個元件加進豁免清單也就一行的事 —— 這一條讓那一行變成看得見的動作。
 * 2. 三支特別的走特別的畫法：ASR 顯示 `anchors` 全文與第 4、15 項的註解；ADL 顯示七級 `definition`；
 *    M-CHAT 題目經 `displayItemText`（簡體）而不是直接印 `item.text`。
 * 3. 缺答時按鈕停用並說「還有 N 題」。
 * 4. 舊評估面板的 T2 五題佔位與 45／75 門檻拿掉了，T3 那半還在。
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

const component = stripComments(read('src/components/T2Assessment.tsx'));
const answering = stripComments(read('src/t2/answering.ts'));

describe('題目只存在於題庫，元件不手抄', () => {
  it('元件 import 純函式層，題目經 formFor 取得', () => {
    expect(component).toMatch(/from '\.\.\/t2\/answering'/);
    for (const name of ['formFor', 'displayItemText', 'displayPrompt', 'asrItemNotes', 'RATER_OPTIONS', 'followupHints', 'canSubmit', 'missingCount', 'togglePreMulti', 'completedAt']) {
      expect(component, name).toContain(name);
    }
    expect(component).not.toMatch(/from '\.\.\/t2\/toolkit/);
  });

  it('22 支的題目與前置題問法，沒有一句出現在元件或 answering.ts 裡', () => {
    for (const id of TOOL_IDS) {
      const bank = TOOLKIT[id];
      for (const s of bank.sections) for (const it of s.items) {
        expect(component, `${id} ${s.key}.${it.no}`).not.toContain(it.text);
        expect(answering, `${id} ${s.key}.${it.no}`).not.toContain(it.text);
      }
      for (const q of bank.preQuestions) {
        expect(component, `${id} ${q.key}`).not.toContain(q.prompt);
        expect(answering, `${id} ${q.key}`).not.toContain(q.prompt);
      }
    }
  });

  it('題目文字一律經 displayItemText，前置題問法經 displayPrompt —— 元件裡沒有直接印 .text／.prompt／.label 的 JSX', () => {
    expect(component).not.toMatch(/\{[^}]*\.item\.text\}/);
    expect(component).not.toMatch(/\{[^}]*\bq\.prompt\}/);
    expect(component).toMatch(/displayItemText\(/);
    expect(component).toMatch(/displayPrompt\(/);
  });
});

describe('三支特別的', () => {
  it('ASR：錨點全文是選項本體，選項標籤只當小字；第 4、15 項的註解走 asrItemNotes', () => {
    expect(component).toMatch(/\.anchors/);
    expect(component).toMatch(/asrItemNotes\(/);
  });

  it('ADL：七級定義全文顯示', () => {
    expect(component).toMatch(/\.definition/);
  });

  it('M-CHAT 的簡體只在顯示層：answering.ts 的轉換表存在，題庫檔一個字都沒被改成簡體', () => {
    expect(answering).toContain('TRAD_TO_SIMP');
    const kit = read('src/t2/toolkit/mchat-rf.ts');
    expect(kit).toContain('你有沒有想過你的子女可能是聾的？');
  });
});

describe('缺答不能交卷', () => {
  it('按鈕看 canSubmit 停用，文案說「還有 N 題」', () => {
    expect(component).toMatch(/disabled=\{[^}]*!canSubmit\(/);
    expect(component).toMatch(/还有 \{[^}]+\} 题/);
  });
});

describe('加測提示', () => {
  it('只在 followupHints 給了那一句時顯示（band 由伺服器算，元件不跑規則表）', () => {
    expect(component).toMatch(/followupHints\(/);
    expect(component).not.toMatch(/from '\.\.\/t2\/rules/);
    expect(component).not.toMatch(/from '\.\.\/t2\/scoring/);
  });
});

describe('接線', () => {
  it('入口（T2Entrance）解鎖後有「開始作答」的 CTA，App 把它接到作答畫面', () => {
    const entrance = stripComments(read('src/components/T2Entrance.tsx'));
    expect(entrance).toMatch(/onStart/);
    const app = stripComments(read('src/App.tsx'));
    expect(app).toMatch(/<T2Assessment/);
    expect(app).toMatch(/'t2_assessment'/);
  });

  it('兩個新檔案都在家長用字掃描的清單上', () => {
    const scan = read('test/parentWording.structure.test.ts');
    expect(scan).toContain("'src/components/T2Assessment.tsx'");
    expect(scan).toContain("'src/t2/answering.ts'");
  });

  it('交卷走 authFetch，而且在 authFetch 護欄的清單上', () => {
    expect(component).toMatch(/authFetch\(/);
    expect(read('test/authFetch.structure.test.ts')).toContain("'src/components/T2Assessment.tsx'");
  });
});

describe('舊評估面板：T2 五題佔位拿掉，T3 那半不動', () => {
  const panel = stripComments(read('src/components/AssessmentPanel.tsx'));

  it('沒有 T2 題目、沒有 T2 的 45／75 門檻、沒有 T2 頁籤', () => {
    expect(panel).not.toContain('tiers.T2');
    expect(panel).not.toContain('calculateT2Score');
    expect(panel).not.toContain('handleSaveT2');
    expect(panel).not.toContain("tierId: 'T2'");
    expect(panel).not.toContain("'T2' | 'T3'");
    // 45／75 只剩 T3 自己那一份（calculateT3Score），T2 那一份沒了
    expect(panel.match(/percent\s*<\s*45/g)).toHaveLength(1);
    expect(panel.match(/percent\s*<\s*75/g)).toHaveLength(1);
    expect(panel.indexOf('percent < 45')).toBeGreaterThan(panel.indexOf('const calculateT3Score'));
  });

  it('T3 那半還在：題目、錄音、上傳、專項報告', () => {
    expect(panel).toContain('tiers.T3');
    expect(panel).toContain('handleSaveT3AndReport');
    expect(panel).toContain('MotionVideoAssessment');
    expect(panel).toContain("tierId: 'T3'");
    expect(panel).toContain('/api/specialized-report');
  });
});
