/**
 * 管理中心畫面的**決策**層 —— 純函式，不碰 React、不碰 DOM、不碰網路。
 *
 * 存在的理由與 `companyScope.ts` 相同：後台最危險的東西不是像素，是判斷。
 * 「這個人看得到哪些分頁」「一個空列表代表什麼」若寫在元件內部的 JSX 條件裡，
 * 專案沒有 jsdom 就沒有任何一條測試驗得到它們，而它們錯掉的樣子恰好都很正常：
 *
 * - 全域管理員沒選公司就進到列表 → 後端回 409，畫面顯示一個空列表 →
 *   看起來就是「這家公司沒有家長」。一個完全看不出來的謊。
 * - 公司成員的選單裡出現「跨公司彙總」→ 點下去被 403 擋住，資料沒有外洩，
 *   但「還有別家公司」這件事已經說出去了。
 *
 * 因此判斷全部住在這裡，`AdminApp.tsx` 只負責把結果畫出來。
 */
import type { AdminCompany, AdminErrorCode, AdminIdentityView } from './adminApi';

/** 「未歸屬」在選單、視野識別碼與畫面文字上的三個固定寫法，只此一處。 */
const UNASSIGNED_VALUE = 'unassigned';
const UNASSIGNED_LABEL = '未归属的家长';

// ══════════════════════════════════════════════
// 畫面分流
// ══════════════════════════════════════════════

export type AdminScreen =
  | { kind: 'unavailable' }
  | { kind: 'login' }
  | { kind: 'needs_company' }
  | { kind: 'ready' };

/**
 * 決定整個後台當下該顯示哪一個畫面。
 *
 * 順序是刻意的：**不可用優先於未登入**。資料庫沒設定時後端整組回 503，
 * 此時把人送到登入畫面只會讓他一直重打密碼去修一個跟密碼無關的問題。
 */
export function resolveScreen(input: {
  identity: AdminIdentityView | null;
  unavailable: boolean;
}): AdminScreen {
  if (input.unavailable) return { kind: 'unavailable' };
  if (!input.identity) return { kind: 'login' };

  // 公司成員的 `selection` 永遠是 null —— 他的視野由帳號決定，不由選擇決定。
  // 只看 `selection === null` 會把整家合作公司鎖在「請先選定公司」外面。
  if (input.identity.role === 'global_admin' && input.identity.selection === null) {
    return { kind: 'needs_company' };
  }

  return { kind: 'ready' };
}

/**
 * 目前視野的識別碼，給 React 當 key 用。
 *
 * 切換公司時分頁**必須整個重新掛載**。若沿用同一個 key，React 會保留既有的
 * state，上一家公司的家長列表就留在畫面上直到新請求回來 —— 在這個系統裡那
 * 不是一次閃爍，是把別家公司的孩子顯示給不該看的人。
 *
 * `unassigned` 刻意不寫成 `company:null` 之類的形式，避免與任何一家公司撞號。
 */
export function scopeKey(identity: AdminIdentityView): string {
  if (identity.role === 'company_member') return `company:${identity.companyId}`;
  if (identity.selection === null) return 'none';
  if (identity.selection.kind === 'unassigned') return UNASSIGNED_VALUE;
  return `company:${identity.selection.companyId}`;
}

// ══════════════════════════════════════════════
// 分頁
// ══════════════════════════════════════════════

export type AdminTabId = 'parents' | 'specialists' | 'company' | 'companies' | 'adminUsers' | 'summary';

export interface AdminTab {
  id: AdminTabId;
  label: string;
}

const SCOPED_TABS: AdminTab[] = [
  { id: 'parents', label: '家长列表' },
  { id: 'specialists', label: '专家名单' },
  { id: 'company', label: '本机构设定' },
];

/** 只有森心康看得到的分頁。合作公司連選單上都不該出現這三個字。 */
const GLOBAL_TABS: AdminTab[] = [
  { id: 'companies', label: '合作公司' },
  { id: 'adminUsers', label: '后台帐号' },
  { id: 'summary', label: '跨公司汇总' },
];

export function visibleTabs(identity: AdminIdentityView): AdminTab[] {
  return identity.role === 'global_admin' ? [...SCOPED_TABS, ...GLOBAL_TABS] : SCOPED_TABS;
}

// ══════════════════════════════════════════════
// 公司切換
// ══════════════════════════════════════════════

export interface SwitcherOption {
  value: string;
  label: string;
}

/**
 * 切換選單的選項。
 *
 * **「未歸屬」永遠在**，即使一家公司都還沒建立。沒帶識別碼進站的家長只有全域
 * 管理員看得到；少了這個選項，他們就從整個後台消失，而「消失」與「不存在」
 * 在畫面上分不出來。
 *
 * 刻意**沒有「全部公司」**這一項 —— 與 `CompanyCondition` 型別上沒有那個值
 * 是同一個決定：看別家的資料必須是一個明確的動作。
 */
export function switcherOptions(companies: AdminCompany[]): SwitcherOption[] {
  return [
    ...companies.map(c => ({ value: `company:${c.id}`, label: c.name })),
    { value: UNASSIGNED_VALUE, label: UNASSIGNED_LABEL },
  ];
}

