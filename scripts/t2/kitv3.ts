/**
 * 完整版題庫（9/23 那一包）的抽取（T2 v3 題庫規格 §3.2）：每支工具一份「配方」，讀 HTML 的資料宣告與探針，
 * 收成 `src/t2/kitv3/types.ts` 的形狀。沿用 9/08 那一版（`kit.ts`）的規矩：
 *
 * - **一行都不執行**：資料宣告過 `literals.ts` 的純資料檢查才在空沙箱求值；寫在函式裡的切點用正則**讀**原始碼。
 * - **探針讀不到就停**：不用預設值補 —— 客戶換版重跑會炸，不會安靜地留著舊數字。
 * - 分級只抄**頁面報告那一套**（不抄 `postMessage` 的，規格 §4.1、R-16）。
 *
 * 跟 9/08 不同的三處：zip 的中文檔名沒設 UTF-8 旗標（`unflaggedUtf8Names`）；有 13 支把邏輯放在第二個 `<script>`
 * （`scripts` 全部讀進來，探針可以指定讀哪一段）；資料裡有跨行的字串相加（`literals.ts` 已放行）。
 */

import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { collectDataDeclarations, type DataDeclaration } from './literals';
import { readZip } from './zip';
import type { KitV3Bank, KitV3Texts } from '../../src/t2/kitv3/types';

export const KITV3_ZIP = 'NEWT2/森心康评估工具包_完整版_20260923.zip';
export const KITV3_ROOT = '森心康评估工具包_完整版/网页版/';
export const KITV3_DIR = 'src/t2/kitv3';

/** 一支工具的 HTML 讀進來之後，配方能碰到的東西。 */
export interface V3Source {
  file: string;
  html: string;
  /** 全部 `<script>` 的內容，依出現順序。 */
  scripts: string[];
  /** 第一個 `<script>` 開頭的純資料宣告。 */
  consts: Map<string, DataDeclaration>;
  sha256: string;
}

export interface V3Recipe {
  code: string;
  /** 檔名（`src/t2/kitv3/<slug>.ts`）：代碼裡的 `/` 不能進檔名。 */
  slug: string;
  file: string;
  build: (src: V3Source) => Omit<KitV3Bank, 'code' | 'source'>;
}

export function loadKitV3Zip(root: string): Map<string, Buffer> {
  return readZip(readFileSync(path.join(root, KITV3_ZIP)), { unflaggedUtf8Names: true });
}

export function loadV3Source(zip: Map<string, Buffer>, file: string): V3Source {
  const buf = zip.get(KITV3_ROOT + file);
  if (!buf) throw new Error(`完整版工具包裡沒有 ${file}`);
  const html = buf.toString('utf8');
  const scripts = [...html.matchAll(/<script[^>]*>([\s\S]*?)<\/script>/g)].map(m => m[1]);
  if (scripts.length === 0) throw new Error(`${file}：找不到 <script>`);
  return { file, html, scripts, consts: collectDataDeclarations(scripts[0]), sha256: createHash('sha256').update(buf).digest('hex') };
}

/** 一定要有的資料宣告。 */
export function need<T>(src: V3Source, name: string): T {
  const d = src.consts.get(name);
  if (!d) throw new Error(`${src.file}：script 開頭沒有純資料的宣告 ${name}`);
  return d.value as T;
}

/** 正則探針：一定要命中；預設讀全部 script 接起來（`where` 可指定 html）。 */
export function probe(src: V3Source, what: string, re: RegExp, where: 'script' | 'html' = 'script'): string[] {
  const text = where === 'html' ? src.html : src.scripts.join('\n');
  const m = re.exec(text);
  if (!m) throw new Error(`${src.file}：探針「${what}」沒有命中 —— 工具包的這一段改了，請人工核對`);
  return m.slice(1);
}

/** 只接受純數字。`Number('')` 是 0，空字串會安靜地變成切點。 */
export function num(s: string): number {
  if (!/^-?\d+(?:\.\d+)?$/.test(s.trim())) throw new Error(`不是數字：「${s}」`);
  return Number(s.trim());
}

/** `<h1>` 的文字（去掉裡面的 `<small>`／`<span>`）。 */
export function h1Title(src: V3Source): string {
  const m = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(src.html);
  if (!m) throw new Error(`${src.file}：找不到 <h1>`);
  const text = m[1].replace(/<(small|span)[^>]*>[\s\S]*?<\/\1>/g, '').replace(/<[^>]+>/g, '').trim();
  if (!text) throw new Error(`${src.file}：<h1> 是空的`);
  return text;
}

/** 配方表在 `kitv3-recipes/index.ts`（每一族一個檔）；這裡只放共用的零件，免得互相 import。 */
export function extractKitV3(zip: Map<string, Buffer>, recipes: ReadonlyArray<V3Recipe>): KitV3Bank[] {
  return recipes.map(r => {
    const src = loadV3Source(zip, r.file);
    const built = r.build(src);
    const texts = extractTexts(src);
    return { code: r.code, source: { zip: KITV3_ZIP, file: r.file, sha256: src.sha256 }, ...built, ...(texts ? { texts } : {}) };
  });
}

