import { describe, it, expect, beforeAll, beforeEach, afterAll, vi } from 'vitest';
import { startTestApp, loadApp, type TestClient } from './helpers/httpApp';
import { bearer } from './helpers/session';

/**
 * #120 換人提示（ADR-0020 第 6 點）：已經有服務關係的家長從別的單位或推薦人的連結進來、或用了別人的兌換碼，
 * 回提示資料（現在誰服務、要換成誰、來源）；家長選換才打 `POST /api/service-relation/switch`，伺服器用同一份規則
 * 重算再寫（原因＝連結／兌換碼、家長自己）。還沒有服務關係的直接掛上。
 * ⚠️ 開關必須在載入 `server.ts` 之前設定。
 */
process.env.A_COMPANIES = '1';
process.env.A_PHONE_IDENTITY = '1';
process.env.SERVICE_RELATIONS = '1';
process.env.TRAINING_PLAN = '1';
process.env.TRAINING_PUSH_V3 = '1';
process.env.T2_COUPON = '1';
process.env.SESSION_SECRET ||= 'test-session-secret-for-service-switch';

const PHONE = '13800138000';
const COMPANIES: Record<string, { id: number; name: string; kind: string }> = {
  jia: { id: 7, name: '甲机构', kind: 'institution' },
  yi: { id: 8, name: '乙机构', kind: 'institution' },
};
const REFERRERS = [
  { id: 70, name: '张老师', companyId: 7, code: 'zhang', active: true },
  { id: 71, name: '李老师', companyId: 7, code: 'li', active: true },
  { id: 80, name: '王老师', companyId: 8, code: 'wang', active: true },
  { id: 90, name: '赵老师', companyId: 9, code: null, active: true },
];

const db = vi.hoisted(() => ({
  users: [] as Array<{ id: number; phone: string; company_id: number | null }>,
  relations: {} as Record<number, { companyId: number; referrerId: number | null }>,
  changes: [] as any[],
  // 兌換碼：codeId → 推薦人與用掉的人
  codes: new Map<string, { id: number; referrerId: number; usedBy: number | null; unitId?: number }>(),
  // 優惠券（2026-11-25 起綁推薦人）：code → 編號、推薦人（null＝之前沒綁人的批次）、用掉的人
  coupons: new Map<string, { id: number; referrerId: number | null; usedBy: number | null }>(),
  codeHash: '',
}));

const ref = (id: number | null | undefined) => REFERRERS.find(r => r.id === id) ?? null;

