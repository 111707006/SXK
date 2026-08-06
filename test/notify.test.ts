import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { notifyExpertBooking, type BookingNotification } from '../src/notify';

/**
 * 預約通知的去向（#11）。
 *
 * 這裡驗的是一件事：**通知有沒有送到正確的那一家公司。**
 * 送錯地方比送不到更糟 —— 送不到會有人抱怨，送錯是把一位家長的姓名、手機與
 * 孩子的篩查摘要，貼進另一家機構的群組裡。
 */

const posts: Array<{ url: string; body: any }> = [];

vi.mock('axios', () => ({
  default: {
    post: async (url: string, body: any) => {
      posts.push({ url, body });
      return { status: 200, data: { errcode: 0 } };
    },
  },
}));

const GLOBAL_HOOK = 'https://qyapi.weixin.qq.com/hook?key=global';
const COMPANY_HOOK = 'https://qyapi.weixin.qq.com/hook?key=jia';

function booking(overrides: Partial<BookingNotification> = {}): BookingNotification {
  return {
    bookingId: 1,
    specialistName: '王医师',
    parentName: '张妈妈',
    parentPhone: '13800138000',
    childAgeMonth: 36,
    childGender: 'boy',
    preferredSlot: '周四上午',
    reportSummary: '语言沟通（临界 5/8）',
    ...overrides,
  };
}

let warn: ReturnType<typeof vi.spyOn>;
let error: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  posts.length = 0;
  process.env.WECOM_WEBHOOK_URL = '';
  warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
  error = vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'log').mockImplementation(() => {});
});

afterEach(() => {
  vi.restoreAllMocks();
});

describe('預約通知依家長的歸屬送出', () => {
  it('該公司設定了自己的位置，就送到那裡', async () => {
    process.env.WECOM_WEBHOOK_URL = GLOBAL_HOOK;
    await notifyExpertBooking(booking({ companyName: '甲机构', companyWebhookUrl: COMPANY_HOOK }));

    expect(posts.map(p => p.url)).toEqual([COMPANY_HOOK]);
    // 全域位置一次都不該被碰到。
    expect(posts.some(p => p.url === GLOBAL_HOOK)).toBe(false);
  });

  it('訊息抬頭寫得出是哪一家公司', async () => {
    await notifyExpertBooking(booking({ companyName: '甲机构', companyWebhookUrl: COMPANY_HOOK }));
    expect(posts[0].body.text.content).toContain('甲机构');
  });

  it('該公司未設定時退回全域位置，並在日誌明確記錄這件事', async () => {
    process.env.WECOM_WEBHOOK_URL = GLOBAL_HOOK;
    await notifyExpertBooking(booking({ companyName: '甲机构', companyWebhookUrl: null }));

    expect(posts.map(p => p.url)).toEqual([GLOBAL_HOOK]);
    // 安靜的退路會讓「A 公司的預約全部送到森心康的群」看起來與正常運作一模一樣。
    expect(warn.mock.calls.flat().join(' ')).toContain('退回全域');
  });

  it('兩者都沒有時，失敗必須在日誌大聲喊，不得靜默', async () => {
    const results = await notifyExpertBooking(booking({ companyName: '甲机构', companyWebhookUrl: null }));

    expect(posts).toEqual([]);
    expect(results.every(r => !r.ok)).toBe(true);
    const shouted = error.mock.calls.flat().join(' ');
    expect(shouted).toContain('reached NOBODY');
    // 沒有公司名，運維只知道「有一則通知掉了」，不知道該打給誰。
    expect(shouted).toContain('甲机构');
  });

  it('未歸屬的家長走全域位置，日誌標明「未归属」', async () => {
    const results = await notifyExpertBooking(booking({ companyName: null, companyWebhookUrl: null }));
    expect(results.every(r => !r.ok)).toBe(true);
    expect(error.mock.calls.flat().join(' ')).toContain('未归属');
  });
});
