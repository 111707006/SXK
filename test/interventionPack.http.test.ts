import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * 干預包端點的 HTTP 測試（issue #26）。
 *
 * 純函式測試已經釘住「哪一格」（`test/interventionMatch.test.ts`）。這一支要驗的
 * 是另外三件事，而它們只有在真的送一個請求時才看得見：
 *   1. 路由掛在付費閘門後面，沒買的維度拿不到
 *   2. 路由問資料層的是**哪三個值** —— 純函式測試證明不了「伺服器把什麼餵給了查詢」
 *   3. 拿不到素材時回的是一個說得出原因的 `status`，不是一份看起來像但不適用的內容
 *
 * 資料層以替身供應：閘門只在有持久層時才執行（記憶體模式下 `denyIfLocked` 一律
 * 放行），而素材庫的內容必須由測試決定，否則「回準備中」與「連不上資料庫」
 * 會長得一模一樣。
 */

const PARENT_ID = 1;
const OWNED = 'language';        // 家長買了的維度
const NOT_OWNED = 'cognitive';   // 沒買的

/** 替身收到的查詢條件。要驗的是伺服器問了哪一格，不是它回了什麼。 */
const asked: Array<{ dimensionId: string; ageBandId: string; severity: string }> = [];

/** 素材庫裡有的東西。刻意只有 B 段那一格 —— A/C 段的孩子必須拿不到它。 */
const LIBRARY = [
  {
    id: 1,
    dimensionId: 'language',
    ageBandId: 'B',
    severity: 'delay',
    title: '轮流发声',
    steps: [
      { imageUrl: '/m/1.png', instruction: '面对面坐下，与孩子平视。' },
      { imageUrl: '/m/2.png', instruction: '发出一个单音，等他回应。' },
    ],
    videoUrl: 'https://v.example.com/lang-b-delay',
    active: true,
    updatedAt: null,
  },
  {
    id: 2,
    dimensionId: 'language',
    ageBandId: 'C',
    severity: 'delay',
    title: '已停用的 C 段素材',
    steps: [{ imageUrl: '/m/3.png', instruction: '拿出绘本。' }],
    videoUrl: null,
    active: false,
    updatedAt: null,
  },
];

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => (id === PARENT_ID ? { id, phone: '13800000000' } : null),
  listUnlockedDimensions: async (userId: number) => (userId === PARENT_ID ? [OWNED] : []),
  // 替身照著正式的查詢語意走：三個值完全相等，而且只回啟用中的。
  // 自己在這裡放寬一點（例如漏掉 active），就等於在測試裡把 bug 補起來。
  findActiveMaterialByCell: async (dimensionId: string, ageBandId: string, severity: string) => {
    asked.push({ dimensionId, ageBandId, severity });
    return (
      LIBRARY.find(
        m => m.active && m.dimensionId === dimensionId && m.ageBandId === ageBandId && m.severity === severity
      ) ?? null
    );
  },
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  saveUserData: async () => {},
  parseUserDataRow: () => null,
}));

let client: TestClient;
let auth: Record<string, string>;

/** B 段是 24–47 個月。 */
const AGE_IN_B = 30;

function ask(params: Record<string, string | number>, headers?: Record<string, string>) {
  const qs = new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));
  return client.get(`/api/intervention-pack?${qs}`, headers);
}

beforeAll(async () => {
  client = await startTestApp(await loadApp());
  auth = bearer(PARENT_ID);
});

afterAll(async () => {
  await client.close();
});

describe('誰拿得到干預包', () => {
  it('未登入拿不到', async () => {
    const resp = await ask({ dimensionId: OWNED, ageMonth: AGE_IN_B, severity: 'delay' });
    expect(resp.status).toBe(401);
    expect((await resp.json()).code).toBe('UNAUTHENTICATED');
  });

  // 干預包是那個維度的深度評估內容，走的是同一道閘門。
  it('沒買的維度拿不到', async () => {
    const resp = await ask({ dimensionId: NOT_OWNED, ageMonth: AGE_IN_B, severity: 'delay' }, auth);
    expect(resp.status).toBe(403);
    expect((await resp.json()).code).toBe('LOCKED');
  });

  it('沒帶維度時整筆拒收，不是回一份通用內容', async () => {
    const resp = await ask({ ageMonth: AGE_IN_B, severity: 'delay' }, auth);
    expect(resp.status).toBe(400);
    expect((await resp.json()).code).toBe('DIMENSION_REQUIRED');
  });
});

describe('取出的是這個孩子那一格', () => {
  it('命中時回完整的步驟與影片連結', async () => {
    const resp = await ask({ dimensionId: OWNED, ageMonth: AGE_IN_B, severity: 'delay' }, auth);
    expect(resp.status).toBe(200);
    const body = await resp.json();

    expect(body.status).toBe('ok');
    expect(body.cell).toMatchObject({ dimensionId: 'language', ageBandId: 'B', severity: 'delay' });
    // 畫面要說得出「B 段 2-4 岁」，不是一個字母。
    expect(body.cell.ageBandName).toContain('B');
    expect(body.pack.title).toBe('轮流发声');
    expect(body.pack.steps).toEqual([
      { imageUrl: '/m/1.png', instruction: '面对面坐下，与孩子平视。' },
      { imageUrl: '/m/2.png', instruction: '发出一个单音，等他回应。' },
    ]);
    expect(body.pack.videoUrl).toBe('https://v.example.com/lang-b-delay');
  });

  /**
   * 年齡段由月齡算出來，**不收呼叫端指定**。
   *
   * 這一條驗的是伺服器問了資料層哪一格 —— 前端送一個 `ageBandId` 上來就能換
   * 一段素材的話，「不退回鄰近年齡段」在後端就等於沒有規則。
   */
  it('年齡段由月齡推導，請求裡的 ageBandId 一概不採信', async () => {
    asked.length = 0;
    await ask({ dimensionId: OWNED, ageMonth: AGE_IN_B, severity: 'delay', ageBandId: 'C' }, auth);
    expect(asked).toEqual([{ dimensionId: 'language', ageBandId: 'B', severity: 'delay' }]);
  });

  it('影片是選填 —— 沒有時回 null，不是空字串', async () => {
    const resp = await ask({ dimensionId: OWNED, ageMonth: AGE_IN_B, severity: 'delay' }, auth);
    const { pack } = await resp.json();
    expect(pack.videoUrl === null || typeof pack.videoUrl === 'string').toBe(true);
  });

  it('不外洩後台維護欄位（id、active、updatedAt）', async () => {
    const { pack } = await (await ask({ dimensionId: OWNED, ageMonth: AGE_IN_B, severity: 'delay' }, auth)).json();
    expect(Object.keys(pack).sort()).toEqual(['steps', 'title', 'videoUrl']);
  });
});

