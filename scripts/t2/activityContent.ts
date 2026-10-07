/**
 * 客戶的活動內容 → `src/t2/activityContent.ts`（Keep 規格 K03，§4.1、§4.2、附錄「內容欄位對照」）。
 *
 * 【來源】
 * 客戶 2026-09-23 交的 `NEWT2/T2视频_20260923.zip`（27 MB，19 支 mp4）裡的兩份 docx，**原封不動**
 * （位元組相同）取出來放在 `NEWT2/` 底下、進 git：
 *
 * - 《儿童居家训练入门手册·300 个亲子活动·总册》：300 張卡（需要什么／练什么／怎么玩／简单与难一点／
 *   💡小提醒／📖想深入练）。
 * - 《居家训练影片导引脚本·总册·300 支》（2026-10-06，取代 9/23 的《模组一》單冊；模組一逐字相同）：A001–A300 的腳本十段。
 *
 * zip 本身不進 git（mp4 不進 git）；讀 zip 也做不到 —— 它的檔名沒有設 UTF-8 旗標，`zip.ts` 不猜編碼。
 * 抽出兩份 docx 進 git，`--check` 與 `test/activityContent.test.ts` 才在 CI 跑得動。
 *
 * 【讀法：只拿掉標籤，原文一個字都不改】
 * 兩份檔的排版非常規律（每張卡、每支腳本同一個形狀），這裡照那個形狀**嚴格地**讀：
 * 少一段、多一段、編號跳號、標籤換了字，都丟例外，不靜靜略過 —— 安靜地少抽一格，
 * 下游就有一支活動永遠少一段而沒有人知道。拿掉的只有：
 *
 * - 段落的標籤與它後面的全形空白：「需要什么　」「练什么　　」「💡 小提醒　」「📖 想深入练：」
 *   「简单：」「；难一点：」「场地　」「旁白　」「如果　」「→ 」「降一阶　」「✓ 」與步驟的「1. 」。
 * - 逐字稿（片頭旁白、分鏡旁白、收尾旁白）外層的那一對「」。內層的「」照留。
 *
 * 《用语对照表》的禁字照原文留著：改不改是客戶的決定（Keep 規格 §7、§9 第 3 題）。
 * 腳本的「画面」（畫面描述）與「十、拍摄提示」是給拍片的人看的，**不抽**（§4.2）。
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { readDocxBlocks, type DocxBlock } from './docx';
import { activityIdOf } from '../../src/t2/activitySeed';
import { GUIDE_PREP_KEYS } from '../../src/t2/types';
import type { ActivityGuide } from '../../src/t2/types';

export const HANDBOOK_DOCX = 'NEWT2/森心康_儿童居家训练入门手册_300个亲子活动_总册.docx';
export const GUIDE_DOCX = 'NEWT2/森心康_居家训练影片导引脚本_总册_300支.docx';
export const ACTIVITY_CONTENT_MODULE = 'src/t2/activityContent.ts';

export const HANDBOOK_CARD_COUNT = 300;
export const GUIDE_SCRIPT_COUNT = 300;

/** 手冊的一張卡，欄位名對到 `Activity`（§4.1）。 */
export interface HandbookCard {
  no: number;
  title: string;
  ageLabel: string;
  people: string;
  need: string;
  trains: string;
  steps: string[];
  easier: string;
  harder: string;
  tip: string;
  deeper: string;
}

/** 腳本的一支。標題與適齡只拿來跟 act300 比，不進資料庫（那兩欄的來源是手冊）；人物配置進資料庫（P15）。 */
export interface GuideScript {
  no: number;
  title: string;
  ageLabel: string;
  /** 人物配置。與手冊不同時以腳本為準（v3 規格 P15，總冊較新）。 */
  people: string;
  guide: ActivityGuide;
}

/** 一支活動的內容 = 手冊那張卡＋（有的話）腳本。與產出檔裡的 `ActivityContent` 同形；不從那邊 import：第一次產生時它還不存在。 */
export interface ActivityContentEntry {
  id: string;
  title: string;
  ageLabel: string;
  people: string;
  need: string;
  trains: string;
  steps: string[];
  easier: string;
  harder: string;
  tip: string;
  deeper: string;
  guide: ActivityGuide | null;
}

// ══════════════════════════════════════════════
// 共用：一段一段往下讀
// ══════════════════════════════════════════════

/** 在一段區塊上往前走的游標。每一步都說出「預期什麼」，對不上就丟例外並指名是哪一張、哪一段。 */
class Cursor {
  private i = 0;
  constructor(private readonly blocks: DocxBlock[], private readonly where: string) {}

