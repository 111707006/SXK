/**
 * 推薦人「代填」（客戶 10/22，#112）：治療師已經清楚孩子狀況 —— 輸入家長手機號、孩子姓名生日性別，
 * 九個方面選紅黃綠、勾 ★ 標籤（中文短名）、選方案長度，送出。家長用那支手機號登入就直接有居家訓練。
 * 別的推薦人名下的家長不能代填；再代填一次覆蓋成新的結果、不再扣碼。
 */
import { useState } from 'react';
import { adminApi, AdminApiError } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import { FINDING_TAG_LABELS } from '../findingTagLabels';
import { ACTIVITY_TAGS, tagDimension, type ActivityTag } from '../../t2/findingTags';
import { SITE_DIMENSION_NAME } from '../../t2/dimensionMap';
import { TAG_PREFIX_OF, type ProxyColor } from '../../t2/proxySnapshot';
import { DIMENSION_CODES, type DimensionCode } from '../../t2/types';
import { Button, Field, Panel, Select, TextInput } from '../ui';

const COLOR_LABEL: Record<ProxyColor, string> = { red: '红', yellow: '黄', green: '绿' };
const COLOR_CLASS: Record<ProxyColor, string> = {
  red: 'border-rose-300 bg-rose-50 text-rose-800',
  yellow: 'border-amber-300 bg-amber-50 text-amber-800',
  green: 'border-emerald-300 bg-emerald-50 text-emerald-800',
};

const tagsOf = (d: DimensionCode) => ACTIVITY_TAGS.filter(t => tagDimension(t) === TAG_PREFIX_OF[d]);

