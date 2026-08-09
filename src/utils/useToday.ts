import { useEffect, useState } from 'react';

/**
 * 「今天」，而且它會自己往前走。
 *
 * 只在寫入的那一刻算一次年齡是不夠的：篩查用的平板常常整天開著同一個分頁，
 * 跨過午夜之後畫面上的實足月齡還停在昨天，而它決定了接下來出哪一段的題目。
 * 把「今天」做成會變的值，所有由它推導出來的東西就會自己跟上。
 *
 * 回傳的是**當天零時**，而且同一天內回同一個物件 —— 下游的 `useMemo` 才不會
 * 每分鐘白重算一次。
 */

/** 檢查頻率。只要比「一天」細得多就夠了，這裡不需要精準到秒。 */
const TICK_MS = 60_000;

function startOfToday(): Date {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate());
}

export function useToday(): Date {
  const [today, setToday] = useState(startOfToday);

  useEffect(() => {
    const tick = () => {
      setToday(prev => {
        const next = startOfToday();
        return next.getTime() === prev.getTime() ? prev : next;
      });
    };

    // 分頁被切到背景時瀏覽器會把計時器降速甚至凍結，所以切回來要再確認一次。
    const timer = setInterval(tick, TICK_MS);
    document.addEventListener('visibilitychange', tick);

    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);

  return today;
}
