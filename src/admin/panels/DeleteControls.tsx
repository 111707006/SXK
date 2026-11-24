/**
 * 後台的停用與刪除（使用者 2026-11-23）：頁面內兩步確認（後台 viewer 不支援 window.confirm）。
 * - `TwoStepDelete`：停用的帳號、推薦人旁邊那一顆「删除」→「确认删除？」。
 * - `UnitStatusCell`：合作單位那一格：啟用中／已停用、停用與啟用、停用的才有「删除」，先讀預覽、照它講清楚再按。
 */
import { useState } from 'react';
import { adminApi, type AdminCompany } from '../adminApi';
import { unitDeleteSummary, type UnitDeletePreview } from '../unitDeletion';
import { Button } from '../ui';

const message = (err: unknown, fallback: string) => (err instanceof Error ? err.message : fallback);

export function TwoStepDelete({ onDelete, onDeleted, hint }: { onDelete: () => Promise<unknown>; onDeleted: () => void; hint?: string }) {
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const go = async () => {
    setBusy(true);
    setError(null);
    try {
      await onDelete();
      onDeleted();
    } catch (err) {
      setError(message(err, '删除失败。'));
      setConfirming(false);
    }
    setBusy(false);
  };
  return (
    <span className="inline-flex flex-col gap-1">
      <span className="inline-flex flex-wrap gap-1.5">
        {confirming ? (
          <>
            <Button variant="danger" busy={busy} onClick={() => void go()}>确认删除？</Button>
            <Button variant="ghost" disabled={busy} onClick={() => setConfirming(false)}>取消</Button>
          </>
        ) : (
          <Button variant="ghost" onClick={() => { setError(null); setConfirming(true); }}>删除</Button>
        )}
      </span>
      {confirming && hint && <span className="max-w-xs text-[10px] text-red-700">{hint}</span>}
      {error && <span className="max-w-xs text-[10px] font-bold text-red-700">{error}</span>}
    </span>
  );
}

export function UnitStatusCell({ company, onChanged }: { company: AdminCompany; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<UnitDeletePreview | null>(null);
  const run = async (job: () => Promise<unknown>, fallback: string) => {
    setBusy(true);
    setError(null);
    try {
      await job();
      return true;
    } catch (err) {
      setError(message(err, fallback));
      return false;
    } finally {
      setBusy(false);
    }
  };
  const toggle = async () => {
    if (await run(() => adminApi.setCompanyActive(company.id, !company.active), '更新失败。')) {
      setPreview(null);
      onChanged();
    }
  };
  const loadPreview = () => run(async () => setPreview((await adminApi.companyDeletePreview(company.id)).preview), '读取删除预览失败。');
  const remove = async () => {
    if (await run(() => adminApi.deleteCompany(company.id), '删除失败。')) {
      setPreview(null);
      onChanged();
    }
  };
  return (
    <div className="flex min-w-[180px] flex-col gap-1.5">
      <span className={company.active ? 'font-bold text-brand-moss' : 'text-brand-charcoal/50'}>{company.active ? '启用中' : '已停用'}</span>
      <span className="flex flex-wrap gap-1.5">
        <Button variant={company.active ? 'danger' : 'ghost'} busy={busy && !preview} disabled={busy} onClick={() => void toggle()}>
          {company.active ? '停用' : '重新启用'}
        </Button>
        {!company.active && !preview && (
          <Button variant="ghost" disabled={busy} onClick={() => void loadPreview()}>删除</Button>
        )}
      </span>
      {company.active && <span className="max-w-[220px] text-[10px] text-brand-charcoal/50">停用后：进站连结与兑换码不再挂到这个单位，单位管理者与推荐人登不进来；家长资料不动。</span>}
      {preview && (
        <div className="max-w-sm space-y-1.5 rounded-xl border border-red-200 bg-red-50/60 p-2.5 text-[11px] text-brand-charcoal/80" role="alert">
          <p className="font-bold text-red-800">删除「{preview.company.name}」会：</p>
          <ul className="list-disc space-y-0.5 pl-4">
            {unitDeleteSummary(preview).map(line => <li key={line}>{line}</li>)}
          </ul>
          {preview.blockers.length > 0 && (
            <div className="space-y-0.5 font-bold text-red-700">
              <p>现在不能删：</p>
              {preview.blockers.map(b => <p key={b.code}>{b.message}</p>)}
            </div>
          )}
          <span className="flex flex-wrap gap-1.5 pt-1">
            <Button variant="danger" busy={busy} disabled={preview.blockers.length > 0} onClick={() => void remove()}>确认删除</Button>
            <Button variant="ghost" disabled={busy} onClick={() => setPreview(null)}>取消</Button>
          </span>
        </div>
      )}
      {error && <span className="max-w-xs text-[10px] font-bold text-red-700">{error}</span>}
    </div>
  );
}
