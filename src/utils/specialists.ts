/**
 * 報告頁的專家名單來源。
 *
 * 專案 A 用寫死的三位森心康醫師；專案 B 的每一家合作公司自備專家，名單是資料，
 * 執行期向 `/api/specialists` 取得，後端依這位家長的**歸屬**決定回哪一批。
 * 由 `PRODUCT.expertBooking.specialistSource` 決定走哪一條，元件裡不再出現
 * `if (mode === ...)`。
 *
 * **B 不會退回內建名單。** 該公司還沒設定專家時回的是空名單加一個明確的理由 ——
 * 退回內建名單會讓家長看到三位森心康醫師的姓名與照片，那既是別人的品牌，
 * 也是他預約不到的人。
 */
import { useEffect, useState } from 'react';
import { PRODUCT } from '../productConfig';
import { authFetch } from './api';

export interface ReportSpecialist {
  /** 專案 A 是 `spec-1` 這種常數；專案 B 是 specialists 資料表的 id 轉成字串。 */
  id: string;
  name: string;
  title: string | null;
  avatarUrl: string | null;
  specialty: string | null;
  experience: string | null;
  slots: string[];
}

/**
 * 名單為空時的原因。空陣列本身說不出話，而三種空法在畫面上必須長得不一樣。
 */
export type SpecialistsReason =
  /** 有專家可選 */
  | 'ok'
  /** 這位家長沒有歸屬（沒帶識別碼進站，或還沒註冊）——不該看到任何一家公司的專家 */
  | 'unassigned'
  /** 他的公司還沒設定專家 —— 這是那家公司的待辦，不是系統故障 */
  | 'none_configured'
  /** 這個部署沒有資料庫（展示站），或名單讀取失敗 */
  | 'unavailable'
  /** 還在讀 */
  | 'loading';

export interface SpecialistsState {
  specialists: ReportSpecialist[];
  reason: SpecialistsReason;
}

/**
 * @param builtin 專案 A 的內建名單。專案 B 永遠不會用到它。
 */
export function useReportSpecialists(builtin: ReportSpecialist[]): SpecialistsState {
  const usesCompanyList = PRODUCT.expertBooking.specialistSource === 'company';

  const [state, setState] = useState<SpecialistsState>(() =>
    usesCompanyList
      ? { specialists: [], reason: 'loading' }
      : { specialists: builtin, reason: builtin.length ? 'ok' : 'none_configured' }
  );

  useEffect(() => {
    if (!usesCompanyList) return;
    let cancelled = false;

    (async () => {
      try {
        const resp = await authFetch('/api/specialists');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        const data = await resp.json();
        if (cancelled) return;

        const list: ReportSpecialist[] = Array.isArray(data.specialists)
          ? data.specialists.map((s: any) => ({
              id: String(s.id),
              name: s.name,
              title: s.title ?? null,
              avatarUrl: s.avatarUrl ?? null,
              specialty: s.specialty ?? null,
              experience: s.experience ?? null,
              slots: Array.isArray(s.slots) ? s.slots : [],
            }))
          : [];

        const reason: SpecialistsReason =
          data.reason === 'ok' || data.reason === 'unassigned' || data.reason === 'none_configured'
            ? data.reason
            : 'unavailable';
        setState({ specialists: list, reason: list.length ? 'ok' : reason });
      } catch (err) {
        if (cancelled) return;
        // 讀不到就是讀不到。**不可**退回內建名單 —— 那會在最沒有訊號的情況下
        // 把別人的醫師端到家長面前。
        console.warn('[Specialists] 名单读取失败，报告页不显示预约区块', err);
        setState({ specialists: [], reason: 'unavailable' });
      }
    })();

    return () => { cancelled = true; };
  }, [usesCompanyList]);

  return state;
}

/** 名單為空時，報告頁那一塊要說什麼。刻意每種原因都說得不一樣。 */
export function emptySpecialistsMessage(reason: SpecialistsReason): { title: string; body: string } {
  switch (reason) {
    case 'unassigned':
      return {
        title: '本次评估暂无可预约的专家',
        body: '您这次不是透过合作机构的专属链接进入，系统无法判断该由哪一家机构为您安排专家。如需一对一说明，请联系提供本链接给您的机构。',
      };
    case 'none_configured':
      return {
        title: '线上预约尚未开放',
        body: '为您提供本服务的机构尚未设定可预约的专家。如需一对一说明，请直接与该机构联系。',
      };
    case 'loading':
      return { title: '正在读取可预约的专家…', body: '' };
    case 'unavailable':
    default:
      return {
        title: '线上预约暂时无法使用',
        body: '专家名单暂时读取不到。请稍后重新载入页面，或直接与为您提供本服务的机构联系。',
      };
  }
}
