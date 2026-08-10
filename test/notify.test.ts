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
    serviceType: 'online_consult',
    ...overrides,
  };
}

/** 送出一則通知並取回實際貼進企業微信群的那段文字。 */
async function sentText(overrides: Partial<BookingNotification> = {}): Promise<string> {
  process.env.WECOM_WEBHOOK_URL = GLOBAL_HOOK;
  await notifyExpertBooking(booking(overrides));
  return posts[0].body.text.content as string;
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

/**
 * 四種諮詢（issue #21）。
 *
 * 驗收條件寫的是「客服在通知裡看得出是哪一種」。這一組把那句話釘成斷言 ——
 * 四種共用同一張表、同一個通知，所以**這段文字是客服唯一分得出來的地方**。
 * 分不出來的代價是具體的：客服照著線上的流程回電，而家長在機構門口等。
 */
describe('通知帶得出是哪一種服務', () => {
  it.each([
    ['online_consult', '线上咨询说明'],
    ['online_training', '线上干预训练指导'],
    ['offline_training', '线下干预训练'],
    ['offline_consult', '线下咨询'],
  ] as const)('%s 的訊息裡寫著「%s」', async (serviceType, label) => {
    expect(await sentText({ serviceType })).toContain(label);
  });

  /**
   * 類型要在**第一行**。
   *
   * 企業微信的群訊息在通知列與訊息清單裡只看得到開頭那一截，而客服一天要掃
   * 過幾十則 —— 埋在第六行的服務類型等於要求他每一則都點開來看。
   */
  it('服務類型出現在第一行', async () => {
    const firstLine = (await sentText({ serviceType: 'offline_training' })).split('\n')[0];
    expect(firstLine).toContain('线下干预训练');
  });

  /**
   * 線下要說出地點不在系統裡。
   *
   * 這是本 issue 的取捨：據點資訊常變，寫進系統只會多一張要維護的表，改由
   * 客服接手安排。少了這一行，客服會在預約單上找一個從來不存在的地址欄位。
   */
  it.each(['offline_training', 'offline_consult'] as const)(
    '%s 明說地點由客服與家長約定',
    async serviceType => {
      const text = await sentText({ serviceType });
      expect(text).toContain('地点');
      expect(text).toContain('客服');
    }
  );

  // 線上的沒有地點可談，多一行只會變成每則都有的雜訊。
  it.each(['online_consult', 'online_training'] as const)(
    '%s 不加那一行地點說明',
    async serviceType => {
      expect(await sentText({ serviceType })).not.toContain('地点');
    }
  );

  /**
   * 既有的線上諮詢說明行為不變（本 issue 的驗收條件之一）。
   *
   * 這一條是把 issue #11 的那幾條再驗一次：加了服務類型之後，原本每一項
   * 都還在。少了它，「加一行」與「換掉一段」在測試上分不出來。
   */
  it('原本就有的每一項都還在', async () => {
    const text = await sentText({ serviceType: 'online_consult', companyName: '甲机构' });
    for (const fragment of ['甲机构', '张妈妈', '13800138000', '王医师', '周四上午', '语言沟通（临界 5/8）']) {
      expect(text, fragment).toContain(fragment);
    }
  });
});
