/**
 * 兌換碼對帳匯出（客戶 10/22，#113）的 `.xlsx`：推薦人、類型、碼、月數、狀態、使用家長手機號、使用時間、使用權迄日。
 * ⚠️ 只給伺服器載（exceljs 不進前端 bundle）。
 */
import ExcelJS from 'exceljs';
import { formatCode } from '../redeem/codes';
import type { RedeemLedgerRow } from './adminStore';
import { yuan } from '../revenueSplit/ledger';
import type { RedeemCommission } from '../revenueSplit/redeemCommission';
import { shanghaiDate } from './summaryXlsx';

export const REDEEM_LEDGER_HEADER = ['推荐人', '类型', '兑换码', '方案（月）', '状态', '使用家长手机号', '使用时间', '使用权到期日'];
/** 清分改看服務關係（#122，ADR-0020 第 7 點）時：推薦人後面多「单位」，最後多兩方金額（空白＝沒用過或算不出來）。 */
export const REDEEM_LEDGER_HEADER_COMMISSION = [
  ...REDEEM_LEDGER_HEADER.slice(0, 2), '单位', ...REDEEM_LEDGER_HEADER.slice(2), '单位金额（元）', '推荐人金额（元）',
];

const KIND = { channel: '渠道商', therapist: '治疗师' } as const;
const STATUS = { unused: '未用', used: '已用', void: '已作废' } as const;

/** `commissions`（#122）：與 `rows` 一一對應的兩方金額；沒傳＝關，與 #122 之前一格不差。 */
export function redeemLedgerRows(rows: ReadonlyArray<RedeemLedgerRow>, commissions?: ReadonlyArray<RedeemCommission | null>): string[][] {
  if (commissions) {
    return redeemLedgerRows(rows).map((cells, i) => {
      const c = commissions[i] ?? null;
      return [...cells.slice(0, 2), rows[i].companyName ?? '', ...cells.slice(2), c ? yuan(c.companyFen) : '', c ? yuan(c.referrerFen) : ''];
    });
  }
  return rows.map(r => [
    r.referrerName ?? '',
    // 單位層的碼（#124）沒有推薦人
    r.referrerKind === null ? '单位层' : KIND[r.referrerKind],
    formatCode(r.code),
    String(r.months),
    STATUS[r.status],
    r.usedByPhone ?? '',
    r.usedAt ? shanghaiDate(r.usedAt) : '',
    r.passEndsOn ?? '',
  ]);
}

export function redeemLedgerFileName(now: Date): string {
  return `兑换码对帐-${shanghaiDate(now).replace(/-/g, '')}.xlsx`;
}

export async function redeemLedgerWorkbook(rows: ReadonlyArray<RedeemLedgerRow>, commissions?: ReadonlyArray<RedeemCommission | null>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const sheet = wb.addWorksheet('兑换码对帐');
  sheet.addRow(commissions ? REDEEM_LEDGER_HEADER_COMMISSION : REDEEM_LEDGER_HEADER).font = { bold: true };
  // 全部寫成文字：手機號與碼不能被 Excel 當成數字吃掉前導字元。
  for (const row of redeemLedgerRows(rows, commissions)) sheet.addRow(row).eachCell(cell => { cell.numFmt = '@'; });
  sheet.columns.forEach(col => { col.width = 16; });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
