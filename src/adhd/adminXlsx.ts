/**
 * 成人 ADHD 後台導出的 `.xlsx`（設計第 5 節）：一筆評估一行，欄位 `EXPORT_HEADER`。
 * ⚠️ 只給伺服器載（exceljs 不進前端 bundle）。
 */
import ExcelJS from 'exceljs';
import { shanghaiDate } from '../admin/summaryXlsx';
import { EXPORT_HEADER, exportCellsOf, type AdhdAdminListItem } from './adminRows';

/** `成人ADHD评估-YYYYMMDD.xlsx`，日期是中國時間的今天。 */
export function adhdExportFileName(now: Date): string {
  return `成人ADHD评估-${shanghaiDate(now).replace(/-/g, '')}.xlsx`;
}

export async function adhdWorkbook(rows: Array<AdhdAdminListItem & { payload: unknown }>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('成人ADHD评估');
  sheet.addRow([...EXPORT_HEADER]).font = { bold: true };
  for (const r of rows) {
    // 分數格寫成文字（`2/3` 不會被 Excel 當成日期）；整數照數字。
    sheet.addRow([
      r.subjectName,
      r.phone ?? '',
      r.companyName ?? '',
      r.createdAt ? shanghaiDate(r.createdAt) : '',
      ...exportCellsOf(r.payload).map(v => (v === null ? '' : v)),
    ]);
  }
  sheet.columns.forEach(c => {
    c.width = 14;
  });
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  return Buffer.from(await wb.xlsx.writeBuffer());
}
