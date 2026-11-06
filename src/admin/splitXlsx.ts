/**
 * 清分對帳匯出（客戶 11/03〈清分〉，ADR-0016）的 `.xlsx`：「订单明细」一筆一列、「按对方汇总」一個對方一列。
 * ⚠️ 只給伺服器載（exceljs 不進前端 bundle）。
 */
import ExcelJS from 'exceljs';
import { ledgerByParty, ledgerTotals, yuan, type LedgerRow } from '../revenueSplit/ledger';
import { shanghaiDate } from './summaryXlsx';

export const SPLIT_LEDGER_HEADER = [
  '付款时间', '商户订单号', '微信订单号', '家长编号', '项目', '状态', '对方', '比例',
  '实付（元）', '微信手续费（元）', '可分金额（元）', '平台（元）', '合作公司（元）', '推荐人／治疗师（元）',
];

const STATUS = { success: '已付款', refunded: '已退款' } as const;

export function splitLedgerCells(rows: ReadonlyArray<LedgerRow>): string[][] {
  return rows.map(r => {
    const a = r.amounts;
    return [
      r.paidAt ? shanghaiDate(r.paidAt) : '',
      r.outTradeNo,
      r.transactionId ?? '',
      String(r.userId),
      r.product,
      STATUS[r.status],
      r.party,
      r.rates,
      a ? yuan(a.amountFen) : '',
      a ? yuan(a.feeFen) : '',
      a ? yuan(a.netFen) : '',
      a ? yuan(a.platformFen) : '',
      a ? yuan(a.companyFen) : '',
      a ? yuan(a.referrerFen) : '',
    ];
  });
}

export function splitLedgerFileName(from: string, to: string): string {
  return `清分对帐-${from.replace(/-/g, '')}-${to.replace(/-/g, '')}.xlsx`;
}

export async function splitLedgerWorkbook(rows: ReadonlyArray<LedgerRow>): Promise<Buffer> {
  const wb = new ExcelJS.Workbook();
  const detail = wb.addWorksheet('订单明细');
  detail.addRow(SPLIT_LEDGER_HEADER).font = { bold: true };
  for (const row of splitLedgerCells(rows)) detail.addRow(row).eachCell(cell => { cell.numFmt = '@'; });
  const t = ledgerTotals(rows);
  detail.addRow([]);
  detail.addRow([
    `合计（已付款、有比例的 ${t.orders} 笔${t.unrecorded ? `；另有 ${t.unrecorded} 笔未记录比例，不在合计里` : ''}）`,
    '', '', '', '', '', '', '',
    yuan(t.amountFen), yuan(t.feeFen), yuan(t.netFen), yuan(t.platformFen), yuan(t.companyFen), yuan(t.referrerFen),
  ]).font = { bold: true };
  detail.columns.forEach(col => { col.width = 16; });

  const byParty = wb.addWorksheet('按对方汇总');
  byParty.addRow(['对方', '笔数', '合作公司（元）', '推荐人／治疗师（元）', '平台（元）']).font = { bold: true };
  for (const p of ledgerByParty(rows)) byParty.addRow([p.party, String(p.orders), yuan(p.companyFen), yuan(p.referrerFen), yuan(p.platformFen)]);
  byParty.columns.forEach(col => { col.width = 22; });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
