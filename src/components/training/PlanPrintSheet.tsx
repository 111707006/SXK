import { createPortal } from 'react-dom';
import { SITE_DIMENSION_NAME } from '../../t2/dimensionMap';
import { PRINT_SHEET, PUSH_PAGE, VARIANT_LABEL, guidanceLines } from '../../t2/pushCopy';
import { WEEKDAYS } from '../../t2/trainingCopy';
import { addCalendarDays } from '../../t2/weeks';
import type { PeriodSheet } from '../../t2/trainingPeriodService';

/** 「10/12」：週卡上的日期只要月日。 */
function md(iso: string): string {
  const [, m, d] = iso.split('-');
  return `${Number(m)}/${Number(d)}`;
}

/**
 * 整期 12 週的列印頁（客戶推送說明第九節）：螢幕上看不到（`#plan-print-sheet` 平常 `display:none`），
 * 列印時 `body.sxk-printing-plan` 只留它（`index.css`）。開頭是怎麼帶、期末怎麼調；之後一週一頁（`break-after: page`），
 * 每支寫練什么、要准备、怎么玩、这个月的做法、小提醒，底下一到日七格打卡與觀察記錄的空白。
 */
export default function PlanPrintSheet({ sheet }: { sheet: PeriodSheet }) {
  return createPortal(
    <div id="plan-print-sheet" className="text-brand-charcoal text-[12px] leading-relaxed">
      <section style={{ breakAfter: 'page' }}>
        <h1 className="text-[20px] font-bold text-brand-forest">{PRINT_SHEET.title(sheet.periodNo)}</h1>
        <p className="mt-1">
          {md(sheet.firstWeekStart)} – {md(addCalendarDays(sheet.firstWeekStart, 12 * 7 - 1))}
        </p>
        <h2 className="mt-4 text-[15px] font-bold text-brand-forest">{PUSH_PAGE.guidanceTitle}</h2>
        <ul className="mt-1 list-disc pl-5">
          {guidanceLines(sheet.perWeek).map(l => <li key={l}>{l}</li>)}
        </ul>
        <h2 className="mt-4 text-[15px] font-bold text-brand-forest">{PUSH_PAGE.periodEndTitle}</h2>
        <ul className="mt-1 list-disc pl-5">
          {PUSH_PAGE.periodEndRows.map(r => <li key={r.when}><b>{r.when}：</b>{r.then}</li>)}
        </ul>
        <p className="mt-2">{PUSH_PAGE.periodEndNote}</p>
        <p className="mt-3 text-[11px] opacity-70">{PUSH_PAGE.boundary}</p>
      </section>
      {sheet.weeks.map(w => (
        <section key={w.week} style={{ breakAfter: 'page' }} data-week={w.week}>
          <h2 className="text-[16px] font-bold text-brand-forest">
            {PRINT_SHEET.weekTitle(w.week, md(w.weekStart), md(addCalendarDays(w.weekStart, 6)))}
            <span className="ml-2 text-[12px] font-normal">{VARIANT_LABEL[w.variant]}</span>
          </h2>
          {w.activities.map(({ activity: a, dimension }) => {
            const variantText = w.variant === 'easy' ? a.easier : w.variant === 'hard' ? a.harder : '';
            return (
              <article key={a.id} className="mt-3 border border-brand-stone rounded-lg p-3" style={{ breakInside: 'avoid' }}>
                <h3 className="text-[14px] font-bold">
                  {a.title}
                  <span className="ml-2 text-[11px] font-normal opacity-70">{SITE_DIMENSION_NAME[dimension]} · {a.id}</span>
                </h3>
                {a.trains && <p><b>{PRINT_SHEET.trains}：</b>{a.trains}</p>}
                {a.need && <p><b>{PRINT_SHEET.need}：</b>{a.need}</p>}
                {a.steps.length > 0 && (
                  <div>
                    <b>{PRINT_SHEET.steps}：</b>
                    <ol className="list-decimal pl-5">{a.steps.map((s, i) => <li key={i}>{s.instruction}</li>)}</ol>
                  </div>
                )}
                <p><b>{PRINT_SHEET.variant}（{VARIANT_LABEL[w.variant]}）：</b>{variantText || PRINT_SHEET.standardVariant}</p>
                {a.tip && <p><b>{PRINT_SHEET.tip}：</b>{a.tip}</p>}
                <div className="mt-2 flex items-center gap-3">
                  <b>{PRINT_SHEET.checkin}</b>
                  {WEEKDAYS.map(d => (
                    <span key={d} className="inline-flex items-center gap-1">{d}<span className="inline-block w-4 h-4 border border-brand-charcoal/60" /></span>
                  ))}
                </div>
                <p className="mt-1"><b>{PRINT_SHEET.note}：</b>________________________________</p>
              </article>
            );
          })}
        </section>
      ))}
    </div>,
    document.body,
  );
}
