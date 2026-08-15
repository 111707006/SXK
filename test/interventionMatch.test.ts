import { describe, it, expect } from 'vitest';
import {
  matchIntervention,
  severityForIntervention,
  type InterventionOutcome,
} from '../src/utils/interventionMatch';
import type { MaterialRecord } from '../src/utils/materialCells';
import type { DimensionScore } from '../src/types';

/**
 * 干預包的配對邏輯（issue #26）。
 *
 * 這一整支測試只在講一件事：**取出來的必須是那一格，不是像那一格的東西**。
 *
 * 發育訓練的年齡差是關鍵的 —— 把學齡前的精細動作訓練給一歲半的孩子，他做不到，
 * 家長會以為孩子又失敗了一次。所以「找不到就說找不到」比「找一個最接近的」正確，
 * 而後者正是任何人接手改這段程式時最想加上去的那一行。下面每一條「不退回」的
 * 測試都是為了讓那一行加上去會紅。
 */

const step = (n: number) => ({ imageUrl: `/m/${n}.png`, instruction: `第 ${n} 步` });

function material(over: Partial<MaterialRecord>): MaterialRecord {
  return {
    id: 1,
    dimensionId: 'language',
    ageBandId: 'B',
    severity: 'delay',
    title: '轮流发声',
    steps: [step(1), step(2)],
    videoUrl: null,
    active: true,
    updatedAt: null,
    ...over,
  };
}

/** B 段是 24–47 個月，取中間一個不貼邊的值。 */
const IN_BAND_B = 30;

const request = { dimensionId: 'language', ageMonth: IN_BAND_B, severity: 'delay' as const };

/** 只有 `status: 'ok'` 的結果才有 pack，斷言前先把型別窄下來。 */
function expectOk(outcome: InterventionOutcome) {
  expect(outcome.status).toBe('ok');
  if (outcome.status !== 'ok') throw new Error('unreachable');
  return outcome;
}

describe('精準命中一格才給素材', () => {
  it('三者相同時取出那一格，步驟照原順序', () => {
    const found = expectOk(matchIntervention(request, [material({ steps: [step(1), step(2), step(3)] })]));
    expect(found.cell).toMatchObject({ dimensionId: 'language', ageBandId: 'B', severity: 'delay' });
    expect(found.pack.title).toBe('轮流发声');
    expect(found.pack.steps.map(s => s.instruction)).toEqual(['第 1 步', '第 2 步', '第 3 步']);
  });

  it('有影片連結時原樣帶出來，沒有時是 null 而不是空字串', () => {
    const withVideo = expectOk(matchIntervention(request, [material({ videoUrl: 'https://v.example.com/a' })]));
    expect(withVideo.pack.videoUrl).toBe('https://v.example.com/a');
    expect(expectOk(matchIntervention(request, [material({})])).pack.videoUrl).toBeNull();
  });

  /**
   * 家長端拿到的是內容，不是資料列。
   *
   * `active` 跟著送出去的話，畫面上遲早會出現一個「已停用」的標記 —— 那是後台
   * 維護的狀態，對家長沒有意義；而 `id` 是後台編輯用的把手。
   */
  it('只帶出內容，不帶出資料列上的維護欄位', () => {
    const found = expectOk(matchIntervention(request, [material({})]));
    expect(Object.keys(found.pack).sort()).toEqual(['steps', 'title', 'videoUrl']);
  });
});

describe('不退回鄰近年齡段、不退回通用方案', () => {
  /** 這一條是整個 issue 的主張。B 段的孩子拿不到 A 段或 C 段的步驟。 */
  it('同維度同嚴重度，但素材在鄰近年齡段 —— 回準備中', () => {
    const neighbours = [
      material({ id: 1, ageBandId: 'A' }),
      material({ id: 2, ageBandId: 'C' }),
    ];
    const outcome = matchIntervention(request, neighbours);
    expect(outcome.status).toBe('preparing');
    // 而且說得出缺的是哪一格 —— 後台照著這個去補。
    expect(outcome.status === 'preparing' && outcome.cell.ageBandId).toBe('B');
  });

  it('同一格但嚴重度不同 —— 回準備中', () => {
    expect(matchIntervention(request, [material({ severity: 'borderline' })]).status).toBe('preparing');
  });

  it('同年齡段同嚴重度但別的維度 —— 回準備中', () => {
    expect(matchIntervention(request, [material({ dimensionId: 'cognitive' })]).status).toBe('preparing');
  });

  /**
   * 「通用方案」在這個資料模型裡根本不存在（素材必屬於 90 格中的一格），
   * 但有人手動塞一列進資料庫時，它不能被當成備胎端出去。
   */
  it('素材庫裡只有一份不屬於任何一格的通用素材 —— 回準備中', () => {
    const generic = material({ dimensionId: 'general', ageBandId: 'ALL', severity: 'delay' as any });
    expect(matchIntervention(request, [generic]).status).toBe('preparing');
  });

  it('九維五段兩級全滿、獨缺這一格 —— 仍然回準備中', () => {
    const everythingElse = [
      material({ id: 1, ageBandId: 'A', severity: 'borderline' }),
      material({ id: 2, ageBandId: 'A', severity: 'delay' }),
      material({ id: 3, ageBandId: 'B', severity: 'borderline' }),
      material({ id: 4, ageBandId: 'C', severity: 'delay' }),
      material({ id: 5, dimensionId: 'cognitive', ageBandId: 'B', severity: 'delay' }),
    ];
    expect(matchIntervention(request, everythingElse).status).toBe('preparing');
  });
});

