/**
 * 家長詳情裡的「服务关系」一區（#119，ADR-0020；服務關係開關開著才畫）：現在由誰服務、標注／改派、改派紀錄。
 *
 * 權限由伺服器判（`canReassign`）：單位管理者只看得到本單位的選項（`/service-targets` 只回本單位），
 * 「森心康直属」那一項只給全域管理員；推薦人不畫改派（只讀紀錄）。
 */
import { useCallback, useEffect, useState } from 'react';
import { History, UserCheck } from 'lucide-react';
import { adminApi } from '../adminApi';
import {
  changeLine,
  referrerOptions,
  relationLabel,
  targetFromChoice,
  type ServiceTargets,
  type ServiceView,
} from '../../serviceRelations/adminView';
import { formatDateTime, type AdminErrorView } from '../adminView';
import { Button, ErrorNote, Select, Spinner, useAsyncData } from '../ui';

export default function ServiceRelationBlock({
  parentId,
  service,
  canEdit,
  canRemove,
  onChanged,
  onError,
}: {
  parentId: number;
  /** 列表那一列帶的服務關係（`null`＝森心康直屬）。 */
  service: ServiceView;
  /** 單位管理者、全域管理員。 */
  canEdit: boolean;
  /** 只有全域管理員能拿掉服務關係。 */
  canRemove: boolean;
  onChanged: () => void;
  onError: (view: AdminErrorView) => void;
}) {
  const loadChanges = useCallback(() => adminApi.serviceChanges(parentId), [parentId]);
  const changes = useAsyncData(loadChanges, [parentId], onError);

  const [targets, setTargets] = useState<ServiceTargets>({ units: [], referrers: [] });
  useEffect(() => {
    if (!canEdit) return;
    let cancelled = false;
    adminApi
      .serviceTargets()
      .then(t => !cancelled && setTargets(t))
      .catch(() => {
        // 讀不到選項：改派那一列就沒有東西可選，紀錄照畫。
      });
    return () => {
      cancelled = true;
    };
  }, [canEdit]);

  const [unitId, setUnitId] = useState<number | null>(service?.companyId ?? null);
  const [referrerId, setReferrerId] = useState<number | null>(service?.referrerId ?? null);
  // 存檔之後畫伺服器回的那一個：改到別的單位之後，這位家長會從重讀的列表裡消失，不能再靠列表那一列。
  const [shown, setShown] = useState<ServiceView>(service);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  const save = async () => {
    setSaving(true);
    setMessage('');
    try {
      const result = await adminApi.reassign(parentId, targetFromChoice(targets, unitId, referrerId));
      const r = result.relation;
      setShown(
        r === null
          ? null
          : {
              companyId: r.companyId,
              companyName: targets.units.find(u => u.id === r.companyId)?.name ?? null,
              referrerId: r.referrerId,
              referrerName: r.referrerId === null ? null : targets.referrers.find(x => x.id === r.referrerId)?.name ?? null,
            }
      );
      setMessage(result.changed ? '已改好。' : '跟现在一样，没有改动。');
      changes.reload();
      onChanged();
    } catch (err: any) {
      setMessage(err?.message || '改派失败。');
    }
    setSaving(false);
  };

  return (
    <section className="border-t border-brand-stone px-5 py-4">
      <h4 className="flex items-center gap-1.5 text-xs font-bold text-brand-forest">
        <UserCheck size={13} className="text-brand-moss" />
        服务关系
      </h4>
      <p className="mt-1 text-xs text-brand-charcoal/80">现在：{relationLabel(shown)}</p>

      {canEdit && (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs">
          <Select
            aria-label="合作单位"
            className="w-auto"
            value={unitId === null ? '' : String(unitId)}
            onChange={e => {
              setUnitId(e.target.value === '' ? null : Number(e.target.value));
              setReferrerId(null);
            }}
          >
            {(canRemove || unitId === null) && <option value="">森心康直属（没有服务关系）</option>}
            {targets.units.map(u => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </Select>
          <Select
            aria-label="推荐人"
            className="w-auto"
            disabled={unitId === null}
            value={referrerId === null ? '' : String(referrerId)}
            onChange={e => setReferrerId(e.target.value === '' ? null : Number(e.target.value))}
          >
            <option value="">还没标注</option>
            {referrerOptions(targets, unitId).map(r => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </Select>
          <Button variant="primary" busy={saving} disabled={saving || (unitId === null && !canRemove)} onClick={save}>
            保存
          </Button>
          {message && (
            <span className="text-brand-charcoal/70" role="status">
              {message}
            </span>
          )}
        </div>
      )}

      <h5 className="mt-4 flex items-center gap-1.5 text-[11px] font-bold text-brand-charcoal/60">
        <History size={12} />
        改派纪录
      </h5>
      {changes.loading ? (
        <Spinner />
      ) : changes.failure ? (
        <ErrorNote message={changes.failure} onRetry={changes.reload} />
      ) : (changes.data?.changes ?? []).length === 0 ? (
        <p className="mt-1 text-[11px] text-brand-charcoal/40">还没有改派过。</p>
      ) : (
        <ul className="mt-1 space-y-1 text-[11px] text-brand-charcoal/70">
          {changes.data!.changes.map(c => {
            const line = changeLine(targets, c);
            return (
              <li key={c.id}>
                {formatDateTime(c.createdAt)}　{line.from} → {line.to}　（{line.who}）
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