  peek(): DocxBlock | undefined {
    return this.blocks[this.i];
  }

  fail(expected: string): never {
    const b = this.peek();
    const got = !b ? '（沒有了）' : b.kind === 'p' ? `「${b.text.slice(0, 30)}」` : `一張 ${b.rows.length} 列的表`;
    throw new Error(`${this.where}：預期${expected}，實際是 ${got}`);
  }

  /** 下一段是段落而且符合 `re` 就吃掉它，回傳比對結果；否則不動、回 null。 */
  tryParagraph(re: RegExp): RegExpExecArray | null {
    const b = this.peek();
    if (!b || b.kind !== 'p') return null;
    const m = re.exec(b.text);
    if (m) this.i++;
    return m;
  }

  paragraph(re: RegExp, expected: string): RegExpExecArray {
    return this.tryParagraph(re) ?? this.fail(expected);
  }

  /** 一段文字剛好等於 `text`（段落標題）。 */
  heading(text: string): void {
    const b = this.peek();
    if (!b || b.kind !== 'p' || b.text !== text) this.fail(`段落標題「${text}」`);
    this.i++;
  }

  table(shape: number[], expected: string): string[][] {
    const b = this.peek();
    if (!b || b.kind !== 'table' || b.rows.length !== shape.length || b.rows.some((r, k) => r.length !== shape[k])) {
      this.fail(expected);
    }
    this.i++;
    return b.rows;
  }

  rest(): DocxBlock[] {
    return this.blocks.slice(this.i);
  }
}

/**
 * 一欄的值：去掉前後空白，必須有字、必須是一段（docx 同一格裡有兩段會以換行接起來）。
 * 換行擋在這裡，是因為遷移檔的 UPDATE 是一行一行寫的，而 `deploy/migrate.mjs` 會把
 * 以 `--` 開頭的整行當註解拿掉 —— 字串裡一個換行接著 `--`，那一句就被切壞了。
 */
function value(raw: string, where: string): string {
  const v = raw.trim();
  if (v === '') throw new Error(`${where}：是空的`);
  if (v.includes('\n')) throw new Error(`${where}：有兩段以上，本讀取器只收一段`);
  return v;
}

/** 依編號切段：每個標頭到下一個標頭之前。標頭的張數與編號（1、2、3……）不對就丟例外。 */
function segments(
  blocks: DocxBlock[],
  isHead: (b: DocxBlock) => number | null,
  expected: number,
  what: string,
): Array<{ no: number; head: DocxBlock; body: DocxBlock[] }> {
  const heads: Array<{ index: number; no: number }> = [];
  blocks.forEach((b, index) => {
    const no = isHead(b);
    if (no !== null) heads.push({ index, no });
  });
  if (heads.length !== expected) throw new Error(`${what}有 ${heads.length} 支，應為 ${expected}`);
  return heads.map(({ index, no }, k) => {
    if (no !== k + 1) throw new Error(`${what}第 ${k + 1} 支的編號是 ${no}`);
    const end = k + 1 < heads.length ? heads[k + 1].index : blocks.length;
    return { no, head: blocks[index], body: blocks.slice(index + 1, end) };
  });
}

const pad = (no: number) => String(no).padStart(3, '0');

// ══════════════════════════════════════════════
// 手冊
// ══════════════════════════════════════════════

/** 卡的標題列：一張 1×3 的表「001　我们来爬行｜6个月–3岁｜亲子」。 */
const CARD_HEAD = /^(\d{3})　(\S.*)$/;

function cardNo(b: DocxBlock): number | null {
  if (b.kind !== 'table' || b.rows.length !== 1 || b.rows[0].length !== 3) return null;
  const m = CARD_HEAD.exec(b.rows[0][0]);
  return m ? Number(m[1]) : null;
}

/** 卡的內容出現在卡的外面（兩張卡之間）就是排版變了 —— 那一段屬於哪一張，這裡不猜。 */
const CARD_LABEL = /^(需要什么|练什么|怎么玩|简单／难一点|\d+\. )/;

