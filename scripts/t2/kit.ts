/**
 * 從工具包的 22 支 HTML 抽出題庫，整理成同一個形狀（`src/t2/toolkit/types.ts`）。
 *
 * 每支工具一份「配方」：讀哪個檔、資料宣告長什麼樣、分段從哪裡來、前置題在
 * HTML 的哪一塊。四種結構上不同的來源 —— 面向底下掛 `{t, m}` 的（GM 那一族與
 * ATT／AB／SPa／SPb）、面向題目是字串陣列的（TEMPa／b、ASB、LDP／LDS）、
 * 帶錨點的（ASR）、年齡段型的（DEV、WARN）—— 在這裡收成一樣的 `sections[].items[]`。
 *
 * 【三套分級只抄一套】
 * 同一支 HTML 裡有三套分級：報告分段（`LEVELS`／`BANDS`／`band()`，＝紙本「分數解讀」）、
 * `postMessage` 回傳給中控台的五級、中控台再壓的三級。這裡**只抄報告分段**。
 * 後兩套的切點（達成率族的 80／60／40、關切率族的 60／70、CHEXI 的 50／83……）
 * 一個數字都不抄 —— 它們是 9/2–9/5 中間版留下的，規格 v2 附錄 D 第一欄才是答案。
 *
 * 【探針】
 * 分段寫在函式裡的幾支（M-CHAT、CHEXI、氣質、LDP／LDS、WARN），用正則**讀**原始碼裡
 * 的那幾行，讀到的數字才進常數；讀不到就丟錯停下來，不用預設值補。這樣工具包改了
 * 分段，重跑腳本會炸，而不是安靜地留著舊數字。
 */

import { createHash } from 'node:crypto';
import { collectDataDeclarations } from './literals';
import type {
  ToolId, ToolkitBank, ToolkitItem, ToolkitOption, ToolkitPreQuestion, ToolkitSection, ToolkitTier,
} from '../../src/t2/toolkit/types';

export const KIT_ZIP = 'NEWT2/森心康评估工具包_20260908.zip';
export const KIT_ROOT = '森心康评估工具包_20260908/';

/** 一支工具的 HTML 讀進來之後，配方能碰到的東西。 */
interface Source {
  file: string;
  html: string;
  /** 第一個 `<script>` 的內容。 */
  script: string;
  /** script 開頭的純資料宣告。 */
  consts: Map<string, unknown>;
}

interface Recipe {
  id: ToolId;
  code: string;
  file: string;
  build: (src: Source) => Omit<ToolkitBank, 'id' | 'code' | 'title' | 'source'>;
}

// ---------------------------------------------------------------------------
// 讀取與共用的小工具
// ---------------------------------------------------------------------------

function loadSource(zip: Map<string, Buffer>, file: string): Source {
  const buf = zip.get(KIT_ROOT + file);
  if (!buf) throw new Error(`工具包裡沒有 ${file}`);
  const html = buf.toString('utf8');
  const m = /<script[^>]*>([\s\S]*?)<\/script>/.exec(html);
  if (!m) throw new Error(`${file}：找不到 <script>`);
  const consts = new Map<string, unknown>();
  for (const d of collectDataDeclarations(m[1]).values()) consts.set(d.name, d.value);
  return { file, html, script: m[1], consts };
}

function need<T>(src: Source, name: string): T {
  if (!src.consts.has(name)) throw new Error(`${src.file}：script 開頭沒有純資料的 const ${name}`);
  return src.consts.get(name) as T;
}

/** 正則探針：一定要命中，命中就回傳 capture groups。預設讀 script；前置題那些在 body 裡的用 `'html'`。 */
function probe(src: Source, what: string, re: RegExp, where: 'script' | 'html' = 'script'): string[] {
  const m = re.exec(src[where]);
  if (!m) throw new Error(`${src.file}：探針「${what}」沒有命中 —— 工具包的這一段改了，請人工核對`);
  return m.slice(1);
}

function num(s: string): number {
  const n = Number(s);
  if (!Number.isFinite(n)) throw new Error(`不是數字：${s}`);
  return n;
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, '');
}

