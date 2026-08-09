/**
 * 素材庫維護（issue #20）。
 *
 * 這一頁決定了家長在深度評估之後拿到的訓練步驟。畫面的組織方式就是資料的形狀：
 * **一個維度十格**（五個年齡段 × 兩級嚴重度），一次只看一個維度的十格，
 * 而不是把 90 格攤成一張長列表 —— 攤開的話沒有人看得出來哪一段還沒做。
 *
 * 「未建立」與「已停用」在畫面上刻意分得開。對家長來說結果一樣（都拿不到素材），
 * 對維護的人完全不同：一個是還沒做，一個是做了又收回去。
 */
import { useCallback, useState } from 'react';
import { ArrowDown, ArrowUp, Plus, Save, Trash2, X } from 'lucide-react';
import { adminApi, type AdminMaterial, type AdminMaterialInput } from '../adminApi';
import { formatDateTime, statusLabel, type AdminErrorView } from '../adminView';
import { DIMENSIONS_DATA } from '../../data';
import {
  cellsForDimension,
  coverageOf,
  MAX_STEPS,
  type MaterialCell,
  type MaterialStep,
} from '../../utils/materialCells';
import {
  Button,
  ErrorNote,
  Field,
  Panel,
  Select,
  Spinner,
  StatusBadge,
  TextArea,
  TextInput,
  toErrorView,
  useAsyncData,
} from '../ui';

interface Draft {
  title: string;
  steps: MaterialStep[];
  videoUrl: string;
  active: boolean;
}

const EMPTY_STEP: MaterialStep = { imageUrl: '', instruction: '' };

function toDraft(material: AdminMaterial | null): Draft {
  if (!material) return { title: '', steps: [{ ...EMPTY_STEP }], videoUrl: '', active: true };
  return {
    title: material.title,
    // 至少留一則空步驟，編輯畫面才不會是一片空白（步驟本來就不允許是空的）。
    steps: material.steps.length ? material.steps.map(s => ({ ...s })) : [{ ...EMPTY_STEP }],
    videoUrl: material.videoUrl ?? '',
    active: material.active,
  };
}

function toInput(cell: MaterialCell, draft: Draft): AdminMaterialInput {
  return {
    dimensionId: cell.dimensionId,
    ageBandId: cell.ageBandId,
    severity: cell.severity,
    title: draft.title.trim(),
    steps: draft.steps.map(s => ({ imageUrl: s.imageUrl.trim(), instruction: s.instruction.trim() })),
    videoUrl: draft.videoUrl.trim() ? draft.videoUrl.trim() : null,
    active: draft.active,
  };
}

