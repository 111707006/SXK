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

/** 清分改看服務關係（#122）時多的兩欄：「对方」後面是篩查渠道那個單位，最後是篩查渠道那一份。 */
export const SPLIT_LEDGER_HEADER_SCREENING = [
  ...SPLIT_LEDGER_HEADER.slice(0, 7), '筛查渠道', ...SPLIT_LEDGER_HEADER.slice(7), '筛查渠道（元）',
];

const STATUS = { success: '已付款', refunded: '已退款' } as const;

/** 關著那一份的一列 → 多兩欄的一列（篩查渠道插在「对方」後面、金額接在最後）。 */
const withScreening = (cells: string[], name: string, fen: string): string[] => [...cells.slice(0, 7), name, ...cells.slice(7), fen];

export function splitLedgerCells(rows: ReadonlyArray<LedgerRow>, opts: { screening?: boolean } = {}): string[][] {
  return rows.map(r => {
    const cells = splitLedgerCellsOf(r);
    return opts.screening ? withScreening(cells, r.screeningName ?? '', r.amounts ? yuan(r.amounts.screeningFen) : '') : cells;
  });
}

function splitLedgerCellsOf(r: LedgerRow): string[] {
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
}

export function splitLedgerFileName(from: string, to: string): string {
  return `清分对帐-${from.replace(/-/g, '')}-${to.replace(/-/g, '')}.xlsx`;
}

/** `screening`（#122）：清分改看服務關係時多篩查渠道兩欄；關著與 #122 之前一格不差。 */
export async function splitLedgerWorkbook(rows: ReadonlyArray<LedgerRow>, opts: { screening?: boolean } = {}): Promise<Buffer> {
  const screening = opts.screening === true;
  const wb = new ExcelJS.Workbook();
  const detail = wb.addWorksheet('订单明细');
  detail.addRow(screening ? SPLIT_LEDGER_HEADER_SCREENING : SPLIT_LEDGER_HEADER).font = { bold: true };
  for (const row of splitLedgerCells(rows, { screening })) detail.addRow(row).eachCell(cell => { cell.numFmt = '@'; });
  const t = ledgerTotals(rows);
  detail.addRow([]);
  const total = [
    `合计（已付款、有比例的 ${t.orders} 笔${t.unrecorded ? `；另有 ${t.unrecorded} 笔未记录比例，不在合计里` : ''}）`,
    '', '', '', '', '', '', '',
    yuan(t.amountFen), yuan(t.feeFen), yuan(t.netFen), yuan(t.platformFen), yuan(t.companyFen), yuan(t.referrerFen),
  ];
  detail.addRow(screening ? withScreening(total, '', yuan(t.screeningFen)) : total).font = { bold: true };
  detail.columns.forEach(col => { col.width = 16; });

  const byParty = wb.addWorksheet('按对方汇总');
  if (screening) {
    byParty.addRow(['对方', '筛查渠道', '笔数', '合作公司（元）', '推荐人／治疗师（元）', '筛查渠道（元）', '平台（元）']).font = { bold: true };
    for (const p of ledgerByParty(rows)) {
      byParty.addRow([p.party, p.screeningName ?? '', String(p.orders), yuan(p.companyFen), yuan(p.referrerFen), yuan(p.screeningFen), yuan(p.platformFen)]);
    }
  } else {
    byParty.addRow(['对方', '笔数', '合作公司（元）', '推荐人／治疗师（元）', '平台（元）']).font = { bold: true };
    for (const p of ledgerByParty(rows)) byParty.addRow([p.party, String(p.orders), yuan(p.companyFen), yuan(p.referrerFen), yuan(p.platformFen)]);
  }
  byParty.columns.forEach(col => { col.width = 22; });
  return Buffer.from(await wb.xlsx.writeBuffer());
}