vi.mock('../src/db/mysql', () => ({
  isConfigured: () => true,
  findUserById: async (id: number) => db.users.find(u => u.id === id) ?? null,
  listUsersByPhone: async (phone: string) => db.users.filter(u => u.phone === phone).map(u => ({ ...u, has_reports: 0, has_orders: 0 })),
  createPhoneUser: async (phone: string, companyId: number | null) => {
    const row = { id: 100 + db.users.length, phone, company_id: companyId };
    db.users.push(row);
    return row.id;
  },
  findLatestSmsCode: async (phone: string) => ({ id: 1, phone, code_hash: db.codeHash, attempts: 0, consumed_at: null, is_expired: 0, age_sec: 999 }),
  claimSmsCodeAttempt: async () => true,
  consumeSmsCode: async () => true,
  findCompanyBySlug: async (slug: string) => (COMPANIES[slug] ? { ...COMPANIES[slug], slug, wecomWebhookUrl: null, active: true } : null),
  findCompanyByUserId: async () => null,
  findLinkReferrer: async (companyId: number, code: string | null) => {
    // 沒代號：個人治療師單位（9）裡那一位
    const r = code === null ? REFERRERS.find(x => x.companyId === companyId && companyId === 9) : REFERRERS.find(x => x.companyId === companyId && x.code === code);
    return r ? { id: r.id, companyId: r.companyId, active: r.active } : null;
  },
  findReferrerById: async (id: number) => {
    const r = ref(id);
    return r ? { id: r.id, companyId: r.companyId, active: r.active } : null;
  },
  findUsedCodeOwner: async (userId: number, codeId: number) => {
    const c = [...db.codes.values()].find(x => x.id === codeId && x.usedBy === userId);
    if (!c) return null;
    return c.unitId !== undefined ? { referrerId: null, companyId: c.unitId, companyActive: c.unitId !== 99 } : { referrerId: c.referrerId, companyId: null, companyActive: false };
  },
  findUsedCouponOwner: async (userId: number, couponId: number) => {
    const c = [...db.coupons.values()].find(x => x.id === couponId && x.usedBy === userId);
    return c ? { referrerId: c.referrerId } : null;
  },
  getServiceRelationByUserId: async (userId: number) => db.relations[userId] ?? null,
  serviceRelationNames: async (rel: { companyId: number; referrerId: number | null }) => ({
    companyName: Object.values(COMPANIES).find(c => c.id === rel.companyId)?.name ?? null,
    referrerName: ref(rel.referrerId)?.name ?? null,
  }),
  attachServiceRelation: async (userId: number, to: any, reason: string) => {
    if (db.relations[userId]) return false;
    db.relations[userId] = { ...to };
    db.changes.push({ userId, from: null, to: { ...to }, actor: 'parent', reason });
    return true;
  },
  parentSwitchServiceRelation: async (userId: number, from: any, to: any, reason: string) => {
    const cur = db.relations[userId] ?? null;
    if (JSON.stringify(cur) !== JSON.stringify(from)) return 'stale';
    db.relations[userId] = { ...to };
    db.changes.push({ userId, from, to: { ...to }, actor: 'parent', reason });
    return 'ok';
  },
  getUserDataByUserId: async () => null,
  getUserDataByDevice: async () => null,
  parseUserDataRow: () => null,
  listUnlockedDimensions: async () => [],
  hasT2Unlock: async () => false,
}));

vi.mock('../src/db/redeemCodes', () => ({
  async redeemCodeForUser(userId: number, code: string) {
    const row = db.codes.get(code);
    if (!row || row.usedBy !== null) return { ok: false };
    row.usedBy = userId;
    return { ok: true, months: 1, startsOn: '2026-11-23', endsOn: '2026-12-20', boundReferrerId: null, codeId: row.id, referrerId: row.unitId !== undefined ? null : row.referrerId, companyId: row.unitId ?? null };
  },
}));

vi.mock('../src/db/coupons', () => ({
  async couponOfUser(userId: number) {
    const hit = [...db.coupons.entries()].find(([, c]) => c.usedBy === userId);
    return hit ? { id: hit[1].id, code: hit[0], discount: { kind: 'percent', value: 50 }, batchNote: null } : null;
  },
  async claimCouponForUser(userId: number, code: string) {
    if ([...db.coupons.values()].some(c => c.usedBy === userId)) return { ok: false, reason: 'already_claimed' };
    const row = db.coupons.get(code);
    if (!row || row.usedBy !== null) return { ok: false, reason: 'invalid' };
    row.usedBy = userId;
    return { ok: true, coupon: { id: row.id, code, discount: { kind: 'percent', value: 50 }, batchNote: null } };
  },
  async claimTestCouponForUser() {
    return { ok: false, reason: 'invalid' };
  },
}));

vi.mock('../src/db/trainingPasses', () => ({
  listTrainingPasses: async () => [],
  insertTrainingPass: async () => true,
  hasScaleT2Findings: async () => false,
}));