export default function MaterialsPanel({ onError }: { onError: (view: AdminErrorView) => void }) {
  const load = useCallback(() => adminApi.materials(), []);
  const { data, loading, failure, reload } = useAsyncData(load, [], onError);
  const [dimensionId, setDimensionId] = useState(DIMENSIONS_DATA[0].id);
  const [editing, setEditing] = useState<{ cell: MaterialCell; id: number | null; draft: Draft } | null>(null);
  const [saveFailure, setSaveFailure] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const materials = data?.materials ?? [];
  const coverage = coverageOf(materials);
  const rows = cellsForDimension(dimensionId, materials);

  function edit(cell: MaterialCell, material: AdminMaterial | null) {
    setSaveFailure(null);
    setEditing({ cell, id: material?.id ?? null, draft: toDraft(material) });
  }

  function patch(change: Partial<Draft>) {
    if (editing) setEditing({ ...editing, draft: { ...editing.draft, ...change } });
  }

  function patchStep(index: number, change: Partial<MaterialStep>) {
    if (!editing) return;
    patch({ steps: editing.draft.steps.map((s, i) => (i === index ? { ...s, ...change } : s)) });
  }

  /** 步驟的順序就是家長照著做的順序，因此換位置是這一頁的主要動作之一。 */
  function moveStep(index: number, delta: number) {
    if (!editing) return;
    const target = index + delta;
    if (target < 0 || target >= editing.draft.steps.length) return;
    const steps = [...editing.draft.steps];
    [steps[index], steps[target]] = [steps[target], steps[index]];
    patch({ steps });
  }

  function removeStep(index: number) {
    if (!editing) return;
    const steps = editing.draft.steps.filter((_, i) => i !== index);
    patch({ steps: steps.length ? steps : [{ ...EMPTY_STEP }] });
  }

  async function save() {
    if (!editing) return;
    setBusy(true);
    setSaveFailure(null);
    try {
      const input = toInput(editing.cell, editing.draft);
      if (editing.id === null) await adminApi.createMaterial(input);
      else await adminApi.updateMaterial(editing.id, input);
      setEditing(null);
      reload();
    } catch (err) {
      const view = toErrorView(err);
      // 內容不合格（400）與這一格已經有素材（409）都是「這次沒存成功」，
      // 訊息要留在表單旁邊 —— 送去外層的殼會讓表單連同已經打好的字一起消失。
      if (view.action === 'none') setSaveFailure(view.message);
      else onError(view);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Panel
      title="素材库"
      description="干预素材以（维度，年龄段，严重度）为索引，共 90 格。内容以图文为主：每则步骤一张分解图配一句指令，影片链接选填。不再使用的素材请「停用」，不要清空内容——停用后家长端不再取到它，内容还在。"
    >
      {loading ? (
        <Spinner label="正在读取素材库…" />
      ) : failure ? (
        // 讀取失敗與「一格都还没建立」是两件事。混成同一个画面的话，
        // 没跑迁移会被看成「还没有人建素材」，然后一路带到家长端。
        <ErrorNote message={failure} onRetry={reload} />
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
            <div className="min-w-[14rem]">
              <Field label="维度">
                <Select
                  value={dimensionId}
                  onChange={e => {
                    setDimensionId(e.target.value);
                    setEditing(null);
                  }}
                >
                  {DIMENSIONS_DATA.map(d => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </Select>
              </Field>
            </div>
            <p className="text-[11px] text-brand-charcoal/50">
              全库进度：已建立 {coverage.filled} / {coverage.total} 格
              <span className="ml-1.5">（启用中 {coverage.active} 格）</span>
            </p>
          </div>

          {/*
            正常情况下永远不显示。维度改名后会出现：旧的 dimension_id 还在
            资料库里，但没有任何一格对得上它——那些素材在这一页点不到，
            也不会被任何一个孩子取到。不说出来的话，只会看到进度数字对不起来。
          */}
          {coverage.orphaned > 0 && (
            <div className="mb-4">
              <ErrorNote
                message={`有 ${coverage.orphaned} 笔素材的维度或年龄段不在目前的 90 格之内（多半是维度改名后留下的旧资料）。它们在这一页点不到，家长端也取不到——请连络开发处理。`}
              />
            </div>
          )}

          {coverage.filled === 0 && (
            <p className="mb-4 rounded-2xl border border-brand-stone bg-brand-cream/40 px-4 py-3 text-[11px] leading-relaxed text-brand-charcoal/60">
              素材库是空的——90 格都还没有建立。空的格子在家长端会明确显示「准备中」并导向专家咨询，
              不会退回邻近年龄段或通用方案：把学龄前的训练给一岁半的孩子，他做不到，家长会以为孩子又失败了一次。
            </p>
          )}

          {editing && (
            <Editor
              cell={editing.cell}
              isNew={editing.id === null}
              draft={editing.draft}
              busy={busy}
              failure={saveFailure}
              onPatch={patch}
              onPatchStep={patchStep}
              onMoveStep={moveStep}
              onRemoveStep={removeStep}
              onAddStep={() => patch({ steps: [...editing.draft.steps, { ...EMPTY_STEP }] })}
              onSave={() => void save()}
              onCancel={() => {
                setEditing(null);
                setSaveFailure(null);
              }}
            />
          )}

          <ul className="space-y-2">
            {rows.map(({ cell, material }) => (
              <li
                key={`${cell.ageBandId}/${cell.severity}`}
                className="flex flex-wrap items-start justify-between gap-3 rounded-2xl border border-brand-stone px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="flex flex-wrap items-center gap-2 text-xs font-bold text-brand-forest">
                    {cell.ageBandName}
                    <StatusBadge status={cell.severity}>{statusLabel(cell.severity)}</StatusBadge>
                    {material && !material.active && (
                      <span className="rounded-lg border border-brand-stone bg-brand-sage px-1.5 py-0.5 text-[10px] font-medium text-brand-charcoal/60">
                        已停用
                      </span>
                    )}
                  </p>
                  {material ? (
                    <>
                      <p className="mt-1 text-[11px] text-brand-charcoal/70">{material.title}</p>
                      <p className="mt-0.5 text-[10px] text-brand-charcoal/45">
                        {material.steps.length} 则分解步骤
                        {material.videoUrl ? ' · 附影片链接' : ' · 无影片'}
                        {material.updatedAt && ` · 最后更新 ${formatDateTime(material.updatedAt)}`}
                      </p>
                    </>
                  ) : (
                    <p className="mt-1 text-[11px] text-brand-charcoal/45">
                      尚未建立——家长端在这一格会显示「准备中」并导向专家咨询。
                    </p>
                  )}
                </div>
                <Button variant="ghost" onClick={() => edit(cell, material)}>
                  {material ? '编辑' : (
                    <>
                      <Plus size={12} />
                      新增
                    </>
                  )}
                </Button>
              </li>
            ))}
          </ul>
        </>
      )}
    </Panel>
  );
}

function Editor({
  cell,
  isNew,
  draft,
  busy,
  failure,
  onPatch,
  onPatchStep,
  onMoveStep,
  onRemoveStep,
  onAddStep,
  onSave,
  onCancel,
}: {
  cell: MaterialCell;
  isNew: boolean;
  draft: Draft;
  busy: boolean;
  failure: string | null;
  onPatch: (change: Partial<Draft>) => void;
  onPatchStep: (index: number, change: Partial<MaterialStep>) => void;
  onMoveStep: (index: number, delta: number) => void;
  onRemoveStep: (index: number) => void;
  onAddStep: () => void;
  onSave: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="mb-5 rounded-2xl border border-brand-stone bg-brand-cream/40 p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-bold text-brand-forest">{isNew ? '新增素材' : '编辑素材'}</p>
          {/* 格子写在标题上，而不是做成三个下拉：这一格是从列表点进来的，
              让它在表单里可改只会制造「存到别格去了」这一种错误。 */}
          <p className="mt-1 text-[10px] text-brand-charcoal/50">
            {cell.dimensionName} · {cell.ageBandName} · {statusLabel(cell.severity)}
          </p>
        </div>
        <button
          onClick={onCancel}
          aria-label="取消"
          className="rounded-lg p-1 text-brand-charcoal/50 transition hover:bg-white"
        >
          <X size={13} />
        </button>
      </div>

      <Field label="标题（必填）">
        <TextInput value={draft.title} maxLength={128} onChange={e => onPatch({ title: e.target.value })} />
      </Field>

      <div className="mt-4 space-y-3">
        <p className="text-[11px] font-bold text-brand-charcoal/70">
          分解步骤（至少一则，最多 {MAX_STEPS} 则）
          <span className="ml-1.5 font-medium text-brand-charcoal/45">
            顺序就是家长照着做的顺序
          </span>
        </p>

        {draft.steps.map((step, index) => (
          <div key={index} className="rounded-xl border border-brand-stone bg-white p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-[11px] font-bold text-brand-forest">第 {index + 1} 步</span>
              <div className="flex items-center gap-1">
                <IconButton label="上移" disabled={index === 0} onClick={() => onMoveStep(index, -1)}>
                  <ArrowUp size={12} />
                </IconButton>
                <IconButton
                  label="下移"
                  disabled={index === draft.steps.length - 1}
                  onClick={() => onMoveStep(index, 1)}
                >
                  <ArrowDown size={12} />
                </IconButton>
                <IconButton label="删除这一步" onClick={() => onRemoveStep(index)}>
                  <Trash2 size={12} />
                </IconButton>
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <Field label="分解图网址" hint="https:// 开头，或站内的 / 路径。http:// 的图会被浏览器挡掉，家长看到的是破图。">
                <TextInput
                  value={step.imageUrl}
                  maxLength={512}
                  onChange={e => onPatchStep(index, { imageUrl: e.target.value })}
                />
              </Field>
              <Field label="指令文字">
                <TextArea
                  rows={2}
                  value={step.instruction}
                  maxLength={500}
                  onChange={e => onPatchStep(index, { instruction: e.target.value })}
                />
              </Field>
            </div>
          </div>
        ))}

        <Button variant="ghost" onClick={onAddStep} disabled={draft.steps.length >= MAX_STEPS}>
          <Plus size={12} />
          加一步
        </Button>
      </div>

      <div className="mt-4">
        <Field label="影片链接（选填）" hint="图文才是主体：家长在网络不好的时候仍然看得到步骤，影片是加分项。">
          <TextInput
            value={draft.videoUrl}
            maxLength={512}
            onChange={e => onPatch({ videoUrl: e.target.value })}
          />
        </Field>
      </div>

      <label className="mt-3 flex items-center gap-2 text-xs text-brand-charcoal/70">
        <input
          type="checkbox"
          checked={draft.active}
          onChange={e => onPatch({ active: e.target.checked })}
          className="accent-brand-forest"
        />
        启用（关闭后家长端在这一格显示「准备中」）
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

function IconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
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
