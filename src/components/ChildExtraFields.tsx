/**
 * 孩子資料的「补充资料（选填）」（T2 v3 推薦規格 §2.1）：診斷（最多兩個）、上學、抽動、聽力檢查、孕週。
 * 只在有深度評估的產品（專案 A）出現；字都在 `src/t2/recommend/childFieldsCopy.ts`。
 * 受控元件：值與改法由建檔表單／編輯檔案彈窗持有，存進 `Child` 的選填欄位。
 */
import type { Child } from '../types';
import type { DxCode } from '../t2/recommend/types';
import {
  DX_NONE,
  DX_OPTIONS,
  DX_PURPOSE,
  DX_QUESTION,
  EXTRA_SUB,
  EXTRA_TITLE,
  GESTATION_FULL_TERM,
  GESTATION_QUESTION,
  HEARING_OPTIONS,
  HEARING_QUESTION,
  NO,
  SCHOOL_QUESTION,
  TIC_QUESTION,
  YES,
} from '../t2/recommend/childFieldsCopy';

export type ChildExtras = Pick<Child, 'diagnoses' | 'inSchool' | 'hasTics' | 'hearingChecked' | 'gestationWeeks'>;

export function extrasOf(child: Child | null | undefined): ChildExtras {
  return {
    diagnoses: child?.diagnoses ?? [],
    inSchool: child?.inSchool,
    hasTics: child?.hasTics,
    hearingChecked: child?.hearingChecked ?? null,
    gestationWeeks: child?.gestationWeeks ?? null,
  };
}

const chip = (on: boolean) =>
  `px-3 py-1.5 rounded-full border text-[12px] transition cursor-pointer ${
    on ? 'border-brand-clay bg-brand-sand/60 text-brand-forest font-semibold' : 'border-brand-stone/40 bg-white text-brand-charcoal/70'
  }`;

function YesNo({ value, onChange, name }: { value: boolean | undefined; onChange: (v: boolean) => void; name: string }) {
  return (
    <div className="flex gap-2" role="radiogroup" aria-label={name}>
      <button type="button" className={chip(value === true)} onClick={() => onChange(true)}>{YES}</button>
      <button type="button" className={chip(value === false)} onClick={() => onChange(false)}>{NO}</button>
    </div>
  );
}

type Dx = Exclude<DxCode, 'NONE'>;

/** 點一下診斷：已選就取消；最多兩個，第一個是主診斷 —— 已有兩個時換掉第二個，主診斷不動。 */
export function toggleDiagnosis(dx: readonly Dx[], d: Dx): Dx[] {
  if (dx.includes(d)) return dx.filter(x => x !== d);
  return dx.length >= 2 ? [dx[0], d] : [...dx, d];
}

export default function ChildExtraFields({ value, onChange }: { value: ChildExtras; onChange: (next: ChildExtras) => void }) {
  return (
    <fieldset className="space-y-4 text-left rounded-2xl border border-brand-stone/40 bg-brand-cream/30 p-4" data-testid="child-extra-fields">
      <legend className="px-1 text-xs font-semibold text-brand-charcoal">{EXTRA_TITLE}</legend>
      <p className="text-[11px] text-brand-charcoal/60 leading-relaxed">{EXTRA_SUB}</p>

      {/* 診斷那一題 2026-10-08 拿掉（ADR-0011：診斷不進推薦）；以前存下的 `diagnoses` 留在資料裡、不再讀 */}
      <div className="space-y-2">
        <p className="text-[12px] text-brand-charcoal">{SCHOOL_QUESTION}</p>
        <YesNo name={SCHOOL_QUESTION} value={value.inSchool} onChange={v => onChange({ ...value, inSchool: v })} />
      </div>

      <div className="space-y-2">
        <p className="text-[12px] text-brand-charcoal">{TIC_QUESTION}</p>
        <YesNo name={TIC_QUESTION} value={value.hasTics} onChange={v => onChange({ ...value, hasTics: v })} />
      </div>

      <div className="space-y-2">
        <p className="text-[12px] text-brand-charcoal">{HEARING_QUESTION}</p>
        <div className="flex gap-2">
          {HEARING_OPTIONS.map(o => (
            <button key={o.label} type="button" className={chip((value.hearingChecked ?? null) === o.value)} onClick={() => onChange({ ...value, hearingChecked: o.value })}>
              {o.label}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <label className="text-[12px] text-brand-charcoal block" htmlFor="gestation-weeks">{GESTATION_QUESTION}</label>
        <select
          id="gestation-weeks"
          value={value.gestationWeeks ?? ''}
          onChange={e => onChange({ ...value, gestationWeeks: e.target.value === '' ? null : Number(e.target.value) })}
          className="w-full rounded-xl border border-brand-stone/40 bg-white px-3 py-2 text-[13px]"
        >
          <option value="">{GESTATION_FULL_TERM}</option>
          {Array.from({ length: 13 }, (_, i) => 24 + i).map(w => (
            <option key={w} value={w}>{`${w} 周`}</option>
          ))}
        </select>
      </div>
    </fieldset>
  );
}