describe('停用與空格子', () => {
  /**
   * 已停用對家長就是拿不到，與還沒建立同一個結果。**兩者的差別在後台**，
   * 不在這裡 —— 家長端多一種狀態只會多一句他無法處理的訊息。
   */
  it('素材已停用 —— 回準備中，不是 ok', () => {
    expect(matchIntervention(request, [material({ active: false })]).status).toBe('preparing');
  });

  it('素材庫整個是空的 —— 回準備中，並說出缺的是哪一格', () => {
    const outcome = matchIntervention(request, []);
    expect(outcome.status).toBe('preparing');
    if (outcome.status !== 'preparing') throw new Error('unreachable');
    expect(outcome.cell).toMatchObject({ dimensionId: 'language', ageBandId: 'B', severity: 'delay' });
    // 名稱一併帶著，畫面才說得出「B 段 2-4 岁」而不是一個字母。
    expect(outcome.cell.ageBandName.length).toBeGreaterThan(1);
    expect(outcome.cell.dimensionName.length).toBeGreaterThan(0);
  });

  it('同一格有一筆停用、一筆啟用時取啟用的那一筆', () => {
    // 唯一鍵讓這在正式環境不會發生，但配對邏輯不該依賴那個假設 ——
    // 遷移沒跑或手動改過資料時，它必須仍然有一個確定的答案。
    const both = [material({ id: 1, active: false, title: '旧的' }), material({ id: 2, active: true, title: '新的' })];
    expect(expectOk(matchIntervention(request, both)).pack.title).toBe('新的');
  });
});

describe('素材壞掉時不炸掉，也不端出半份', () => {
  /**
   * 一則步驟壞掉，整份就不算數。
   *
   * 挑掉壞的那幾則會端出一份少了中間某一步的訓練，而家長會把手上這幾步照著
   * 做完 —— 他無從知道自己拿到的是殘缺的版本。少一步的訓練比沒有訓練更糟。
   */
  it.each([
    ['一則是 null', [step(1), null, step(3)]],
    ['一則缺圖', [step(1), { instruction: '只有字' }]],
    ['一則缺指令', [{ imageUrl: '/m/1.png' }, step(2)]],
    ['一則圖是空字串', [{ imageUrl: '', instruction: '有字沒圖' }]],
    ['一則根本不是物件', [step(1), '第二步']],
    ['整個 steps 不是陣列', '不是陣列'],
    ['一則都沒有', []],
  ])('%s —— 回 unusable，不拋例外、不端出剩下的', (_label, steps) => {
    const outcome = matchIntervention(request, [material({ steps: steps as any })]);
    expect(outcome.status).toBe('unusable');
    expect('pack' in outcome).toBe(false);
    // 說得出是哪一格，維護的人才修得到那一列。
    expect(outcome.status === 'unusable' && outcome.cell.ageBandId).toBe('B');
  });

  /**
   * `unusable` 與 `preparing` 必須分得開。
   *
   * 混成同一個答案的話，一列壞掉的素材會躲進另外八十幾格還沒建的裡面 ——
   * 「這一格還沒做」不會有人去查，而那一列其實是做了但寫壞了。
   */
  it('壞掉的素材不會被說成「還沒建立」', () => {
    const broken = matchIntervention(request, [material({ steps: [null as any] })]);
    const empty = matchIntervention(request, []);
    expect(broken.status).not.toBe(empty.status);
    expect(empty.status).toBe('preparing');
  });

  it('步驟都好好的就照常回 ok —— 這道檢查沒有誤傷正常的素材', () => {
    expect(expectOk(matchIntervention(request, [material({ steps: [step(1)] })])).pack.steps).toHaveLength(1);
  });
});

