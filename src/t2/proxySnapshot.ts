/**
 * 推薦人代填（客戶 10/22，規格三「代填」，issue #112）：治療師已經清楚孩子狀況，不讓家長重做評估 ——
 * 在後台填孩子資料、九個方面選紅黃綠、勾 ★ 標籤、選方案長度，家長登入就直接有居家訓練。
 *
 * 這一檔是純函式：讀後台送來的那一包（`readProxyInput`），組成「代填」快照（`proxyFindings`）——紅黃綠當作 T2 分級
 * （refer／watch／clear）、勾的標籤當發現標籤，推送規則與每週活動一行不動。
 */
import { calculateAgeMonth } from '../utils/dateUtils';
import { ACTIVITY_TAGS, tagDimension, type ActivityTag } from './findingTags';
import { PROXY_TOOLKIT } from './snapshotKinds';
import { isPassMonths, type PassMonths } from './trainingPass';
import { DIMENSION_CODES, type DimensionCode, type T1Flag, type T2Findings } from './types';

export type ProxyColor = 'red' | 'yellow' | 'green';

export interface ProxyInput {
  phone: string;
  child: { name: string; birthDate: string; gender: 'boy' | 'girl' };
  colors: Record<DimensionCode, ProxyColor>;
  tags: ActivityTag[];
  months: PassMonths;
}

export const PROXY_RULES_VERSION = 'proxy-1';

const ACTIVITY_TAG_SET: ReadonlySet<string> = new Set(ACTIVITY_TAGS);

/** 九個維度在標籤前綴上的寫法（`lang.comprehension` 的 `lang`）。 */
export const TAG_PREFIX_OF: Record<DimensionCode, string> = {
  COG: 'cog', LANG: 'lang', SOC: 'soc', EMO: 'emo', ATT: 'att', MOT: 'mot', SEN: 'sen', ADL: 'adl', LEARN: 'learn',
};

/** 後台送來的那一包 → 代填的輸入；不對回錯誤訊息（給推薦人看的中文）。 */
export function readProxyInput(body: unknown, now: Date = new Date()): ProxyInput | { error: string } {
  const b = typeof body === 'object' && body !== null ? (body as Record<string, unknown>) : {};
  const phone = typeof b.phone === 'string' ? b.phone.trim() : '';
  if (!/^1\d{10}$/.test(phone)) return { error: '请填写 11 位手机号。' };
  const c = typeof b.child === 'object' && b.child !== null ? (b.child as Record<string, unknown>) : {};
  const name = typeof c.name === 'string' ? c.name.trim() : '';
  if (!name || name.length > 20) return { error: '请填写孩子的姓名（20 字以内）。' };
  const birthDate = typeof c.birthDate === 'string' ? c.birthDate.trim() : '';
  const age = /^\d{4}-\d{2}-\d{2}$/.test(birthDate) ? calculateAgeMonth(birthDate, now) : null;
  if (age === null || age < 0 || age > 216) return { error: '出生日期不对（要是 0–18 岁之间的日期）。' };
  const gender = c.gender === 'boy' || c.gender === 'girl' ? c.gender : null;
  if (!gender) return { error: '请选择性别。' };
  const rawColors = typeof b.colors === 'object' && b.colors !== null ? (b.colors as Record<string, unknown>) : {};
  const colors = {} as Record<DimensionCode, ProxyColor>;
  for (const d of DIMENSION_CODES) {
    const v = rawColors[d];
    if (v !== 'red' && v !== 'yellow' && v !== 'green') return { error: '九个方面都要选红、黄或绿。' };
    colors[d] = v;
  }
  const rawTags = Array.isArray(b.tags) ? b.tags : [];
  if (rawTags.length > 60 || rawTags.some(t => typeof t !== 'string' || !ACTIVITY_TAG_SET.has(t))) {
    return { error: '标签只能从清单里勾。' };
  }
  if (!isPassMonths(b.months)) return { error: '方案只有 1、3、6 个月。' };
  return { phone, child: { name, birthDate, gender }, colors, tags: [...new Set(rawTags as ActivityTag[])], months: b.months };
}

const BAND_OF: Record<ProxyColor, 'refer' | 'watch' | 'clear'> = { red: 'refer', yellow: 'watch', green: 'clear' };
const FLAG_OF: Record<ProxyColor, T1Flag> = { red: 2, yellow: 1, green: 0 };

/** 代填的快照：紅黃綠＝T2 分級；勾的標籤放進它那個維度（綠的維度也收，推送規則自己會決定用不用）。 */
export function proxyFindings(input: { colors: Record<DimensionCode, ProxyColor>; tags: ReadonlyArray<ActivityTag>; ageMonth: number; sex: 'boy' | 'girl'; now: Date }): T2Findings {
  return {
    version: 3,
    toolkitVersion: PROXY_TOOLKIT,
    rulesVersion: PROXY_RULES_VERSION,
    child: { assessedAgeMonth: input.ageMonth, sex: input.sex },
    t1: Object.fromEntries(DIMENSION_CODES.map(d => [d, FLAG_OF[input.colors[d]]])) as Record<DimensionCode, T1Flag>,
    diagnosisDirection: null,
    dimensions: DIMENSION_CODES.map(d => ({
      dimensionId: d,
      band: BAND_OF[input.colors[d]],
      drivenBy: null,
      tags: input.tags.filter(t => tagDimension(t) === TAG_PREFIX_OF[d]),
      caveats: [],
      tools: [],
      t1Flag: FLAG_OF[input.colors[d]],
    })),
    toolResults: [],
    computedAt: input.now.toISOString(),
  };
}
