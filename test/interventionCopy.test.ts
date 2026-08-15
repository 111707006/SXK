import { describe, it, expect } from 'vitest';
import { interventionMessage, type InterventionStatus } from '../src/utils/interventionPack';
import type { MaterialCell } from '../src/utils/interventionMatch';

/**
 * 拿不到干預素材時，家長端說了什麼（issue #26）。
 *
 * 為什麼這值得一支測試：這幾句話**就是**「空格子回明確的準備中並導向專家」
 * 這條驗收條件的全部。寫在元件的 JSX 條件裡就沒有任何一條測試驗得到它，而它
 * 錯掉的樣子很安靜 —— 少了那顆按鈕，一位拿不到訓練內容的家長就在報告頁走到底了。
 */

const ALL_STATUSES: InterventionStatus[] = [
  'ok',
  'preparing',
  'not_flagged',
  'out_of_scope',
  'unavailable',
  'loading',
];

const CELL: MaterialCell = {
  dimensionId: 'language',
  dimensionName: '语言沟通',
  ageBandId: 'B',
  ageBandName: 'B 段 2-4 岁 (幼儿期)',
  severity: 'delay',
};

describe('每一種拿不到都說得出話', () => {
  it('每一種狀態都有標題，沒有一種是空白畫面', () => {
    for (const status of ALL_STATUSES) {
      expect(interventionMessage(status, null).title.length, status).toBeGreaterThan(0);
    }
  });

  it('沒有兩種狀態說同一句話', () => {
    // 說同一句話等於少了一種狀態：家長分不出「還沒做好」與「讀不到」，
    // 而前者該去找專家，後者只要等一下重新載入。
    const titles = ALL_STATUSES.filter(s => s !== 'ok').map(s => interventionMessage(s, null).title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});

describe('空格子：準備中並導向專家', () => {
  it('說的是「準備中」，而且給得出聯繫專家那條路', () => {
    const message = interventionMessage('preparing', CELL);
    expect(message.title).toContain('准备中');
    expect(message.offerExpert).toBe(true);
  });

  it('說得出是哪一個維度的哪一段，家長才知道這句話在講他的孩子', () => {
    const message = interventionMessage('preparing', CELL);
    expect(message.body).toContain('语言沟通');
    expect(message.body).toContain('B 段');
  });

  /**
   * 這一句是產品決定本身，不是文案潤飾：**不退回鄰近年齡段、不退回通用方案**。
   * 明講出來，家長才不會把「沒有內容」讀成系統壞掉。
   */
  it('明白說出不提供其他年齡段或通用內容，並說出為什麼', () => {
    const { body } = interventionMessage('preparing', CELL);
    expect(body).toContain('年龄段');
    expect(body).toContain('通用');
  });

  it('不知道是哪一格時仍然說得出話，不會印出 undefined', () => {
    const message = interventionMessage('preparing', null);
    expect(message.body).not.toContain('undefined');
    expect(message.offerExpert).toBe(true);
  });
});

describe('哪些狀態不該把家長推去找專家', () => {
  // 這個維度沒被標記是好消息，配一顆「联系专家」只會讓人以為漏看了什麼。
  it('維度沒被標記時不給專家按鈕', () => {
    expect(interventionMessage('not_flagged', null).offerExpert).toBe(false);
  });

  it('還在讀取時不給專家按鈕，也不給正文', () => {
    const message = interventionMessage('loading', null);
    expect(message.offerExpert).toBe(false);
    expect(message.body).toBe('');
  });

  // 讀不到與資料壞掉都是真的走不下去，那時專家是唯一有意義的下一步。
  it('讀不到或資料壞掉時仍然給得出一條出路', () => {
    expect(interventionMessage('unavailable', null).offerExpert).toBe(true);
    expect(interventionMessage('out_of_scope', null).offerExpert).toBe(true);
  });
});
