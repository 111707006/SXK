/**
 * 活動的影片導引腳本（`ActivityGuide`，Keep 規格 §4.2）怎麼讀 —— 純函式，不碰 React、不碰資料庫。
 *
 * 兩個讀法，與分解步驟同一個分工（`activitySteps.ts` 的 `readSteps` 對 `src/db/activities.ts`
 * 的 `parseSteps`）：
 *
 * - `guideFromStored`：**從資料庫讀回來的**。只看形狀，不看長度上限；形狀不對就當沒有腳本
 *   （`null`），不拋例外 —— 一支活動的腳本存壞，不該讓整個活動庫讀不出來。
 * - `readGuide`：**後台送上來的**。形狀、長度上限都驗，讀不出來就說是哪一段不對。
 *
 * 兩者吐出來的物件都經過 `normalizeGuide`：鍵的順序固定、「準備」照 `GUIDE_PREP_KEYS` 排。
 * 這不是美觀問題：後台存檔前用 JSON 比對「改過沒有」（`changedFields`），而 MySQL 的 JSON
 * 物件不保留鍵的順序 —— 兩邊不先排成同一個順序，沒改過的腳本也會被當成改過、整份重寫一次。
 */
import { GUIDE_PREP_KEYS } from '../t2/types';
import type { ActivityGuide, GuidePrepKey } from '../t2/types';

/** 一段文字的上限。客戶腳本最長的一段不到七十字；超過一千字多半是整份貼進了一格。 */
export const MAX_GUIDE_TEXT = 1000;
/** 原理、常做錯、進步指標、分鏡、孩子的反應，各自最多幾則。客戶的腳本是 8–9／3／3／6／3。 */
export const MAX_GUIDE_ITEMS = 20;

export type GuideResult = { ok: true; guide: ActivityGuide } | { ok: false; error: string };

/** 單段文字的五段、清單的三段（分鏡與反應是物件的清單，另外處理）。 */
const TEXT_KEYS = ['length', 'intro', 'down', 'up', 'outro'] as const;
const LIST_KEYS = ['principles', 'mistakes', 'progress'] as const;

const isString = (v: unknown): v is string => typeof v === 'string';
const isRecord = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);

/** 鍵的順序固定、「準備」照 `GUIDE_PREP_KEYS` 排、不認得的鍵丟掉。 */
export function normalizeGuide(g: ActivityGuide): ActivityGuide {
  const prep: Partial<Record<GuidePrepKey, string>> = {};
  for (const key of GUIDE_PREP_KEYS) {
    const value = g.prep[key];
    if (typeof value === 'string') prep[key] = value;
  }
  return {
    length: g.length,
    intro: g.intro,
    principles: [...g.principles],
    prep,
    shots: g.shots.map(s => ({ name: s.name, say: s.say })),
    reactions: g.reactions.map(r => ({ if: r.if, then: r.then })),
    mistakes: [...g.mistakes],
    down: g.down,
    up: g.up,
    progress: [...g.progress],
    outro: g.outro,
  };
}

// ══════════════════════════════════════════════
// 後台送上來的：形狀與上限都驗
// ══════════════════════════════════════════════

/** 每一段在後台畫面上的名稱。錯誤訊息用它說「是哪一段不對」。 */
export const GUIDE_SECTION_NAMES: Readonly<Record<keyof ActivityGuide, string>> = {
  length: '片长',
  intro: '片头旁白',
  principles: '原理',
  prep: '准备',
  shots: '分镜',
  reactions: '孩子的反应',
  mistakes: '常做错',
  down: '降一阶',
  up: '升一阶',
  progress: '怎么看出有进步',
  outro: '收尾旁白',
};

class GuideError extends Error {}

/**
 * 一段文字：修掉前後空白，可以是空的（畫面就不顯示那一段）。`where` 是完整的位置說法，
 * 「的「片长」」「的「原理」第 2 则」，錯誤訊息接在「脚本」後面。
 */
