import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { ACTIVITY_SEED } from '../src/t2/activitySeed';
import type { Activity } from '../src/t2/types';
import {
  activityIdFromFileName,
  filterForTagging,
  monthOptions,
  monthText,
  nextActivityId,
  planUploads,
  suggestedTargetMonth,
  taggingProgress,
  taggingState,
} from '../src/admin/videoTagging';
import { visibleTabs } from '../src/admin/adminView';

/** 後台「示范片与标签」分頁（2026-10-08）的純函式。 */

const act = (over: Partial<Activity>): Activity => ({ ...ACTIVITY_SEED[0], ...over });
const file = (name: string) => ({ name }) as File;

describe('檔名認編號', () => {
  it.each([
    ['A001.mp4', 'A001'],
    ['a1.mp4', 'A001'],
    ['A017-我们来爬行.mp4', 'A017'],
    ['001 我们来爬行.mp4', 'A001'],
    ['42.mp4', 'A042'],
    ['示范 A300.mp4', 'A300'],
  ])('%s → %s', (name, id) => {
    expect(activityIdFromFileName(name)).toBe(id);
  });

  it.each(['我们来爬行.mp4', 'A301.mp4', 'A000.mp4', 'IMG_2026.mp4', 'A1234.mp4'])('%s 認不出', name => {
    expect(activityIdFromFileName(name)).toBeNull();
  });
});

describe('月齡', () => {
  it('說法', () => {
    expect(monthText(0)).toBe('0 个月');
    expect(monthText(18)).toBe('1 岁 6 个月');
    expect(monthText(24)).toBe('2 岁');
  });

  it('下拉 0–216 個月，每個都附幾歲幾個月', () => {
    const opts = monthOptions();
    expect(opts).toHaveLength(217);
    expect(opts[30].label).toBe('30 个月（2 岁 6 个月）');
  });

  it('建議值取手冊適齡區間的中間，不超過 216', () => {
    expect(suggestedTargetMonth({ min: 18, max: 24 })).toBe(21);
    expect(suggestedTargetMonth({ min: 72, max: 999 })).toBe(144);
  });

  it('300 支的建議值都落在 0–216', () => {
    for (const a of ACTIVITY_SEED) {
      const s = suggestedTargetMonth(a.ageMonths);
      expect(s >= 0 && s <= 216, a.id).toBe(true);
    }
  });
});

describe('標到哪裡', () => {
  it('沒片 → 还没有片；有片缺月齡或缺练什么 → 还没标好；都有 → 已标好', () => {
    expect(taggingState(act({ videoUrl: null, targetMonth: 20, targets: ['mot_balance' as any] }))).toBe('no_video');
    expect(taggingState(act({ videoUrl: '/media/activities/A001.mp4', targetMonth: null, targets: ['mot_balance' as any] }))).toBe('untagged');
    expect(taggingState(act({ videoUrl: '/media/activities/A001.mp4', targetMonth: 20, targets: [] }))).toBe('untagged');
    expect(taggingState(act({ videoUrl: '/media/activities/A001.mp4', targetMonth: 20, targets: ['mot_balance' as any] }))).toBe('done');
  });

  it('進度、篩選、搜尋、下一支', () => {
    const list = [
      act({ id: 'A002', title: '钻山洞', videoUrl: '/m', targetMonth: null, targets: [] }),
      act({ id: 'A001', title: '我们来爬行', videoUrl: '/m', targetMonth: 20, targets: ['mot_balance' as any] }),
      act({ id: 'A003', title: '叫名字', videoUrl: null }),
    ];
    expect(taggingProgress(list)).toEqual({ total: 3, withVideo: 2, done: 1 });
    expect(filterForTagging(list, 'all', '').map(a => a.id)).toEqual(['A001', 'A002', 'A003']);
    expect(filterForTagging(list, 'untagged', '').map(a => a.id)).toEqual(['A002']);
    expect(filterForTagging(list, 'all', '山洞').map(a => a.id)).toEqual(['A002']);
    expect(filterForTagging(list, 'all', 'a003').map(a => a.id)).toEqual(['A003']);
    expect(nextActivityId(list, 'A002')).toBe('A001');
    expect(nextActivityId(list, 'A003')).toBeNull();
  });
});

describe('一批上傳的清單', () => {
  it('認不出、不是 mp4、活動庫沒有、同批重複 → 不上傳並說明', () => {
    const items = planUploads(
      [file('A001.mp4'), file('A001 again.mp4'), file('cat.mp4'), file('A002.mov'), file('A299.mp4')],
      new Set(['A001', 'A002']),
    );
    expect(items.map(i => [i.activityId, i.status])).toEqual([
      ['A001', 'waiting'],
      ['A001', 'skipped'],
      [null, 'skipped'],
      ['A002', 'skipped'],
      ['A299', 'skipped'],
    ]);
    expect(items.every(i => i.status === 'waiting' || i.message)).toBe(true);
  });
});

describe('分頁：只在專案 A、只有全域管理員', () => {
  const god = { role: 'global_admin' as const, email: 'g', companyId: null, selection: null };
  const member = { role: 'company_member' as const, email: 'm', companyId: 1, selection: null };
  it('A 的全域管理員看得到，B 看不到，公司成員看不到', () => {
    expect(visibleTabs(god, { multiCompany: false }).map(t => t.id)).toContain('videos');
    expect(visibleTabs(god, { multiCompany: true }).map(t => t.id)).not.toContain('videos');
    expect(visibleTabs(member, { multiCompany: false }).map(t => t.id)).not.toContain('videos');
  });

  it('畫面不給人看英文標籤碼（只顯示中文短名）', () => {
    const src = fs.readFileSync(path.resolve(__dirname, '../src/admin/panels/VideoTaggingPanel.tsx'), 'utf8');
    expect(src).toContain('FINDING_TAG_LABELS[tag]');
    expect(src).not.toMatch(/\{tag\}\s*</);
  });
});