export function parseHandbook(blocks: DocxBlock[], expected = HANDBOOK_CARD_COUNT): HandbookCard[] {
  return segments(blocks, cardNo, expected, '手冊的卡').map(({ no, head, body }) => {
    const where = `手冊第 ${pad(no)} 張`;
    const [titleCell, ageCell, peopleCell] = (head as Extract<DocxBlock, { kind: 'table' }>).rows[0];
    const c = new Cursor(body, where);

    const need = value(c.paragraph(/^需要什么　+([\s\S]*)$/, '「需要什么」')[1], `${where}「需要什么」`);
    const trains = value(c.paragraph(/^练什么　+([\s\S]*)$/, '「练什么」')[1], `${where}「练什么」`);
    c.heading('怎么玩');
    const steps: string[] = [];
    for (let m = c.tryParagraph(/^(\d+)\. ([\s\S]*)$/); m; m = c.tryParagraph(/^(\d+)\. ([\s\S]*)$/)) {
      if (Number(m[1]) !== steps.length + 1) throw new Error(`${where}「怎么玩」第 ${steps.length + 1} 步的編號是 ${m[1]}`);
      steps.push(value(m[2], `${where}第 ${steps.length + 1} 步`));
    }
    if (steps.length === 0) c.fail('「怎么玩」的第 1 步');

    const eh = c.paragraph(/^简单／难一点　+简单：([\s\S]*)$/, '「简单／难一点」')[1];
    const halves = eh.split('；难一点：');
    if (halves.length !== 2) throw new Error(`${where}「简单／难一点」切不成「简单：…；难一点：…」兩半`);
    const easier = value(halves[0], `${where}「简单」`);
    const harder = value(halves[1], `${where}「难一点」`);

    const [[tipCell], [deeperCell]] = c.table([1, 1], '「💡 小提醒」「📖 想深入练」那張表');
    const tip = /^💡 小提醒　+([\s\S]*)$/.exec(tipCell);
    const deeper = /^📖 想深入练：([\s\S]*)$/.exec(deeperCell);
    if (!tip || !deeper) throw new Error(`${where}：小提醒那張表的兩格不是「💡 小提醒」與「📖 想深入练：」`);

    for (const b of c.rest()) {
      if (b.kind === 'table') throw new Error(`${where}：卡的後面多了一張表`);
      if (CARD_LABEL.test(b.text)) throw new Error(`${where}：卡的後面多了「${b.text.slice(0, 20)}」`);
    }

    return {
      no,
      title: value(CARD_HEAD.exec(titleCell)![2], `${where}的標題`),
      ageLabel: value(ageCell, `${where}的適齡`),
      people: value(peopleCell, `${where}的人物配置`),
      need,
      trains,
      steps,
      easier,
      harder,
      tip: value(tip[1], `${where}「小提醒」`),
      deeper: value(deeper[1], `${where}「想深入练」`),
    };
  });
}

// ══════════════════════════════════════════════
// 模組一的腳本
// ══════════════════════════════════════════════

/** 腳本的標頭：一張 2 列的表「活动 001　我们来爬行｜影片长度 2–3 分钟」「适合年龄 …　｜　人物配置 …　｜　模组…」。 */
const GUIDE_HEAD = /^活动 (\d{3})　(\S.*)$/;

function guideNo(b: DocxBlock): number | null {
  if (b.kind !== 'table' || b.rows[0]?.length !== 2) return null;
  // 模組一單冊（9/23）：一張 2 列的表；總冊（10/06）：標題那一列自己一張表，「适合年龄」那一格是下一張表。
  const twoRows = b.rows.length === 2 && b.rows[1].length === 1;
  if (!twoRows && b.rows.length !== 1) return null;
  const m = GUIDE_HEAD.exec(b.rows[0][0]);
  return m ? Number(m[1]) : null;
}

/**
 * 腳本後面、下一支前面，總冊會插模組的扉頁與活動清單（「动作体能」「模组二」「021　走在软软的路上　2–8岁 ｜ …」）。
 * 那些跳過；但腳本的段落標籤出現在那裡就是排版變了 —— 那一段屬於哪一支，這裡不猜。
 */
const GUIDE_LABEL = /^([一二三四五六七八九十]、|▎镜头|旁白　|画面　|如果　|→ |降一阶　|升一阶　|✓ |▸ )/;

const SHOT_NUMERALS = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十'];

/**
 * 逐字稿外層的那一對「」拿掉。整段必須被**一對**「」包住：「甲」「乙」這種外層提早關掉的，
 * 拿掉頭尾會變成「甲」「乙」中間缺一半 —— 那不是外層的引號，丟例外讓人來看。
 */
