import { describe, it, expect } from 'vitest';
import {
  resolveScreen,
  scopeKey,
  visibleTabs,
  switcherOptions,
  parseSwitcherValue,
  selectionLabel,
  parseSlots,
  formatSlots,
  tabNeedsCompany,
  describeApiError,
  statusLabel,
  genderLabel,
  formatDateTime,
  showCompanySwitcher,
  type AdminCenterShape,
  type AdminTabId,
} from '../src/admin/adminView';
import type { AdminCompany, AdminIdentityView } from '../src/admin/adminApi';

/**
 * 管理中心畫面的**決策**測試。
 *
 * 專案沒有 jsdom 也沒有元件測試框架，而管理中心最危險的東西不是像素，是判斷：
 * 「這個人看得到什麼」與「空白代表什麼」。因此那些判斷全部住在這個純模組裡，
 * `AdminApp.tsx` 只負責把結果畫出來 —— 與 `companyScope.ts` 對 SQL 的處置相同。
 *
 * 這裡釘住的兩件事，錯了都不會有人看見：
 *
 * 1. 全域管理員**未選定公司**時不得進到資料畫面。若進得去，後端會回 409，
 *    而畫面上一個空列表看起來就是「這家公司沒有家長」—— 一個看起來完全正常的謊。
 * 2. 公司成員不得看到全域管理員的分頁。後端擋得住（403），但選單本身就洩漏了
 *    「還有別家公司、還有跨公司彙總」這件事。
 */

/** 專案 B：多合作公司。既有的每一條測試都是在這個模式下寫的。 */
const MULTI: AdminCenterShape = { multiCompany: true };
/** 專案 A：沒有合作公司，視野固定在未歸屬（issue #19）。 */
const SINGLE: AdminCenterShape = { multiCompany: false };

const member: AdminIdentityView = {
  role: 'company_member',
  email: 'm@x.com',
  companyId: 7,
  selection: null,
};

const globalUnselected: AdminIdentityView = {
  role: 'global_admin',
  email: 'g@x.com',
  companyId: null,
  selection: null,
};

const globalOnCompany: AdminIdentityView = {
  role: 'global_admin',
  email: 'g@x.com',
  companyId: null,
  selection: { kind: 'company', companyId: 9 },
};

const globalOnUnassigned: AdminIdentityView = {
  role: 'global_admin',
  email: 'g@x.com',
  companyId: null,
  selection: { kind: 'unassigned' },
};

const companies: AdminCompany[] = [
  { id: 7, name: '康行儿童', slug: 'kangxing', wecomWebhookUrl: null, active: true },
  { id: 9, name: '明德早疗', slug: 'mingde', wecomWebhookUrl: 'https://x', active: true },
];

describe('畫面分流', () => {
  it('沒有身分時要求登入', () => {
    expect(resolveScreen({ identity: null, unavailable: false, shape: MULTI })).toEqual({ kind: 'login' });
  });

  // 資料庫沒設定時後端整組回 503。這要與「沒登入」分開講，否則維運人員會一直
  // 重打密碼去修一個跟密碼無關的問題。
  it('後台不可用時優先於一切，包含已登入的狀態', () => {
    expect(resolveScreen({ identity: null, unavailable: true, shape: MULTI }).kind).toBe('unavailable');
    expect(resolveScreen({ identity: globalOnCompany, unavailable: true, shape: MULTI }).kind).toBe('unavailable');
  });

  it('公司成員登入後直接進到資料畫面', () => {
    expect(resolveScreen({ identity: member, unavailable: false, shape: MULTI })).toEqual({ kind: 'ready' });
  });

  // 這一條是本檔案的核心。放行的話畫面會顯示一個空列表，而空列表與
  // 「這家公司真的沒有家長」在螢幕上長得一模一樣。
  it('全域管理員未選定公司時不得進到資料畫面', () => {
    expect(resolveScreen({ identity: globalUnselected, unavailable: false, shape: MULTI })).toEqual({
      kind: 'needs_company',
    });
  });

  it('全域管理員選定公司或未歸屬後才進到資料畫面', () => {
    expect(resolveScreen({ identity: globalOnCompany, unavailable: false, shape: MULTI })).toEqual({ kind: 'ready' });
    expect(resolveScreen({ identity: globalOnUnassigned, unavailable: false, shape: MULTI })).toEqual({ kind: 'ready' });
  });

  // 公司成員的 selection 永遠是 null（視野由帳號決定）。若分流只看
  // `selection === null`，整家合作公司都會被鎖在「請先選定公司」的畫面外。
  it('公司成員的 selection 為 null 不代表未選定', () => {
    expect(resolveScreen({ identity: member, unavailable: false, shape: MULTI }).kind).not.toBe('needs_company');
  });
});