/** 查表；查不到就丟錯，不落回預設值。 */
function mapOr(src: Source, table: Record<string, string>, v: string): string {
  const hit = table[v];
  if (hit === undefined) throw new Error(`${src.file}：不認識的選項值 ${v}`);
  return hit;
}

/** `<h1>` 的文字；DEV 那一支在裡面多掛了一個 `<span class="code">`，只取標籤外的字。 */
function h1Title(src: Source): string {
  const m = /<h1[^>]*>([\s\S]*?)<\/h1>/.exec(src.html);
  if (!m) throw new Error(`${src.file}：找不到 <h1>`);
  const text = m[1].replace(/<span[^>]*>[\s\S]*?<\/span>/g, '').trim();
  if (!text || /[<>]/.test(text)) throw new Error(`${src.file}：<h1> 裡有沒處理的標籤：${m[1]}`);
  return text;
}

function sha256(buf: Buffer): string {
  return createHash('sha256').update(buf).digest('hex');
}

// ---------------------------------------------------------------------------
// 面向與題目
// ---------------------------------------------------------------------------

interface RawSec { key: string; name: string; items: unknown[] }

/** `SECS[].items` 是 `{t, m}` 的那一族。 */
function sectionsWithMonths(src: Source, name = 'SECS'): ToolkitSection[] {
  const secs = need<RawSec[]>(src, name);
  return secs.map(s => ({
    key: s.key,
    name: s.name,
    items: s.items.map((it, i) => {
      const o = it as { t?: unknown; m?: unknown };
      if (typeof o.t !== 'string' || typeof o.m !== 'number') {
        throw new Error(`${src.file}：${s.key} 第 ${i + 1} 題不是 {t, m}`);
      }
      return { no: i + 1, text: o.t, startMonth: o.m };
    }),
  }));
}

/** `SECS[].items`（或 `DOMAINS[].items`）是字串陣列的那一族。 */
function sectionsOfStrings(src: Source, name: string): ToolkitSection[] {
  const secs = need<RawSec[]>(src, name);
  return secs.map(s => ({
    key: s.key,
    name: s.name,
    items: s.items.map((t, i) => {
      if (typeof t !== 'string') throw new Error(`${src.file}：${s.key} 第 ${i + 1} 題不是字串`);
      return { no: i + 1, text: t, startMonth: null };
    }),
  }));
}

// ---------------------------------------------------------------------------
// 選項
// ---------------------------------------------------------------------------

/** `OPTS` 是 `[label, value]` 的陣列（ADL 多一個定義）。 */
function optionsFromOpts(src: Source): ToolkitOption[] {
  const opts = need<unknown[]>(src, 'OPTS');
  return opts.map((o, i) => {
    if (!Array.isArray(o) || typeof o[0] !== 'string' || typeof o[1] !== 'number') {
      throw new Error(`${src.file}：OPTS 第 ${i + 1} 個不是 [label, value]`);
    }
    const out: ToolkitOption = { value: o[1], label: o[0] };
    if (typeof o[2] === 'string') out.definition = stripTags(o[2]);
    return out;
  });
}

/**
 * 沒有 `OPTS` 的工具，選項寫在畫面模板裡：`value="2"><em>已经会</em>`。
 * 依模板出現的順序抓，`mapValue` 把 HTML 的值換成 §3.1 的值域。
 */
function optionsFromTemplate(
  src: Source,
  namePrefix: string,
  mapValue: (v: string) => number | string,
): ToolkitOption[] {
  const re = new RegExp(`<input type="radio" name="${namePrefix}[^"]*" value="([^"]+)"><em>([^<]+)</em>`, 'g');
  const out: ToolkitOption[] = [];
  for (const m of src.script.matchAll(re)) out.push({ value: mapValue(m[1]), label: m[2] });
  if (out.length === 0) throw new Error(`${src.file}：畫面模板裡找不到 ${namePrefix} 的選項`);
  return out;
}

// ---------------------------------------------------------------------------
// 分段
// ---------------------------------------------------------------------------

function tier(n: number): ToolkitTier['tier'] {
  if (n < 1 || n > 4) throw new Error(`tier 只能是 1–4，拿到 ${n}`);
  return n as ToolkitTier['tier'];
}

