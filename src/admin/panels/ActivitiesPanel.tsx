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
import { useCallback, useRef, useState } from 'react';
import { ArrowDown, ArrowUp, FileUp, Plus, Save, Trash2, X } from 'lucide-react';
import { adminApi } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import type { Activity, DimensionCode, ModuleNo } from '../../t2/types';
import { DIMENSION_CODES, GUIDE_PREP_KEYS } from '../../t2/types';
import { SITE_DIMENSION_NAME } from '../../t2/dimensionMap';
import { MODULE_TITLES, parseAgeRange } from '../../t2/activitySeed';
import { ACTIVITY_TAGS, REPORT_ONLY_TAGS, TAG_DIMENSIONS, tagDimension } from '../../t2/findingTags';
import type { ActivityTag, FindingTag, TagDimension } from '../../t2/findingTags';
import { FINDING_TAG_LABELS } from '../findingTagLabels';
import { TAG_SENTENCES } from '../../t2/report/sentences';
import {
  activityCoverage,
  changedFields,
  CONTENT_TEXT_FIELDS,
  filterActivities,
  groupImportWarnings,
  MAX_AGE_LABEL,
  MAX_IMPORT_ROWS,
  MAX_TARGET_MONTH,
  MAX_VIDEO_SECONDS,
  readImportFile,
  type ActivityFilter,
  type ActivityImportFailure,
  type ActivityImportReport,
  type ActivityImportWarning,
} from '../../utils/activityAdmin';
import { MAX_STEPS } from '../../utils/activitySteps';
import {
  GUIDE_SECTION_NAMES,
  MAX_GUIDE_ITEMS,
  MAX_GUIDE_TEXT,
  guideFromDraft,
  guideToDraft,
  type GuideDraft,
} from '../../utils/activityGuide';
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

/** 編輯畫面的一則步驟：圖選填（ADR-0008），沒有圖是空字串，存檔時轉回 `null`。 */
interface StepDraft {
  imageUrl: string;
  instruction: string;
}

/** 手冊的文字欄位 —— 原文，照樣存（`readActivityPatch` 驗欄寬）。 */
type ContentTextKey = (typeof CONTENT_TEXT_FIELDS)[number]['key'];

/** 手冊裡一行就寫完的幾欄用單行輸入框；其餘（练什么、简单、难一点、小提醒）是句子，用多行。 */
const SHORT_CONTENT_FIELDS: ReadonlySet<ContentTextKey> = new Set(['people', 'need', 'deeper']);

/** 編輯畫面的草稿：數字與器材是字串，存檔時再轉回 Activity 的形狀。 */
interface Draft extends Record<ContentTextKey, string> {
  title: string;
  targetMonth: string;
  ageLabel: string;
  dimensions: DimensionCode[];
  targets: ActivityTag[];
  avoidIf: FindingTag[];
  durationMin: string;
  equipment: string;
  steps: StepDraft[];
  /** 沒有腳本的活動是 `null`：後台不新增、不整份刪掉腳本（`readActivityPatch` 檔頭）。 */
  guide: GuideDraft | null;
  videoUrl: string;
  posterUrl: string;
  videoSeconds: string;
  active: boolean;
}

const EMPTY_STEP: StepDraft = { imageUrl: '', instruction: '' };

function toDraft(a: Activity): Draft {
  return {
    title: a.title,
    targetMonth: a.targetMonth === null ? '' : String(a.targetMonth),
    ageLabel: a.ageLabel,
    people: a.people,
    dimensions: [...a.dimensions],
    targets: [...a.targets],
    avoidIf: [...a.avoidIf],
    durationMin: String(a.durationMin),
    equipment: a.equipment.join('、'),
    need: a.need,
    trains: a.trains,
    steps: a.steps.map(s => ({ imageUrl: s.imageUrl ?? '', instruction: s.instruction })),
    easier: a.easier,
    harder: a.harder,
    tip: a.tip,
    deeper: a.deeper,
    guide: a.guide ? guideToDraft(a.guide) : null,
    videoUrl: a.videoUrl ?? '',
    posterUrl: a.posterUrl ?? '',
    videoSeconds: a.videoSeconds === null ? '' : String(a.videoSeconds),
    active: a.active,
  };
}

