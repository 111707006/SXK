import { describe, it, expect } from 'vitest';
import { latestReportOf, screeningReportCount } from '../src/utils/reportHistory';

/**
 * 「最近一份報告」是後台詳情與列印頁共用的那一個選擇（ADR-0007）。
 *
 * 抽出成純函式有兩個理由：
 *
 * 1. 兩個畫面各寫一次 `sort(...)[0]` 的話，有一天其中一個會被改成挑別的一份 ——
 *    客服在抽屜裡看到的與他印出來交給家長的,就是兩份不同的報告。
 * 2. **這裡是不可信資料的關口。** `report_history` 是家長端存上去、伺服器原封不動
 *    收下的一串 JSON，欄位可以少、型別可以不對。這支函式是後台唯一讀它的地方，
 *    所以形狀要在這裡收乾淨 —— 而不是讓 `ReportBody` 在畫面上撞出一個
 *    `undefined.filter is not a function`。家長掃碼那一頁（server.ts 的 `/r/:token`）
 *    早就是這樣防的，後台不該是例外。
 */

const metrics = {
  neuralPlasticity: 72,
  sensoryIntegration: 64,
  familyEnvironmentScore: 81,
  motorControlIndex: 58,
};

const aiReport = {
  summary: '总结',
  neuralPathwayAnalysis: '分析',
  rehabSuggestions: ['建议一'],
  homeGuidance: ['指导一'],
  prognosisPrediction: '预判',
  criticalMetrics: metrics,
};

const score = {
  dimensionId: 'language',
  dimensionName: '语言沟通',
  tierId: 'T1',
  score: 5,
  maxScore: 8,
  status: 'delay',
  completedAt: '2026-09-10T02:00:00.000Z',
};

function rec(id: string, createdAt: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    type: 'T1_SCREENING',
    child: { name: '小明', birthDate: '2023-05-15', ageMonth: 40, gender: 'boy' },
    scores: [score],
    aiReport,
    isAiGenerated: true,
    createdAt,
    ...extra,
  };
}

describe('挑出最近一份報告', () => {
  it('挑產生時間最晚的那一份，不是陣列裡最後一筆', () => {
    const picked = latestReportOf([
      rec('a', '2026-09-01T00:00:00Z'),
      rec('c', '2026-09-09T00:00:00Z'),
      rec('b', '2026-09-05T00:00:00Z'),
    ]);
    expect(picked?.id).toBe('c');
  });

  it('跳過沒有 aiReport 的紀錄 —— 那些是還沒生成過報告的篩查', () => {
    const picked = latestReportOf([
      rec('has', '2026-09-01T00:00:00Z'),
      rec('none', '2026-09-09T00:00:00Z', { aiReport: undefined }),
    ]);
    expect(picked?.id).toBe('has');
  });

  it('深度評估（T2/T3）的報告不算 —— 後台只放篩查報告', () => {
    const picked = latestReportOf([
      rec('t2', '2026-09-09T00:00:00Z', { type: 'T2_T3_SPECIALIZED' }),
      rec('t1', '2026-09-01T00:00:00Z'),
    ]);
    expect(picked?.id).toBe('t1');
  });

  it('沒標 type 的舊紀錄當成篩查報告 —— 深度評估是後來才有的', () => {
    expect(latestReportOf([rec('old', '2026-09-01T00:00:00Z', { type: undefined })])?.id).toBe('old');
  });

  it('沒有任何報告時回 null', () => {
    expect(latestReportOf([])).toBeNull();
    expect(latestReportOf([rec('none', '2026-09-01T00:00:00Z', { aiReport: undefined })])).toBeNull();
  });

  it('不改動傳進來的陣列', () => {
    const history = [rec('a', '2026-09-01T00:00:00Z'), rec('c', '2026-09-09T00:00:00Z')];
    latestReportOf(history);
    expect(history.map(r => r.id)).toEqual(['a', 'c']);
  });
});

/**
 * 資料庫裡那串 JSON 可以是任何形狀。這一組釘的是「**壞掉的紀錄不會炸掉畫面**」——
 * 後台沒有 error boundary 包著家長分頁，一個 TypeError 會讓整個管理中心變白畫面，
 * 不只是那一個抽屜。
 */
