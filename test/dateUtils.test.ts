import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  calculateAgeMonth,
  getBirthDateFromAgeMonth,
  parseBirthDate,
  refreshChildAge,
} from '../src/utils/dateUtils';
import type { AssessmentRecord, Child } from '../src/types';

/**
 * 實足月齡 —— 由出生日期與**今天**算出的當前月齡（見 CONTEXT.md）。
 *
 * 這裡釘的不是一個顯示欄位。實足月齡決定篩查用哪一個年齡段的題目，
 * 錯到跨段，孩子就會答到別的年齡的題目，整份篩查結果失去意義。
 */
describe('實足月齡照今天算', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('「今天」來自執行期，不是寫死的常數', () => {
    // 客戶影片對過帳的那個孩子：生日 2022-01-14。
    // 舊版把今天寫死成 2026-07-08，於是這個孩子永遠停在 53 個月。
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 9)); // 2026-08-09
    expect(calculateAgeMonth('2022-01-14')).toBe(54);
  });

  it('明天會多一天 —— 過了生日那一天就長一個月', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 13)); // 2026-09-13，還沒到 14 號
    expect(calculateAgeMonth('2022-01-14')).toBe(55);

    vi.setSystemTime(new Date(2026, 8, 14)); // 2026-09-14，生日當天
    expect(calculateAgeMonth('2022-01-14')).toBe(56);
  });

  it('算不出來就回 null，不回一個看起來很正常的數字', () => {
    // 舊版讀不出來一律回 36。36 落在表單「12–180 個月」的合法範圍內，
    // 所以一個壞掉的出生日期會安靜地變成「3 歲」被存起來，畫面上毫無異狀。
    expect(calculateAgeMonth('')).toBeNull();
    expect(calculateAgeMonth('不是日期')).toBeNull();
    expect(calculateAgeMonth('2022-02-30')).toBeNull();
  });

  it('出生日期在未來時回 null —— 那不是 0 歲，那是資料有問題', () => {
    // 裝置時鐘被重設、或年份打錯成 2027，都會走到這裡。
    // 夾成 0 會讓四歲的孩子拿到 12–23 個月的題目。
    expect(calculateAgeMonth('2027-01-14', new Date(2026, 7, 9))).toBeNull();
    // 邊界：今天出生是 0 個月，不是錯誤
    expect(calculateAgeMonth('2026-08-09', new Date(2026, 7, 9))).toBe(0);
  });
});

/**
 * 出生日期是一個**日曆上的日子**，不是一個時間點。
 *
 * `new Date('2022-01-14')` 依 ECMAScript 規格解成 UTC 零時，於是在 UTC 以西
 * 讀回來是 1 月 13 日、在 UTC 以東是 1 月 14 日早上八點。差的那一天足以讓
 * 孩子在生日當天少算一個月 —— 而那正是跨年齡段的邊界。
 */
describe('出生日期以本地時區構造', () => {
  it('解出來就是字串上那一天的本地零時', () => {
    const d = parseBirthDate('2022-01-14');
    expect(d).not.toBeNull();
    expect([d!.getFullYear(), d!.getMonth(), d!.getDate()]).toEqual([2022, 0, 14]);
    expect(d!.getHours()).toBe(0);
  });

  it('讀不出來的值回 null，不回一個 Invalid Date', () => {
    expect(parseBirthDate('')).toBeNull();
    expect(parseBirthDate('不是日期')).toBeNull();
    expect(parseBirthDate('2022-13-01')).toBeNull(); // 沒有 13 月
    expect(parseBirthDate('2022-02-30')).toBeNull(); // 2 月沒有 30 日
  });

  it('只認整串就是一個日期，多一個字都不收', () => {
    // 前綴比對會把截斷或黏在一起的髒值讀成一個看起來很正常的日期，
    // 於是「讀不出來就沿用存下來的月齡」那道保險完全不會啟動。
    expect(parseBirthDate('2022-01-1499')).toBeNull();
    expect(parseBirthDate('2022-01-14garbage')).toBeNull();
    // 帶時間的值也不收：它是一個時間點，取它的 UTC 日期部分在本地會差一天，
    // 正是這個函式存在的理由。目前沒有任何地方寫得出這種值。
    expect(parseBirthDate('2022-01-14T00:00:00.000Z')).toBeNull();
  });
});

