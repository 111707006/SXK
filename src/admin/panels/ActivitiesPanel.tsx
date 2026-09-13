/**
 * 活動庫標記頁（#62，規格 v2 §7.4）。
 *
 * 300 支活動的種子全部 `targetMonth = null`，沒填的活動**配不到** —— 上線當天每個維度都是
 * 「準備中」。這一頁就是讓內容團隊看見還差多少，然後一支一支填。
 *
 * 上方四個進度數字（總數／已填目標月齡／已填練什麼／已啟用）沿用已退場的素材庫分頁
 * 的作法，各自代表一件事。列表可依模組、維度、「還沒填目標月齡」篩。存檔只送改過的欄位
 * （`changedFields`），伺服器回整支，直接換掉列表裡那一列 —— 進度數字跟著變，不必重抓 300 支。
 *
 * 「未填」與「已停用」在畫面上分得開：對配對來說結果一樣（都配不到），對維護的人完全不同。
 */
import { useCallback, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, Trash2, X } from 'lucide-react';
import { adminApi } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import type { Activity, ActivityStep, DimensionCode, ModuleNo } from '../../t2/types';
import { DIMENSION_CODES } from '../../t2/types';
import { SITE_DIMENSION_NAME } from '../../t2/dimensionMap';
import { MODULE_TITLES } from '../../t2/activitySeed';
import { ACTIVITY_TAGS, REPORT_ONLY_TAGS, TAG_DIMENSIONS, tagDimension } from '../../t2/findingTags';
import type { ActivityTag, FindingTag, TagDimension } from '../../t2/findingTags';
import { TAG_SENTENCES } from '../../t2/report/sentences';
import {
  activityCoverage,
  changedFields,
  filterActivities,
  MAX_TARGET_MONTH,
  type ActivityFilter,
} from '../../utils/activityAdmin';
import { MAX_STEPS } from '../../utils/activitySteps';
import {
  Button,
  ErrorNote,
  Field,
  Panel,
  Select,
  Spinner,
  TextArea,
  TextInput,
  toErrorView,
  useAsyncData,
} from '../ui';

const MODULE_NOS = Object.keys(MODULE_TITLES).map(Number) as ModuleNo[];

/** 標籤前綴 → 維度名稱；`severity` 不是維度，另外給一個說法。 */
const TAG_DIMENSION_CODE: Readonly<Record<TagDimension, DimensionCode | null>> = {
  lang: 'LANG', soc: 'SOC', emo: 'EMO', att: 'ATT', mot: 'MOT',
  sen: 'SEN', adl: 'ADL', cog: 'COG', learn: 'LEARN', severity: null,
};
function tagGroupName(dim: TagDimension): string {
  const code = TAG_DIMENSION_CODE[dim];
  return code ? SITE_DIMENSION_NAME[code] : '严重度（跨工具）';
}

/** 編輯畫面的草稿：數字與器材是字串，存檔時再轉回 Activity 的形狀。 */
interface Draft {
  title: string;
  targetMonth: string;
  dimensions: DimensionCode[];
  targets: ActivityTag[];
  avoidIf: FindingTag[];
  durationMin: string;
  equipment: string;
  steps: ActivityStep[];
  videoUrl: string;
  active: boolean;
}

const EMPTY_STEP: ActivityStep = { imageUrl: '', instruction: '' };

function toDraft(a: Activity): Draft {
  return {
    title: a.title,
    targetMonth: a.targetMonth === null ? '' : String(a.targetMonth),
    dimensions: [...a.dimensions],
    targets: [...a.targets],
    avoidIf: [...a.avoidIf],
    durationMin: String(a.durationMin),
    equipment: a.equipment.join('、'),
    steps: a.steps.map(s => ({ ...s })),
    videoUrl: a.videoUrl ?? '',
    active: a.active,
  };
}

/**
 * 數字欄位的字串讀成整數；空字串回 `null`。打了不是數字的字回 `undefined` —— 呼叫端據此擋下，
 * **不能**放行成 `NaN`：`JSON.stringify` 會把 `NaN` 寫成 `null`，伺服器就把「3o」當成「清掉」存進去，
 * 表單關掉、沒有任何錯誤，而那支活動剛剛還填著月齡。
 */
