import { describe, it, expect } from 'vitest';
import {
  DEFAULT_SERVICE_TYPE,
  SERVICE_TYPES,
  describeServiceType,
  isOfflineService,
  readServiceType,
  serviceTypeLabel,
  type ServiceType,
} from '../src/utils/serviceTypes';

/**
 * 四種諮詢的純函式測試（issue #21）。
 *
 * 這個模組決定的是「客服接到的是哪一種服務」。錯掉的樣子分兩種，都很貴：
 *
 * 1. **認不得的值被當成預設值。** 家長按的是「線下干預訓練」，送出去的字串
 *    因為拼錯而落回「線上諮詢說明」，客服在線上等，家長在機構門口等。
 * 2. **缺省的值被當成錯誤。** 既有的家長端不送這個欄位，一律 400 的話，
 *    整個既有的預約流程當場停擺（本 issue 的驗收條件之一是它行為不變）。
 *
 * 兩者恰好要求相反的處置，所以「缺省」與「認不得」在這裡是**兩件事**。
 */

describe('四種服務類型', () => {
  it('恰好四種，順序固定', () => {
    expect(SERVICE_TYPES).toEqual([
      'online_consult',
      'online_training',
      'offline_training',
      'offline_consult',
    ]);
  });

  // 既有的線上諮詢說明是預設值 —— 那是這個功能之前唯一存在的那一種。
  it('預設是既有的線上諮詢說明', () => {
    expect(DEFAULT_SERVICE_TYPE).toBe('online_consult');
    expect(SERVICE_TYPES).toContain(DEFAULT_SERVICE_TYPE);
  });

  it('每一種都有可顯示的中文名稱，而且互不相同', () => {
    const labels = SERVICE_TYPES.map(serviceTypeLabel);
    expect(labels.every(l => l.length > 0)).toBe(true);
    expect(new Set(labels).size).toBe(SERVICE_TYPES.length);
  });

  /**
   * 線上／線下是**衍生的事實**，不是第五個欄位。
   *
   * 通知要靠它決定該不該補上「地點由客服安排」那一行，而畫面要靠它把四種
   * 排成兩排。散在兩處各判斷一次的話，新增第五種服務時會有一處被漏掉。
   */
  it('線上兩種、線下兩種', () => {
    const online = SERVICE_TYPES.filter(t => describeServiceType(t).venue === 'online');
    const offline = SERVICE_TYPES.filter(t => describeServiceType(t).venue === 'offline');
    expect(online).toEqual(['online_consult', 'online_training']);
    expect(offline).toEqual(['offline_training', 'offline_consult']);
  });

  it('諮詢兩種、干預訓練兩種', () => {
    const consult = SERVICE_TYPES.filter(t => describeServiceType(t).topic === 'consult');
    const training = SERVICE_TYPES.filter(t => describeServiceType(t).topic === 'training');
    expect(consult).toEqual(['online_consult', 'offline_consult']);
    expect(training).toEqual(['online_training', 'offline_training']);
  });

  // 少一種說明就會在畫面上留下一張沒有副標的卡片，而那看起來像壞掉。
  it('每一種都說得出它是什麼', () => {
    for (const type of SERVICE_TYPES) {
      const d = describeServiceType(type);
      expect(d.label.length, type).toBeGreaterThan(0);
      expect(d.description.length, type).toBeGreaterThan(0);
    }
  });
});

describe('讀取請求裡的服務類型', () => {
  it('四種都收得下', () => {
    for (const type of SERVICE_TYPES) {
      expect(readServiceType(type), type).toBe(type);
    }
  });

  /**
   * 缺省 = 既有行為。
   *
   * 既有的家長端（以及任何還沒更新的建置）根本不送這個欄位。這裡若回 null，
   * 呼叫端會答 400，而那條路正是專案 B 唯一的轉換點。
   */
  it.each([
    ['沒有這個欄位', undefined],
    ['明確的 null', null],
    ['空字串', ''],
  ])('%s 一律當作預設的線上諮詢說明', (_label, raw) => {
    expect(readServiceType(raw)).toBe(DEFAULT_SERVICE_TYPE);
  });

  /**
   * 認不得 ≠ 缺省。
   *
   * 悄悄落回預設值的話，一個拼錯的類型會變成一筆「線上諮詢說明」的預約，
   * 而家長以為自己約的是線下訓練 —— 沒有任何一個畫面看得出這個落差。
   */
  it.each([
    ['拼錯', 'offline_trainning'],
    ['大小寫不同', 'OFFLINE_TRAINING'],
    ['前後有空白', ' online_consult '],
    ['中文名稱', '线下干预训练'],
    ['別的字串', 'whatever'],
  ])('%s 一律回 null，不猜一種出來', (_label, raw) => {
    expect(readServiceType(raw)).toBeNull();
  });

  it('非字串一律回 null', () => {
    for (const raw of [42, {}, [], true, () => {}]) {
      expect(readServiceType(raw)).toBeNull();
    }
  });
});

describe('要不要多說一句「地點由客服安排」', () => {
  it('線下兩種要，線上兩種不要', () => {
    expect(isOfflineService('offline_training')).toBe(true);
    expect(isOfflineService('offline_consult')).toBe(true);
    expect(isOfflineService('online_consult')).toBe(false);
    expect(isOfflineService('online_training')).toBe(false);
  });

  /**
   * 認不得一律回 false，方向是刻意的：把一筆線上預約標成線下，客服會去安排
   * 一個沒有人要去的場地；反過來只是少一行提示，而那筆預約的類型欄位本來
   * 就已經顯示成「未记录服务类型」了。
   */
  it.each([
    ['遷移前的舊列（空字串）', ''],
    ['null', null],
    ['undefined', undefined],
    ['認不得的字串', 'offline_whatever'],
    ['中文名稱', '线下咨询'],
  ])('%s 一律回 false', (_label, raw) => {
    expect(isOfflineService(raw)).toBe(false);
  });
});

describe('標籤', () => {
  it('四種的說法逐字固定 —— 客服照著這幾個字分辨要怎麼接', () => {
    const expected: Record<ServiceType, string> = {
      online_consult: '线上咨询说明',
      online_training: '线上干预训练指导',
      offline_training: '线下干预训练',
      offline_consult: '线下咨询',
    };
    for (const type of SERVICE_TYPES) {
      expect(serviceTypeLabel(type), type).toBe(expected[type]);
    }
  });

  // 資料庫裡的舊列在遷移前可能讀出空值或別的東西，畫面仍然要有話可說。
  it('認不得的值有替代說法，不顯示空白', () => {
    expect(serviceTypeLabel('nonsense' as ServiceType).length).toBeGreaterThan(0);
  });
});