/** `LEVELS = [{min: 85, key}, {min: 70, key}, …]`，由高到低；上一段的 min − 1 就是這一段的 max。 */
function tiersFromMinLevels(src: Source): ToolkitTier[] {
  const levels = need<Array<{ min: number; key: string }>>(src, 'LEVELS');
  return levels.map((l, i) => {
    if (typeof l.min !== 'number' || typeof l.key !== 'string') throw new Error(`${src.file}：LEVELS 第 ${i + 1} 段不是 {min, key}`);
    if (i > 0 && levels[i - 1].min <= l.min) throw new Error(`${src.file}：LEVELS 不是由高到低（第 ${i + 1} 段）`);
    const t: ToolkitTier = { tier: tier(i + 1), key: l.key, min: l.min };
    if (i > 0) t.max = levels[i - 1].min - 1;
    return t;
  });
}

/** `LEVELS = [{lo: 0, hi: 22, key}, …]`，由低到高，閉區間照抄。 */
function tiersFromRanges(src: Source): ToolkitTier[] {
  const levels = need<Array<{ lo: number; hi: number; key: string }>>(src, 'LEVELS');
  return levels.map((l, i) => {
    if (typeof l.lo !== 'number' || typeof l.hi !== 'number' || typeof l.key !== 'string') {
      throw new Error(`${src.file}：LEVELS 第 ${i + 1} 段不是 {lo, hi, key}`);
    }
    if (i > 0 && l.lo !== levels[i - 1].hi + 1) throw new Error(`${src.file}：LEVELS 第 ${i + 1} 段與上一段不連續`);
    return { tier: tier(i + 1), key: l.key, min: l.lo, max: l.hi };
  });
}

/** LDP／LDS 的 `BANDS = [{max: 9, key}, …]`；最後一段的 999 是哨兵，不是上限。 */
function tiersFromMaxBands(src: Source): ToolkitTier[] {
  const bands = need<Array<{ max: number; key: string }>>(src, 'BANDS');
  return bands.map((b, i) => {
    if (typeof b.max !== 'number' || typeof b.key !== 'string') throw new Error(`${src.file}：BANDS 第 ${i + 1} 段不是 {max, key}`);
    if (i > 0 && b.max <= bands[i - 1].max) throw new Error(`${src.file}：BANDS 不是由低到高（第 ${i + 1} 段）`);
    const t: ToolkitTier = { tier: tier(i + 1), key: b.key };
    if (i > 0) t.min = bands[i - 1].max + 1;
    if (i < bands.length - 1) t.max = b.max;
    return t;
  });
}

// ---------------------------------------------------------------------------
// 前置題（寫在 HTML body 裡，不在 script）
// ---------------------------------------------------------------------------

/**
 * `<div class="ask">` 那一塊：`<h3>` 是問法，每個 `<label>` 一個選項。
 * `values` 把 HTML 的 id（`q_lang`）或 value（`lt3`）對到 §5.1 的值。
 */
