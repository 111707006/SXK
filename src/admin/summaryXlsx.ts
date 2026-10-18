/**
 * 家長彙總的 `.xlsx`（#69）：伺服器端產檔，欄位與後台「汇总」檢視同一份 `SummaryTable`。
 *
 * 九維格寫成 `5/8` 的**文字**（不是數字也不是日期 —— Excel 會把手打的 5/8 當成 5 月 8 日），
 * 底色照存下來的判定（紅／黃／綠），與報告同一組判定、不另算。
 *
 * ⚠️ 只給伺服器載（exceljs 不進前端 bundle）。
 */
import ExcelJS from 'exceljs';
import type { AssessmentStatus } from '../types';
import type { SummaryTable } from './parentSummary';

const TIME_ZONE = 'Asia/Shanghai';

/** 紅／黃／綠的底色（ARGB）。淡色，上面的黑字讀得清楚。 */
export const STATUS_FILL: Record<AssessmentStatus, string> = {
  delay: 'FFF4C7C3',
  borderline: 'FFFCE8B2',
  normal: 'FFD9EAD3',
};

/** ISO → 中國時間的 `YYYY-MM-DD`。 */
export function shanghaiDate(iso: string | Date): string {
  const d = iso instanceof Date ? iso : new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: TIME_ZONE, year: 'numeric', month: '2-digit', day: '2-digit' }).format(d);
}

/** `家长汇总-YYYYMMDD.xlsx`，日期是中國時間的今天。 */
export function summaryFileName(now: Date): string {
  return `家长汇总-${shanghaiDate(now).replace(/-/g, '')}.xlsx`;
}

export async function summaryWorkbook(table: SummaryTable): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('家长汇总');

  const header = [
    '孩子名字', '电话', '年龄', '筛查渠道', '筛查日期',
    ...table.dimensions.map(d => d.name),
    '需关注几个方面',
  ];
  sheet.addRow(header).font = { bold: true };
  sheet.views = [{ state: 'frozen', ySplit: 1 }];

  const firstDimCol = 6;
  for (const r of table.rows) {
    const row = sheet.addRow([
      r.childName ?? '',
      r.phone ?? '',
      r.ageLabel ?? '',
      r.channel,
      shanghaiDate(r.screenedAt),
      ...r.cells.map(c => (c ? `${c.score}/${c.maxScore}` : '')),
      r.flaggedCount,
    ]);
    r.cells.forEach((c, i) => {
      if (!c) return;
      row.getCell(firstDimCol + i).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: STATUS_FILL[c.status] } };
    });
    // 電話當文字：數字格會被 Excel 寫成 1.38E+10。
    row.getCell(2).numFmt = '@';
  }

  sheet.columns.forEach((col, i) => {
    col.width = i === 1 ? 14 : i < firstDimCol - 1 ? 12 : i === header.length - 1 ? 14 : 10;
  });

  return Buffer.from(await wb.xlsx.writeBuffer());
}
