/**
 * 匯出用的可列印文件。
 *
 * 它**只接受一份已經取好的 `ParentDetail`**，自己不碰資料庫 —— 這是刻意的：
 * 匯出最自然的寫法是「再查一次」，而再查一次就會成為繞過公司範圍的第二條路。
 * 型別上拿不到 pool，這條路就走不出來。
 *
 * 【已知取捨】產出的是可列印的 HTML，由瀏覽器「列印 → 另存為 PDF」。
 * 專案裡沒有 PDF 產生器，而中文 PDF 需要內嵌字型（十幾 MB 的二進位檔進版控），
 * 現有的報告列印也是走 `window.print()` 這條路（`AnalysisReport.tsx`）。
 * 若之後要真的產出 PDF 檔，改的只有這個檔案，取資料那一段不會動。
 */
import type { ParentBooking, ParentDetail } from './adminStore';
import type { AssessmentRecord, DimensionScore } from '../types';
// 判定、性別與時間的說法與詳情畫面共用同一份（`adminView.ts`）。
// issue #8 的驗收條件是「內容與詳情畫面一致」，而兩邊各留一份 statusLabel 的話，
// 只要有人改了其中一邊，同一位孩子在螢幕上與在交給專家的那張紙上就會有兩種判定。
// 那個模組是純函式，不碰 DOM，伺服器端載入它是安全的。
import { formatDateTime as fmtDate, genderLabel, statusLabel } from './adminView';
import { ageBandDrift } from '../utils/ageBandDrift';

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * 這一頁真正用得到的欄位。
 *
 * `ParentDetail` 是它的**超集**，所以後台的匯出路徑照樣把整份詳情傳進來就好。
 * 拆出這個較小的型別是為了讓第二個呼叫端存在：家長掃碼帶走報告的那條路
 * （issue #22）走的不是後台的資料入口，它拿不到 `companyId`、`hasBooking`
 * 這些後台專用的欄位，而要求它捏造幾個用不到的值只會讓「這一頁需要什麼」
 * 這件事變得看不出來。
 */
export interface ReportSubject {
  childName: string | null;
  childAgeMonth: number | null;
  childGender: string | null;
  email: string | null;
  phone: string | null;
  screenedAt: string | null;
  scores: DimensionScore[];
  reportHistory: AssessmentRecord[];
  bookings: ParentBooking[];
  assessedAgeMonth: number | null;
  assessedBandName: string | null;
}

export interface ReportRenderOptions {
  /**
   * 只呈現這一份報告。`undefined` = 最近一份（後台匯出的既有行為）。
   *
   * 家長掃到的 token 對應的是**某一份**報告，不是「這位家長最新的那份」——
   * 否則同一張二維碼會在下次重測之後指向另一份內容，而拿著它的人（可能是
   * 另一位醫師）不會知道自己看的已經換了一份。
   */
  reportId?: string;
  /**
   * 要不要列出專家預約。預設要（後台的匯出交給客服，那是他們接人的依據）。
   *
   * 家長端的永久連結**刻意關掉**：預約區塊裡有聯絡人姓名與手機號，而這條連結
   * 撤不回來。報告本身已經是敏感資料，沒有理由讓它再多帶一組聯絡方式出門。
   */
  includeBookings?: boolean;
  /** 頁尾那一行提示。兩個呼叫端的讀者不同，說的話也不同。 */
  hint?: string;
}

export function renderParentExportHtml(
  parent: ReportSubject,
  options: ReportRenderOptions = {}
): string {
  const includeBookings = options.includeBookings !== false;
  const hint = options.hint ?? '这一页可直接用浏览器「列印 → 另存为 PDF」交给专家。';

  const withAi = parent.reportHistory.filter(r => r.aiReport);
  const latestReport =
    options.reportId === undefined
      ? withAi.sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0]
      : withAi.find(r => r.id === options.reportId);
  const ai = latestReport?.aiReport;

  const scoreRows = parent.scores
    .map(
      s => `<tr>
        <td>${esc(s.dimensionName)}</td>
        <td>${esc(s.tierId)}</td>
        <td>${esc(s.score)} / ${esc(s.maxScore)}</td>
        <td class="s-${esc(s.status)}">${esc(statusLabel(s.status))}</td>
      </tr>`
    )
    .join('');

  const bookingBlocks = parent.bookings
    .map(
      b => `<div class="card">
        <div><strong>指定专家：</strong>${esc(b.specialistName || b.specialistId)}</div>
        <div><strong>联络人：</strong>${esc(b.parentName)}　${esc(b.parentPhone)}</div>
        <div><strong>希望时段：</strong>${esc(b.preferredSlot || '未指定')}</div>
        <div><strong>状态：</strong>${esc(b.status)}　<strong>送出时间：</strong>${esc(fmtDate(b.createdAt))}</div>
        ${b.reportSummary ? `<div><strong>筛查摘要：</strong>${esc(b.reportSummary)}</div>` : ''}
      </div>`
    )
    .join('');

  // 交給專家的那張紙上也要有測評月齡與年齡段，而且說法與詳情畫面相同。
  // 只寫「月龄 54」的話，專家會照 54 個月的常模去讀一份 40 個月時測出來的表。
  const crossBand = ageBandDrift(parent.childAgeMonth, parent.assessedAgeMonth);
  const assessedLine =
    parent.assessedAgeMonth === null
      ? '未记录测评月龄（本栏位之前存下的旧资料）'
      : `${parent.assessedAgeMonth} 个月・${parent.assessedBandName}`;

  const list = (items: string[] | undefined) =>
    items && items.length ? `<ul>${items.map(i => `<li>${esc(i)}</li>`).join('')}</ul>` : '<p>—</p>';

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<!--
  手機上打得開才算數（issue #22）：家長掃碼之後看的是這一頁。少了這一行，
  iOS Safari 會用 980px 的假想寬度排版再整頁縮小，字小到讀不了 ——
  而畫面上看起來「有內容」，只是全部擠成一團。
