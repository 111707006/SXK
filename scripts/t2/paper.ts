/**
 * 把紙本版 docx（2026-09-10）讀成可以跟題庫常數逐題比對的形狀。
 *
 * 紙本是題目文字的權威（規格 v2 §1）。每支 docx 的「四、量表本身」一節裡，面向
 * 是一段標題（「一、卧位与翻身　（共 8 项）」），題目是一張表（`题号 | 起始月龄 | 项目 | 選項…`）；
 * 「六、分数解读」是一張 `范围 | 分段 | 判读与建议` 的表。DEV 多一層「年龄段 0-6」，
 * WARN 的面向標題是時點（「3 月龄」「4 岁」），M-CHAT 沒有面向、只有一張表。
 *
 * 這裡只讀，不判斷；比對在 `paperDiff.ts`。
 */

import { readDocxBlocks, type DocxBlock } from './docx';
import type { ToolId } from '../../src/t2/toolkit/types';

export const PAPER_ZIP = 'NEWT2/森心康纸本评估工具_20260910.zip';
export const PAPER_ROOT = '森心康纸本评估工具_20260910/';

/** 工具 id → 紙本檔名。 */
export const PAPER_FILES: Record<ToolId, string> = {
  'sxk-dev': '森心康分龄发展量表_SXK-DEV_纸本版.docx',
  'sxk-warn': '儿童心理行为发育问题预警征象筛查_SXK-WARN_纸本版.docx',
  'mchat-rf': '改良版嬰幼兒自閉症篩查表_M-CHAT-RF_纸本版.docx',
  'sxk-gm': '森心康粗大动作发展量表_SXK-GM_纸本版.docx',
  'sxk-soc': '森心康社会能力发展量表_SXK-SOC_纸本版.docx',
  'sxk-lang': '森心康语言能力发展量表_SXK-LANG_纸本版.docx',
  'sxk-adp': '森心康适应能力发展量表_SXK-ADP_纸本版.docx',
  'sxk-voc': '森心康 0–3 词汇量检核表_SXK-VOC_纸本版.docx',
  'sxk-asq': '森心康三岁综合筛查量表_SXK-ASQ_纸本版.docx',
  'sxk-asb': '森心康自闭行为量表_SXK-ASB_纸本版.docx',
  'sxk-asr': '森心康社交沟通行为量表_SXK-ASR_纸本版.docx',
  'sxk-ab': '森心康注意力及行为观察量表_SXK-AB_纸本版.docx',
  'sxk-att': '森心康注意力及多动量表_SXK-ATT_纸本版.docx',
  'snap-iv': 'SNAP-IV 评量表_SNAP-IV_纸本版.docx',
  'chexi': 'CHEXI 儿童执行功能量表_CHEXI_纸本版.docx',
  'sxk-spa': '森心康感觉处理记录量表（2–5岁）_SXK-SPa_纸本版.docx',
  'sxk-spb': '森心康感觉处理记录量表（五岁以上）_SXK-SPb_纸本版.docx',
  'sxk-adl': '森心康生活自理功能量表_SXK-ADL_纸本版.docx',
  'sxk-ldp': '森心康学习障碍量表（小学版）_SXK-LDP_纸本版.docx',
  'sxk-lds': '森心康学习障碍量表（国高中版）_SXK-LDS_纸本版.docx',
  'sxk-tempa': '森心康 1–3 岁气质量表_SXK-TEMPa_纸本版.docx',
  'sxk-tempb': '森心康 3–7 岁气质量表_SXK-TEMPb_纸本版.docx',
};

export interface PaperItem {
  no: number;
  text: string;
  startMonth: number | null;
}

export interface PaperSection {
  /** 標題去掉「一、」與「（共 N 项）」之後的名字；DEV 是領域名，WARN 是時點標籤。 */
  name: string;
  /** 只有 DEV 有：「年龄段 0-6」。 */
  ageBand?: string;
  /** 標題括號裡宣稱的題數，用來對表格列數。 */
  declaredCount?: number;
  items: PaperItem[];
}

export interface PaperTier {
  /** 「范围」欄原文。 */
  range: string;
  key: string;
  min?: number;
  max?: number;
}

export interface PaperTool {
  id: ToolId;
  file: string;
  title: string;
  sections: PaperSection[];
  /** 題目表的表頭裡「项目」之後的欄位，就是選項標籤。 */
  optionLabels: string[];
  /** 「六、分数解读」的表；沒有那張表就是 null（CHEXI、SNAP、氣質）。 */
  tiers: PaperTier[] | null;
  /** 只有 ADL 有：七級定義那七行，「7 完全自己做　從头到尾…」拆成 {value, label, definition}。 */
  levelDefinitions?: Array<{ value: number; label: string; definition: string }>;
}

