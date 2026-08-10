import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

/**
 * 家長端「通行證失效」的護欄。
 *
 * 畫面上「已登入」是 localStorage 裡的一個字串撐著的，而伺服器認的是通行證。
 * 兩者分家時，家長會對著自己的孩子檔案做完一整份篩查，而每一次保存都被 401
 * 靜靜退回 —— #27 之後更沒有退路：電子郵件登入不在了，他不會自己想到要按登出。
 *
 * 處置只有一種，而它住在 `authFetch` 裡（`src/utils/api.ts`）。這個檔案擋的是
 * **繞過它**：只要有人手拼一次 `fetch(..., { headers: authHeaders() })`，那一支
 * 請求就回到了原本那條安靜的路上，而型別檢查與其他測試一條都擋不住 ——
 * 專案沒有 jsdom，這些請求發不出來也就驗不到。
 *
 * 曾經漏掉的具體形狀（都是這樣長出來的）：
 *   - `handleSaveChild` 自己拼一支 `fetch(...).catch(...)` —— 而 401 是一個
 *     **成功兌現**的 Promise，`.catch` 從來不會被呼叫到。
 *   - 掛載時「伺服器是空的就把本機這一份送上去」那支，連狀態碼都沒看。
 */

const ROOT = path.resolve(__dirname, '..');

/** 會發身分請求的檔案。新增一個要記得加進來 —— 底下第三條測試會提醒。 */
const CLIENT_FILES = [
  'src/App.tsx',
  'src/components/AssessmentPanel.tsx',
  'src/components/LanguageSpecialAssessment.tsx',
  'src/components/MotionVideoAssessment.tsx',
  'src/components/Paywall.tsx',
  'src/utils/asr.ts',
  'src/utils/specialists.ts',
];

/**
 * 可以直接呼叫 `authHeaders()` 的檔案 —— **只有它自己**。
 *
 * 要往這裡加一個名字，得先解釋為什麼那一支請求的 401 不需要被處理，
 * 而答案不會是「它不重要」：不重要的請求不必帶通行證。
 */
const AUTH_HEADERS_ALLOWLIST = ['src/utils/api.ts'];

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

/** 註解裡舉的反例不該被當成真的程式碼。 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

/** 整個 `src/` 底下所有的 .ts / .tsx。 */
function allSources(dir = path.join(ROOT, 'src')): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap(entry => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return allSources(full);
    return /\.tsx?$/.test(entry.name) ? [path.relative(ROOT, full).replace(/\\/g, '/')] : [];
  });
}

describe('通行證失效只在一個地方處理', () => {
  it('只有 src/utils/api.ts 碰得到 authHeaders()', () => {
    const offenders = allSources()
      .filter(rel => !AUTH_HEADERS_ALLOWLIST.includes(rel))
      .filter(rel => /\bauthHeaders\s*\(/.test(stripComments(read(rel))));

    expect(offenders).toEqual([]);
  });

  it('每一個發身分請求的檔案都是走 authFetch', () => {
    for (const rel of CLIENT_FILES) {
      expect(stripComments(read(rel))).toMatch(/\bauthFetch\s*\(/);
    }
  });

  it('authFetch 本身認 401，而且只在本來就帶了通行證的那一次', () => {
    const api = stripComments(read('src/utils/api.ts'));
    // 401 要有處置。
    expect(api).toMatch(/resp\.status\s*===\s*401/);
    expect(api).toMatch(/onUnauthorized/);
    // 未登入的家長打到需要登入的端點也會拿到 401，那是一個正常的答案 ——
    // 對他跳出「你的登入失效了」只會讓人以為自己被登出過。
    expect(api).toMatch(/hadToken/);
  });

  it('App 有把處置登記進去 —— 沒登記的話 authFetch 是一個空殼', () => {
    const app = stripComments(read('src/App.tsx'));
    expect(app).toMatch(/setUnauthorizedHandler\s*\(\s*handleSessionExpired\s*\)/);
  });

  it('被登出這件事看得到，不是只有頁首那個 9px 的徽章', () => {
    const app = stripComments(read('src/App.tsx'));
    // `syncError` 畫成「⚠️ 同步失败」，訊息本體藏在 title 裡 —— 共用 iPad
    // 上沒有滑鼠可以停留，那句話等於不存在。
    expect(app).toMatch(/setSessionNotice\s*\(/);
    expect(app).toMatch(/id="session-expired-notice"/);
  });
});