function readText(raw: unknown, where: string): string {
  if (typeof raw !== 'string') throw new GuideError(`脚本${where}必须是文字。`);
  const text = raw.trim();
  if (text.length > MAX_GUIDE_TEXT) throw new GuideError(`脚本${where}最多 ${MAX_GUIDE_TEXT} 字，目前有 ${text.length} 字。`);
  return text;
}

/** 清單裡的一則必須有字 —— 一則空白的原理、空白的進步指標，家長那邊是一個空的圓點。 */
function readItem(raw: unknown, where: string): string {
  const text = readText(raw, where);
  if (!text) throw new GuideError(`脚本${where}是空的。`);
  return text;
}

function readList<T>(raw: unknown, key: keyof ActivityGuide, readOne: (item: unknown, where: string) => T): T[] {
  const name = GUIDE_SECTION_NAMES[key];
  if (!Array.isArray(raw)) throw new GuideError(`脚本的「${name}」必须是一个阵列。`);
  if (raw.length > MAX_GUIDE_ITEMS) throw new GuideError(`脚本的「${name}」最多 ${MAX_GUIDE_ITEMS} 则，目前有 ${raw.length} 则。`);
  return raw.map((item, k) => readOne(item, `的「${name}」第 ${k + 1} 则`));
}

/**
 * 後台送上來的一份腳本。**整份**：少了哪一段、哪一段型別不對、超過上限，都整份退回並說出是哪一段。
 * 單段文字（片長、旁白、降一階……）可以清空；清單裡的每一則、分鏡的名稱、反應的兩半必須有字。
 * 分鏡的旁白可以空：客戶腳本有不出聲的鏡頭（總冊 A121 鏡頭二等 18 處），畫面上那一格不列（`shots.filter(s => s.say)`）。
 * 「準備」只認 `GUIDE_PREP_KEYS` 那四項，可以少、不能多。不認得的段落略過（`normalizeGuide`）。
 */
export function readGuide(raw: unknown): GuideResult {
  try {
    if (!isRecord(raw)) throw new GuideError('脚本的格式不对。');
    const text = (key: (typeof TEXT_KEYS)[number]) => readText(raw[key], `的「${GUIDE_SECTION_NAMES[key]}」`);
    const lines = (key: (typeof LIST_KEYS)[number]) => readList(raw[key], key, readItem);

    if (!isRecord(raw.prep)) throw new GuideError('脚本的「准备」格式不对。');
    const prep: Partial<Record<GuidePrepKey, string>> = {};
    for (const [key, value] of Object.entries(raw.prep)) {
      if (!(GUIDE_PREP_KEYS as ReadonlyArray<string>).includes(key)) {
        throw new GuideError(`脚本的「准备」只收${GUIDE_PREP_KEYS.map(k => `「${k}」`).join('')}，没有「${key}」这一项。`);
      }
      prep[key as GuidePrepKey] = readItem(value, `的「准备·${key}」`);
    }

    const shots = readList(raw.shots, 'shots', (item, where) => {
      if (!isRecord(item)) throw new GuideError(`脚本${where}要有名称与旁白。`);
      return { name: readItem(item.name, `${where}的名称`), say: readText(item.say, `${where}的旁白`) };
    });
    const reactions = readList(raw.reactions, 'reactions', (item, where) => {
      if (!isRecord(item)) throw new GuideError(`脚本${where}要有「如果」与「怎么做」。`);
      return { if: readItem(item.if, `${where}的「如果」`), then: readItem(item.then, `${where}的「怎么做」`) };
    });

    return {
      ok: true,
      guide: normalizeGuide({
        length: text('length'),
        intro: text('intro'),
        principles: lines('principles'),
        prep,
        shots,
        reactions,
        mistakes: lines('mistakes'),
        down: text('down'),
        up: text('up'),
        progress: lines('progress'),
        outro: text('outro'),
      }),
    };
  } catch (err) {
    if (err instanceof GuideError) return { ok: false, error: err.message };
    throw err;
  }
}

// ══════════════════════════════════════════════
// 後台編輯畫面的草稿
// ══════════════════════════════════════════════

