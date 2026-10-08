/**
 * 後台「示范片与标签」分頁（使用者 2026-10-08）：客戶自己把 300 支示範片傳上來、一支一支下標籤。
 * 給非技術人員用 —— 不碰 JSON、不看英文標籤碼：
 *
 * 1. **上傳**：一次選很多個 mp4，檔名認編號（`A001.mp4`、`001 我们来爬行.mp4` 都行），一支接一支傳、有進度；
 *    封面與片長由瀏覽器抽（`videoFrame.ts`）。單支也可以在右邊直接換片。
 * 2. **標籤**：左邊清單（篩「还没标好」），右邊看片、選「适合几个月」（下拉、附幾歲幾個月，手冊適齡給建議值）、
 *    點「练什么」（中文、依能力分組），按「存档，下一支」。
 *
 * 標籤＝現有那套「练什么」（★ 可配活動的標籤）＋目標月齡，存的欄位與「活动库」分頁同一組（PATCH）。
 * ⚠️ 舊的每週配對讀這兩欄；v3 推送（`TRAINING_PUSH_V3`，客戶 10/06）**不讀**（看模組與手冊適齡），
 * 所以畫面上的字不說「標了才會推給家長」。
 * 有後台帳號（全域管理員）就能標，不另設審核（使用者同日）。只在專案 A（B 沒有活動與片子）。
 */

import { useCallback, useMemo, useRef, useState } from 'react';
import { Check, Film, Upload } from 'lucide-react';
import { adminApi } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import type { Activity, DimensionCode } from '../../t2/types';
import { SITE_DIMENSION_NAME } from '../../t2/dimensionMap';
import { MODULE_TITLES } from '../../t2/activitySeed';
import { ACTIVITY_TAGS, TAG_DIMENSIONS, tagDimension, type ActivityTag, type TagDimension } from '../../t2/findingTags';
import { FINDING_TAG_LABELS } from '../findingTagLabels';
import { TAG_SENTENCES } from '../../t2/report/sentences';
import { readVideoInfo } from '../videoFrame';
import {
  TAGGING_STATE_LABEL,
  ageRangeText,
  filterForTagging,
  monthOptions,
  monthText,
  nextActivityId,
  planUploads,
  suggestedTargetMonth,
  taggingProgress,
  taggingState,
  type TaggingFilter,
  type UploadItem,
} from '../videoTagging';
import { Button, ErrorNote, Panel, Select, Spinner, TextInput, toErrorView, useAsyncData } from '../ui';

const TAG_DIMENSION_CODE: Readonly<Record<TagDimension, DimensionCode | null>> = {
  lang: 'LANG', soc: 'SOC', emo: 'EMO', att: 'ATT', mot: 'MOT',
  sen: 'SEN', adl: 'ADL', cog: 'COG', learn: 'LEARN', severity: null,
};
const TAG_GROUPS = TAG_DIMENSIONS
  .map(dim => ({ dim, tags: ACTIVITY_TAGS.filter(t => tagDimension(t) === dim) }))
  .filter(g => g.tags.length > 0);
const MONTH_OPTIONS = monthOptions();
const FILTERS: TaggingFilter[] = ['untagged', 'no_video', 'done', 'all'];
const FILTER_LABEL: Record<TaggingFilter, string> = { ...TAGGING_STATE_LABEL, all: '全部' };