function askBlock(
  src: Source,
  key: ToolkitPreQuestion['key'],
  kind: ToolkitPreQuestion['kind'],
  values: Record<string, { value: string; exclusive?: boolean }>,
  blockRe = /<div class="ask">([\s\S]*?)<\/div>/,
  promptOverride?: string,
): ToolkitPreQuestion {
  const block = blockRe.exec(src.html);
  if (!block) throw new Error(`${src.file}：找不到前置題區塊`);
  const prompt = promptOverride ?? /<h3>([^<]*)<\/h3>/.exec(block[1])?.[1]?.trim();
  if (!prompt) throw new Error(`${src.file}：前置題區塊裡沒有 <h3>`);

  const options: ToolkitPreQuestion['options'] = [];
  const labelRe = /<input type="(?:checkbox|radio)"(?:\s+name="[^"]*")?\s+id="([^"]+)"(?:\s+value="([^"]+)")?><span>([^<]*)<\/span>/g;
  for (const m of block[1].matchAll(labelRe)) {
    const htmlKey = m[2] ?? m[1];
    const mapped = values[htmlKey];
    if (!mapped) throw new Error(`${src.file}：前置題選項「${m[3]}」（${htmlKey}）沒有對到 §5.1 的值`);
    const opt: ToolkitPreQuestion['options'][number] = { value: mapped.value, label: m[3].trim() };
    if (mapped.exclusive) opt.exclusive = true;
    options.push(opt);
  }
  if (options.length !== Object.keys(values).length) {
    throw new Error(`${src.file}：前置題選項數 ${options.length}，配方預期 ${Object.keys(values).length}`);
  }
  return { key, kind, prompt, options };
}

/** ASB／ASR 共用：能力倒退。 */
const REGRESSION_VALUES = {
  q_ok: { value: 'none', exclusive: true },
  q_lang: { value: 'language' },
  q_soc: { value: 'social' },
};

// ---------------------------------------------------------------------------
// 22 份配方
// ---------------------------------------------------------------------------

/** 達成率族六支長得一模一樣：`SECS` 帶起始月齡、`LEVELS` 是 min 型、選項在模板裡。 */
function achievementRecipe(id: ToolId, code: string, file: string): Recipe {
  return {
    id, code, file,
    build: src => ({
      options: optionsFromTemplate(src, 'i', v => num(v)),
      sections: sectionsWithMonths(src),
      tiers: tiersFromMinLevels(src),
      preQuestions: [],
      minItems: need<number>(src, 'MIN_ITEMS'),
    }),
  };
}

/** 關切率族裡 `SECS` 帶起始月齡的四支（ATT／AB／SPa／SPb）。 */
function concernWithMonthsRecipe(id: ToolId, code: string, file: string, pre: (src: Source) => ToolkitPreQuestion): Recipe {
  return {
    id, code, file,
    build: src => ({
      options: optionsFromOpts(src),
      sections: sectionsWithMonths(src),
      tiers: tiersFromRanges(src),
      preQuestions: [pre(src)],
    }),
  };
}

const IMPACT_VALUES = {
  q_none: { value: 'none', exclusive: true },
  q_adl: { value: 'adl' },
  q_sch: { value: 'group' },
  q_soc: { value: 'play' },
};

export const RECIPES: Recipe[] = [
  // ---- 01 綜合篩查與官方工具 ----
  {
    id: 'sxk-dev', code: 'SXK-DEV', file: '01_综合筛查与官方工具/森心康分龄发展量表_SXK-DEV.html',
    build: src => {
      const banks = need<Record<string, Record<string, unknown[]>>>(src, 'BANKS');
      const ageBands = need<Array<{ key: string; label: string; lo: number; hi: number }>>(src, 'AGEBANDS');
      const domains = need<Array<{ key: string; name: string }>>(src, 'DOMAINS');
      const sections: ToolkitSection[] = [];
      for (const band of ageBands) {
        const bank = banks[band.key];
        if (!bank) throw new Error(`${src.file}：BANKS 沒有年齡段 ${band.key}`);
        for (const d of domains) {
          const items = bank[d.key];
          if (!Array.isArray(items)) throw new Error(`${src.file}：BANKS[${band.key}] 沒有領域 ${d.key}`);
          sections.push({
            key: d.key,
            name: d.name,
            ageBand: { key: band.key, lo: band.lo, hi: band.hi },
            items: items.map((t, i) => {
              if (typeof t !== 'string') throw new Error(`${src.file}：BANKS[${band.key}].${d.key} 第 ${i + 1} 題不是字串`);
              return { no: i + 1, text: t, startMonth: null };
            }),
          });
        }
      }
      return {
        // 畫面的值是 "1"／"0"／"x"，§3.1 的值域是 pass／fail／skip。
        options: optionsFromTemplate(src, 'i', v => mapOr(src, { '1': 'pass', '0': 'fail', x: 'skip' }, v)),
        sections,
        tiers: tiersFromMinLevels(src),
        preQuestions: [],
      };
    },
  },
  {
    id: 'sxk-warn', code: 'SXK-WARN', file: '01_综合筛查与官方工具/SXK-WARN_儿童心理行为发育问题预警征象筛查.html',
    build: src => {
      const points = need<Array<{ m: number; label: string; items: unknown[] }>>(src, 'POINTS');
      // 「取 ≤ 月齡的最大時點」（`ptFor`）：這個時點管到下一個時點的前一個月；
      // 最後一個時點管到工具自己說「超出範圍」的那個月齡減一（`showAge` 的 `a.months>=84`）。
      const outOfRange = num(probe(src, '幾個月起超出範圍', /a\.months>=(\d+)\)\{box\.classList\.add\("bad"\);s\+=`　·　本表适用未满 7 周岁/)[0]);
      const sections: ToolkitSection[] = points.map((p, pi) => ({
        key: `m${p.m}`,
        name: p.label,
        ageBand: { key: String(p.m), lo: p.m, hi: pi + 1 < points.length ? points[pi + 1].m - 1 : outOfRange - 1 },
        items: p.items.map((t, i) => {
          if (typeof t !== 'string') throw new Error(`${src.file}：${p.label} 第 ${i + 1} 條不是字串`);
          return { no: i + 1, text: t, startMonth: null };
        }),
      }));
      // 判定規則寫在報告文字裡：任一條陽性或任一倒退即初篩異常。
      probe(src, '初篩異常的判定標準', /预警征象存在一条及以上阳性，或任何年龄段出现语言功能和社会交往能力障碍或倒退/);
      const [abnormal, normal] = probe(src, '兩個判定名稱', /abnormal \? "(初筛异常)，建议转诊复筛" : "(初筛未见异常)"/);
      const prompt = probe(src, '倒退詢問的問法', /<p>(询问家长，了解儿童是否出现语言功能和社会交往能力障碍或倒退。)<\/p>/, 'html')[0];
      // WARN 的這一題沒有 <h3>，問法是區塊上方的那一句說明。
      const ask = askBlock(src, 'regression', 'multi', REGRESSION_VALUES, /<div class="chk">([\s\S]*?)<p class="hint">/, prompt);
      return {
        options: optionsFromTemplate(src, 'w', v => num(v)),
        sections,
        tiers: [
          { tier: 1, key: normal, max: 0 },
          { tier: 3, key: abnormal, min: 1 },
        ],
        preQuestions: [ask],
      };
    },
  },
  {
    id: 'mchat-rf', code: 'M-CHAT-R/F', file: '01_综合筛查与官方工具/M-CHAT-RF_森心康院内实施版.html',
    build: src => {
      const q = need<Array<{ id: number; risk: string; t: string }>>(src, 'Q');
      const items: ToolkitItem[] = q.map((x, i) => {
        if (x.id !== i + 1 || (x.risk !== 'yes' && x.risk !== 'no') || typeof x.t !== 'string') {
          throw new Error(`${src.file}：Q 第 ${i + 1} 題形狀不對`);
        }
        return { no: x.id, text: x.t, startMonth: null, riskAnswer: x.risk };
      });
      const [lowMax, lowRange] = probe(src, '低風險', /if\(n<=(\d+)\) return \{k:"低風險",range:"([^"]+)"/);
      const [midMax, midRange] = probe(src, '中等風險', /if\(n<=(\d+)\) return \{k:"中等風險",range:"([^"]+)"/);
      const [hiLo, hiHi] = probe(src, '高風險', /return \{k:"高風險",range:"(\d+)–(\d+) 分"/);
      if (lowRange !== `0–${lowMax} 分` || midRange !== `${num(lowMax) + 1}–${midMax} 分` || num(hiLo) !== num(midMax) + 1) {
        throw new Error(`${src.file}：三段風險的數字與文字對不上（${lowRange}／${midRange}／${hiLo}–${hiHi}）`);
      }
      const concernPrompt = probe(src, '擔心那一題', /<span>(醫護人員或家長是否對兒童患上自閉症譜系障礙有擔心？)<\/span>\s*<select id="f_concern"><option value="">請選擇<\/option><option>否<\/option><option>是<\/option><\/select>/, 'html')[0];
      return {
        options: optionsFromTemplate(src, 'i', v => v),
        // M-CHAT 沒有面向；用一個沒有名字的面向裝 20 題，不替原文發明一個標題。
        sections: [{ key: 'all', name: '', items }],
        tiers: [
          { tier: 1, key: '低風險', min: 0, max: num(lowMax) },
          { tier: 2, key: '中等風險', min: num(lowMax) + 1, max: num(midMax) },
          { tier: 3, key: '高風險', min: num(hiLo), max: num(hiHi) },
        ],
        preQuestions: [{
          key: 'concern', kind: 'boolean', prompt: concernPrompt,
          options: [{ value: 'false', label: '否' }, { value: 'true', label: '是' }],
        }],
      };
    },
  },

  // ---- 02 分項發展（達成率族六支） ----
  achievementRecipe('sxk-gm', 'SXK-GM', '02_分项发展/森心康粗大动作发展量表_SXK-GM.html'),
  achievementRecipe('sxk-soc', 'SXK-SOC', '02_分项发展/森心康社会能力发展量表_SXK-SOC.html'),
  achievementRecipe('sxk-lang', 'SXK-LANG', '02_分项发展/森心康语言能力发展量表_SXK-LANG.html'),
  achievementRecipe('sxk-adp', 'SXK-ADP', '02_分项发展/森心康适应能力发展量表_SXK-ADP.html'),
  achievementRecipe('sxk-voc', 'SXK-VOC', '02_分项发展/森心康0-3词汇量检核表_SXK-VOC.html'),
  achievementRecipe('sxk-asq', 'SXK-ASQ', '02_分项发展/森心康三岁综合筛查量表_SXK-ASQ.html'),

  // ---- 03 社交溝通 ----
  {
    id: 'sxk-asb', code: 'SXK-ASB', file: '03_社交沟通/森心康自闭行为量表_SXK-ASB.html',
    build: src => ({
      options: optionsFromOpts(src),
      sections: sectionsOfStrings(src, 'SECS'),
      tiers: tiersFromRanges(src),
      preQuestions: [askBlock(src, 'regression', 'single', REGRESSION_VALUES)],
    }),
  },
  {
    id: 'sxk-asr', code: 'SXK-ASR', file: '03_社交沟通/森心康社交沟通行为量表_SXK-ASR.html',
    build: src => {
      const secs = need<RawSec[]>(src, 'SECS');
      const sections: ToolkitSection[] = secs.map(s => ({
        key: s.key,
        name: s.name,
        items: s.items.map((it, i) => {
          const o = it as { t?: unknown; a?: unknown };
          if (typeof o.t !== 'string' || !Array.isArray(o.a) || o.a.length !== 4 || !o.a.every(x => typeof x === 'string')) {
            throw new Error(`${src.file}：${s.key} 第 ${i + 1} 項不是 {t, a[4]}`);
          }
          return { no: i + 1, text: o.t, startMonth: null, anchors: o.a as string[] };
        }),
      }));
      return {
        options: optionsFromOpts(src),
        sections,
        tiers: tiersFromRanges(src),
        preQuestions: [askBlock(src, 'regression', 'single', REGRESSION_VALUES)],
      };
    },
  },

  // ---- 04 注意力與執行功能 ----
  concernWithMonthsRecipe('sxk-ab', 'SXK-AB', '04_注意力与执行功能/森心康注意力及行为观察量表_SXK-AB.html', src =>
    askBlock(src, 'settings', 'multi', {
      q_home: { value: 'home' }, q_school: { value: 'school' }, q_other: { value: 'other' },
    })),
  concernWithMonthsRecipe('sxk-att', 'SXK-ATT', '04_注意力与执行功能/森心康注意力及多动量表_SXK-ATT.html', src =>
    askBlock(src, 'duration', 'single', {
      lt3: { value: 'lt3m' }, '3to6': { value: '3to6m' }, gt6: { value: 'gt6m' }, always: { value: 'always' },
    })),
  {
    id: 'snap-iv', code: 'SNAP-IV', file: '04_注意力与执行功能/SNAP-IV评量表_森心康院内实施版.html',
    build: src => {
      const secs = need<Array<{ key: string; name: string; ids: number[] }>>(src, 'SECS');
      const qmap = need<Record<string, string>>(src, 'QMAP');
      const sections: ToolkitSection[] = secs.map(s => ({
        key: s.key,
        name: s.name,
        items: s.ids.map((id, i) => {
          const text = qmap[String(id)];
          if (typeof text !== 'string') throw new Error(`${src.file}：QMAP 沒有第 ${id} 題`);
          return { no: i + 1, sourceNo: id, text, startMonth: null };
        }),
      }));
      const ref = need<{ parent: Record<string, [number, number] | string> }>(src, 'REF');
      const cuts = secs.map(s => ref.parent[s.key]);
      if (!cuts.every(c => Array.isArray(c) && c.length === 2 && c[0] === (cuts[0] as number[])[0] && c[1] === (cuts[0] as number[])[1])) {
        throw new Error(`${src.file}：REF.parent 三個分量表的參考點不一致，配方假設它們一樣`);
      }
      const [watch, refer] = cuts[0] as [number, number];
      probe(src, '參考點的三個名稱', /if\(p\[1\]!==null&&ari>p\[1\]\) return \{k:"高于诊断参考点"[\s\S]*?if\(ari>p\[0\]\) return \{k:"高于关注参考点"[\s\S]*?return \{k:"低于参考点"/);
      return {
        options: optionsFromOpts(src),
        sections,
        // 只抄家長版參考點（22 支全由家長填，§0）；教師版另一組不進來。
        tiers: [
          { tier: 1, key: '低于参考点', max: watch },
          { tier: 2, key: '高于关注参考点', min: watch, max: refer },
          { tier: 3, key: '高于诊断参考点', min: refer },
        ],
        preQuestions: [],
      };
    },
  },
  {
    id: 'chexi', code: 'CHEXI', file: '04_注意力与执行功能/CHEXI儿童执行功能量表_森心康实施版.html',
    build: src => {
      const secs = need<RawSec[]>(src, 'SECS');
      const sections: ToolkitSection[] = secs.map(s => ({
        key: s.key,
        name: s.name,
        items: s.items.map((it, i) => {
          const o = it as { id?: unknown; t?: unknown };
          if (typeof o.id !== 'number' || typeof o.t !== 'string') throw new Error(`${src.file}：${s.key} 第 ${i + 1} 題不是 {id, t}`);
          return { no: i + 1, sourceNo: o.id, text: o.t, startMonth: null };
        }),
      }));
      const [low] = probe(src, '相對較低', /if\(pct<=(\d+)\) return \{k:"相对较低"/);
      const [mid] = probe(src, '中等', /if\(pct<=(\d+)\) return \{k:"中等"/);
      probe(src, '相對偏高', /return \{k:"相对偏高"/);
      return {
        options: optionsFromOpts(src),
        sections,
        // 紙本寫「不套用任何切分值」；這三段是 HTML 報告對副量表與因素的**相對描述**
        // （`band(pct)`），規格 §5.3 沿用它出標籤，不出 band。
        tiers: [
          { tier: 1, key: '相对较低', max: num(low) },
          { tier: 2, key: '中等', min: num(low) + 1, max: num(mid) },
          { tier: 3, key: '相对偏高', min: num(mid) + 1 },
        ],
        preQuestions: [],
      };
    },
  },

  // ---- 05 感覺與生活自理 ----
  concernWithMonthsRecipe('sxk-spa', 'SXK-SPa', '05_感觉与生活自理/森心康感觉处理记录量表_2-5岁_SXK-SPa.html', src =>
    askBlock(src, 'impact', 'multi', IMPACT_VALUES)),
  concernWithMonthsRecipe('sxk-spb', 'SXK-SPb', '05_感觉与生活自理/森心康感觉处理记录量表_五岁以上_SXK-SPb.html', src =>
    askBlock(src, 'impact', 'multi', IMPACT_VALUES)),
  {
    id: 'sxk-adl', code: 'SXK-ADL', file: '05_感觉与生活自理/森心康生活自理功能量表_SXK-ADL.html',
    build: src => {
      const options = optionsFromOpts(src);
      if (options.length !== 7 || !options.every(o => o.definition)) throw new Error(`${src.file}：七級定義不齊`);
      return {
        options,
        sections: sectionsWithMonths(src),
        tiers: tiersFromMinLevels(src),
        preQuestions: [],
        minItems: need<number>(src, 'MIN_ITEMS'),
      };
    },
  },

  // ---- 06 學習障礙 ----
  ...(['sxk-ldp', 'sxk-lds'] as const).map((id): Recipe => ({
    id,
    code: id === 'sxk-ldp' ? 'SXK-LDP' : 'SXK-LDS',
    file: id === 'sxk-ldp'
      ? '06_学习障碍/森心康学习障碍量表_小学版_SXK-LDP.html'
      : '06_学习障碍/森心康学习障碍量表_国高中版_SXK-LDS.html',
    build: src => {
      // OPTS 是 [label, 說明]，分數是位置 0–3（`OPTS[ANS[i.no]][0]`）。
      const opts = need<unknown[]>(src, 'OPTS');
      const options: ToolkitOption[] = opts.map((o, i) => {
        if (!Array.isArray(o) || typeof o[0] !== 'string') throw new Error(`${src.file}：OPTS 第 ${i + 1} 個不是 [label, 說明]`);
        return { value: i, label: o[0] };
      });
      probe(src, '分數是選項的位置', /OPTS\[ANS\[i\.no\]\]\[0\]/);
      const [d1, d2, d3] = probe(src, '各方面分級',
        /function domLevel\(s\)\{\s*if\(s<=(\d+)\)\s*return \{t:"未见明显"[^}]*\};\s*if\(s<=(\d+)\)\s*return \{t:"轻微"[^}]*\};\s*if\(s<=(\d+)\)\s*return \{t:"中等"[^}]*\};\s*return\s*\{t:"显著"/);
      return {
        options,
        sections: sectionsOfStrings(src, 'DOMAINS'),
        tiers: tiersFromMaxBands(src),
        sectionTiers: [
          { tier: 1, key: '未见明显', max: num(d1) },
          { tier: 2, key: '轻微', min: num(d1) + 1, max: num(d2) },
          { tier: 3, key: '中等', min: num(d2) + 1, max: num(d3) },
          { tier: 4, key: '显著', min: num(d3) + 1 },
        ],
        preQuestions: [],
      };
    },
  })),

  // ---- 07 氣質 ----
  ...(['sxk-tempa', 'sxk-tempb'] as const).map((id): Recipe => ({
    id,
    code: id === 'sxk-tempa' ? 'SXK-TEMPa' : 'SXK-TEMPb',
    file: id === 'sxk-tempa'
      ? '07_气质/森心康1-3岁气质量表_SXK-TEMPa.html'
      : '07_气质/森心康3-7岁气质量表_SXK-TEMPb.html',
    build: src => {
      const extreme = need<number>(src, 'EXTREME');
      const [slight] = probe(src, '兩端之間的門檻', /if\(a<([\d.]+)\) return "两端之间"/);
      probe(src, '明顯偏／稍偏', /\(a>=EXTREME\?"明显偏":"稍偏"\)/);
      return {
        options: optionsFromOpts(src),
        sections: sectionsOfStrings(src, 'SECS'),
        // 不分級（附錄 D）。這三段是 |均分 − 2.5| 的偏向程度，只進報告的氣質段落（§5.3 profile）。
        tiers: [
          { tier: 1, key: '两端之间', max: num(slight) },
          { tier: 2, key: '稍偏', min: num(slight), max: extreme },
          { tier: 3, key: '明显偏', min: extreme },
        ],
        preQuestions: [],
      };
    },
  })),
];

// ---------------------------------------------------------------------------
// 入口
// ---------------------------------------------------------------------------

export function extractToolkit(zip: Map<string, Buffer>): ToolkitBank[] {
  const ids = new Set<string>();
  return RECIPES.map(recipe => {
    if (ids.has(recipe.id)) throw new Error(`配方重複：${recipe.id}`);
    ids.add(recipe.id);
    const src = loadSource(zip, recipe.file);
    const built = recipe.build(src);
    return {
      id: recipe.id,
      code: recipe.code,
      title: h1Title(src),
      source: { file: recipe.file, sha256: sha256(zip.get(KIT_ROOT + recipe.file)!) },
      ...built,
    };
  });
}