/**
 * 單一機構模式（專案 A，issue #19）。
 *
 * 專案沒有 jsdom，這一整組是「森心康登入後看到什麼」唯一驗得到的地方。
 * 錯掉的樣子全都很正常：多三個空分頁、一個只有一項的下拉、一句
 * 「請先選定要查看的合作公司」配著空的公司清單。
 */
describe('單一機構模式下的畫面分流', () => {
  // 本 issue 的核心。放行的話森心康每次登入都會撞上一個選不出東西的畫面。
  it('全域管理員未選定公司也直接進到資料畫面', () => {
    expect(resolveScreen({ identity: globalUnselected, unavailable: false, shape: SINGLE })).toEqual({
      kind: 'ready',
    });
  });

  it('後台不可用仍然優先，這一條不因模式而改變', () => {
    expect(resolveScreen({ identity: globalUnselected, unavailable: true, shape: SINGLE }).kind).toBe(
      'unavailable'
    );
  });

  it('沒有身分時仍然要求登入', () => {
    expect(resolveScreen({ identity: null, unavailable: false, shape: SINGLE })).toEqual({
      kind: 'login',
    });
  });

  // 兩種模式在這裡刻意分岔：多公司時「沒選公司」是一個真實的狀態，
  // 單一機構時它不存在。把 bug 放回去（拿掉 shape 判斷）這一條會紅。
  it('同一個身分在兩種模式下走到不同的畫面', () => {
    const asMulti = resolveScreen({ identity: globalUnselected, unavailable: false, shape: MULTI });
    const asSingle = resolveScreen({ identity: globalUnselected, unavailable: false, shape: SINGLE });
    expect(asMulti.kind).toBe('needs_company');
    expect(asSingle.kind).toBe('ready');
  });
});