function unquote(raw: string, where: string): string {
  const s = value(raw, where);
  if (!s.startsWith('「') || !s.endsWith('」')) throw new Error(`${where}：逐字稿沒有被「」包住`);
  let depth = 0;
  for (let k = 0; k < s.length; k++) {
    if (s[k] === '「') depth++;
    else if (s[k] === '」') {
      depth--;
      if (depth === 0 && k !== s.length - 1) throw new Error(`${where}：外層的「」在中間就關掉了`);
    }
  }
  if (depth !== 0) throw new Error(`${where}：「」沒有成對`);
  return value(s.slice(1, -1), where);
}

/** 分鏡的旁白可以是一對空的「」：客戶腳本裡不出聲的鏡頭（例 A121 鏡頭二「孩子转头」），抽成空字串。 */
function unquoteSay(raw: string, where: string): string {
  return raw.trim() === '「」' ? '' : unquote(raw, where);
}

function numbered(c: Cursor, where: string): string[] {
  const items: string[] = [];
  for (let m = c.tryParagraph(/^(\d+)\. ([\s\S]*)$/); m; m = c.tryParagraph(/^(\d+)\. ([\s\S]*)$/)) {
    if (Number(m[1]) !== items.length + 1) throw new Error(`${where}第 ${items.length + 1} 條的編號是 ${m[1]}`);
    items.push(value(m[2], `${where}第 ${items.length + 1} 條`));
  }
  if (items.length === 0) c.fail(`${where}的第 1 條`);
  return items;
}

export function parseGuideScripts(blocks: DocxBlock[], expected = GUIDE_SCRIPT_COUNT): GuideScript[] {
  return segments(blocks, guideNo, expected, '腳本').map(({ no, head, body }) => {
    const where = `腳本 ${pad(no)}`;
    const rows = (head as Extract<DocxBlock, { kind: 'table' }>).rows;
    const c = new Cursor(body, where);
    const length = /^影片长度 (\S.*)$/.exec(rows[0][1]);
    const metaCell = rows.length === 2 ? rows[1][0] : c.table([1], '「适合年龄｜人物配置｜模组」那一格')[0][0];
    const meta = /^适合年龄 (\S+)　｜　人物配置 (\S+)　｜　\S.*$/.exec(metaCell);
    if (!length || !meta) throw new Error(`${where}：標頭不是「影片长度」「适合年龄｜人物配置｜模组」`);

    c.heading('一、片头旁白（可直接念）');
    const intro = unquote(c.table([1], '片頭旁白那一格')[0][0], `${where}片頭旁白`);

    c.heading('二、这个活动在练什么');
    const principles = numbered(c, `${where}原理`);

    c.heading('三、开拍前的准备');
    const prep: ActivityGuide['prep'] = {};
    for (const key of GUIDE_PREP_KEYS) {
      prep[key] = value(c.paragraph(new RegExp(`^${key}\\u3000+([\\s\\S]*)$`), `「${key}」`)[1], `${where}「${key}」`);
    }

    c.heading('四、分镜与操作步骤');
    const shots: ActivityGuide['shots'] = [];
    for (let m = c.tryParagraph(/^▎镜头(\S) · ([\s\S]*)$/); m; m = c.tryParagraph(/^▎镜头(\S) · ([\s\S]*)$/)) {
      if (m[1] !== SHOT_NUMERALS[shots.length]) throw new Error(`${where}第 ${shots.length + 1} 個鏡頭的編號是「${m[1]}」`);
      const name = value(m[2], `${where}鏡頭${m[1]}的名稱`);
      const say = unquoteSay(c.paragraph(/^旁白　+([\s\S]*)$/, `鏡頭${m[1]}的「旁白」`)[1], `${where}鏡頭${m[1]}的旁白`);
      c.paragraph(/^画面　+\S/, `鏡頭${m[1]}的「画面」`); // 畫面描述：給拍片的人看的，不抽
      shots.push({ name, say });
    }
    if (shots.length === 0) c.fail('「▎镜头一」');

    c.heading('五、孩子可能的反应与应对');
    const reactions: ActivityGuide['reactions'] = [];
    for (let m = c.tryParagraph(/^如果　+([\s\S]*)$/); m; m = c.tryParagraph(/^如果　+([\s\S]*)$/)) {
      const k = reactions.length + 1;
      const then = c.paragraph(/^→ ([\s\S]*)$/, `第 ${k} 則「如果」後面的「→」`)[1];
      reactions.push({ if: value(m[1], `${where}第 ${k} 則「如果」`), then: value(then, `${where}第 ${k} 則「→」`) });
    }
    if (reactions.length === 0) c.fail('「如果」');

    c.heading('六、大人最常做错的三件事');
    const mistakes = numbered(c, `${where}常做錯`);

    c.heading('七、做不到就降一阶 · 太简单就升一阶');
    const down = value(c.paragraph(/^降一阶　+([\s\S]*)$/, '「降一阶」')[1], `${where}「降一阶」`);
    const up = value(c.paragraph(/^升一阶　+([\s\S]*)$/, '「升一阶」')[1], `${where}「升一阶」`);

    c.heading('八、怎么看出有进步');
    const progress: string[] = [];
    for (let m = c.tryParagraph(/^✓ ([\s\S]*)$/); m; m = c.tryParagraph(/^✓ ([\s\S]*)$/)) {
      progress.push(value(m[1], `${where}第 ${progress.length + 1} 條進步指標`));
    }
    if (progress.length === 0) c.fail('「✓」');

    c.heading('九、收尾旁白');
    const outro = unquote(c.table([1], '收尾旁白那一格')[0][0], `${where}收尾旁白`);

    c.heading('十、拍摄提示'); // 給拍攝與剪輯用的，不抽
    while (c.tryParagraph(/^▸ \S/)) {
      /* 略過 */
    }
    for (const b of c.rest()) {
      if (b.kind === 'table') throw new Error(`${where}：拍攝提示後面多了一張表`);
      if (GUIDE_LABEL.test(b.text)) throw new Error(`${where}：拍攝提示後面多了「${b.text.slice(0, 20)}」`);
    }

    return {
      no,
      title: value(GUIDE_HEAD.exec(rows[0][0])![2], `${where}的標題`),
      ageLabel: meta[1],
      people: meta[2],
      guide: {
        length: value(length[1], `${where}的影片長度`),
        intro,
        principles,
        prep,
        shots,
        reactions,
        mistakes,
        down,
        up,
        progress,
        outro,
      },
    };
  });
}

