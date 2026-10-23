/**
 * 兌換碼的獨立限流（#110，規格三「暫採」：每位家長每小時 10 次、每個來源每小時 30 次）：擋暴力試碼。
 * 記在程序記憶體裡（重啟歸零；只有一台主機）。成功與失敗都算一次 —— 試碼的人不會先知道哪一次會成功。
 */
export const REDEEM_PER_USER_PER_HOUR = 10;
export const REDEEM_PER_SOURCE_PER_HOUR = 30;
const WINDOW_MS = 60 * 60 * 1000;

export function createRedeemLimiter(now: () => number = Date.now) {
  const hits = new Map<string, number[]>();
  const recent = (key: string) => {
    const cutoff = now() - WINDOW_MS;
    const list = (hits.get(key) ?? []).filter(t => t > cutoff);
    hits.set(key, list);
    return list;
  };
  return {
    /** 還能不能試；能的話記一次。 */
    take(userKey: string, sourceKey: string): boolean {
      const u = recent(`u:${userKey}`);
      const s = recent(`s:${sourceKey}`);
      if (u.length >= REDEEM_PER_USER_PER_HOUR || s.length >= REDEEM_PER_SOURCE_PER_HOUR) return false;
      u.push(now());
      s.push(now());
      return true;
    },
  };
}