/** 選單值 → `POST /select-company` 收得下的形狀。認不得就回 `null`，不猜。 */
export function parseSwitcherValue(value: string): { companyId: number } | 'unassigned' | null {
  if (value === UNASSIGNED_VALUE) return 'unassigned';
  if (!value.startsWith('company:')) return null;
  const raw = value.slice('company:'.length);
  // 只收正整數。`Number('')` 是 0 而 0 是整數 —— 少了這個檢查，一個空的
  // `company:` 會變成「公司 #0」送出去，看起來像一個真的選擇。
  if (!/^[1-9][0-9]*$/.test(raw)) return null;
  return { companyId: Number(raw) };
}

/** 目前視野的說法。任何情況下都要有話可說 —— 空字串會讓人以為畫面壞了。 */
export function selectionLabel(identity: AdminIdentityView, companies: AdminCompany[]): string {
  const nameOf = (id: number) => companies.find(c => c.id === id)?.name;

  if (identity.role === 'company_member') {
    // 公司成員的 `/me` 不含公司清單（他不該知道還有別家公司），
    // 因此這裡查不到名字是正常狀況，不是錯誤。
    return (identity.companyId !== null ? nameOf(identity.companyId) : undefined) ?? '本机构';
  }

  if (identity.selection === null) return '尚未选定';
  if (identity.selection.kind === 'unassigned') return UNASSIGNED_LABEL;
  return nameOf(identity.selection.companyId) ?? `公司 #${identity.selection.companyId}`;
}

// ══════════════════════════════════════════════
// 專家的可預約時段
// ══════════════════════════════════════════════

/** 後端 `readSpecialistInput` 收的上限。前端一起截斷，兩邊才會說同一件事。 */
const MAX_SLOTS = 20;

/**
 * 一行一個時段。
 *
 * 截斷的上限與後端相同：若前端不截，使用者按下儲存後畫面上還有第 21 行，
 * 而資料庫裡沒有 —— 一個要等到家長預約不到才會被發現的落差。
 */
export function parseSlots(text: string): string[] {
  return text
    .split('\n')
    .map(line => line.trim())
    .filter(line => line.length > 0)
    .slice(0, MAX_SLOTS);
}

export function formatSlots(slots: string[]): string {
  return slots.join('\n');
}

// ══════════════════════════════════════════════
// 錯誤分流
// ══════════════════════════════════════════════

/** 錯誤發生後畫面該做什麼。分錯的代價是把人送去修一個不存在的問題。 */
export type AdminErrorAction = 'relogin' | 'select_company' | 'unavailable' | 'none';

export interface AdminErrorView {
  message: string;
  action: AdminErrorAction;
}

export function describeApiError(err: {
  code: AdminErrorCode;
  status: number;
  message: string;
}): AdminErrorView {
  switch (err.code) {
    case 'ADMIN_UNAVAILABLE':
      return { message: err.message || '管理中心需要数据库，当前部署未配置。', action: 'unavailable' };
    case 'ADMIN_UNAUTHENTICATED':
      return { message: err.message || '登入状态已失效，请重新登入。', action: 'relogin' };
    case 'NO_COMPANY_SELECTED':
      return { message: err.message || '请先选定一家合作公司。', action: 'select_company' };
    default:
      // 後端沒回訊息（反向代理擋掉、網路中斷）時仍要有話可說。
      return { message: err.message || `操作失败（HTTP ${err.status}）`, action: 'none' };
  }
}

// ══════════════════════════════════════════════
// 共用標籤
// ══════════════════════════════════════════════
//
// 匯出頁（`exportView.ts`，伺服器端）與詳情畫面（`AdminApp.tsx`，瀏覽器端）
// 都用這裡的說法。issue #8 的驗收條件是「內容與詳情畫面一致」，而兩邊各寫
// 一份 statusLabel 的話，只要有人改了其中一邊，同一位孩子就會有兩種判定說法。

export function statusLabel(status: string): string {
  return status === 'delay' ? '需关注' : status === 'borderline' ? '需留意' : '正常';
}

export function genderLabel(gender: string | null): string {
  return gender === 'boy' ? '男' : gender === 'girl' ? '女' : '未填';
}

/**
 * 後端一律回 ISO 字串（UTC）。
 *
 * **必須轉成中國時間再顯示。** 直接切字串（`iso.slice(0, 19)`）省事，但那顯示的是
 * UTC：一位家長在 17:12 做完的篩查，後台會寫成 09:12。後台的用途就是「照著時間
 * 決定先打給誰」，差八小時足以把今天下午的個案排到昨天。
 *
 * 時區寫死 `Asia/Shanghai` 而不是用瀏覽器的本地時區：這個模組同時被伺服器端的
 * 匯出頁（`exportView.ts`）使用，而伺服器多半跑在 UTC。寫死才能讓螢幕上與交給
 * 專家的那張紙上是同一個時間 —— 使用者全在同一個時區，這裡不需要可變性。
 */
const DISPLAY_TIME_ZONE = 'Asia/Shanghai';

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';

  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: DISPLAY_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  }).formatToParts(date);

  const at = (type: Intl.DateTimeFormatPartTypes) => parts.find(p => p.type === type)?.value ?? '';
  // hour12: false 在部分執行環境會把午夜給成 "24"，這裡收斂回 "00"。
  const hour = at('hour') === '24' ? '00' : at('hour');
  return `${at('year')}-${at('month')}-${at('day')} ${hour}:${at('minute')}:${at('second')}`;
}