// ══════════════════════════════════════════════
// 合起來、跟 act300 比
// ══════════════════════════════════════════════

export function mergeContent(cards: ReadonlyArray<HandbookCard>, scripts: ReadonlyArray<GuideScript>): ActivityContentEntry[] {
  const byNo = new Map(scripts.map(s => [s.no, s.guide] as const));
  const peopleByNo = new Map(scripts.map(s => [s.no, s.people] as const));
  for (const s of scripts) {
    if (!cards.some(c => c.no === s.no)) throw new Error(`腳本 ${pad(s.no)} 在手冊裡沒有對應的卡`);
  }
  return cards.map(c => ({
    id: activityIdOf(c.no),
    title: c.title,
    ageLabel: c.ageLabel,
    people: peopleByNo.get(c.no) ?? c.people, // 腳本較新，以它為準（v3 規格 P15）
    need: c.need,
    trains: c.trains,
    steps: [...c.steps],
    easier: c.easier,
    harder: c.harder,
    tip: c.tip,
    deeper: c.deeper,
    guide: byNo.get(c.no) ?? null,
  }));
}

/** 人物配置手冊與腳本寫得不一樣的那幾支（總冊 2026-10-06：A017、A030、A040）。資料庫那一側由 2026-10-07 的遷移改。 */
export interface PeopleOverride {
  id: string;
  handbook: string;
  script: string;
}

export function peopleOverrides(cards: ReadonlyArray<HandbookCard>, scripts: ReadonlyArray<GuideScript>): PeopleOverride[] {
  return scripts.flatMap(s => {
    const card = cards.find(c => c.no === s.no);
    return card && card.people !== s.people ? [{ id: activityIdOf(s.no), handbook: card.people, script: s.people }] : [];
  });
}

export interface ContentMismatch {
  id: string;
  source: 'handbook' | 'guide';
  field: 'title' | 'ageLabel';
  act300: string;
  found: string;
}

/**
 * 標題與適齡跟 `act300.ts`（活動庫種子的原文）逐支比，不一致的列出來（票 K03）。
 * **只列不改**：兩邊都是原文，照哪一邊是人的決定 —— 適齡還牽動配對的硬閘（`ageMonths`）。
 */
export function contentMismatches(
  cards: ReadonlyArray<HandbookCard>,
  scripts: ReadonlyArray<GuideScript>,
  act300: ReadonlyArray<{ no: number; name: string; age: string }>,
): ContentMismatch[] {
  const out: ContentMismatch[] = [];
  const check = (source: ContentMismatch['source'], no: number, title: string, ageLabel: string) => {
    const e = act300.find(x => x.no === no);
    if (!e) throw new Error(`act300 沒有第 ${no} 支`);
    const id = activityIdOf(no);
    if (title !== e.name) out.push({ id, source, field: 'title', act300: e.name, found: title });
    if (ageLabel !== e.age) out.push({ id, source, field: 'ageLabel', act300: e.age, found: ageLabel });
  };
  for (const c of cards) check('handbook', c.no, c.title, c.ageLabel);
  for (const s of scripts) check('guide', s.no, s.title, s.ageLabel);
  return out;
}

