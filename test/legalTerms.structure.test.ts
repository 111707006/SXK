import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 條款只有一份。
 *
 * 【為什麼需要這一條】
 * 服務及免責條款、隱私保護條款原本各自寫死在兩個元件裡：`App.tsx` 的頁尾彈窗
 * （完整版）與 `AuthScreen.tsx` 登入頁的合併彈窗（**精簡版**，免責 4 節、隱私 6 節）。
 * 兩份各自演化，到 2026-09 已經對不起來。
 *
 * 那個結構讓「所有頁面的條款都換成最新版」在物理上做不到 —— 改一處不會動到另一處，
 * 而畫面上看不出哪一邊是舊的。更麻煩的是登入頁：使用者在那裡勾的是「本人已審閱並
 * 同意」，而他看到的是刪節版 —— 那個同意站不住。
 *
 * 壞掉的樣子很安靜：條款照樣打得開、內容看起來也正常，只是其中一頁少了幾節。
 * 所以這裡釘的是「**內文只能有一個來源**」，不是內文本身寫了什麼。
 *
 * 改條款內容請改 `src/components/LegalTerms.tsx`（內容來源是客戶的 .docx）。
 */

const ROOT = path.resolve(__dirname, '..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

const SOURCE_OF_TRUTH = 'src/components/LegalTerms.tsx';

/**
 * 從兩份條款各取一句**只會出現在條款內文裡**的句子。
 *
 * 取整句而不是關鍵詞：像「隐私」「免责」這種詞在按鈕文字、頁尾連結、錯誤訊息裡
 * 都會出現，拿來當判準會誤判。
 */
const CLAUSE_SENTENCES = [
  '不构成任何医疗诊断、治疗建议或医疗行为',
  '本系统非医疗器械，不具备医疗资质',
  '发育评估量表作答数据（9维度3层级评估结果）',
  '定期执行安全审计与漏洞扫描',
];

/** 條款內文不得再出現在這些檔案裡 —— 它們要 import，不要自己抄一份。 */
const CONSUMERS = ['src/App.tsx', 'src/components/AuthScreen.tsx'];

describe('條款內文的唯一來源', () => {
  it.each(CLAUSE_SENTENCES)('「%s」寫在 LegalTerms.tsx 裡', sentence => {
    expect(read(SOURCE_OF_TRUTH)).toContain(sentence);
  });

  it.each(
    CONSUMERS.flatMap(file => CLAUSE_SENTENCES.map(sentence => [file, sentence] as const))
  )('%s 裡沒有自己抄一份（%s）', (file, sentence) => {
    expect(read(file)).not.toContain(sentence);
  });

  it.each(CONSUMERS)('%s 從 LegalTerms 取用條款', file => {
    expect(read(file)).toMatch(/from\s+['"][^'"]*LegalTerms['"]/);
  });
});

describe('登入頁看到的是完整條款', () => {
  /**
   * 登入頁的勾選框寫著「本人已審閱並同意服務及免責條款、隱私保護條款等聲明」，
   * 而第一次驗證成功就會建立帳號 —— 那一刻就是同意成立的時點。
   * 給他看刪節版而讓他同意完整版，那個同意站不住。
   */
  it('AuthScreen 用的是與頁尾同一份，不是另一個刪節版元件', () => {
    const source = read('src/components/AuthScreen.tsx');
    expect(source).toContain('CombinedLegalBody');
    // 併在一起的那個元件必須真的由兩份完整條款組成。
    const legal = read(SOURCE_OF_TRUTH);
    const combined = legal.slice(legal.indexOf('export function CombinedLegalBody'));
    expect(combined).toContain('<ServiceTerms />');
    expect(combined).toContain('<PrivacyTerms />');
  });
});

describe('落款日期', () => {
  it('三個彈窗共用同一個常數，不會有一頁停在舊日期', () => {
    const legal = read(SOURCE_OF_TRUTH);
    expect(legal).toMatch(/export const LEGAL_LAST_UPDATED = '.+'/);
    // 舊的寫法是把日期直接打在每個彈窗底下，共有三處，改一處會漏兩處。
    for (const file of [...CONSUMERS, SOURCE_OF_TRUTH]) {
      expect(read(file)).not.toContain('最后更新日期：2026年7月');
    }
  });
});
