import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { isTrainingPath, resolveTrainingPriceFen } from '../src/t2/trainingGate';

/**
 * 「线上干预」自己的收費站（`src/t2/trainingGate.ts`，使用者 2026-09-29：從報告轉到線上干預再收一次，
 * 現在 0 元、直接通過）。
 *
 * 最要緊的一件事：分流只能把**線上干預**的端點從 T2 閘門拿出來 —— T2 自己的端點（報告、交卷）認錯成線上干預，
 * 就是沒付錢也拿得到深度評估。所以這裡把 `/api/t2` 底下每一支路由都點名歸類，新加一支沒歸類就紅。
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/** 線上干預（走自己的收費站）。 */
const TRAINING_ROUTES = [
  '/api/t2/weekly-plan',
  '/api/t2/training-period',
  '/api/t2/library',
  '/api/t2/activities/:id',
  '/api/t2/checkins',
  '/api/t2/checkins/:id',
  '/api/t2/practice-prefs',
  '/api/t2/practice-prefs.ics',
  '/api/t2/practice-prefs/ics-link',
];
/** T2 本身（付費前開放的 `/plan` 在 T2_OPEN_PATHS，其餘要買 T2；`/diagnosis` 2026-09-29 拿掉了）。 */
const T2_ROUTES = ['/api/t2/plan', '/api/t2/tool-results', '/api/t2/findings', '/api/t2/findings/latest'];

const rel = (route: string) => route.replace(/^\/api\/t2/, '').replace(':id', '123');

describe('分流', () => {
  it('/api/t2 底下每一支路由都歸了類（新加的沒歸類就紅）', () => {
    const sources = ['server.ts', 'src/t2/practiceRoutes.ts', 'src/t2/libraryRoutes.ts'].map(read).join('\n');
    const found = new Set([...sources.matchAll(/\.(?:get|post|put|patch|delete)\(\s*'(\/api\/t2\/[^']*)'/g)].map(m => m[1]));
    expect([...found].sort()).toEqual([...TRAINING_ROUTES, ...T2_ROUTES].sort());
  });

  it.each(TRAINING_ROUTES)('%s 是線上干預（含 Express 也認的大小寫與結尾斜線）', route => {
    expect(isTrainingPath(rel(route))).toBe(true);
    expect(isTrainingPath(rel(route).toUpperCase())).toBe(true);
    expect(isTrainingPath(`${rel(route)}/`)).toBe(true);
  });

  it.each(T2_ROUTES)('%s 不是（照舊要買 T2）', route => {
    expect(isTrainingPath(rel(route))).toBe(false);
    expect(isTrainingPath(`${rel(route).toUpperCase()}/`)).toBe(false);
  });

  it('只看第一段整段相等：前綴相像的不算', () => {
    for (const p of ['/weekly-planx', '/library2', '/findings-weekly-plan', '/', '']) expect(isTrainingPath(p)).toBe(false);
  });
});

describe('價錢', () => {
  it('沒設、空字串、0 → 0（免費、直接通過）', () => {
    for (const raw of [undefined, '', ' ', '0']) expect(resolveTrainingPriceFen(raw)).toBe(0);
  });

  it('其他值現在一律讓程序起不來：收費的訂單與權益還沒做', () => {
    for (const raw of ['990', '1', 'abc', '-1']) expect(() => resolveTrainingPriceFen(raw)).toThrow(/TRAINING_PRICE_FEN/);
  });
});

describe('server.ts 怎麼接', () => {
  const server = read('server.ts');

  it('/api/t2 閘門：線上干預走自己的收費站，其餘照舊走 T2', () => {
    expect(server).toContain(
      'const denial = isTrainingPath(req.path) ? await denyIfTrainingLocked(userId) : await denyIfT2Locked(req, userId);',
    );
    expect(server).toContain('const TRAINING_PRICE_FEN = resolveTrainingPriceFen(process.env.TRAINING_PRICE_FEN);');
  });

  it('線上干預的閘門不看 T2 權益，但要登入', () => {
    const fn = server.slice(server.indexOf('async function denyIfTrainingLocked'), server.indexOf('// Mounted on tier2Only rather than paidOnly'));
    expect(fn).not.toContain('hasT2Unlock');
    expect(fn).toContain("code: 'UNAUTHENTICATED'");
  });
});