/** 去掉 HTML 標記（`<b>`、`<br>`），合併空白。只動標記，不動字。 */
function plain(s: string): string {
  return s.replace(/<br\s*\/?>/g, '').replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();
}

function asTips(v: unknown, where: string): string[] {
  if (v === undefined) return [];
  if (typeof v === 'string') return [plain(v)];
  if (Array.isArray(v) && v.every(x => typeof x === 'string')) return v.map(x => plain(x as string));
  throw new Error(`${where}：tips 不是字串或字串陣列`);
}

/**
 * 量表详解的素材（量表详解規格 §3）：掃第一段 script 的純資料宣告。
 * - 面向：陣列裡帶 `key`（或 `k`）與字串 `what` 的物件 → `{what, tips}`（GM 一族的 SECS、ASQ3 的 DOMAINS、CHEXI 的 SUBS……）。
 *   同一個 key 出現在兩個宣告裡就停下來（不猜哪一個才對）。
 * - 氣質：`DIM_DESC`／`TIPS` 兩張表，以向度名稱為鍵。
 * - 分段：`LEVELS` 各段的 `head`／`txt`。
 * 只抄原文；改寫在 `src/t2/kitv3/textAdapt.ts`。
 */
export function extractTexts(src: V3Source): KitV3Texts | null {
  const facets: KitV3Texts['facets'] = {};
  const owner: Record<string, string> = {};
  for (const [name, d] of src.consts) {
    if (!Array.isArray(d.value)) continue;
    for (const o of d.value as unknown[]) {
      if (!o || typeof o !== 'object' || Array.isArray(o)) continue;
      const rec = o as Record<string, unknown>;
      const key = typeof rec.key === 'string' ? rec.key : typeof rec.k === 'string' ? rec.k : null;
      if (key === null || typeof rec.what !== 'string') continue;
      if (owner[key]) throw new Error(`${src.file}：面向 ${key} 的說明同時出現在 ${owner[key]} 與 ${name}`);
      owner[key] = name;
      facets[key] = { what: plain(rec.what), tips: asTips(rec.tips, `${src.file} ${name}.${key}`) };
    }
  }
  const desc = src.consts.get('DIM_DESC')?.value as Record<string, unknown> | undefined;
  const tips = src.consts.get('TIPS')?.value as Record<string, unknown> | undefined;
  if (desc && typeof desc === 'object' && !Array.isArray(desc)) {
    for (const [dim, what] of Object.entries(desc)) {
      if (typeof what !== 'string') throw new Error(`${src.file}：DIM_DESC.${dim} 不是字串`);
      if (facets[dim]) throw new Error(`${src.file}：向度 ${dim} 的說明重複`);
      const t = tips?.[dim];
      const poles = t && typeof t === 'object' && !Array.isArray(t) ? (t as Record<string, unknown>) : null;
      if (poles && (typeof poles.hi !== 'string' || typeof poles.lo !== 'string')) throw new Error(`${src.file}：TIPS.${dim} 不是 {hi, lo}`);
      facets[dim] = poles
        ? { what: plain(what), tips: [], poleTips: { hi: plain(poles.hi as string), lo: plain(poles.lo as string) } }
        : { what: plain(what), tips: asTips(t, `${src.file} TIPS.${dim}`) };
    }
  }
  const levelsRaw = src.consts.get('LEVELS')?.value;
  const levels = Array.isArray(levelsRaw) && levelsRaw.every(l => l && typeof (l as { txt?: unknown }).txt === 'string')
    ? (levelsRaw as Array<{ head?: unknown; txt: string }>).map(l => ({ head: typeof l.head === 'string' ? plain(l.head) : '', txt: plain(l.txt) }))
    : undefined;
  if (Object.keys(facets).length === 0 && !levels) return null;
  return { facets, ...(levels ? { levels } : {}) };
}

/** 一支工具的模組原文：JSON 字面量、兩格縮排、沒有時間戳，逐位元可重現。 */
export function emitKitV3Module(bank: KitV3Bank): string {
  return [
    '/**',
    ` * ${bank.code}（${bank.title}）—— 完整版題庫 kit-20260923。`,
    ' *',
    ' * 由 `scripts/t2-extract-kitv3.ts` 從客戶 zip 抽出，**請勿手改** —— `test/t2KitV3.structure.test.ts` 會重跑比對。',
    ` *   ${bank.source.zip} → ${bank.source.file}（sha256 ${bank.source.sha256.slice(0, 12)}…）`,
    ' */',
    '',
    "import type { KitV3Bank } from './types';",
    '',
    `export const BANK: KitV3Bank = ${JSON.stringify(bank, null, 2)};`,
    '',
  ].join('\n');
}

export function renderKitV3Files(root: string, recipes: ReadonlyArray<V3Recipe>): Map<string, string> {
  const zip = loadKitV3Zip(root);
  const out = new Map<string, string>();
  for (const [i, bank] of extractKitV3(zip, recipes).entries()) {
    out.set(`${KITV3_DIR}/${recipes[i].slug}.ts`, emitKitV3Module(bank));
  }
  return out;
}
