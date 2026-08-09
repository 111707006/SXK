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
import type { ParentDetail } from './adminStore';
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

export function renderParentExportHtml(parent: ParentDetail): string {
  const latestReport = parent.reportHistory
    .filter(r => r.aiReport)
    .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))[0];
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
      ? `<table><thead><tr><th>维度</th><th>层级</th><th>得分</th><th>判定</th></tr></thead><tbody>${scoreRows}</tbody></table>`
      : '<p>尚未完成筛查。</p>'
  }

  <h2>专家预约</h2>
  ${bookingBlocks || '<p>尚未送出预约。</p>'}

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

  <p class="hint">这一页可直接用浏览器「列印 → 另存为 PDF」交给专家。</p>
</body>
</html>`;
}
