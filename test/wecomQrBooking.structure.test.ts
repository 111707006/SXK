import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { WORDING_1022 } from '../src/wording1022';

/**
 * 1022（使用者 2026-10-24）：「预约 1 对 1 专家」改成企業微信二維碼，不選專家、不選時段。
 * 專案沒有 jsdom，接線只能讀原始碼：兩個開預約表的入口（報告頁的 `openBookingModal`、App 的 `goToExpertBooking`）
 * 都要先看 `expertBookingIsQr()`，而它只在 1022 開著時成立 —— 關著時一行不動。
 */

const ROOT = path.resolve(__dirname, '..');
const read = (rel: string) => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const bodyOf = (src: string, head: string) => src.slice(src.indexOf(head), src.indexOf(head) + 400);

describe('預約專家改成企業微信二維碼', () => {
  it('只在 1022 開著、而且有二維碼時才換', () => {
    expect(read('src/components/WecomQr.tsx')).toMatch(/expertBookingIsQr = \(\): boolean => PRODUCT\.features\.ui1022 && Boolean\(PRODUCT\.expertBooking\.wechatQrSrc\)/);
  });

  it('報告頁開預約表之前先看開關，開著就出二維碼', () => {
    const body = bodyOf(read('src/components/AnalysisReport.tsx'), 'const openBookingModal = (');
    expect(body).toMatch(/if \(expertBookingIsQr\(\)\) \{\s*setShowWecomQr\(true\);\s*return;/);
  });

  it('其他頁的「预约专家」原地出二維碼，不帶去報告頁', () => {
    const body = bodyOf(read('src/App.tsx'), 'const goToExpertBooking = (');
    expect(body).toMatch(/if \(expertBookingIsQr\(\)\) \{\s*setShowWecomQr\(true\);\s*return;/);
  });

  it('報告上的預約卡在二維碼模式不畫選專家與時段的按鈕', () => {
    expect(read('src/components/AnalysisReport.tsx')).toMatch(/\{expertBookingIsQr\(\) \? \(\s*\/\*[^*]*\*\/\s*<div[^>]*>[\s\S]*?<WecomQrBlock tone="dark" \/>/);
  });

  it('字不寫預約時間', () => {
    for (const text of Object.values(WORDING_1022.expertQr)) {
      expect(text).not.toMatch(/预约时间|选择时间|时段/);
    }
  });
});