export default function VideoTaggingPanel({ onError }: { onError: (view: AdminErrorView) => void }) {
  const load = useCallback(() => adminApi.activities(), []);
  const { data, loading, failure, reload } = useAsyncData(load, [], onError);
  // 存過／傳過的那幾支蓋在讀回來的列表上（伺服器回整支）。
  const [updated, setUpdated] = useState<Record<string, Activity>>({});
  const [filter, setFilter] = useState<TaggingFilter>('untagged');
  const [query, setQuery] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const activities = useMemo(() => (data?.activities ?? []).map(a => updated[a.id] ?? a), [data, updated]);
  const progress = taggingProgress(activities);
  const list = filterForTagging(activities, filter, query);
  const selected = activities.find(a => a.id === selectedId) ?? null;
  const replace = (a: Activity) => setUpdated(prev => ({ ...prev, [a.id]: a }));

  return (
    <Panel
      title="示范片与标签"
      description="上传每支活动的示范片，再替它选「适合几个月」和「练什么」。两样都选好，就算标好了。"
    >
      {loading && <Spinner />}
      {failure && <ErrorNote message={failure} onRetry={reload} />}
      {data && (
        <>
          <div className="flex flex-wrap gap-3">
            <Stat label="有示范片" value={progress.withVideo} total={progress.total} />
            <Stat label="已标好" value={progress.done} total={progress.total} />
          </div>

          <BulkUpload activities={activities} onUploaded={replace} />

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {FILTERS.map(f => (
              <button
                key={f}
                type="button"
                onClick={() => setFilter(f)}
                className={`rounded-full px-3 py-1 text-xs font-bold ${filter === f ? 'bg-brand-forest text-white' : 'bg-brand-cream text-brand-charcoal/70'}`}
              >
                {FILTER_LABEL[f]}
              </button>
            ))}
            <TextInput
              value={query}
              onChange={e => setQuery(e.target.value)}
              placeholder="搜寻编号或名称"
              className="ml-auto w-44"
              aria-label="搜寻编号或名称"
            />
          </div>

          <div className="mt-3 grid gap-4 md:grid-cols-[240px_1fr]">
            <ul className="max-h-[70vh] overflow-y-auto rounded-2xl border border-brand-stone" aria-label="活动清单">
              {list.length === 0 && <li className="p-4 text-xs text-brand-charcoal/50">这里没有活动。</li>}
              {list.map(a => (
                <li key={a.id}>
                  <button
                    type="button"
                    onClick={() => setSelectedId(a.id)}
                    className={`flex w-full items-center gap-2 border-b border-brand-stone/60 px-3 py-2 text-left text-xs ${a.id === selectedId ? 'bg-brand-cream' : ''}`}
                  >
                    <span className="font-mono text-brand-charcoal/50">{a.id}</span>
                    <span className="flex-1 truncate text-brand-charcoal">{a.title}</span>
                    <StateDot activity={a} />
                  </button>
                </li>
              ))}
            </ul>

            {selected ? (
              <Workbench
                key={selected.id}
                activity={selected}
                onSaved={a => replace(a)}
                onNext={() => {
                  const next = nextActivityId(filterForTagging(activities, filter, query), selected.id);
                  if (next) setSelectedId(next);
                }}
              />
            ) : (
              <div className="rounded-2xl border border-dashed border-brand-stone p-8 text-center text-sm text-brand-charcoal/50">
                从左边选一支活动开始。
              </div>
            )}
          </div>
        </>
      )}
    </Panel>
  );
}

function Stat({ label, value, total }: { label: string; value: number; total: number }) {
  return (
    <div className="rounded-2xl bg-brand-cream px-4 py-2">
      <div className="text-[11px] text-brand-charcoal/60">{label}</div>
      <div className="text-lg font-bold text-brand-forest">
        {value} <span className="text-xs font-medium text-brand-charcoal/50">/ {total}</span>
      </div>
    </div>
  );
}

function StateDot({ activity }: { activity: Activity }) {
  const state = taggingState(activity);
  const color = state === 'done' ? 'bg-emerald-500' : state === 'untagged' ? 'bg-amber-400' : 'bg-brand-stone';
  return <span className={`h-2 w-2 shrink-0 rounded-full ${color}`} title={TAGGING_STATE_LABEL[state]} aria-label={TAGGING_STATE_LABEL[state]} />;
}

/** 傳一支：讀片長、抽封面 → 傳片（有進度）→ 傳封面。回最後那一份活動。 */
async function uploadOne(activityId: string, file: File, onProgress: (f: number) => void): Promise<Activity> {
  const info = await readVideoInfo(file);
  let { activity } = await adminApi.uploadActivityMedia(activityId, 'video', file, { seconds: info.seconds, onProgress });
  if (info.poster) ({ activity } = await adminApi.uploadActivityMedia(activityId, 'poster', info.poster));
  return activity;
}

