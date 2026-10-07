/**
 * 完整版題庫的逐支作答（T2 v3 題庫規格 §8 R3h）：畫面要的表單與作答狀態，純函式。
 *
 * 與 9/08 那一套（`answering.ts`）同一個規矩：題目、選項、段名全部從題庫來（`askedItems`／`formFor`，與伺服器驗卷是
 * 同一份），這一檔與畫面元件**不手抄任何一題**；這一檔自己寫的字（年級名稱）進用字掃描。題庫檔本身是客戶的原文，
 * 不進掃描（`test/parentWording.structure.test.ts` 檔頭）。
 *
 * 比舊的多的幾件事：每一段有自己的選項組（「不确定」「未观察到」「不适用」是 `null`）、題目可以帶自己的錨點
 *（ASR 四條、TIC 六條）、整段「无法观察」（ATT）、學障兩支的年級（家長可改）。
 */

import { askedItems, defaultGrade, formFor, scoreKitV3, type LdScoring, type ScoreContext } from './kitv3/score';
import type { KitV3Bank, KitV3Option } from './kitv3/types';

export type V3Answers = Record<string, number | null>;

export interface V3FormItem {
  key: string;
  text: string;
  hint?: string;
  /** 這一題自己的選項說明（依選項組的順序）；有就用它當選項本體。 */
  anchors?: string[];
}

export interface V3FormSection {
  key: string;
  /** 段名（未滿某月齡時換學前的名稱）。 */
  name: string;
  options: KitV3Option[];
  items: V3FormItem[];
  /** 可以整段勾「无法观察」時的那句話。 */
  naLabel?: string;
  /** 選答的一段（不答不算缺）。 */
  optional: boolean;
}

export interface V3Form {
  code: string;
  title: string;
  sections: V3FormSection[];
  /** 學障兩支：這次用的年級與可選範圍；其他工具是 `null`。 */
  grade: { value: number; range: [number, number] } | null;
}

/** 年級的名稱（1＝一年級 … 12＝高三），學障兩支的年級選單用。 */
export const GRADE_LABELS: Readonly<Record<number, string>> = {
  1: '一年级', 2: '二年级', 3: '三年级', 4: '四年级', 5: '五年级', 6: '六年级',
  7: '初一', 8: '初二', 9: '初三', 10: '高一', 11: '高二', 12: '高三',
};

/** 這一支在這個情境下的表單：只含這次有題的段，順序照題庫。 */
export function formV3(bank: KitV3Bank, ctx: ScoreContext): V3Form {
  const grade = bank.family === 'ld'
    ? (() => {
        const range = (bank.scoring as LdScoring).gradeRange;
        return { value: ctx.grade ?? defaultGrade(ctx.ageM, range), range };
      })()
    : null;
  const effective: ScoreContext = grade ? { ...ctx, grade: grade.value } : ctx;
  const form = formFor(bank, ctx.ageM);
  const asked = askedItems(bank, effective);
  const sections: V3FormSection[] = [];
  for (const sec of form.sections) {
    const items = asked.filter(a => a.section === sec.key).map(a => ({
      key: a.item.key,
      text: a.item.text,
      ...(a.item.hint ? { hint: a.item.hint } : {}),
      ...(a.item.anchors ? { anchors: a.item.anchors } : {}),
    }));
    if (items.length === 0) continue;
    sections.push({
      key: sec.key,
      name: sec.preName && ctx.ageM < sec.preName.belowM ? sec.preName.name : sec.name,
      options: bank.options[sec.options],
      items,
      ...(sec.naLabel ? { naLabel: sec.naLabel } : {}),
      optional: sec.optional === true,
    });
  }
  return { code: bank.code, title: bank.title, sections, grade };
}

/** 這一段勾了「无法观察」沒有。 */
export function isNa(answers: V3Answers, sectionKey: string): boolean {
  return answers[`${sectionKey}.na`] === 1;
}

/** 勾／取消「无法观察」：勾了就把那一段已答的清掉（伺服器不收那一段的題）。 */
export function setNa(answers: V3Answers, section: Pick<V3FormSection, 'key' | 'items'>, on: boolean): V3Answers {
  const out: V3Answers = { ...answers };
  if (on) {
    for (const it of section.items) delete out[it.key];
    out[`${section.key}.na`] = 1;
  } else {
    delete out[`${section.key}.na`];
  }
  return out;
}

/** 還沒答的題（伺服器交卷時擋的同一份）。 */
export function missingV3(bank: KitV3Bank, ctx: ScoreContext, answers: V3Answers): string[] {
  return scoreKitV3(bank, answers, ctx).missing;
}

/** 換年級：題目跟著換，只留新年級也有出的題的答案（伺服器不收這次沒出的題）。 */
export function keepAnswersFor(form: V3Form, answers: V3Answers): V3Answers {
  const keys = new Set(form.sections.flatMap(s => [...s.items.map(i => i.key), `${s.key}.na`]));
  return Object.fromEntries(Object.entries(answers).filter(([k]) => keys.has(k)));
}