export function readPaperTool(id: ToolId, docx: Buffer): PaperTool {
  const blocks = readDocxBlocks(docx);
  const title = blocks.find((b): b is { kind: 'p'; text: string } => b.kind === 'p' && b.text.trim() !== '')?.text.trim() ?? '';

  // 用完整的章名切，不然面向標題「四、走跑跳」「五、平衡与协调」會被當成章的邊界。
  const body = slice(blocks, /^四、量表本身/, /^五、(计分方式|計分方式)/);
  const sections: PaperSection[] = [];
  let optionLabels: string[] = [];
  let ageBand: string | undefined;
  let pending: { name: string; declaredCount?: number } | null = null;

  for (const b of body) {
    if (b.kind === 'p') {
      const t = b.text.trim();
      if (!t || /^四、量表本身/.test(t)) continue;
      const band = /^年龄段 (\S+)$/.exec(t);
      if (band) { ageBand = band[1]; continue; }
      // 「一、卧位与翻身　（共 8 项）」；LANG 那一支括號前沒有全形空格。
      const head = /^[一二三四五六七八九十]+、(.+?)(?:\s*（共 (\d+) 项）)?$/.exec(t);
      if (head) { pending = { name: head[1].trim(), declaredCount: head[2] ? Number(head[2]) : undefined }; continue; }
      // DEV 的領域名、WARN 的時點：一段短文字，緊接著就是表。
      if (t.length <= 8 && !/[。：；，]/.test(t)) { pending = { name: t }; continue; }
      continue;
    }
    const header = b.rows[0] ?? [];
    const textCol = header.findIndex(c => c === '项目' || c === '項目' || c === '预警征象');
    if (textCol < 0) continue; // 不是題目表
    const noCol = 0;
    const monthCol = header.indexOf('起始月龄');
    const labels = header.slice(textCol + 1);
    if (optionLabels.length === 0) optionLabels = labels;
    else if (labels.join('|') !== optionLabels.join('|')) {
      throw new Error(`${PAPER_FILES[id]}：同一支的題目表選項欄不一致：${labels.join('／')} vs ${optionLabels.join('／')}`);
    }
    const items: PaperItem[] = [];
    for (const row of b.rows.slice(1)) {
      if (!/^\d+$/.test(row[noCol] ?? '')) continue; // 「小计」列
      items.push({
        no: Number(row[noCol]),
        text: row[textCol].trim(),
        startMonth: monthCol >= 0 ? Number(row[monthCol]) : null,
      });
    }
    sections.push({ name: pending?.name ?? '', ageBand, declaredCount: pending?.declaredCount, items });
    pending = null;
  }

  const tiers = readTiers(slice(blocks, /^六、(分数解读|分數解讀)/, /^七、/));
  const out: PaperTool = { id, file: PAPER_FILES[id], title, sections, optionLabels, tiers };
  if (id === 'sxk-adl') out.levelDefinitions = readLevelDefinitions(body);
  return out;
}

function slice(blocks: DocxBlock[], from: RegExp, to: RegExp): DocxBlock[] {
  const out: DocxBlock[] = [];
  let on = false;
  for (const b of blocks) {
    if (b.kind === 'p' && from.test(b.text.trim())) on = true;
    else if (b.kind === 'p' && to.test(b.text.trim())) on = false;
    if (on) out.push(b);
  }
  return out;
}

/**
 * 「范围 | 分段 | 判读与建议」。範圍的寫法有五種：
 * `85% 以上`、`70–84%`、`55% 以下`（＝ <55，紙本的「以下」是不含）、`0–9 分`、`30 分以上`；
 * WARN 是 `0 条阳性`／`任一条阳性`。
 */
function readTiers(blocks: DocxBlock[]): PaperTier[] | null {
  const table = blocks.find((b): b is { kind: 'table'; rows: string[][] } =>
    b.kind === 'table' && /^(范围|範圍|达成率)$/.test(b.rows[0]?.[0] ?? ''));
  if (!table) return null;
  return table.rows.slice(1).map(row => {
    const range = row[0].trim();
    const key = row[1].trim();
    const t: PaperTier = { range, key };
    let m: RegExpExecArray | null;
    if ((m = /^(\d+)(?:%| 分)? ?以上$/.exec(range))) t.min = Number(m[1]);
    else if ((m = /^(\d+)[–-](\d+)(?:%| 分)$/.exec(range))) { t.min = Number(m[1]); t.max = Number(m[2]); }
    else if ((m = /^(\d+)(?:%| 分)? ?以下$/.exec(range))) t.max = Number(m[1]) - 1;
    else if (range === '0 条阳性') t.max = 0;
    else if (range === '任一条阳性') t.min = 1;
    else throw new Error(`看不懂的分段範圍：「${range}」`);
    return t;
  });
}

/** ADL 的「　7 完全自己做　从头到尾自己完成，不需要有人在旁边」七行。 */
function readLevelDefinitions(blocks: DocxBlock[]): Array<{ value: number; label: string; definition: string }> {
  const out: Array<{ value: number; label: string; definition: string }> = [];
  for (const b of blocks) {
    if (b.kind !== 'p') continue;
    const m = /^\s*([1-7]) (\S+)　(.+)$/.exec(b.text.trim());
    if (m) out.push({ value: Number(m[1]), label: m[2], definition: m[3].trim() });
  }
  return out;
}
