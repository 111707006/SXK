import type { ReactNode } from 'react';
import { WORDING_1022 } from '../wording1022';
import {
  GESTATION_FULL_TERM,
  HEARING_QUESTION,
  NO,
  SCHOOL_QUESTION,
  TIC_QUESTION,
  YES,
} from '../t2/recommend/childFieldsCopy';
import { supplementMissing, type SupplementAnswers } from '../utils/t1Supplement';

/**
 * T1 最後一步「补充资料」（issue #83，`VITE_UI_1022`）：九個方面之後、生成報告之前。
 * 受控元件：答案由 `T1Screening` 持有，必填與寫回的規則在 `src/utils/t1Supplement.ts`。
 */

const pill = (on: boolean) =>
  `rounded-full border-[1.5px] px-3.5 py-2 text-[13px] font-bold transition cursor-pointer ${
    on ? 'border-ledo-accent bg-ledo-accent text-white' : 'border-ledo-line bg-white text-ledo-ink'
  }`;

function Question({ title, required, children }: { title: string; required: boolean; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <p className="text-sm font-bold leading-relaxed text-ledo-ink">
        {title}
        <span className={`ml-1.5 rounded-full px-2 py-0.5 text-xs font-bold ${required ? 'bg-ledo-more text-ledo-more-ink' : 'bg-ledo-field text-ledo-ink-2'}`}>
          {required ? WORDING_1022.supplement.required : WORDING_1022.supplement.optional}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">{children}</div>
    </div>
  );
}

export default function T1SupplementStep({ value, onChange, onBack, onSubmit }: {
  value: SupplementAnswers;
  onChange: (next: SupplementAnswers) => void;
  onBack: () => void;
  onSubmit: () => void;
}) {
  const missing = supplementMissing(value);
  const unknown = WORDING_1022.supplement.unknown;

  return (
    <div id="t1-supplement" className="mx-auto w-full max-w-xl space-y-5 rounded-[32px] bg-white p-4 text-left shadow-[0_22px_50px_-28px_rgba(36,51,44,0.45)] sm:p-6">
      <div className="space-y-1">
        <b className="text-lg font-black text-ledo-ink">{WORDING_1022.supplement.title}</b>
        <p className="text-xs leading-relaxed text-ledo-ink-2">{WORDING_1022.supplement.sub}</p>
      </div>

      <Question title={WORDING_1022.supplement.gestationQuestion} required>
        <select
          id="t1-supplement-gestation"
          aria-label={WORDING_1022.supplement.gestationQuestion}
          value={value.gestation === undefined ? '' : String(value.gestation)}
          onChange={e => onChange({ ...value, gestation: e.target.value === '' ? undefined : e.target.value === 'term' ? 'term' : Number(e.target.value) })}
          className="w-full rounded-[18px] border-[1.5px] border-ledo-line bg-white px-3.5 py-2.5 text-[14px] font-bold text-ledo-ink"
        >
          <option value="">请选择</option>
          <option value="term">{GESTATION_FULL_TERM}</option>
          {Array.from({ length: 13 }, (_, i) => 24 + i).map(w => (
            <option key={w} value={w}>{`${w} 周`}</option>
          ))}
        </select>
      </Question>

      <Question title={TIC_QUESTION} required>
        {([[true, YES], [false, NO], ['unknown', unknown]] as const).map(([v, label]) => (
          <button key={label} type="button" id={`t1-supplement-tics-${String(v)}`} className={pill(value.tics === v)} onClick={() => onChange({ ...value, tics: v })}>{label}</button>
        ))}
      </Question>

      <Question title={HEARING_QUESTION} required>
        {([[true, '做过'], [false, '没做过'], ['unknown', unknown]] as const).map(([v, label]) => (
          <button key={label} type="button" id={`t1-supplement-hearing-${String(v)}`} className={pill(value.hearing === v)} onClick={() => onChange({ ...value, hearing: v })}>{label}</button>
        ))}
      </Question>

      <Question title={SCHOOL_QUESTION} required={false}>
        {([[true, YES], [false, NO]] as const).map(([v, label]) => (
          <button key={label} type="button" className={pill(value.inSchool === v)} onClick={() => onChange({ ...value, inSchool: value.inSchool === v ? undefined : v })}>{label}</button>
        ))}
      </Question>

      {/* 診斷那一題拿掉（使用者 2026-10-27：「不影響的話就刪了」）：推薦每個方面只出一份、不看診斷（ADR-0011），答了也不改任何結果。 */}

      {missing.length > 0 && <p className="text-xs font-bold text-ledo-more-ink">{WORDING_1022.supplement.missing}</p>}

      <div className="grid grid-cols-2 gap-2.5">
        <button type="button" onClick={onBack} className="rounded-full bg-ledo-accent-soft py-3.5 text-sm font-black text-ledo-accent-soft-ink cursor-pointer">
          上一题
        </button>
        <button type="button" id="t1-supplement-submit" disabled={missing.length > 0} onClick={onSubmit}
          className="rounded-full bg-ledo-bar py-3.5 text-sm font-black text-white disabled:opacity-40 cursor-pointer disabled:cursor-default">
          {WORDING_1022.buttons.generateReport}
        </button>
      </div>
    </div>
  );
}