describe('不可信的紀錄要收乾淨', () => {
  it('整串不是陣列就當作沒有報告', () => {
    for (const junk of [null, undefined, 'not an array', 42, {}]) {
      expect(latestReportOf(junk as never), String(junk)).toBeNull();
      expect(screeningReportCount(junk as never), String(junk)).toBe(0);
    }
  });

  it('陣列裡的非物件直接跳過', () => {
    const picked = latestReportOf([null, 'x', 7, rec('ok', '2026-09-01T00:00:00Z')] as never);
    expect(picked?.id).toBe('ok');
  });

  it('scores 不是陣列時收成空陣列，不是讓畫面去 .filter(undefined)', () => {
    const picked = latestReportOf([rec('a', '2026-09-01T00:00:00Z', { scores: undefined })]);
    expect(picked?.scores).toEqual([]);
  });

  it('scores 裡形狀不對的那幾筆被丟掉，好的留著', () => {
    const picked = latestReportOf([
      rec('a', '2026-09-01T00:00:00Z', {
        scores: [score, null, { dimensionId: 'cognitive' }, { ...score, score: '五' }],
      }),
    ]);
    expect(picked?.scores).toHaveLength(1);
    expect(picked?.scores[0].dimensionId).toBe('language');
  });

  it('認不得的判定收成 normal —— 與 statusLabel 對未知值的處置一致', () => {
    const picked = latestReportOf([
      rec('a', '2026-09-01T00:00:00Z', { scores: [{ ...score, status: '不认得' }] }),
    ]);
    // 不是綠燈比較安全，而是**全站對未知判定只能有一種說法**：
    // `statusLabel` 與 `flaggedFrom` 都把未知當成沒被標記，三處分岔更糟。
    expect(picked?.scores[0].status).toBe('normal');
  });

  it('child 不見了也照樣讀得出報告，名字退成一個不指名的說法', () => {
    const picked = latestReportOf([rec('a', '2026-09-01T00:00:00Z', { child: null })]);
    expect(picked).not.toBeNull();
    expect(picked?.childName).toBe('这个孩子');
  });

  it('aiReport 的文字欄位缺了就給空字串，陣列缺了就給空陣列', () => {
    const picked = latestReportOf([
      rec('a', '2026-09-01T00:00:00Z', { aiReport: { summary: '只剩这一句' } }),
    ]);
    expect(picked?.aiReport.summary).toBe('只剩这一句');
    expect(picked?.aiReport.prognosisPrediction).toBe('');
    expect(picked?.aiReport.rehabSuggestions).toEqual([]);
    expect(picked?.aiReport.homeGuidance).toEqual([]);
  });

  it('陣列裡的非字串被濾掉 —— 課表會把它們直接印出來', () => {
    const picked = latestReportOf([
      rec('a', '2026-09-01T00:00:00Z', {
        aiReport: { ...aiReport, rehabSuggestions: ['好的', null, 3, { x: 1 }] },
      }),
    ]);
    expect(picked?.aiReport.rehabSuggestions).toEqual(['好的']);
  });

  it('四個儀表數字不齊時回 null，不捏造 0', () => {
    // 捏造的 0 在畫面上是四個歸零的儀表，而家長會以為那是他孩子的分數。
    for (const broken of [undefined, null, {}, { ...metrics, motorControlIndex: '五十八' }]) {
      const picked = latestReportOf([
        rec('a', '2026-09-01T00:00:00Z', { aiReport: { ...aiReport, criticalMetrics: broken } }),
      ]);
      expect(picked?.aiReport.criticalMetrics, JSON.stringify(broken)).toBeNull();
    }
  });

  it('四個數字都在就原樣帶過去', () => {
    const picked = latestReportOf([rec('a', '2026-09-01T00:00:00Z')]);
    expect(picked?.aiReport.criticalMetrics).toEqual(metrics);
  });

  it('id 或 createdAt 不是字串時收成空字串 —— 報告編號那一行會整行不出現', () => {
    const picked = latestReportOf([rec('a', '2026-09-01T00:00:00Z', { id: 123, createdAt: null })]);
    expect(picked?.id).toBe('');
    expect(picked?.createdAt).toBe('');
  });
});

/**
 * 後台兩個地方要說「這位家長有幾份報告」。用整串 `reportHistory.length` 會把
 * 深度評估與沒生成過報告的篩查紀錄一起算進去 —— 而刪除確認框正是那個最不該
 * 報錯數字的地方。
 */
describe('報告份數', () => {
  it('只算篩查報告，不算深度評估與沒生成過報告的紀錄', () => {
    const history = [
      rec('t1a', '2026-09-01T00:00:00Z'),
      rec('t1b', '2026-09-05T00:00:00Z'),
      rec('t2', '2026-09-06T00:00:00Z', { type: 'T2_T3_SPECIALIZED' }),
      rec('none', '2026-09-07T00:00:00Z', { aiReport: undefined }),
    ];
    expect(screeningReportCount(history)).toBe(2);
    expect(history).toHaveLength(4);
  });

  it('一份都沒有時回 0', () => {
    expect(screeningReportCount([])).toBe(0);
  });
});