function BulkUpload({ activities, onUploaded }: { activities: Activity[]; onUploaded: (a: Activity) => void }) {
  const [items, setItems] = useState<UploadItem[]>([]);
  const [running, setRunning] = useState(false);
  const input = useRef<HTMLInputElement>(null);

  async function start(files: File[]) {
    const planned = planUploads(files, new Set(activities.map(a => a.id)));
    setItems(planned);
    setRunning(true);
    const set = (i: number, change: Partial<UploadItem>) => setItems(prev => prev.map((x, j) => (j === i ? { ...x, ...change } : x)));
    for (let i = 0; i < planned.length; i++) {
      const item = planned[i];
      if (item.status !== 'waiting' || !item.activityId) continue;
      set(i, { status: 'uploading' });
      try {
        onUploaded(await uploadOne(item.activityId, item.file, p => set(i, { progress: p })));
        set(i, { status: 'done', progress: 1 });
      } catch (err) {
        set(i, { status: 'failed', message: toErrorView(err).message });
      }
    }
    setRunning(false);
  }

  const done = items.filter(x => x.status === 'done').length;
  const toUpload = items.filter(x => x.status !== 'skipped').length;
  return (
    <div className="mt-5 rounded-2xl border border-brand-stone p-4">
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" busy={running} onClick={() => input.current?.click()}>
          <Upload size={14} /> 一次上传很多支
        </Button>
        <span className="text-xs text-brand-charcoal/60">
          可以一次选好几个 mp4。档名要有活动编号，例如「A001.mp4」或「001 我们来爬行.mp4」；同一个编号再传一次会换掉旧的。
        </span>
        <input
          ref={input}
          type="file"
          accept="video/mp4,.mp4"
          multiple
          hidden
          onChange={e => {
            const files = Array.from(e.target.files ?? []);
            e.target.value = '';
            if (files.length) void start(files);
          }}
        />
      </div>
      {items.length > 0 && (
        <div className="mt-3">
          <div className="text-xs font-bold text-brand-charcoal/70">
            {running ? `上传中：${done} / ${toUpload}` : `完成 ${done} / ${toUpload}`}
          </div>
          <ul className="mt-2 max-h-56 space-y-1 overflow-y-auto text-xs">
            {items.map((x, i) => (
              <li key={i} className="flex items-center gap-2">
                <span className="w-12 font-mono text-brand-charcoal/50">{x.activityId ?? '—'}</span>
                <span className="flex-1 truncate">{x.file.name}</span>
                <span
                  className={
                    x.status === 'done' ? 'text-emerald-600' : x.status === 'failed' || x.status === 'skipped' ? 'text-red-600' : 'text-brand-charcoal/60'
                  }
                >
                  {x.status === 'waiting' && '等待中'}
                  {x.status === 'uploading' && `上传中 ${Math.round(x.progress * 100)}%`}
                  {x.status === 'done' && '完成'}
                  {(x.status === 'failed' || x.status === 'skipped') && `没有上传：${x.message}`}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Workbench({ activity, onSaved, onNext }: { activity: Activity; onSaved: (a: Activity) => void; onNext: () => void }) {
  const [targetMonth, setTargetMonth] = useState<number | null>(activity.targetMonth);
  const [targets, setTargets] = useState<ActivityTag[]>(activity.targets);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const suggestion = suggestedTargetMonth(activity.ageMonths);
  const dirty = targetMonth !== activity.targetMonth || targets.length !== activity.targets.length || targets.some(t => !activity.targets.includes(t));

  async function save(thenNext: boolean) {
    setBusy(true);
    setMessage(null);
    try {
      const { activity: next } = await adminApi.updateActivity(activity.id, { targetMonth, targets });
      onSaved(next);
      setMessage({ ok: true, text: '已存档。' });
      if (thenNext) onNext();
    } catch (err) {
      setMessage({ ok: false, text: toErrorView(err).message });
    } finally {
      setBusy(false);
    }
  }

  async function replaceVideo(file: File) {
    setMessage(null);
    if (!/\.mp4$/i.test(file.name)) {
      setMessage({ ok: false, text: '只收 mp4 档。' });
      return;
    }
    setUploading(0);
    try {
      onSaved(await uploadOne(activity.id, file, p => setUploading(p)));
      setMessage({ ok: true, text: '示范片已上传。' });
    } catch (err) {
      setMessage({ ok: false, text: toErrorView(err).message });
    } finally {
      setUploading(null);
    }
  }

  return (
    <div className="rounded-2xl border border-brand-stone p-4">
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="font-mono text-xs text-brand-charcoal/50">{activity.id}</span>
        <h3 className="text-base font-bold text-brand-charcoal">{activity.title}</h3>
        <span className="text-xs text-brand-charcoal/50">模组 {activity.moduleNo} · {MODULE_TITLES[activity.moduleNo]}</span>
        {!activity.active && <span className="rounded bg-brand-stone px-1.5 text-[10px]">已停用</span>}
      </div>

      <div className="mt-3">
        {activity.videoUrl ? (
          <video
            key={activity.videoUrl}
            src={activity.videoUrl}
            poster={activity.posterUrl ?? undefined}
            controls
            playsInline
            preload="metadata"
            className="aspect-video w-full rounded-xl bg-black"
          />
        ) : (
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 rounded-xl bg-brand-cream text-sm text-brand-charcoal/50">
            <Film size={28} />
            这支还没有示范片
          </div>
        )}
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <Button type="button" variant="ghost" busy={uploading !== null} onClick={() => fileInput.current?.click()}>
            <Upload size={14} /> {activity.videoUrl ? '换一支示范片' : '上传示范片'}
          </Button>
          {uploading !== null && <span className="text-xs text-brand-charcoal/60">上传中 {Math.round(uploading * 100)}%</span>}
          {activity.videoSeconds && <span className="text-xs text-brand-charcoal/50">片长 {activity.videoSeconds} 秒</span>}
          <input
            ref={fileInput}
            type="file"
            accept="video/mp4,.mp4"
            hidden
            onChange={e => {
              const f = e.target.files?.[0];
              e.target.value = '';
              if (f) void replaceVideo(f);
            }}
          />
        </div>
      </div>

      <div className="mt-5">
        <label className="text-sm font-bold text-brand-charcoal" htmlFor={`tm-${activity.id}`}>
          适合几个月的孩子
        </label>
        <p className="text-xs text-brand-charcoal/50">手册写的适龄：{ageRangeText(activity)}。选这支活动最适合的月龄。</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2">
          <Select
            id={`tm-${activity.id}`}
            value={targetMonth === null ? '' : String(targetMonth)}
            onChange={e => setTargetMonth(e.target.value === '' ? null : Number(e.target.value))}
            className="w-56"
          >
            <option value="">（还没选）</option>
            {MONTH_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </Select>
          {suggestion !== targetMonth && (
            <button type="button" className="text-xs font-bold text-brand-moss underline" onClick={() => setTargetMonth(suggestion)}>
              用建议值：{suggestion} 个月（{monthText(suggestion)}）
            </button>
          )}
        </div>
      </div>

      <fieldset className="mt-5">
        <legend className="text-sm font-bold text-brand-charcoal">练什么（可以选好几个）</legend>
        <p className="text-xs text-brand-charcoal/50">选这支活动主要在练哪些地方。把鼠标停在选项上可以看说明。</p>
        <div className="mt-2 space-y-2">
          {TAG_GROUPS.map(g => (
            <div key={g.dim} className="flex flex-wrap items-center gap-1.5">
              <span className="w-24 shrink-0 text-xs text-brand-charcoal/60">
                {TAG_DIMENSION_CODE[g.dim] ? SITE_DIMENSION_NAME[TAG_DIMENSION_CODE[g.dim]!] : '其他'}
              </span>
              {g.tags.map(tag => {
                const on = targets.includes(tag);
                return (
                  <button
                    key={tag}
                    type="button"
                    title={TAG_SENTENCES[tag]}
                    aria-pressed={on}
                    onClick={() => setTargets(on ? targets.filter(t => t !== tag) : [...targets, tag])}
                    className={`flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs ${
                      on ? 'border-brand-forest bg-brand-forest text-white' : 'border-brand-stone bg-white text-brand-charcoal/80'
                    }`}
                  >
                    {on && <Check size={12} />}
                    {FINDING_TAG_LABELS[tag]}
                  </button>
                );
              })}
            </div>
          ))}
        </div>
      </fieldset>

      <div className="mt-5 flex flex-wrap items-center gap-2">
        <Button type="button" busy={busy} disabled={!dirty} onClick={() => void save(false)}>
          存档
        </Button>
        <Button type="button" variant="ghost" busy={busy} onClick={() => (dirty ? void save(true) : onNext())}>
          {dirty ? '存档，下一支' : '下一支'}
        </Button>
        {dirty && <span className="text-xs text-amber-700">有还没存的修改</span>}
        {message && <span className={`text-xs ${message.ok ? 'text-emerald-700' : 'text-red-600'}`}>{message.text}</span>}
      </div>
    </div>
  );
}