describe('哪些請求根本不該去配對', () => {
  it('維度沒被標記（normal）—— 回未標記，不去查表', () => {
    const outcome = matchIntervention({ ...request, severity: 'normal' }, [material({})]);
    expect(outcome.status).toBe('not_flagged');
  });

  it('認不得的維度 —— 回超出範圍', () => {
    // fine_motor 是 2026-07 正名前的舊 id，正是會從舊資料裡冒出來的那一種。
    expect(matchIntervention({ ...request, dimensionId: 'fine_motor' }, [material({})]).status).toBe('out_of_scope');
    expect(matchIntervention({ ...request, dimensionId: '' }, []).status).toBe('out_of_scope');
    expect(matchIntervention({ ...request, dimensionId: null }, []).status).toBe('out_of_scope');
  });

  it('認不得的嚴重度 —— 回超出範圍', () => {
    for (const bad of ['delayed', 'DELAY', '', null, undefined, 2]) {
      expect(matchIntervention({ ...request, severity: bad }, []).status, String(bad)).toBe('out_of_scope');
    }
  });

  /**
   * 月齡可能直接來自 localStorage 或雲端 JSON，沒有人保證它的形狀。
   * 硬算會讓 `NaN` 落進 A 段（`NaN >= 12` 是 false）—— 一個看起來很正常的年齡段。
   */
  it('月齡不是非負整數 —— 回超出範圍，不猜一個年齡段', () => {
    for (const bad of [null, undefined, NaN, -1, 30.5, '30', {}]) {
      expect(matchIntervention({ ...request, ageMonth: bad }, [material({})]).status, String(bad)).toBe('out_of_scope');
    }
  });

  /**
   * 適用範圍外的月齡跟著 `getT1AgeBand` 落到最近的一段。
   *
   * 這**不是**「退回鄰近年齡段」：判斷必須與孩子實際做過的那份題目一致 ——
   * 篩查已經用 A 段的題目測了一個 9 個月大的孩子，干預包卻說這一格不存在，
   * 家長會看到一份有結果卻沒有下一步的報告。
   */
  it('適用範圍外的月齡與篩查落在同一段', () => {
    const tooYoung = matchIntervention({ ...request, ageMonth: 9 }, [material({ ageBandId: 'A' })]);
    expect(expectOk(tooYoung).cell.ageBandId).toBe('A');

    const tooOld = matchIntervention({ ...request, ageMonth: 240 }, [material({ ageBandId: 'E' })]);
    expect(expectOk(tooOld).cell.ageBandId).toBe('E');
  });

  it('邊界月齡落在正確的一段（23 是 A、24 是 B）', () => {
    expect(expectOk(matchIntervention({ ...request, ageMonth: 23 }, [material({ ageBandId: 'A' })])).cell.ageBandId).toBe('A');
    expect(expectOk(matchIntervention({ ...request, ageMonth: 24 }, [material({ ageBandId: 'B' })])).cell.ageBandId).toBe('B');
  });
});

describe('嚴重度取自哪一層成績', () => {
  const score = (over: Partial<DimensionScore>): DimensionScore => ({
    dimensionId: 'language',
    dimensionName: '语言沟通',
    tierId: 'T1',
    score: 4,
    maxScore: 8,
    status: 'borderline',
    completedAt: '2026-08-01T00:00:00.000Z',
    ...over,
  });

  it('只做過篩查時用篩查的判定', () => {
    expect(severityForIntervention([score({ tierId: 'T1', status: 'delay' })], 'language')).toBe('delay');
  });

  /**
   * 深度評估比篩查精確，這正是家長付費買的東西。最深的那一層說了算 ——
   * 拿 T1 的判定去配 T2/T3 已經做完的維度，等於把他買到的結論丟掉。
   */
  it('做過深度評估時用最深的那一層', () => {
    const scores = [
      score({ tierId: 'T1', status: 'delay' }),
      score({ tierId: 'T2', status: 'borderline' }),
      score({ tierId: 'T3', status: 'borderline' }),
    ];
    expect(severityForIntervention(scores, 'language')).toBe('borderline');
  });

  it('最深的一層是 normal 時就是 normal，不會被較淺的一層蓋回去', () => {
    const scores = [
      score({ tierId: 'T1', status: 'delay' }),
      score({ tierId: 'T3', status: 'normal' }),
    ];
    // 深度評估說沒問題，就沒有干預包 —— 那是他花錢買到的結論。
    expect(severityForIntervention(scores, 'language')).toBe('normal');
  });

  it('只看指定維度的成績，別的維度一概不算', () => {
    const scores = [
      score({ dimensionId: 'cognitive', tierId: 'T3', status: 'delay' }),
      score({ dimensionId: 'language', tierId: 'T1', status: 'borderline' }),
    ];
    expect(severityForIntervention(scores, 'language')).toBe('borderline');
  });

  it('沒有該維度的成績時回 null —— 不預設成正常，也不預設成需關注', () => {
    expect(severityForIntervention([], 'language')).toBeNull();
    expect(severityForIntervention([score({ dimensionId: 'cognitive' })], 'language')).toBeNull();
    expect(severityForIntervention(null, 'language')).toBeNull();
  });

  it('成績形狀壞掉時不當成一個判定', () => {
    const broken = [
      { dimensionId: 'language', tierId: 'T3', status: 'unknown' },
      null,
    ] as unknown as DimensionScore[];
    expect(severityForIntervention(broken, 'language')).toBeNull();
  });
});