/**
 * 後台編輯畫面（`ActivitiesPanel.tsx`）裡的一份腳本：原理、常做錯、進步指標是「一行一條」的
 * 文字框，準備是固定四格（沒有的那一項是空字串），分鏡與反應是一列一列的輸入框。
 */
export interface GuideDraft {
  length: string;
  intro: string;
  principles: string;
  prep: Record<GuidePrepKey, string>;
  shots: Array<{ name: string; say: string }>;
  reactions: Array<{ if: string; then: string }>;
  mistakes: string;
  down: string;
  up: string;
  progress: string;
  outro: string;
}

const toLines = (items: ReadonlyArray<string>) => items.join('\n');
const fromLines = (text: string) => text.split('\n').map(s => s.trim()).filter(Boolean);

export function guideToDraft(g: ActivityGuide): GuideDraft {
  const prep = Object.fromEntries(GUIDE_PREP_KEYS.map(k => [k, g.prep[k] ?? ''])) as Record<GuidePrepKey, string>;
  return {
    length: g.length,
    intro: g.intro,
    principles: toLines(g.principles),
    prep,
    shots: g.shots.map(s => ({ name: s.name, say: s.say })),
    reactions: g.reactions.map(r => ({ if: r.if, then: r.then })),
    mistakes: toLines(g.mistakes),
    down: g.down,
    up: g.up,
    progress: toLines(g.progress),
    outro: g.outro,
  };
}

/**
 * 草稿 → 腳本，經過 `normalizeGuide`：鍵的順序與伺服器給的那一份（`guideFromStored`）相同，
 * `changedFields` 用 JSON 比對才比得準 —— 開了不改，什麼都不送。
 *
 * 清單的空行、整列空白的分鏡或反應直接丟掉（那是畫面上多按了一次「加一列」）；只填一半的留著，
 * 讓伺服器（`readGuide`）說出是第幾則少了什麼 —— 在這裡丟掉，打了一半的字就無聲無息地不見了。
 */
export function guideFromDraft(d: GuideDraft): ActivityGuide {
  const prep: Partial<Record<GuidePrepKey, string>> = {};
  for (const k of GUIDE_PREP_KEYS) {
    const value = d.prep[k].trim();
    if (value) prep[k] = value;
  }
  return normalizeGuide({
    length: d.length.trim(),
    intro: d.intro.trim(),
    principles: fromLines(d.principles),
    prep,
    shots: d.shots.map(s => ({ name: s.name.trim(), say: s.say.trim() })).filter(s => s.name || s.say),
    reactions: d.reactions.map(r => ({ if: r.if.trim(), then: r.then.trim() })).filter(r => r.if || r.then),
    mistakes: fromLines(d.mistakes),
    down: d.down.trim(),
    up: d.up.trim(),
    progress: fromLines(d.progress),
    outro: d.outro.trim(),
  });
}

// ══════════════════════════════════════════════
// 從資料庫讀回來的：只看形狀
// ══════════════════════════════════════════════

/**
 * `guide` 欄位 → 腳本。`NULL`、壞掉的 JSON、形狀不對，都回 `null`（檔頭）。
 * mysql2 對 JSON 欄位會先解析成物件；手動下 SQL 或替身給的可能還是字串，兩種都收。
 */
export function guideFromStored(raw: unknown): ActivityGuide | null {
  let value: unknown = raw;
  if (typeof raw === 'string') {
    try {
      value = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!isRecord(value)) return null;
  for (const key of TEXT_KEYS) if (!isString(value[key])) return null;
  for (const key of LIST_KEYS) {
    const list = value[key];
    if (!Array.isArray(list) || !list.every(isString)) return null;
  }
  if (!isRecord(value.prep) || !Object.values(value.prep).every(isString)) return null;
  const { shots, reactions } = value;
  if (!Array.isArray(shots) || !shots.every(s => isRecord(s) && isString(s.name) && isString(s.say))) return null;
  if (!Array.isArray(reactions) || !reactions.every(r => isRecord(r) && isString(r.if) && isString(r.then))) return null;
  return normalizeGuide(value as unknown as ActivityGuide);
}