-->
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>筛查资料 - ${esc(parent.childName || '未填姓名')}</title>
<style>
  body { font-family: "Microsoft YaHei", "PingFang SC", sans-serif; color: #1f2933; margin: 32px; line-height: 1.7; }
  h1 { font-size: 22px; margin: 0 0 4px; }
  h2 { font-size: 16px; margin: 28px 0 10px; border-bottom: 2px solid #d9e2ec; padding-bottom: 4px; }
  .meta { color: #627d98; font-size: 13px; margin-bottom: 20px; }
  table { border-collapse: collapse; width: 100%; font-size: 14px; }
  th, td { border: 1px solid #d9e2ec; padding: 6px 10px; text-align: left; }
  th { background: #f0f4f8; }
  .s-delay { color: #b91c1c; font-weight: 600; }
  .s-borderline { color: #b45309; font-weight: 600; }
  .drift { color: #b45309; }
  .card { border: 1px solid #d9e2ec; border-radius: 6px; padding: 10px 14px; margin-bottom: 10px; font-size: 14px; }
  ul { margin: 4px 0 0 18px; padding: 0; }
  .hint { font-size: 12px; color: #829ab1; margin-top: 32px; }
  @media print { .hint { display: none; } body { margin: 0; } }
  /*
    手機。九維那張表有四欄，在 375px 寬的螢幕上一定要能橫向捲動 ——
    否則不是被裁掉（讀不到判定那一欄），就是把整個 body 撐寬。
  */
  @media (max-width: 600px) {
    body { margin: 16px 12px; font-size: 15px; }
    h1 { font-size: 19px; }
    h2 { font-size: 15px; }
    .scroll-x { overflow-x: auto; -webkit-overflow-scrolling: touch; }
    table { min-width: 420px; }
  }
</style>
</head>
<body>
  <h1>${esc(parent.childName || '未填姓名')}　筛查资料</h1>
  <div class="meta">
    月龄 ${esc(parent.childAgeMonth ?? '—')}　性别 ${esc(genderLabel(parent.childGender))}
    帐号 ${esc(parent.email || parent.phone || '—')}　最近筛查 ${esc(fmtDate(parent.screenedAt))}
  </div>

  <h2>九维筛查结果</h2>
  ${
    scoreRows
      ? `<p class="meta">筛查当时：${esc(assessedLine)}${
          crossBand
            ? `　<strong class="drift">孩子现在已进入「${esc(crossBand.currentBand.name)}」，与下表不同段</strong>`
            : ''
        }</p>`
      : ''
  }
  ${
    scoreRows
      ? `<div class="scroll-x"><table><thead><tr><th>维度</th><th>层级</th><th>得分</th><th>判定</th></tr></thead><tbody>${scoreRows}</tbody></table></div>`
      : '<p>尚未完成筛查。</p>'
  }

  ${includeBookings ? `<h2>专家预约</h2>
  ${bookingBlocks || '<p>尚未送出预约。</p>'}` : ''}

  <h2>AI 发展报告</h2>
  ${
    ai
      ? `<p><strong>总结：</strong>${esc(ai.summary)}</p>
         <p><strong>神经环路分析：</strong>${esc(ai.neuralPathwayAnalysis)}</p>
         <p><strong>康复建议：</strong></p>${list(ai.rehabSuggestions)}
         <p><strong>家庭指导：</strong></p>${list(ai.homeGuidance)}
         <p><strong>预后预判：</strong>${esc(ai.prognosisPrediction)}</p>
         <p class="meta">报告来源：${
           latestReport?.isAiGenerated === true
             ? 'AI 生成'
             : latestReport?.isAiGenerated === false
               ? '本地模板'
               : '未记录'
         }　产生时间：${esc(fmtDate(latestReport?.createdAt ?? null))}</p>`
      : '<p>尚未产生 AI 发展报告。</p>'
  }

  <p class="hint">${esc(hint)}</p>
</body>
</html>`;
}