/** 適齡原文解析成硬閘的月齡區間；看不懂回 null（畫面提示，存檔時伺服器照樣擋）。 */
function ageRangeOf(label: string): { min: number; max: number } | null {
  try {
    return parseAgeRange(label);
  } catch {
    return null;
  }
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
function fromDraft(
  original: Activity,
  d: Draft,
  numbers: { targetMonth: number | null; durationMin: number | null; videoSeconds: number | null },
): Activity {
  const content = Object.fromEntries(CONTENT_TEXT_FIELDS.map(({ key }) => [key, d[key].trim()])) as Record<ContentTextKey, string>;
  return {
    ...original,
    ...content,
    title: d.title.trim(),
    targetMonth: numbers.targetMonth,
    ageLabel: d.ageLabel.trim(),
    dimensions: d.dimensions,
    targets: d.targets,
    avoidIf: d.avoidIf,
    durationMin: numbers.durationMin ?? 0,
    equipment: d.equipment.split(/[、,，;；\n]/).map(s => s.trim()).filter(Boolean),
    steps: d.steps.map(s => ({ imageUrl: s.imageUrl.trim() || null, instruction: s.instruction.trim() })),
    guide: d.guide ? guideFromDraft(d.guide) : original.guide,
    videoUrl: d.videoUrl.trim() ? d.videoUrl.trim() : null,
    posterUrl: d.posterUrl.trim() ? d.posterUrl.trim() : null,
    videoSeconds: numbers.videoSeconds,
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
    const videoSeconds = readIntField(editing.draft.videoSeconds);
    if (targetMonth === undefined || durationMin === undefined || videoSeconds === undefined) {
      setSaveFailure(
        targetMonth === undefined
          ? '目标月龄只能填整数（单位是月），或留空。'
          : durationMin === undefined
            ? '时长只能填整数（分钟），或留空。'
            : '示范片长度只能填整数（秒），或留空。'
      );
      return;
    }
    const diff = changedFields(
      editing.original,
      fromDraft(editing.original, editing.draft, { targetMonth, durationMin, videoSeconds })
    );
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
      {/* 放在載入狀態之外：匯入完重新讀列表時畫面會轉一下圈，匯入結果不能跟著消失。 */}
      <ImportBox
        // 編輯到一半不給匯入：匯入改掉的可能正是表單底下那一支，表單裡還是舊的內容。
        disabled={editing !== null || busy}
        onError={onError}
        onImported={() => {
          // 蓋在列表上的那幾支是匯入之前存的，重新讀回來之前先拿掉，否則會把匯入的值蓋回去。
          setSaved({});
          reload();
        }}
      />

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
                    <span>适龄 {a.ageLabel || `${a.ageMonths.min}–${a.ageMonths.max} 个月`}</span>
                    <span>
                      {a.steps.length} 步{a.videoUrl ? '·附示范' : ''}
                      {a.guide ? '·有脚本' : ''}
                    </span>
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

type ImportStage =
  | { kind: 'idle' }
  /** 試跑過了，等人看完按「确认汇入」。送出的是同一份 `rows`。 */
  | { kind: 'checked'; fileName: string; rows: unknown[]; report: ActivityImportReport }
  | { kind: 'done'; fileName: string; report: ActivityImportReport };

/**
 * 批量匯入（v2.1 S25，客戶 9/21 工作單 #14）：選一個 JSON 檔 → 試跑（dryRun）→ 看成功幾列、
 * 哪幾列被退、哪些欄位被忽略 → 確認後正式匯入 → 重新讀列表。
 *
 * 一定先試跑：正式匯入是逐列寫、寫了就寫了，沒有「整份復原」。試跑與正式匯入送的是同一份 `rows`，
 * 伺服器兩次跑同一套檢查（`planActivityImport`），所以試跑說能進的，正式匯入就進得去
 * （除非中間有人改了活動庫，或資料庫那一列寫入失敗 —— 那一列會出現在結果的退回清單裡）。
 */
function ImportBox({
  disabled,
  onError,
  onImported,
}: {
  disabled: boolean;
  onError: (view: AdminErrorView) => void;
  onImported: () => void;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<ImportStage>({ kind: 'idle' });
  const [busy, setBusy] = useState(false);
  const [failure, setFailure] = useState<string | null>(null);

  function fail(err: unknown) {
    const view = toErrorView(err);
    // 內容不合格（400）留在這一區；401／503 交給外層的殼。
    if (view.action === 'none') setFailure(view.message);
    else onError(view);
  }

  async function check(file: File) {
    setFailure(null);
    setStage({ kind: 'idle' });
    const read = readImportFile(await file.text());
    if (!read.ok) {
      setFailure(read.error);
      return;
    }
    setBusy(true);
    try {
      const report = await adminApi.importActivities(read.rows, true);
      setStage({ kind: 'checked', fileName: file.name, rows: read.rows, report });
    } catch (err) {
      fail(err);
    } finally {
      setBusy(false);
    }
  }

  async function commit() {
    if (stage.kind !== 'checked') return;
    setFailure(null);
    setBusy(true);
    try {
      const report = await adminApi.importActivities(stage.rows, false);
      setStage({ kind: 'done', fileName: stage.fileName, report });
      onImported();
    } catch (err) {
      const view = toErrorView(err);
      if (view.action !== 'none') {
        onError(view);
        return;
      }
      // 正式匯入是逐列寫的：請求失敗不代表一列都沒寫（例如寫到一半斷線、反向代理逾時）。
      // 試跑結果這時已經不準，拿掉；列表重新讀，免得有人拿舊的內容去編輯、把匯入的值蓋回去。
      setStage({ kind: 'idle' });
      setFailure(`${view.message}（这次汇入可能已经写进去一部分。列表已重新读取，请核对后整份重新试跑、再汇入；已经写进去的列再写一次，结果一样。）`);
      onImported();
    } finally {
      setBusy(false);
    }
  }

  function close() {
    setStage({ kind: 'idle' });
    setFailure(null);
  }

  return (
    <div className="mb-4 rounded-2xl border border-brand-stone bg-brand-cream/40 px-4 py-3" data-testid="activity-import">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-[11px] leading-relaxed text-brand-charcoal/60">
          <span className="font-bold text-brand-charcoal/80">批量汇入</span>
          ：选一个 JSON 档（格式 {'{ "rows": [ … ] }'}，见规格 v2.1 附录 C），一次最多 {MAX_IMPORT_ROWS} 列。
          每列必填 id、moduleNo、targetMonth；只更新已有的活动，带了的栏位才改。先试跑，看过结果再确认汇入。
        </p>
        <Button variant="ghost" onClick={() => fileInput.current?.click()} busy={busy && stage.kind === 'idle'} disabled={disabled || busy}>
          <FileUp size={12} />
          {stage.kind === 'idle' ? '选择档案并试跑' : '换一个档案'}
        </Button>
        <input
          ref={fileInput}
          type="file"
          accept=".json,application/json"
          className="hidden"
          data-testid="activity-import-file"
          onChange={e => {
            const file = e.target.files?.[0];
            // 清掉，同一個檔案改過之後再選一次才會觸發 onChange。
            e.target.value = '';
            if (file) void check(file);
          }}
        />
      </div>

      {failure && (
        <div className="mt-3">
          <ErrorNote message={failure} />
        </div>
      )}

      {stage.kind !== 'idle' && (
        <div className="mt-3 space-y-3 border-t border-brand-stone pt-3">
          <p className="text-xs font-bold text-brand-forest">
            {stage.kind === 'checked' ? '试跑结果（还没写入）' : '汇入完成'}
            <span className="ml-2 font-mono text-[10px] font-medium text-brand-charcoal/45">{stage.fileName}</span>
          </p>
          <div className="grid grid-cols-3 gap-2">
            <Stat label={stage.kind === 'checked' ? '可以汇入' : '已汇入'} value={stage.report.imported} highlight />
            <Stat label="整列退回" value={stage.report.failed.length} />
            <Stat label="忽略的栏位" value={groupImportWarnings(stage.report.warnings).length} />
          </div>

          <FailedRows failed={stage.report.failed} />
          <IgnoredFields warnings={stage.report.warnings} />

          <div className="flex flex-wrap gap-2">
            {stage.kind === 'checked' ? (
              <>
                <Button onClick={() => void commit()} busy={busy} disabled={disabled || stage.report.imported === 0}>
                  确认汇入 {stage.report.imported} 列
                </Button>
                <Button variant="ghost" onClick={close} disabled={busy}>
                  取消
                </Button>
              </>
            ) : (
              <Button variant="ghost" onClick={close}>
                关闭
              </Button>
            )}
          </div>
          {stage.kind === 'checked' && stage.report.failed.length > 0 && (
            <p className="text-[10px] leading-relaxed text-brand-charcoal/45">
              确认汇入只写能进的那几列；被退的列一个栏位都不写，改好档案后可以整份再汇入一次（已经写进去的列再写一次，结果一样）。
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function FailedRows({ failed }: { failed: ReadonlyArray<ActivityImportFailure> }) {
  if (failed.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold text-brand-charcoal/70">整列退回（这些列一个栏位都没写）</p>
      <ul className="max-h-64 space-y-1 overflow-auto rounded-xl border border-brand-stone bg-white p-2" data-testid="activity-import-failed">
        {failed.map(f => (
          <li key={f.row} className="flex gap-2 text-[11px] leading-relaxed text-brand-charcoal/70">
            <span className="w-14 shrink-0 font-bold text-brand-charcoal/50">第 {f.row} 列</span>
            <span className="w-16 shrink-0 font-mono text-brand-charcoal/50">{f.id ?? '（无 id）'}</span>
            <span className="min-w-0">{f.error}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** 列號最多列十個，其餘說「共 N 列」—— 整張表都帶的欄位會有三百個列號。 */
const MAX_LISTED_ROWS = 10;

function IgnoredFields({ warnings }: { warnings: ReadonlyArray<ActivityImportWarning> }) {
  const groups = groupImportWarnings(warnings);
  if (groups.length === 0) return null;
  return (
    <div>
      <p className="mb-1 text-[11px] font-bold text-brand-charcoal/70">
        忽略的栏位（认不得，没写入；不影响那一列其他栏位）
      </p>
      <ul className="space-y-1 rounded-xl border border-brand-stone bg-white p-2" data-testid="activity-import-warnings">
        {groups.map(g => (
          <li key={g.field} className="text-[11px] leading-relaxed text-brand-charcoal/70">
            <span className="font-mono">「{g.field}」</span>
            <span className="ml-1 text-brand-charcoal/50">
              第 {g.rows.slice(0, MAX_LISTED_ROWS).join('、')}
              {g.rows.length > MAX_LISTED_ROWS ? '… ' : ' '}列（共 {g.rows.length} 列）
            </span>
          </li>
        ))}
      </ul>
    </div>
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

  function patchStep(index: number, change: Partial<StepDraft>) {
    onPatch({ steps: draft.steps.map((s, i) => (i === index ? { ...s, ...change } : s)) });
  }
  function moveStep(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= draft.steps.length) return;
    const steps = [...draft.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    onPatch({ steps });
  }

  // 適齡是配對硬閘的來源（readActivityPatch 由它解析 ageMonths）：打字的當下就說硬閘會變成什麼，
  // 看不懂的寫法在這裡先講，存檔時伺服器照樣擋。
  const ageLabel = draft.ageLabel.trim();
  const ageRange = ageLabel ? ageRangeOf(ageLabel) : null;
  const ageHint = !ageLabel
    ? original.ageLabel
      ? '适龄不能留空。'
      : `还没写入手册原文（内容迁移还没跑）。配对硬闸 ${original.ageMonths.min}–${original.ageMonths.max} 个月。`
    : !ageRange
      ? '看不懂这个写法，存不进去。写法：「3–8岁」「6个月–3岁」「全龄」。'
      : ageRange.min === original.ageMonths.min && ageRange.max === original.ageMonths.max
        ? `配对硬闸 ${ageRange.min}–${ageRange.max} 个月（由适龄解析）。`
        : `存档后配对硬闸跟着改成 ${ageRange.min}–${ageRange.max} 个月（现在是 ${original.ageMonths.min}–${original.ageMonths.max}）。`;

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
            模组 {original.moduleNo}·{MODULE_TITLES[original.moduleNo]} · 配对硬闸 {original.ageMonths.min}–{original.ageMonths.max} 个月
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
        <Field label="适龄（手册原文，家长端显示它）" hint={ageHint}>
          <TextInput
            value={draft.ageLabel}
            maxLength={MAX_AGE_LABEL}
            placeholder="例：6个月–3岁"
            onChange={e => onPatch({ ageLabel: e.target.value })}
          />
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
        <Field label="器材（用「、」分开）" hint="给配对与后台用；家长端「要准备」显示的是下面「需要什么」的原文。">
          <TextInput value={draft.equipment} onChange={e => onPatch({ equipment: e.target.value })} />
        </Field>
      </div>

      <fieldset className="mt-4">
        <legend className="text-[11px] font-bold text-brand-charcoal/70">
          手册内容
          <span className="ml-1.5 font-medium text-brand-charcoal/45">
            客户原文，照样存；清空＝家长端不显示这一区（内容迁移重跑不会把清掉的填回来）
          </span>
        </legend>
        <div className="mt-1.5 grid gap-3 sm:grid-cols-2">
          {CONTENT_TEXT_FIELDS.map(({ key, name, max }) => (
            <Field key={key} label={name} hint={`最多 ${max} 字`}>
              {SHORT_CONTENT_FIELDS.has(key) ? (
                <TextInput value={draft[key]} maxLength={max} onChange={e => onPatch({ [key]: e.target.value })} />
              ) : (
                <TextArea rows={max > 255 ? 3 : 2} value={draft[key]} maxLength={max} onChange={e => onPatch({ [key]: e.target.value })} />
              )}
            </Field>
          ))}
        </div>
      </fieldset>

      <div className="mt-4 space-y-3">
        <p className="text-[11px] font-bold text-brand-charcoal/70">
          分解步骤（可为零步，最多 {MAX_STEPS} 步；图选填）
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
              <Field label="指令文字（必填）">
                <TextArea rows={2} value={step.instruction} maxLength={500} onChange={e => patchStep(index, { instruction: e.target.value })} />
              </Field>
              <Field
                label="分解图网址（选填）"
                hint="留空＝这一步只有文字，家长端放序号方块。有图时 https:// 开头，或站内的 / 路径。"
              >
                <TextInput value={step.imageUrl} maxLength={512} onChange={e => patchStep(index, { imageUrl: e.target.value })} />
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

      {draft.guide ? (
        <GuideEditor guide={draft.guide} onChange={guide => onPatch({ guide })} />
      ) : (
        // 後台不新增腳本：腳本是客戶交的（現在只有模組一），由抽取腳本寫進內容遷移。
        <p className="mt-4 text-[11px] text-brand-charcoal/45">这支没有影片导引脚本（目前只有模组一的 20 支有）。</p>
      )}

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Field label="示范链接（选填）" hint="https:// 开头，或站内的 / 路径。http:// 会被家长的浏览器挡掉。">
          <TextInput value={draft.videoUrl} maxLength={512} onChange={e => onPatch({ videoUrl: e.target.value })} />
        </Field>
        <Field label="示范片封面（选填）" hint="网址规则同示范链接。">
          <TextInput value={draft.posterUrl} maxLength={512} onChange={e => onPatch({ posterUrl: e.target.value })} />
        </Field>
        <Field label="示范片长度（秒）" hint={`选填，1–${MAX_VIDEO_SECONDS}。家长端显示成「0:10」。`}>
          <TextInput inputMode="numeric" value={draft.videoSeconds} onChange={e => onPatch({ videoSeconds: e.target.value })} />
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
 * 模組一的影片導引腳本（Keep 規格 §4.2）。預設收起：二十支裡只有它們有，而且一份很長。
 *
 * 原理、常做錯、進步指標是「一行一條」；分鏡與孩子的反應是一列一列的，可以加減。
 * 只能改、不能整份刪掉（`readActivityPatch`：刪掉就是 NULL，內容遷移重跑會把原文填回來）。
 * 草稿與腳本的來回在 `activityGuide.ts`（`guideToDraft`／`guideFromDraft`，有測試）。
 */
function GuideEditor({ guide, onChange }: { guide: GuideDraft; onChange: (next: GuideDraft) => void }) {
  const [open, setOpen] = useState(false);
  const patch = (change: Partial<GuideDraft>) => onChange({ ...guide, ...change });
  const name = GUIDE_SECTION_NAMES;
  const linesHint = `一行一条，最多 ${MAX_GUIDE_ITEMS} 条`;

  return (
    <fieldset className="mt-4 rounded-xl border border-brand-stone bg-white p-3" data-testid="activity-guide-editor">
      <legend className="px-1 text-[11px] font-bold text-brand-charcoal/70">
        影片导引脚本（模组一）
        <button type="button" onClick={() => setOpen(!open)} className="ml-2 font-medium text-brand-moss underline">
          {open ? '收起' : '展开'}
        </button>
      </legend>
      {!open ? (
        <p className="text-[10px] text-brand-charcoal/45">
          {guide.length || '片长未填'} · {guide.shots.length} 个分镜 · {guide.reactions.length} 则孩子的反应
        </p>
      ) : (
        <div className="space-y-3">
          <p className="text-[10px] leading-relaxed text-brand-charcoal/45">
            客户原文。只能改，不能整份删掉；单段文字清空＝家长端不显示那一段。
          </p>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={name.length}>
              <TextInput value={guide.length} maxLength={MAX_GUIDE_TEXT} onChange={e => patch({ length: e.target.value })} />
            </Field>
            <div className="sm:col-span-2">
              <Field label={name.intro}>
                <TextArea rows={3} value={guide.intro} maxLength={MAX_GUIDE_TEXT} onChange={e => patch({ intro: e.target.value })} />
              </Field>
            </div>
          </div>

          <Field label={name.principles} hint={linesHint}>
            <TextArea rows={9} value={guide.principles} onChange={e => patch({ principles: e.target.value })} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            {GUIDE_PREP_KEYS.map(key => (
              <Field key={key} label={`${name.prep}·${key}`}>
                <TextArea
                  rows={2}
                  value={guide.prep[key]}
                  maxLength={MAX_GUIDE_TEXT}
                  onChange={e => patch({ prep: { ...guide.prep, [key]: e.target.value } })}
                />
              </Field>
            ))}
          </div>

          <RowList
            title={`${name.shots}（名称与旁白；画面描述不在这里）`}
            rows={guide.shots}
            empty={{ name: '', say: '' }}
            onChange={shots => patch({ shots })}
            fields={[
              { key: 'name', label: '名称', rows: 1 },
              { key: 'say', label: '旁白', rows: 2 },
            ]}
          />

          <RowList
            title={name.reactions}
            rows={guide.reactions}
            empty={{ if: '', then: '' }}
            onChange={reactions => patch({ reactions })}
            fields={[
              { key: 'if', label: '如果', rows: 2 },
              { key: 'then', label: '怎么做', rows: 2 },
            ]}
          />

          <Field label={name.mistakes} hint={linesHint}>
            <TextArea rows={3} value={guide.mistakes} onChange={e => patch({ mistakes: e.target.value })} />
          </Field>

          <div className="grid gap-3 sm:grid-cols-2">
            <Field label={name.down}>
              <TextArea rows={2} value={guide.down} maxLength={MAX_GUIDE_TEXT} onChange={e => patch({ down: e.target.value })} />
            </Field>
            <Field label={name.up}>
              <TextArea rows={2} value={guide.up} maxLength={MAX_GUIDE_TEXT} onChange={e => patch({ up: e.target.value })} />
            </Field>
          </div>

          <Field label={name.progress} hint={`${linesHint}。打卡时家长勾的就是这几条。`}>
            <TextArea rows={3} value={guide.progress} onChange={e => patch({ progress: e.target.value })} />
          </Field>

          <Field label={name.outro}>
            <TextArea rows={2} value={guide.outro} maxLength={MAX_GUIDE_TEXT} onChange={e => patch({ outro: e.target.value })} />
          </Field>
        </div>
      )}
    </fieldset>
  );
}

/**
 * 腳本裡「一列好幾格」的清單（分鏡、孩子的反應）：可加一列、刪一列，上限 `MAX_GUIDE_ITEMS`。
 * 整列空白的存檔時丟掉；只填一半的留著給伺服器說是第幾則（`guideFromDraft`）。
 */
function RowList<K extends string>({
  title,
  rows,
  empty,
  fields,
  onChange,
}: {
  title: string;
  rows: Array<Record<K, string>>;
  empty: Record<K, string>;
  fields: ReadonlyArray<{ key: K; label: string; rows: number }>;
  onChange: (next: Array<Record<K, string>>) => void;
}) {
  return (
    <div className="space-y-2">
      <p className="text-[11px] font-bold text-brand-charcoal/70">{title}</p>
      {rows.map((row, index) => (
        <div key={index} className="flex items-start gap-2">
          <span className="w-5 shrink-0 pt-2 text-[10px] font-bold text-brand-charcoal/45">{index + 1}</span>
          <div className="grid flex-1 gap-2 sm:grid-cols-2">
            {fields.map(f => (
              <TextArea
                key={f.key}
                rows={f.rows}
                aria-label={`第 ${index + 1} 则·${f.label}`}
                placeholder={f.label}
                value={row[f.key]}
                maxLength={MAX_GUIDE_TEXT}
                onChange={e => onChange(rows.map((r, i) => (i === index ? { ...r, [f.key]: e.target.value } : r)))}
              />
            ))}
          </div>
          <IconButton label="删除这一则" onClick={() => onChange(rows.filter((_, i) => i !== index))}>
            <Trash2 size={12} />
          </IconButton>
        </div>
      ))}
      <Button variant="ghost" onClick={() => onChange([...rows, { ...empty }])} disabled={rows.length >= MAX_GUIDE_ITEMS}>
        <Plus size={12} />
        加一则
      </Button>
    </div>
  );
}

/**
 * 依維度分組的標籤勾選。每個標籤顯示「中文短名 · 英文碼」（v2.1 S15，客戶 9/21 工作單 #19）：
 * 短名給內容團隊一眼認出是哪一個，英文碼照樣露出來 —— 存進活動庫的、量表規則表產出的都是它，
 * 對帳時兩邊講的是同一組字。滑鼠停上去看得到報告裡那一句固定說法。
 *
 * 短名只在後台（`FINDING_TAG_LABELS` 檔頭）：「心情底色偏低」這種字不能進家長端。
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
                <label key={tag} title={TAG_SENTENCES[tag]} className="flex items-center gap-1 text-[11px] text-brand-charcoal/70">
                  <input
                    type="checkbox"
                    className="accent-brand-forest"
                    checked={selected.includes(tag)}
                    onChange={e => onChange(e.target.checked ? [...selected, tag] : selected.filter(x => x !== tag))}
                  />
                  {FINDING_TAG_LABELS[tag]}
                  <span className="font-mono text-brand-charcoal/45">· {tag}</span>
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