let client: TestClient;
beforeAll(async () => {
  db.codeHash = (await import('bcryptjs')).default.hashSync('123456', 4);
  client = await startTestApp(await loadApp());
});
afterAll(async () => {
  await client.close();
  for (const k of ['A_COMPANIES', 'A_PHONE_IDENTITY', 'SERVICE_RELATIONS', 'TRAINING_PLAN', 'TRAINING_PUSH_V3', 'T2_COUPON']) delete process.env[k];
});
beforeEach(() => {
  db.users = [{ id: 40, phone: PHONE, company_id: 8 }];
  db.relations = { 40: { companyId: 8, referrerId: 80 } };
  db.changes = [];
  db.codes = new Map([
    ['ZHANGAAAA2', { id: 501, referrerId: 70, usedBy: null }],
    ['WANGAAAAA2', { id: 502, referrerId: 80, usedBy: null }],
    // 單位層的碼（#124）：甲机构（7）、個人治療師單位（9）、停用的單位（99）
    ['JAAAAAAAA2', { id: 601, referrerId: 0, usedBy: null, unitId: 7 }],
    ['SAAAAAAAA2', { id: 602, referrerId: 0, usedBy: null, unitId: 9 }],
    ['DEADAAAAA2', { id: 603, referrerId: 0, usedBy: null, unitId: 99 }],
  ]);
  db.coupons = new Map([
    ['ZHANGCPNA2', { id: 801, referrerId: 70, usedBy: null }],
    ['WANGCPNAA2', { id: 802, referrerId: 80, usedBy: null }],
    ['XXDCPNAAA2', { id: 803, referrerId: null, usedBy: null }],
  ]);
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

const verify = (body: Record<string, unknown>) =>
  client.postJson('/api/auth/sms/verify', { phone: PHONE, code: '123456', ...body });
const post = (path: string, body: unknown, userId = 40) => client.postJson(path, body, bearer(userId));

const ZHANG_LINK = { kind: 'link', companySlug: 'jia', referrerCode: 'zhang' };

describe('登入驗證的回應', () => {
  it('已經由王老师服務、這次點了张老师的連結：帶提示資料，什麼都不寫', async () => {
    const res = await verify({ companySlug: 'yi', visitLink: { companySlug: 'jia', referrerCode: 'zhang' } });
    const body = await res.json();
    expect(body.serviceSwitch).toEqual({ currentName: '王老师', toName: '张老师', source: ZHANG_LINK });
    expect(db.relations[40]).toEqual({ companyId: 8, referrerId: 80 });
    expect(db.changes).toEqual([]);
  });

  it('沒帶這次的連結、只有記下的那一組（第一次進站的連結）：不問——改派過的家長不會每次登入都被問要不要換回去（review）', async () => {
    const body = await (await verify({ companySlug: 'jia', referrerCode: 'li' })).json();
    expect(body).not.toHaveProperty('serviceSwitch');
    expect(db.changes).toEqual([]);
  });

  it('記下的那一組只用來掛上還沒有服務關係的家長', async () => {
    db.relations = {};
    await verify({ companySlug: 'jia', referrerCode: 'li' });
    expect(db.relations[40]).toEqual({ companyId: 7, referrerId: 71 });
  });

  it('換成只有單位：寫單位名', async () => {
    const body = await (await verify({ visitLink: { companySlug: 'jia' } })).json();
    expect(body.serviceSwitch).toEqual({ currentName: '王老师', toName: '甲机构', source: { kind: 'link', companySlug: 'jia', referrerCode: null } });
  });

  it('不用問（同一位、或只帶同一個單位的連結）：回應裡沒有這一欄', async () => {
    for (const visitLink of [{ companySlug: 'yi', referrerCode: 'wang' }, { companySlug: 'yi' }]) {
      const body = await (await verify({ visitLink })).json();
      expect(body).not.toHaveProperty('serviceSwitch');
      expect(body.success).toBe(true);
    }
  });
});

describe('POST /api/service-relation/switch：家長選「換」', () => {
  it('照來源重算規則、寫服務關係與紀錄（家長自己、原因＝連結）', async () => {
    const res = await post('/api/service-relation/switch', { source: ZHANG_LINK });
    expect(await res.json()).toEqual({ changed: true });
    expect(db.relations[40]).toEqual({ companyId: 7, referrerId: 70 });
    expect(db.changes).toEqual([{ userId: 40, from: { companyId: 8, referrerId: 80 }, to: { companyId: 7, referrerId: 70 }, actor: 'parent', reason: 'link' }]);
  });

  it('規則說不用問（已經是同一位）：不寫', async () => {
    const res = await post('/api/service-relation/switch', { source: { kind: 'link', companySlug: 'yi', referrerCode: 'wang' } });
    expect(await res.json()).toEqual({ changed: false });
    expect(db.changes).toEqual([]);
  });

  it('來源認不得（單位不存在）：不寫', async () => {
    expect(await (await post('/api/service-relation/switch', { source: { kind: 'link', companySlug: 'nope', referrerCode: null } })).json()).toEqual({ changed: false });
    expect(db.changes).toEqual([]);
  });

  it('兌換碼來源：碼要是這位家長自己用掉的，否則不寫', async () => {
    db.codes.get('ZHANGAAAA2')!.usedBy = 41;
    expect(await (await post('/api/service-relation/switch', { source: { kind: 'code', codeId: 501 } })).json()).toEqual({ changed: false });
    db.codes.get('ZHANGAAAA2')!.usedBy = 40;
    expect(await (await post('/api/service-relation/switch', { source: { kind: 'code', codeId: 501 } })).json()).toEqual({ changed: true });
    expect(db.changes.at(-1)).toEqual(expect.objectContaining({ reason: 'code', to: { companyId: 7, referrerId: 70 } }));
  });

  it.each([[{}], [{ source: { kind: 'link', companySlug: '../x' } }], [{ source: { kind: 'code', codeId: 'a' } }], [{ source: { kind: 'other' } }]])(
    '形狀不對 %j：400',
    async body => {
      expect((await post('/api/service-relation/switch', body)).status).toBe(400);
    },
  );

  it('沒登入：401', async () => {
    expect((await client.postJson('/api/service-relation/switch', { source: ZHANG_LINK })).status).toBe(401);
  });
});

describe('POST /api/service-relation/link：已登入的家長點了連結', () => {
  it('還沒有服務關係：直接掛上', async () => {
    db.relations = {};
    const res = await post('/api/service-relation/link', { companySlug: 'jia', referrerCode: 'zhang' });
    expect(await res.json()).toEqual({ attached: true });
    expect(db.relations[40]).toEqual({ companyId: 7, referrerId: 70 });
  });

  it('已經有了、來源不同：回提示資料', async () => {
    const res = await post('/api/service-relation/link', { companySlug: 'jia', referrerCode: 'zhang' });
    expect(await res.json()).toEqual({ attached: false, serviceSwitch: { currentName: '王老师', toName: '张老师', source: ZHANG_LINK } });
    expect(db.changes).toEqual([]);
  });

  it('同一個：什麼都不做', async () => {
    expect(await (await post('/api/service-relation/link', { companySlug: 'yi' })).json()).toEqual({ attached: false });
  });
});

describe('兌換碼', () => {
  it('還沒有服務關係：照舊發使用權，另外掛到那位推薦人與他的單位（原因＝兌換碼）', async () => {
    db.relations = {};
    const body = await (await post('/api/training/redeem', { code: 'ZHANGAAAA2' })).json();
    expect(body.months).toBe(1);
    expect(body).not.toHaveProperty('serviceSwitch');
    expect(db.relations[40]).toEqual({ companyId: 7, referrerId: 70 });
    expect(db.changes).toEqual([expect.objectContaining({ reason: 'code', actor: 'parent' })]);
  });

  it('已經由別人服務：碼照樣用掉，回提示（來源是這組碼）', async () => {
    const body = await (await post('/api/training/redeem', { code: 'ZHANGAAAA2' })).json();
    expect(body.months).toBe(1);
    expect(body.serviceSwitch).toEqual({ currentName: '王老师', toName: '张老师', source: { kind: 'code', codeId: 501 } });
    expect(db.relations[40]).toEqual({ companyId: 8, referrerId: 80 });
  });

  it('單位層的碼（#124）、還沒有服務關係：掛到那個單位、推薦人空', async () => {
    db.relations = {};
    await post('/api/training/redeem', { code: 'JAAAAAAAA2' });
    expect(db.relations[40]).toEqual({ companyId: 7, referrerId: null });
  });

  it('個人治療師單位的碼：掛到那位推薦人', async () => {
    db.relations = {};
    await post('/api/training/redeem', { code: 'SAAAAAAAA2' });
    expect(db.relations[40]).toEqual({ companyId: 9, referrerId: 90 });
  });

  it('單位層的碼、已經由別單位服務：回提示（換成單位名）', async () => {
    const body = await (await post('/api/training/redeem', { code: 'JAAAAAAAA2' })).json();
    expect(body.serviceSwitch).toEqual({ currentName: '王老师', toName: '甲机构', source: { kind: 'code', codeId: 601 } });
  });

  it('單位停用了：不掛也不問', async () => {
    db.relations = {};
    const body = await (await post('/api/training/redeem', { code: 'DEADAAAAA2' })).json();
    expect(body).not.toHaveProperty('serviceSwitch');
    expect(db.relations[40]).toBeUndefined();
  });

  it('用的是現在那位推薦人的碼：不問', async () => {
    const body = await (await post('/api/training/redeem', { code: 'WANGAAAAA2' })).json();
    expect(body).not.toHaveProperty('serviceSwitch');
  });
});

describe('優惠券（2026-11-25 起綁推薦人，規則同兌換碼）', () => {
  it('還沒有服務關係：券照樣用好，另外掛到那位推薦人與他的單位（原因＝優惠券）', async () => {
    db.relations = {};
    const res = await post('/api/coupon', { code: 'ZHANGCPNA2' });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.coupon).toBeTruthy();
    expect(body).not.toHaveProperty('serviceSwitch');
    expect(db.relations[40]).toEqual({ companyId: 7, referrerId: 70 });
    expect(db.changes).toEqual([expect.objectContaining({ reason: 'coupon', actor: 'parent' })]);
  });

  it('已經由別人服務：券照樣用掉，回提示（來源是這張券）；選「換」寫原因＝優惠券', async () => {
    const body = await (await post('/api/coupon', { code: 'ZHANGCPNA2' })).json();
    expect(body.coupon).toBeTruthy();
    expect(body.serviceSwitch).toEqual({ currentName: '王老师', toName: '张老师', source: { kind: 'coupon', couponId: 801 } });
    expect(db.relations[40]).toEqual({ companyId: 8, referrerId: 80 });
    expect(await (await post('/api/service-relation/switch', { source: { kind: 'coupon', couponId: 801 } })).json()).toEqual({ changed: true });
    expect(db.changes.at(-1)).toEqual(expect.objectContaining({ reason: 'coupon', to: { companyId: 7, referrerId: 70 } }));
  });

  it('換人：券要是這位家長自己用掉的，否則不寫', async () => {
    db.coupons.get('ZHANGCPNA2')!.usedBy = 41;
    expect(await (await post('/api/service-relation/switch', { source: { kind: 'coupon', couponId: 801 } })).json()).toEqual({ changed: false });
    expect(db.changes).toEqual([]);
  });

  it('之前沒綁推薦人的批次：不掛也不問', async () => {
    db.relations = {};
    const body = await (await post('/api/coupon', { code: 'XXDCPNAAA2' })).json();
    expect(body.coupon).toBeTruthy();
    expect(body).not.toHaveProperty('serviceSwitch');
    expect(db.relations[40]).toBeUndefined();
  });

  it('用的是現在那位推薦人的券：不問', async () => {
    const body = await (await post('/api/coupon', { code: 'WANGCPNAA2' })).json();
    expect(body).not.toHaveProperty('serviceSwitch');
  });

  it.each([[{ source: { kind: 'coupon', couponId: 'a' } }], [{ source: { kind: 'coupon' } }]])('形狀不對 %j：400', async body => {
    expect((await post('/api/service-relation/switch', body)).status).toBe(400);
  });
});