describe('視野識別碼', () => {
  // 這個字串是 React 的 key。切換公司後若 key 沒變，分頁不會重新掛載，
  // 上一家公司的家長就留在畫面上直到新請求回來 —— 那不是閃爍，是外洩。
  it('每一種視野都給出不同的識別碼', () => {
    const keys = [
      scopeKey(member, MULTI),
      scopeKey(globalUnselected, MULTI),
      scopeKey(globalOnCompany, MULTI),
      scopeKey(globalOnUnassigned, MULTI),
    ];
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('看的是同一家公司就是同一個識別碼', () => {
    const globalOnMembersCompany: AdminIdentityView = {
      ...globalOnCompany,
      selection: { kind: 'company', companyId: 7 },
    };
    expect(scopeKey(globalOnMembersCompany, MULTI)).toBe(scopeKey(member, MULTI));
  });

  it('未歸屬不會與任何一家公司撞在一起', () => {
    const companyIds = [0, 1, 7, 9, 999];
    for (const companyId of companyIds) {
      const identity: AdminIdentityView = { ...globalOnCompany, selection: { kind: 'company', companyId } };
      expect(scopeKey(identity, MULTI)).not.toBe(scopeKey(globalOnUnassigned, MULTI));
    }
  });

  /**
   * 單一機構只有一個視野，識別碼必須說出那個視野本身 —— 而不是 token 裡碰巧
   * 還留著的某家公司。畫面上的 key 說一家公司、後端撈的是未歸屬，兩邊講的
   * 不是同一件事，而那個落差在螢幕上長得完全正常。
   */
  it('單一機構的識別碼一律是未歸屬，不理會殘留的公司選擇', () => {
    const keys = [globalUnselected, globalOnCompany, globalOnUnassigned].map(i => scopeKey(i, SINGLE));
    expect(new Set(keys).size).toBe(1);
    expect(keys[0]).toBe(scopeKey(globalOnUnassigned, MULTI));
  });
});

describe('分頁可見性', () => {
  const idsOf = (identity: AdminIdentityView): AdminTabId[] => visibleTabs(identity, MULTI).map(t => t.id);

  it('公司成員只有自己那三個分頁', () => {
    expect(idsOf(member)).toEqual(['parents', 'specialists', 'company']);
  });

  it('全域管理員多出合作公司、後台帳號、跨公司彙總與素材庫', () => {
    expect(idsOf(globalOnCompany)).toEqual([
      'parents',
      'specialists',
      'company',
      'companies',
      'adminUsers',
      'summary',
      'materials',
    ]);
  });

  // 「後端會擋」不是不顯示的理由：選單上出現「跨公司彙總」本身就告訴合作公司
  // 有別家公司存在，而那是他們不該知道的事。
  it('全域管理員專屬的分頁不出現在公司成員的選單裡', () => {
    const globalOnly: AdminTabId[] = ['companies', 'adminUsers', 'summary', 'materials'];
    for (const id of globalOnly) {
      expect(idsOf(member)).not.toContain(id);
    }
  });

  it('每個分頁都有可顯示的名稱', () => {
    for (const tab of visibleTabs(globalOnCompany, MULTI)) {
      expect(tab.label.length).toBeGreaterThan(0);
    }
  });
});

describe('單一機構模式下的分頁可見性', () => {
  const idsOf = (identity: AdminIdentityView): AdminTabId[] =>
    visibleTabs(identity, SINGLE).map(t => t.id);

  /**
   * 這三個在專案 A 上永遠是空的：一家合作公司都沒有，所以沒有名冊可看、
   * 沒有跨公司可彙總；而「本機構設定」設定的是那家合作公司的企業微信通知
   * 位置，未歸屬不是一家公司，沒有位置可以設定。
   */
  it('合作公司、跨公司彙總、本機構設定都不在選單裡', () => {
    for (const id of ['companies', 'summary', 'company'] as AdminTabId[]) {
      expect(idsOf(globalUnselected), id).not.toContain(id);
    }
  });

  // 素材庫是專案 A **才有**的東西（深度評估的干預內容），後台帳號則是這個
  // 部署唯一開得出帳號的地方。連它們一起收掉會把功能藏起來。
  it('家長列表、專家名單、後台帳號與素材庫仍然在', () => {
    expect(idsOf(globalUnselected)).toEqual(['parents', 'specialists', 'adminUsers', 'materials']);
  });

  it('對應的後端路由不掛載，所以留著分頁就是留著 404', () => {
    // 這一條是提醒，不是斷言邏輯：兩邊的清單必須一起改。
    expect(idsOf(globalUnselected)).not.toContain('companies');
    expect(visibleTabs(globalOnCompany, MULTI).map(t => t.id)).toContain('companies');
  });
});

describe('公司切換下拉的去留', () => {
  it('多合作公司時，全域管理員看得到', () => {
    expect(showCompanySwitcher(globalOnCompany, MULTI)).toBe(true);
  });

  // 公司成員的視野由帳號決定，切換對他沒有意義（後端也會回 403）。
  it('公司成員看不到，兩種模式都一樣', () => {
    expect(showCompanySwitcher(member, MULTI)).toBe(false);
    expect(showCompanySwitcher(member, SINGLE)).toBe(false);
  });

  // 只有一項的下拉是請人做一個沒有選擇的選擇，而每按一次都會留下一筆切換紀錄。
  it('單一機構時誰都看不到', () => {
    expect(showCompanySwitcher(globalUnselected, SINGLE)).toBe(false);
    expect(showCompanySwitcher(globalOnCompany, SINGLE)).toBe(false);
  });
});

describe('哪些分頁要先選定公司', () => {
  // 需要公司條件的恰好是那三個看家長資料的分頁 —— 與後端 withScope 涵蓋的
  // 範圍相同。兩邊分岔的話，畫面會擋下一件後端明明允許的事（或反過來）。
  it('看家長資料的三個分頁都要', () => {
    for (const id of ['parents', 'specialists', 'company'] as AdminTabId[]) {
      expect(tabNeedsCompany(id), id).toBe(true);
    }
  });

  /**
   * 素材庫不需要。它不是家長資料，後端也不要求選定 —— 擋在「請先選定公司」
   * 後面的話，維護素材的人得先隨便挑一家合作公司，而那一下會在切換紀錄裡
   * 留下一筆他其實沒有要看的公司。
   */
  it('全域的四個分頁都不需要', () => {
    for (const id of ['companies', 'adminUsers', 'summary', 'materials'] as AdminTabId[]) {
      expect(tabNeedsCompany(id), id).toBe(false);
    }
  });
});

describe('公司切換選單', () => {
  it('列出所有公司，並多一個「未歸屬」', () => {
    expect(switcherOptions(companies)).toEqual([
      { value: 'company:7', label: '康行儿童' },
      { value: 'company:9', label: '明德早疗' },
      { value: 'unassigned', label: '未归属的家长' },
    ]);
  });

  // 未歸屬的家長只有全域管理員看得到。少了這個選項他們就從後台消失了，
  // 而「消失」與「不存在」在畫面上分不出來。
  it('公司清單為空時「未歸屬」仍然在', () => {
    expect(switcherOptions([])).toEqual([{ value: 'unassigned', label: '未归属的家长' }]);
  });

  it('選單值送得回後端要的形狀', () => {
    expect(parseSwitcherValue('company:9')).toEqual({ companyId: 9 });
    expect(parseSwitcherValue('unassigned')).toBe('unassigned');
  });

  // 往返：畫面上選得到的每一項，都必須解得回一個後端收得下的選擇。
  it('選單上的每一項都解得回去', () => {
    for (const option of switcherOptions(companies)) {
      expect(parseSwitcherValue(option.value)).not.toBeNull();
    }
  });

  it('認不得的值一律回 null，不猜一家公司出來', () => {
    expect(parseSwitcherValue('')).toBeNull();
    expect(parseSwitcherValue('company:')).toBeNull();
    expect(parseSwitcherValue('company:abc')).toBeNull();
    expect(parseSwitcherValue('company:9.5')).toBeNull();
    expect(parseSwitcherValue('all')).toBeNull();
  });
});

describe('目前視野的說法', () => {
  it('公司成員顯示自己的公司名', () => {
    expect(selectionLabel(member, companies, MULTI)).toBe('康行儿童');
  });

  it('全域管理員依選定顯示', () => {
    expect(selectionLabel(globalOnCompany, companies, MULTI)).toBe('明德早疗');
    expect(selectionLabel(globalOnUnassigned, companies, MULTI)).toBe('未归属的家长');
  });

  it('未選定時說的是「尚未選定」，不是空字串', () => {
    expect(selectionLabel(globalUnselected, companies, MULTI)).toBe('尚未选定');
  });

  // 公司成員的公司不在他拿得到的清單裡（`/me` 只給全域管理員公司清單）。
  // 這時要說「本机构」，不能顯示成空白或 undefined。
  it('查不到公司名時有替代說法', () => {
    expect(selectionLabel(member, [], MULTI)).toBe('本机构');
    expect(selectionLabel(globalOnCompany, [], MULTI)).toBe('公司 #9');
  });

  // 單一機構沒有東西待選。說「尚未选定」會讓人去找一個不存在的下拉。
  it('單一機構一律說未歸屬，不說「尚未選定」', () => {
    expect(selectionLabel(globalUnselected, companies, SINGLE)).toBe('未归属的家长');
    expect(selectionLabel(globalOnCompany, companies, SINGLE)).toBe('未归属的家长');
  });
});

describe('可預約時段的輸入', () => {
  it('一行一個時段，去掉空白與空行', () => {
    expect(parseSlots('周一 上午\n\n  周三 下午  \n')).toEqual(['周一 上午', '周三 下午']);
  });

  it('沒填就是沒有時段', () => {
    expect(parseSlots('')).toEqual([]);
    expect(parseSlots('   \n  \n')).toEqual([]);
  });

  // 後端只收 20 個。前端一起截斷，使用者才看得到真正會被存下來的東西 ——
  // 否則按下儲存後畫面上還有第 21 行，而資料庫裡沒有。
  it('超過 20 個就截斷，與後端一致', () => {
    const many = Array.from({ length: 25 }, (_, i) => `时段${i}`);
    expect(parseSlots(many.join('\n'))).toHaveLength(20);
  });

  it('存進去再讀出來是同一份', () => {
    const slots = ['周一 上午', '周三 下午'];
    expect(parseSlots(formatSlots(slots))).toEqual(slots);
  });

  it('沒有時段時輸入框是空的', () => {
    expect(formatSlots([])).toBe('');
  });
});

describe('錯誤分流', () => {
  it('登入失效要回登入畫面', () => {
    expect(describeApiError({ code: 'ADMIN_UNAUTHENTICATED', status: 401, message: 'x' }).action).toBe(
      'relogin'
    );
  });

  it('未選定公司要回到選公司，而不是重新登入', () => {
    expect(describeApiError({ code: 'NO_COMPANY_SELECTED', status: 409, message: 'x' }).action).toBe(
      'select_company'
    );
  });

  it('後台不可用要標成不可用，不是叫人重新登入', () => {
    expect(describeApiError({ code: 'ADMIN_UNAVAILABLE', status: 503, message: 'x' }).action).toBe(
      'unavailable'
    );
  });

  it('其他錯誤留在原地，只把訊息顯示出來', () => {
    const d = describeApiError({ code: 'UNKNOWN', status: 500, message: '读取家长列表失败。' });
    expect(d.action).toBe('none');
    expect(d.message).toBe('读取家长列表失败。');
  });

  // 後端沒有回訊息（反向代理擋掉、網路斷線）時仍要有話可說。
  it('沒有訊息時不顯示空白', () => {
    expect(describeApiError({ code: 'UNKNOWN', status: 0, message: '' }).message.length).toBeGreaterThan(0);
  });
});

describe('共用標籤', () => {
  // 匯出頁與詳情畫面必須說同一句話（issue #8：「內容與詳情畫面一致」）。
  // 兩邊各寫一份 statusLabel 的話，改了其中一邊就會產生兩種判定說法。
  it('判定的說法只有一套', () => {
    expect(statusLabel('delay')).toBe('需关注');
    expect(statusLabel('borderline')).toBe('需留意');
    expect(statusLabel('normal')).toBe('正常');
    expect(statusLabel('something-else')).toBe('正常');
  });

  it('性別有未填的說法', () => {
    expect(genderLabel('boy')).toBe('男');
    expect(genderLabel('girl')).toBe('女');
    expect(genderLabel(null)).toBe('未填');
  });

  // 後端回的是 UTC。照著切字串會讓 17:12 做完的篩查在後台寫成 09:12，
  // 而後台的用途就是照時間決定先打給誰。
  it('時間換算成中國時間再顯示', () => {
    expect(formatDateTime('2026-08-06T11:04:51.000Z')).toBe('2026-08-06 19:04:51');
  });

  it('跨日的那一刻也要換算對，不是只加八小時的數字', () => {
    expect(formatDateTime('2026-08-06T16:30:00.000Z')).toBe('2026-08-07 00:30:00');
    expect(formatDateTime('2026-12-31T16:00:00.000Z')).toBe('2027-01-01 00:00:00');
  });

  it('沒有時間或格式不對就是破折號，不顯示 Invalid Date', () => {
    expect(formatDateTime(null)).toBe('—');
    expect(formatDateTime(undefined)).toBe('—');
    expect(formatDateTime('')).toBe('—');
    expect(formatDateTime('not-a-date')).toBe('—');
  });
});