describe('由月齡反推出生日期', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('月底不溢位 —— 3 月 31 日往回一個月是 2 月 28 日', () => {
    // `setMonth(月-1)` 會做出「2 月 31 日」，JS 安靜地把它推成 3 月 3 日，
    // 於是反推出來的生日比實際晚了三天，往前推得越多錯得越多。
    expect(getBirthDateFromAgeMonth(1, new Date(2026, 2, 31))).toBe('2026-02-28');
  });

  it('閏日往回一年落在 2 月 28 日', () => {
    expect(getBirthDateFromAgeMonth(12, new Date(2028, 1, 29))).toBe('2027-02-28');
  });

  it('反推出來的生日再算一次，要回到原本那個月齡', () => {
    // 溢位的月份會多出幾天，剛好足以讓月齡少一個月 —— 這條掃過月底邊界。
    const refs = [
      new Date(2026, 0, 31), // 1/31
      new Date(2026, 2, 31), // 3/31
      new Date(2026, 4, 30), // 5/30
      new Date(2028, 1, 29), // 閏日
      new Date(2026, 7, 9),  // 平常的一天
    ];
    const mismatched: string[] = [];
    for (const ref of refs) {
      for (let n = 12; n <= 180; n++) {
        const birth = getBirthDateFromAgeMonth(n, ref);
        const back = calculateAgeMonth(birth, ref);
        if (back !== n) mismatched.push(`${ref.toDateString()} -${n}月 → ${birth} → ${back}`);
      }
    }
    expect(mismatched).toEqual([]);
  });

  it('沒傳參考日期時用執行期的今天', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 7, 9));
    expect(getBirthDateFromAgeMonth(0)).toBe('2026-08-09');
    expect(getBirthDateFromAgeMonth(42)).toBe('2023-02-09');
  });

  it('算不出一個真的日期時回空字串，不回一個畸形的字串', () => {
    // 月齡是從 localStorage / 雲端 JSON 直接拿的，沒有人保證它是正整數。
    // 畸形的字串會被 parseBirthDate 擋下 → 日期欄位變空白 → 年齡讀不出來，
    // 一路傳下去只會讓錯誤更難找。
    const ref = new Date(2026, 7, 9);
    expect(getBirthDateFromAgeMonth(42.5, ref)).toBe('');
    expect(getBirthDateFromAgeMonth(NaN, ref)).toBe('');
    expect(getBirthDateFromAgeMonth(-6, ref)).toBe(''); // 負數會推出一個未來的日期
    expect(getBirthDateFromAgeMonth(24000, ref)).toBe(''); // 年份會掉到 4 位數以下
  });

  it('產出的字串一定讀得回來', () => {
    const ref = new Date(2026, 7, 9);
    for (let n = 0; n <= 180; n++) {
      const s = getBirthDateFromAgeMonth(n, ref);
      expect(parseBirthDate(s), `${n} 個月推出的 ${s} 讀不回來`).not.toBeNull();
    }
  });
});

describe('孩子檔案讀回來時重算實足月齡', () => {
  /** 存進 localStorage / 資料庫的那一刻算出來的月齡，此後就沒再動過。 */
  const stored: Child = { name: '森森', birthDate: '2022-01-14', ageMonth: 53, gender: 'boy' };
  const today = new Date(2026, 7, 9);

  it('有出生日期就重算 —— 存下來的月齡是寫入當下的值，會過期', () => {
    expect(refreshChildAge(stored, today)!.ageMonth).toBe(54);
  });

  it('沒有出生日期就保留原本的月齡，不亂猜一個', () => {
    // 多合作公司上線前建的舊檔案只有月齡。硬推一個生日出來會憑空產生錯誤。
    const legacy: Child = { name: '康康', ageMonth: 54, gender: 'boy' };
    expect(refreshChildAge(legacy, today)).toEqual(legacy);
  });

  it('還沒有孩子檔案時回 null', () => {
    expect(refreshChildAge(null, today)).toBeNull();
  });

  it('出生日期讀不出來時沿用存下來的月齡，不退回預設值', () => {
    // 退回 36 會把孩子從 D 段拉到 B 段去答題，而畫面上什麼異常都看不到。
    const broken: Child = { name: '心心', birthDate: '不是日期', ageMonth: 54, gender: 'girl' };
    expect(refreshChildAge(broken, today)!.ageMonth).toBe(54);
  });

  it('不就地改寫 —— 篩查紀錄裡的測評月齡是事實記錄，永不重算', () => {
    // 紀錄裡的 child 與檔案裡的 child 可能是同一個物件（都從同一份 JSON 解出來）。
    // 只要重算是就地改的，重算「現在的年齡」就會把「當時的年齡」一起改掉，
    // 那份篩查結果從此無法解讀 —— 沒有人會看到它壞掉。
    const record: AssessmentRecord = {
      id: 'rec_1',
      type: 'T1_SCREENING',
      child: stored,
      scores: [],
      createdAt: '2026-07-08T00:00:00.000Z',
    };

    const live = refreshChildAge(record.child, today);

    expect(live!.ageMonth).toBe(54);
    expect(record.child.ageMonth).toBe(53);
    expect(live).not.toBe(record.child);
  });
});