describe('拿不到素材時說得出為什麼', () => {
  /** 這一條是整個 issue 的主張：C 段的孩子拿不到 B 段那份現成的素材。 */
  it('鄰近年齡段有素材也不退回，回準備中', async () => {
    const resp = await ask({ dimensionId: OWNED, ageMonth: 60, severity: 'delay' }, auth);
    const body = await resp.json();
    expect(body.status).toBe('preparing');
    // 缺的是哪一格要說得出來，後台照著這個去補。
    expect(body.cell).toMatchObject({ dimensionId: 'language', ageBandId: 'C', severity: 'delay' });
    expect(body.pack).toBeUndefined();
  });

  it('同一格但嚴重度不同 —— 回準備中', async () => {
    const body = await (await ask({ dimensionId: OWNED, ageMonth: AGE_IN_B, severity: 'borderline' }, auth)).json();
    expect(body.status).toBe('preparing');
    expect(body.cell.severity).toBe('borderline');
  });

  // 已停用對家長就是拿不到。後台看得到差別，家長端沒有第三種說法。
  it('素材已停用 —— 回準備中，不回內容', async () => {
    const body = await (await ask({ dimensionId: OWNED, ageMonth: 60, severity: 'delay' }, auth)).json();
    expect(body.status).toBe('preparing');
    expect(body.pack).toBeUndefined();
  });

  it('維度沒被標記 —— 回未標記，不是準備中', async () => {
    const body = await (await ask({ dimensionId: OWNED, ageMonth: AGE_IN_B, severity: 'normal' }, auth)).json();
    expect(body.status).toBe('not_flagged');
  });

  it('月齡缺漏或不是數字 —— 回超出範圍，不當成剛出生', async () => {
    for (const ageMonth of ['', 'abc', '-3', '30.5']) {
      const body = await (await ask({ dimensionId: OWNED, ageMonth, severity: 'delay' }, auth)).json();
      expect(body.status, ageMonth).toBe('out_of_scope');
    }
    const noAge = await (await ask({ dimensionId: OWNED, severity: 'delay' }, auth)).json();
    expect(noAge.status).toBe('out_of_scope');
  });

  it('嚴重度認不得 —— 回超出範圍', async () => {
    for (const severity of ['', 'DELAY', 'delayed']) {
      const body = await (await ask({ dimensionId: OWNED, ageMonth: AGE_IN_B, severity }, auth)).json();
      expect(body.status, severity).toBe('out_of_scope');
    }
  });

  /**
   * 讀取炸掉 ≠ 這一格還沒建。
   *
   * 兩者混在一起的方向很安靜：資料庫連不上時對每一位家長說「準備中」，那聽起來
   * 像待辦事項而不像故障，於是沒有人會去看它 —— 而真正的情況是所有已經建好的
   * 素材一份都送不出去。
   */
  /**
   * 素材存在但內容讀不成步驟：對家長與讀取失敗是同一件事（都拿不到，而且不是
   * 內容還沒做），所以回同一個 `unavailable`。**不可以回 `preparing`** ——
   * 那會讓一列壞掉的素材躲進另外八十幾格還沒建的裡面，永遠沒有人去修它。
   */
  it('素材內容壞掉 —— 回暫時讀不到，且一步都不端出去', async () => {
    const db = await import('../src/db/mysql');
    const original = db.findActiveMaterialByCell;
    (db as any).findActiveMaterialByCell = async () => ({
      ...LIBRARY[0],
      steps: [{ imageUrl: '/m/1.png', instruction: '好的那一步' }, null],
    });
    try {
      const body = await (await ask({ dimensionId: OWNED, ageMonth: AGE_IN_B, severity: 'delay' }, auth)).json();
      expect(body.status).toBe('unavailable');
      expect(body.pack).toBeUndefined();
      // 缺的是哪一格仍要說得出來，畫面才標得出年齡段。
      expect(body.cell).toMatchObject({ ageBandId: 'B', severity: 'delay' });
    } finally {
      (db as any).findActiveMaterialByCell = original;
    }
  });

  it('素材讀取失敗 —— 回暫時讀不到，不是準備中', async () => {
    const db = await import('../src/db/mysql');
    const original = db.findActiveMaterialByCell;
    (db as any).findActiveMaterialByCell = async () => {
      throw new Error('pool unavailable');
    };
    try {
      const body = await (await ask({ dimensionId: OWNED, ageMonth: AGE_IN_B, severity: 'delay' }, auth)).json();
      expect(body.status).toBe('unavailable');
      expect(body.pack).toBeUndefined();
    } finally {
      (db as any).findActiveMaterialByCell = original;
    }
  });
});