// ══════════════════════════════════════════════
// 讀檔、印成 src/t2/activityContent.ts
// ══════════════════════════════════════════════

export interface ContentSource {
  file: string;
  sha256: string;
}

export function readActivityContent(root: string) {
  const handbook = readFileSync(path.join(root, HANDBOOK_DOCX));
  const guideDoc = readFileSync(path.join(root, GUIDE_DOCX));
  const guideBlocks = readDocxBlocks(guideDoc);
  const cards = parseHandbook(readDocxBlocks(handbook));
  const scripts = parseGuideScripts(guideBlocks);
  const sources: ContentSource[] = [
    { file: HANDBOOK_DOCX, sha256: createHash('sha256').update(handbook).digest('hex') },
    { file: GUIDE_DOCX, sha256: createHash('sha256').update(guideDoc).digest('hex') },
  ];
  return { cards, scripts, entries: mergeContent(cards, scripts), sources, guideBlocks };
}

/** `src/t2/activityContent.ts` 該長什麼樣。逐位元可重現：JSON 字面量、兩格縮排、沒有時間戳。 */
export function emitActivityContentModule(entries: ReadonlyArray<ActivityContentEntry>, sources: ReadonlyArray<ContentSource>): string {
  return [
    '/**',
    ' * 客戶的活動內容：《儿童居家训练入门手册·300 个亲子活动·总册》300 張卡，',
    ' * 加上《居家训练影片导引脚本·总册·300 支》A001–A300 的腳本（Keep 規格 §4.1、§4.2；v3 規格 P15）。',
    ' *',
    ' * 由 `scripts/t2-extract-activity-content.ts` 從下面兩份 docx 產生，**請勿手改** —— 改了下一次重跑',
    ' * 就會被蓋掉，而且 `test/activityContent.test.ts` 會比對這一份與腳本重跑的結果。',
    ...sources.map(s => ` *   ${s.file}（sha256 ${s.sha256.slice(0, 12)}…）`),
    ' *',
    ' * 這裡是**客戶原文**：只拿掉段落的標籤（「需要什么」「💡 小提醒」「旁白」「1.」……）與逐字稿外層',
    ' * 那一對「」，一個字都不改寫 —— 含《用语对照表》的禁字（改不改是客戶的決定，規格 §7、§9 第 3 題）。',
    ' * 腳本的「画面」與「拍摄提示」是給拍片的人看的，不在這裡。',
    ' *',
    ' * 家長端與後台讀的是資料庫，不是這一檔：資料庫那一份由同一支腳本印進遷移',
    ' * `deploy/migrations/2026-09-23-activity-content.sql` 的 UPDATE。',
    ' */',
    '',
    "import type { ActivityGuide } from './types';",
    '',
    'export interface ActivityContent {',
    "  /** 'A001'。 */",
    '  id: string;',
    '  title: string;',
    '  /** 適齡原文「6个月–3岁」。 */',
    '  ageLabel: string;',
    '  /** 人物配置「亲子」「亲子或全家」……；手冊與腳本不同時取腳本。 */',
    '  people: string;',
    '  /** 需要什么。 */',
    '  need: string;',
    '  /** 练什么。 */',
    '  trains: string;',
    '  /** 怎么玩，一步一句，不含編號。 */',
    '  steps: string[];',
    '  /** 简单／难一点的兩半。 */',
    '  easier: string;',
    '  harder: string;',
    '  /** 💡 小提醒。 */',
    '  tip: string;',
    '  /** 📖 想深入练（不含「想深入练：」）。 */',
    '  deeper: string;',
    '  /** 腳本（總冊 300 支都有）；後台新增的活動是 null。 */',
    '  guide: ActivityGuide | null;',
    '}',
    '',
    `export const ACTIVITY_CONTENT: ReadonlyArray<ActivityContent> = ${JSON.stringify(entries, null, 2)};`,
    '',
  ].join('\n');
}

export function renderActivityContentModule(root: string): string {
  const { entries, sources } = readActivityContent(root);
  return emitActivityContentModule(entries, sources);
}