export default function ProxyPanel({ onError }: { onError: (view: AdminErrorView) => void }) {
  const [phone, setPhone] = useState('');
  const [stage, setStage] = useState<'lookup' | 'form' | 'done'>('lookup');
  const [lookupNote, setLookupNote] = useState<string | null>(null);
  const [child, setChild] = useState({ name: '', birthDate: '', gender: 'boy' as 'boy' | 'girl' });
  const [colors, setColors] = useState<Partial<Record<DimensionCode, ProxyColor>>>({});
  const [tags, setTags] = useState<Set<ActivityTag>>(new Set());
  const [months, setMonths] = useState<1 | 3 | 6>(3);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [doneNote, setDoneNote] = useState<string | null>(null);

  async function lookup(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const found = await adminApi.proxyLookup(phone.trim());
      if (found.status === 'new') setLookupNote('这支手机号还没有帐号，送出时会为家长建一个。');
      else setLookupNote(found.status === 'mine' ? '这位家长已在你名下，再代填会覆盖成新的结果，不再扣码。' : '这位家长还没有推荐人，代填后会绑到你名下。');
      if ('child' in found && found.child) setChild({ name: found.child.name, birthDate: found.child.birthDate, gender: found.child.gender === 'girl' ? 'girl' : 'boy' });
      setStage('form');
    } catch (err) {
      if (err instanceof AdminApiError && err.status === 409) setError(err.message);
      else if (err instanceof AdminApiError && err.status >= 500) onError({ message: err.message, action: 'none' });
      else setError(err instanceof Error ? err.message : '查询失败。');
    } finally {
      setBusy(false);
    }
  }

  async function submit() {
    setBusy(true);
    setError(null);
    try {
      const result = await adminApi.proxyFill({ phone: phone.trim(), child, colors, tags: [...tags], months });
      setDoneNote(result.consumedCode ? '已代填，用掉你一组兑换码。家长用这支手机号登入就能开始居家训练。' : '已更新代填的结果（没有再扣码）。');
      setStage('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : '代填失败。');
    } finally {
      setBusy(false);
    }
  }

  const allColored = DIMENSION_CODES.every(d => colors[d]);
  const toggleTag = (t: ActivityTag) => setTags(prev => {
    const next = new Set(prev);
    if (next.has(t)) next.delete(t);
    else next.add(t);
    return next;
  });

  if (stage === 'done') {
    return (
      <Panel title="代填">
        <p className="text-xs font-bold text-brand-forest">{doneNote}</p>
        <Button className="mt-3" variant="ghost" onClick={() => { setStage('lookup'); setPhone(''); setColors({}); setTags(new Set()); setChild({ name: '', birthDate: '', gender: 'boy' }); setLookupNote(null); }}>再代填一位</Button>
      </Panel>
    );
  }

  return (
    <Panel title="代填" description="不让家长重做评估：你给的红黄绿与勾的标签，就是安排每周家庭活动的依据。家长看到的结果会标「由治疗师填写」。">
      <form onSubmit={lookup} className="flex flex-wrap items-end gap-2">
        <Field label="家长手机号"><TextInput value={phone} onChange={e => { setPhone(e.target.value); setStage('lookup'); }} inputMode="numeric" maxLength={11} /></Field>
        <Button type="submit" busy={busy && stage === 'lookup'} disabled={!/^1\d{10}$/.test(phone.trim())}>查找家长</Button>
      </form>
      {error && <p className="mt-2 text-xs font-bold text-red-700">{error}</p>}
      {stage === 'form' && (
        <div className="mt-4 space-y-4">
          {lookupNote && <p className="text-[11px] text-brand-charcoal/70">{lookupNote}</p>}
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="孩子姓名"><TextInput value={child.name} onChange={e => setChild({ ...child, name: e.target.value })} maxLength={20} /></Field>
            <Field label="出生日期"><TextInput type="date" value={child.birthDate} onChange={e => setChild({ ...child, birthDate: e.target.value })} /></Field>
            <Field label="性别">
              <Select value={child.gender} onChange={e => setChild({ ...child, gender: e.target.value as 'boy' | 'girl' })}>
                <option value="boy">男</option>
                <option value="girl">女</option>
              </Select>
            </Field>
          </div>
          <ul className="space-y-3">
            {DIMENSION_CODES.map(d => (
              <li key={d} id={`proxy-dim-${d}`} className="rounded-2xl border border-brand-stone/60 p-3 space-y-2">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="w-28 text-xs font-bold text-brand-forest">{SITE_DIMENSION_NAME[d]}</span>
                  {(['red', 'yellow', 'green'] as const).map(c => (
                    <button key={c} type="button" onClick={() => setColors({ ...colors, [d]: c })}
                      className={`rounded-full border px-3 py-1 text-xs font-bold cursor-pointer ${colors[d] === c ? COLOR_CLASS[c] : 'border-brand-stone bg-white text-brand-charcoal/60'}`}>
                      {COLOR_LABEL[c]}
                    </button>
                  ))}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {tagsOf(d).map(t => (
                    <label key={t} className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] cursor-pointer ${tags.has(t) ? 'border-brand-moss bg-brand-sage/40 text-brand-forest font-bold' : 'border-brand-stone/60 text-brand-charcoal/70'}`}>
                      <input type="checkbox" className="sr-only" checked={tags.has(t)} onChange={() => toggleTag(t)} />
                      {FINDING_TAG_LABELS[t] ?? t}
                    </label>
                  ))}
                </div>
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-3">
            <Field label="方案">
              <Select value={months} onChange={e => setMonths(Number(e.target.value) as 1 | 3 | 6)} className="w-auto">
                <option value={1}>一个月</option>
                <option value={3}>三个月</option>
                <option value={6}>六个月</option>
              </Select>
            </Field>
            <Button busy={busy} disabled={!allColored || !child.name.trim() || !child.birthDate} onClick={() => void submit()}>送出代填</Button>
            {!allColored && <span className="text-[11px] text-brand-charcoal/60">九个方面都要选红、黄或绿。</span>}
          </div>
        </div>
      )}
    </Panel>
  );
}
