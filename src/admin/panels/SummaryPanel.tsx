/**
 * 跨公司彙總（issue #13）—— 只有全域管理員看得到。
 *
 * 這是整個後台唯一合法跨越公司邊界的畫面，因此它**只有數字**：
 * 沒有姓名、沒有電話、沒有任何一位家長點得進去。後端的 `summaryByCompany`
 * 刻意不接受公司條件，讓它與「帶條件的家長查詢」在型別上就是兩種東西。
 *
 * 「未歸屬」單獨一列。省略他們會讓各公司加總 ≠ 全部家長，而對不起來的數字
 * 最後總是被當成資料遺失。
 */
import { useCallback } from 'react';
import { adminApi } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import { EmptyState, ErrorNote, Panel, Spinner, useAsyncData } from '../ui';

export default function SummaryPanel({ onError }: { onError: (view: AdminErrorView) => void }) {
  const load = useCallback(() => adminApi.summary(), []);
  const { data, loading, failure, reload } = useAsyncData(load, [], onError);
  const rows = data?.summary ?? [];

  const total = rows.reduce(
    (acc, r) => ({
      parentCount: acc.parentCount + r.parentCount,
      screenedCount: acc.screenedCount + r.screenedCount,
      bookingCount: acc.bookingCount + r.bookingCount,
    }),
    { parentCount: 0, screenedCount: 0, bookingCount: 0 }
  );

  const rate = (done: number, all: number) => (all === 0 ? '—' : `${Math.round((done / all) * 100)}%`);

  return (
    <Panel
      title="跨公司汇总"
      description="用于对帐与评估合作成效。这一页只有数字，没有任何一位家长的可识别资料，也点不进去。"
    >
      {loading ? (
        <Spinner />
      ) : failure ? (
        <ErrorNote message={failure} onRetry={reload} />
      ) : rows.length === 0 ? (
        <EmptyState title="还没有资料" />
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[520px] text-left text-xs">
            <thead>
              <tr className="border-b border-brand-stone text-[10px] uppercase tracking-wide text-brand-charcoal/45">
                <th className="py-2 pr-3 font-bold">合作公司</th>
                <th className="py-2 pr-3 text-right font-bold">家长数</th>
                <th className="py-2 pr-3 text-right font-bold">已筛查</th>
                <th className="py-2 pr-3 text-right font-bold">完成率</th>
                <th className="py-2 text-right font-bold">预约数</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr
                  key={r.companyId === null ? 'unassigned' : r.companyId}
                  className="border-b border-brand-stone/60 last:border-0"
                >
                  <td className="py-2.5 pr-3">
                    <span className={r.companyId === null ? 'text-brand-charcoal/55' : 'font-bold text-brand-forest'}>
                      {r.companyName}
                    </span>
                  </td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-brand-charcoal/80">{r.parentCount}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-brand-charcoal/80">{r.screenedCount}</td>
                  <td className="py-2.5 pr-3 text-right tabular-nums text-brand-charcoal/60">
                    {rate(r.screenedCount, r.parentCount)}
                  </td>
                  <td className="py-2.5 text-right tabular-nums text-brand-charcoal/80">{r.bookingCount}</td>
                </tr>
              ))}
              <tr className="border-t-2 border-brand-stone">
                <td className="py-2.5 pr-3 font-bold text-brand-forest">合计</td>
                <td className="py-2.5 pr-3 text-right font-bold tabular-nums text-brand-forest">
                  {total.parentCount}
                </td>
                <td className="py-2.5 pr-3 text-right font-bold tabular-nums text-brand-forest">
                  {total.screenedCount}
                </td>
                <td className="py-2.5 pr-3 text-right tabular-nums text-brand-charcoal/60">
                  {rate(total.screenedCount, total.parentCount)}
                </td>
                <td className="py-2.5 text-right font-bold tabular-nums text-brand-forest">
                  {total.bookingCount}
                </td>
              </tr>
            </tbody>
          </table>
          <p className="mt-3 text-[10px] leading-relaxed text-brand-charcoal/40">
            「未归属」是没有从任何合作公司连结进站的家长。他们只有全域管理员看得到——
            少了这一列，各公司加总就对不上全部家长数。
          </p>
        </div>
      )}
    </Panel>
  );
}