function readIntField(text: string): number | null | undefined {
  const t = text.trim();
  if (t === '') return null;
  return /^\d+$/.test(t) ? Number(t) : undefined;
}

/** 草稿 → Activity 的形狀，好拿去跟原本的那支比（`changedFields`）。數字欄位已由 `readIntField` 驗過。 */
function fromDraft(original: Activity, d: Draft, targetMonth: number | null, durationMin: number | null): Activity {
  return {
    ...original,
    title: d.title.trim(),
    targetMonth,
    dimensions: d.dimensions,
    targets: d.targets,
    avoidIf: d.avoidIf,
    durationMin: durationMin ?? 0,
    equipment: d.equipment.split(/[、,，;；\n]/).map(s => s.trim()).filter(Boolean),
    steps: d.steps.map(s => ({ imageUrl: s.imageUrl.trim(), instruction: s.instruction.trim() })),
    videoUrl: d.videoUrl.trim() ? d.videoUrl.trim() : null,
    active: d.active,
  };
}

export default function ActivitiesPanel({ onError }: { onError: (view: AdminErrorView) => void }) {
  const load = useCallback(() => adminApi.activities(), []);
  const { data, loading, failure, reload } = useAsyncData(load, [], onError);
  // 存過的那幾支蓋在讀回來的列表上 —— 伺服器回整支，直接換掉那一列，不重抓 300 支。
  const [saved, setSaved] = useState<Record<string, Activity>>({});
  const [filter, setFilter] = useState<ActivityFilter>({ moduleNo: null, dimension: null, missingTargetMonth: false });
  const [editing, setEditing] = useState<{ original: Activity; draft: Draft } | null>(null);
  const [saveFailure, setSaveFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const activities = (data?.activities ?? []).map(a => saved[a.id] ?? a);
  const coverage = activityCoverage(activities);
  const rows = filterActivities(activities, filter);

  function edit(a: Activity) {
    setSaveFailure(null);
    setEditing({ original: a, draft: toDraft(a) });
  }

  function patch(change: Partial<Draft>) {
    if (editing) setEditing({ ...editing, draft: { ...editing.draft, ...change } });
  }

  async function save() {
    if (!editing) return;
    const targetMonth = readIntField(editing.draft.targetMonth);
    const durationMin = readIntField(editing.draft.durationMin);
    if (targetMonth === undefined || durationMin === undefined) {
      setSaveFailure(targetMonth === undefined ? '目标月龄只能填整数（单位是月），或留空。' : '时长只能填整数（分钟），或留空。');
      return;
    }
    const diff = changedFields(editing.original, fromDraft(editing.original, editing.draft, targetMonth, durationMin));
    if (Object.keys(diff).length === 0) {
      setEditing(null);
      return;
    }
    setBusy(true);
    setSaveFailure(null);
    try {
      const { activity } = await adminApi.updateActivity(editing.original.id, diff);
      setSaved(prev => ({ ...prev, [activity.id]: activity }));
      setEditing(null);
    } catch (err) {
      const view = toErrorView(err);
      // 內容不合格（400）是「這次沒存成功」，訊息要留在表單旁邊 —— 送去外層的殼會讓
      // 表單連同已經打好的字一起消失。
      if (view.action === 'none') setSaveFailure(view.message);
      else onError(view);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="活动库"
      description="300 支活动由种子写入，内容团队在这里逐支补「目标月龄」（做得到的孩子的发展月龄）与「练什么」标签。没填目标月龄的活动配不到任何孩子——这一页就是让人看见还差多少。不再用的活动请「停用」，没有删除。"
    >
      {loading ? (
        <Spinner label="正在读取活动库…" />
      ) : failure ? (
        // 讀取失敗與「一支都沒有」是兩件事：沒跑遷移會被看成「活動庫是空的」。
        <ErrorNote message={failure} onRetry={reload} />
      ) : (
        <>
          <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-4" data-testid="activity-coverage">
            <Stat label="总数" value={coverage.total} />
            <Stat label="已填目标月龄" value={coverage.targetMonthFilled} total={coverage.total} highlight />
            <Stat label="已填练什么" value={coverage.targetsFilled} total={coverage.total} />
            <Stat label="已启用" value={coverage.active} total={coverage.total} />
          </div>

          {coverage.total > 0 && coverage.targetMonthFilled === 0 && (
            <p className="mb-4 rounded-2xl border border-brand-stone bg-brand-cream/40 px-4 py-3 text-[11px] leading-relaxed text-brand-charcoal/60">
              还没有任何一支活动填了目标月龄——现在每个维度在家长端都是「准备中」并导向专家，每周活动是零支。
              先从一格做起：语言 × 12–36 个月（模组 7／8／9／11）。
            </p>
          )}

          <div className="mb-4 flex flex-wrap items-end gap-3">
            <div className="min-w-[12rem]">
              <Field label="模组">
                <Select
                  value={filter.moduleNo ?? ''}
                  onChange={e => setFilter({ ...filter, moduleNo: e.target.value ? (Number(e.target.value) as ModuleNo) : null })}
                >
                  <option value="">全部 15 个模组</option>
                  {MODULE_NOS.map(no => (
                    <option key={no} value={no}>
                      {no}. {MODULE_TITLES[no]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <div className="min-w-[10rem]">
              <Field label="维度">
                <Select
                  value={filter.dimension ?? ''}
                  onChange={e => setFilter({ ...filter, dimension: (e.target.value || null) as DimensionCode | null })}
                >
                  <option value="">全部维度</option>
                  {DIMENSION_CODES.map(code => (
                    <option key={code} value={code}>
                      {SITE_DIMENSION_NAME[code]}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <label className="flex items-center gap-2 pb-2 text-xs text-brand-charcoal/70">
              <input
                type="checkbox"
                checked={filter.missingTargetMonth}
                onChange={e => setFilter({ ...filter, missingTargetMonth: e.target.checked })}
                className="accent-brand-forest"
              />
              只看还没填目标月龄的
            </label>
            <p className="pb-2 text-[11px] text-brand-charcoal/50">符合 {rows.length} 支</p>
          </div>

          {editing && (
            <Editor
              original={editing.original}
              draft={editing.draft}
              busy={busy}
              failure={saveFailure}
              onPatch={patch}
              onSave={() => void save()}
              onCancel={() => {
                setEditing(null);
                setSaveFailure(null);
              }}
            />
          )}

          <ul className="space-y-1.5">
            {rows.map(a => (
              <li
                key={a.id}
                data-testid="activity-row"
                className="flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-brand-stone px-4 py-2.5"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-brand-forest">
                    <span className="font-mono text-[11px] text-brand-charcoal/50">{a.id}</span>
                    {a.title}
                    {!a.active && <Tag tone="muted">已停用</Tag>}
                  </p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-brand-charcoal/50">
                    <span>模组 {a.moduleNo}·{MODULE_TITLES[a.moduleNo]}</span>
                    <span>{a.dimensions.map(d => SITE_DIMENSION_NAME[d]).join('／') || '未选维度'}</span>
                    {a.targetMonth === null ? (
                      <Tag tone="warn">未填目标月龄</Tag>
                    ) : (
                      <span>目标 {a.targetMonth} 个月</span>
                    )}
                    <span>{a.targets.length ? `练 ${a.targets.length} 项` : '未贴练什么'}</span>
                    {a.avoidIf.length > 0 && <span>回避 {a.avoidIf.length} 项</span>}
                    <span>{a.steps.length} 步{a.videoUrl ? '·附示范' : ''}</span>
                  </p>
                </div>
                <Button variant="ghost" onClick={() => edit(a)} disabled={busy}>
                  编辑
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function Stat({ label, value, total, highlight }: { label: string; value: number; total?: number; highlight?: boolean }) {
  return (
    <div className={`rounded-2xl border px-3 py-2 ${highlight ? 'border-brand-moss bg-brand-sage/40' : 'border-brand-stone bg-white'}`}>
      <p className="text-[10px] text-brand-charcoal/50">{label}</p>
      <p className="text-base font-bold text-brand-forest">
        {value}
        {total !== undefined && <span className="ml-1 text-[10px] font-medium text-brand-charcoal/40">/ {total}</span>}
      </p>
    </div>
  );
}

function Tag({ tone, children }: { tone: 'warn' | 'muted'; children: React.ReactNode }) {
  const cls = tone === 'warn'
    ? 'border-amber-300 bg-amber-50 text-amber-800'
    : 'border-brand-stone bg-brand-sage text-brand-charcoal/60';
  return <span className={`rounded-lg border px-1.5 py-0.5 text-[10px] font-medium ${cls}`}>{children}</span>;
}

function Editor({
  original,
  draft,
  busy,
  failure,
  onPatch,
  onSave,
  onCancel,
}: {
  original: Activity;
  draft: Draft;
  busy: boolean;
  failure: string | null;
  onPatch: (change: Partial<Draft>) => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  function toggle<T extends string>(list: T[], value: T, on: boolean): T[] {
    return on ? (list.includes(value) ? list : [...list, value]) : list.filter(x => x !== value);
  }

  function patchStep(index: number, change: Partial<ActivityStep>) {
    onPatch({ steps: draft.steps.map((s, i) => (i === index ? { ...s, ...change } : s)) });
  }
  function moveStep(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= draft.steps.length) return;
    const steps = [...draft.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    onPatch({ steps });
  }

  return (
    <div className="mb-5 rounded-2xl border border-brand-stone bg-brand-cream/40 p-4" data-testid="activity-editor">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-brand-forest">
            <span className="mr-2 font-mono text-brand-charcoal/50">{original.id}</span>
            编辑活动
          </p>
          {/* 編號與模組不可改：模組由編號算出（ceil(編號/20)），改了它活動會搬到別的模組群而編號還留在原處。 */}
          <p className="mt-1 text-[10px] text-brand-charcoal/50">
            模组 {original.moduleNo}·{MODULE_TITLES[original.moduleNo]} · 原型适龄 {original.ageMonths.min}–{original.ageMonths.max} 个月
          </p>
        </div>
        <button onClick={onCancel} aria-label="取消" className="rounded-lg p-1 text-brand-charcoal/50 transition hover:bg-white">
          <X size={13} />
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <Field label="标题">
          <TextInput value={draft.title} maxLength={128} onChange={e => onPatch({ title: e.target.value })} />
        </Field>
        <Field
          label="目标月龄（月）"
          hint={`「做得到的孩子」的发展月龄，0–${MAX_TARGET_MONTH}。留空＝还没填，配不到。`}
        >
          <TextInput
            inputMode="numeric"
            value={draft.targetMonth}
            placeholder="例：30"
            onChange={e => onPatch({ targetMonth: e.target.value })}
          />
        </Field>
        <Field label="时长（分钟）" hint="0＝还没填">
          <TextInput inputMode="numeric" value={draft.durationMin} onChange={e => onPatch({ durationMin: e.target.value })} />
        </Field>
      </div>

      <fieldset className="mt-4">
        <legend className="text-[11px] font-bold text-brand-charcoal/70">维度（至少一个；后台显示用，配对看模组）</legend>
        <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1">
          {DIMENSION_CODES.map(code => (
            <label key={code} className="flex items-center gap-1.5 text-xs text-brand-charcoal/70">
              <input
                type="checkbox"
                className="accent-brand-forest"
                checked={draft.dimensions.includes(code)}
                onChange={e => onPatch({ dimensions: toggle(draft.dimensions, code, e.target.checked) })}
              />
              {SITE_DIMENSION_NAME[code]}
            </label>
          ))}
        </div>
      </fieldset>

      <TagPicker
        legend="练什么（targets）—— 只认 ★ 可配活动的标签，孩子带着这些标签时这支加分"
        tags={ACTIVITY_TAGS}
        selected={draft.targets}
        onChange={targets => onPatch({ targets })}
      />

      <TagPicker
        legend="回避条件（avoidIf）—— 孩子带着这些标签时不派这支；含只进报告的标签"
        tags={[...ACTIVITY_TAGS, ...REPORT_ONLY_TAGS]}
        selected={draft.avoidIf}
        onChange={avoidIf => onPatch({ avoidIf })}
        collapsed
      />

      <div className="mt-4">
        <Field label="器材（用「、」分开）">
          <TextInput value={draft.equipment} onChange={e => onPatch({ equipment: e.target.value })} />
        </Field>
      </div>

      <div className="mt-4 space-y-3">
        <p className="text-[11px] font-bold text-brand-charcoal/70">
          分解步骤（可为零步，最多 {MAX_STEPS} 步）
          <span className="ml-1.5 font-medium text-brand-charcoal/45">顺序就是家长照着做的顺序</span>
        </p>
        {draft.steps.map((step, index) => (
          <div key={index} className="rounded-xl border border-brand-stone bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold text-brand-forest">第 {index + 1} 步</span>
              <div className="flex items-center gap-1">
                <IconButton label="上移" disabled={index === 0} onClick={() => moveStep(index, -1)}>
                  <ArrowUp size={12} />
                </IconButton>
                <IconButton label="下移" disabled={index === draft.steps.length - 1} onClick={() => moveStep(index, 1)}>
                  <ArrowDown size={12} />
                </IconButton>
                <IconButton label="删除这一步" onClick={() => onPatch({ steps: draft.steps.filter((_, i) => i !== index) })}>
                  <Trash2 size={12} />
                </IconButton>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="分解图网址" hint="https:// 开头，或站内的 / 路径。">
                <TextInput value={step.imageUrl} maxLength={512} onChange={e => patchStep(index, { imageUrl: e.target.value })} />
              </Field>
              <Field label="指令文字">
                <TextArea rows={2} value={step.instruction} maxLength={500} onChange={e => patchStep(index, { instruction: e.target.value })} />
              </Field>
            </div>
          </div>
        ))}
        <Button
          variant="ghost"
          onClick={() => onPatch({ steps: [...draft.steps, { ...EMPTY_STEP }] })}
          disabled={draft.steps.length >= MAX_STEPS}
        >
          <Plus size={12} />
          加一步
        </Button>
      </div>

      <div className="mt-4">
        <Field label="示范链接（选填）" hint="https:// 开头，或站内的 / 路径。http:// 会被家长的浏览器挡掉。">
          <TextInput value={draft.videoUrl} maxLength={512} onChange={e => onPatch({ videoUrl: e.target.value })} />
        </Field>
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-brand-charcoal/70">
        <input type="checkbox" checked={draft.active} onChange={e => onPatch({ active: e.target.checked })} className="accent-brand-forest" />
        启用（关闭后这支不再派给任何孩子；内容还在，可以再打开）
      </label>

      {failure && (
        <div className="mt-3">
          <ErrorNote message={failure} />
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Button onClick={onSave} busy={busy}>
          <Save size={12} />
          保存
        </Button>
        <Button variant="ghost" onClick={onCancel}>
          取消
        </Button>
      </div>
    </div>
  );
}

/**
 * 依維度分組的標籤勾選。標籤顯示原碼（`lang.expression`）—— 那是量表規則表與活動庫兩邊
 * 貼的同一組字，換成中文別名就又多一套名字；滑鼠停上去看得到報告裡那一句固定說法。
 */
function TagPicker<T extends FindingTag>({
  legend,
  tags,
  selected,
  onChange,
  collapsed = false,
}: {
  legend: string;
  tags: ReadonlyArray<T>;
  selected: T[];
  onChange: (next: T[]) => void;
  collapsed?: boolean;
}) {
  const [open, setOpen] = useState(!collapsed);
  const groups = TAG_DIMENSIONS.map(dim => ({ dim, tags: tags.filter(t => tagDimension(t) === dim) })).filter(g => g.tags.length);
  return (
    <fieldset className="mt-4">
      <legend className="text-[11px] font-bold text-brand-charcoal/70">
        {legend}
        <button type="button" onClick={() => setOpen(!open)} className="ml-2 font-medium text-brand-moss underline">
          {open ? '收起' : `展开（已选 ${selected.length}）`}
        </button>
      </legend>
      {open && (
        <div className="mt-1.5 space-y-1.5">
          {groups.map(g => (
            <div key={g.dim} className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
              <span className="w-20 shrink-0 text-[10px] text-brand-charcoal/45">{tagGroupName(g.dim)}</span>
              {g.tags.map(tag => (
                <label key={tag} title={TAG_SENTENCES[tag]} className="flex items-center gap-1 font-mono text-[11px] text-brand-charcoal/70">
                  <input
                    type="checkbox"
                    className="accent-brand-forest"
                    checked={selected.includes(tag)}
                    onChange={e => onChange(e.target.checked ? [...selected, tag] : selected.filter(x => x !== tag))}
                  />
                  {tag}
                </label>
              ))}
            </div>
          ))}
        </div>
      )}
    </fieldset>
  );
}

function IconButton({ label, disabled, onClick, children }: { label: string; disabled?: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg border border-brand-stone p-1 text-brand-charcoal/60 transition hover:bg-brand-sage disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}
