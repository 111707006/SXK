/**
 * 後台「首页素材」（客戶 10/22，#87／#88）：開屏一張、首頁輪播多張。全站一套，只有全域管理員、只有專案 A。
 *
 * 上傳前就在瀏覽器擋格式與大小（伺服器照樣再擋一次）；短片的封面由這台瀏覽器抽一格另外傳（同示範片，
 * 主機不保證有 ffmpeg）。連結只收站內路徑或 https（`isSafeMediaLink`，與伺服器同一支）。每張素材旁邊畫一個
 * 手機比例的預覽框，上線前看得出有沒有被裁掉。伺服器開關 `HOME_MEDIA` 關著時整頁說一句「還沒開」。
 */
import { useCallback, useState } from 'react';
import { ArrowDown, ArrowUp, Upload } from 'lucide-react';
import { adminApi, AdminApiError } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import { readVideoInfo } from '../videoFrame';
import {
  HOME_MEDIA_TYPES,
  isSafeMediaLink,
  MAX_HOME_IMAGE_BYTES,
  MAX_HOME_VIDEO_BYTES,
  type HomeMediaItem,
  type HomeMediaKind,
  type HomeMediaSlot,
} from '../../homeMedia/shape';
import { Button, EmptyState, ErrorNote, Field, Panel, Spinner, TextInput, useAsyncData } from '../ui';

const SLOT_TITLE: Record<HomeMediaSlot, string> = { splash: '开屏', banner: '首页轮播' };
const SLOT_HINT: Record<HomeMediaSlot, string> = {
  splash: '家长每次打开网站先看到 3 秒，右上角可以跳过；只用启用中排在最前的那一张。',
  banner: '首页大图，5 秒换一张、可以左右滑；全部停用时首页照旧是固定示范片。',
};

/** 上傳前在瀏覽器先擋（伺服器照樣再擋）。回錯誤訊息，沒問題回 null。 */
export function precheckHomeMediaFile(file: { type: string; size: number }): { kind: HomeMediaKind } | { error: string } {
  const kind: HomeMediaKind | null = HOME_MEDIA_TYPES.video.includes(file.type) ? 'video' : HOME_MEDIA_TYPES.image.includes(file.type) ? 'image' : null;
  if (!kind) return { error: '只收 jpg、png 图片或 mp4 短片。' };
  const max = kind === 'video' ? MAX_HOME_VIDEO_BYTES : MAX_HOME_IMAGE_BYTES;
  if (file.size > max) return { error: `${kind === 'video' ? '短片' : '图片'}太大了（上限 ${max / 1024 / 1024} MB）。` };
  return { kind };
}

function Preview({ item, slot }: { item: HomeMediaItem; slot: HomeMediaSlot }) {
  // 開屏是整個手機畫面（9:19.5），輪播是首頁那張 16:9 的大卡。
  const frame = slot === 'splash' ? 'w-[96px] aspect-[9/19.5]' : 'w-[170px] aspect-video';
  return (
    <div className={`${frame} shrink-0 overflow-hidden rounded-xl border border-brand-stone bg-brand-cream`}>
      {item.kind === 'video' ? (
        <video src={item.url} poster={item.posterUrl ?? undefined} muted playsInline className="h-full w-full object-cover" />
      ) : (
        <img src={item.url} alt="" className="h-full w-full object-cover" />
      )}
    </div>
  );
}

function MediaRow({ item, slot, first, last, onChanged, onMove }: {
  item: HomeMediaItem;
  slot: HomeMediaSlot;
  first: boolean;
  last: boolean;
  onChanged: (item: HomeMediaItem) => void;
  onMove: (dir: -1 | 1) => void;
}) {
  const [link, setLink] = useState(item.link ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const linkOk = link === '' || isSafeMediaLink(link);
  const save = async (patch: { link?: string | null; active?: boolean }) => {
    setBusy(true);
    setError(null);
    try {
      onChanged((await adminApi.updateHomeMedia(item.id, patch)).item);
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败。');
    } finally {
      setBusy(false);
    }
  };
  return (
    <li id={`home-media-${item.id}`} className={`flex flex-wrap items-start gap-3 rounded-2xl border p-3 ${item.active ? 'border-brand-stone bg-white' : 'border-dashed border-brand-stone bg-brand-cream/40 opacity-70'}`}>
      <Preview item={item} slot={slot} />
      <div className="min-w-[220px] flex-1 space-y-2">
        <p className="text-[11px] text-brand-charcoal/60">
          #{item.id} · {item.kind === 'video' ? '短片' : '图片'} · {item.active ? '启用中' : '已停用'}
          {item.kind === 'video' && !item.posterUrl && ' · 还没有封面'}
        </p>
        <Field label="点下去去哪里（选填）" hint="站内路径（/ 开头，例如 /）或 https:// 网址；空着＝不连。">
          <TextInput value={link} onChange={e => setLink(e.target.value.trim())} placeholder="/ 或 https://…" />
        </Field>
        {!linkOk && <p className="text-[11px] font-bold text-red-700">连结只能填站内路径（/ 开头）或 https:// 网址。</p>}
        {error && <p className="text-[11px] font-bold text-red-700">{error}</p>}
        <div className="flex flex-wrap gap-2">
          <Button busy={busy} disabled={!linkOk || link === (item.link ?? '')} onClick={() => save({ link: link === '' ? null : link })}>保存连结</Button>
          <Button variant={item.active ? 'danger' : 'ghost'} busy={busy} onClick={() => save({ active: !item.active })}>{item.active ? '停用' : '重新启用'}</Button>
          <Button variant="ghost" disabled={first || busy} onClick={() => onMove(-1)} aria-label="往前"><ArrowUp size={12} /></Button>
          <Button variant="ghost" disabled={last || busy} onClick={() => onMove(1)} aria-label="往后"><ArrowDown size={12} /></Button>
        </div>
      </div>
    </li>
  );
}

export default function HomeMediaPanel({ onError }: { onError: (view: AdminErrorView) => void }) {
  const load = useCallback(async () => {
    try {
      return { items: (await adminApi.homeMedia()).items, off: false };
    } catch (err) {
      // 伺服器開關 HOME_MEDIA 關著：那幾支不註冊（404）。
      if (err instanceof AdminApiError && err.status === 404) return { items: [] as HomeMediaItem[], off: true };
      throw err;
    }
  }, []);
  const { data, loading, failure, reload } = useAsyncData(load, [], onError);
  const [items, setItems] = useState<HomeMediaItem[] | null>(null);
  const [uploading, setUploading] = useState<HomeMediaSlot | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const list = items ?? data?.items ?? [];

  const replace = (next: HomeMediaItem) => setItems(list.map(i => (i.id === next.id ? next : i)));

  const upload = async (slot: HomeMediaSlot, file: File) => {
    setUploadError(null);
    const check = precheckHomeMediaFile(file);
    if ('error' in check) {
      setUploadError(check.error);
      return;
    }
    setUploading(slot);
    try {
      let { item } = await adminApi.uploadHomeMedia(slot, check.kind, file);
      if (check.kind === 'video') {
        const info = await readVideoInfo(file);
        if (info.poster) item = (await adminApi.uploadHomeMediaPoster(item.id, info.poster)).item;
      }
      setItems([...list, item]);
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '上传失败。');
    } finally {
      setUploading(null);
    }
  };

  // 往前／往後：跟鄰居交換排序值（兩支 PATCH）。
  const move = async (slot: HomeMediaSlot, index: number, dir: -1 | 1) => {
    const inSlot = list.filter(i => i.slot === slot).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
    const a = inSlot[index];
    const b = inSlot[index + dir];
    if (!a || !b) return;
    try {
      const [na, nb] = await Promise.all([
        adminApi.updateHomeMedia(a.id, { sortOrder: b.sortOrder === a.sortOrder ? b.sortOrder + dir : b.sortOrder }),
        adminApi.updateHomeMedia(b.id, { sortOrder: a.sortOrder }),
      ]);
      setItems(list.map(i => (i.id === a.id ? na.item : i.id === b.id ? nb.item : i)));
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : '调整顺序失败。');
    }
  };

  if (loading) return <Spinner />;
  if (failure) return <ErrorNote message={failure} onRetry={reload} />;
  if (data?.off) {
    return (
      <Panel title="首页素材">
        <EmptyState title="首页素材还没开启" hint="伺服器开关 HOME_MEDIA 打开后，这里可以上传开屏与首页轮播。" />
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      {uploadError && <ErrorNote message={uploadError} />}
      {(['splash', 'banner'] as const).map(slot => {
        const inSlot = list.filter(i => i.slot === slot).sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
        return (
          <Panel
            key={slot}
            title={SLOT_TITLE[slot]}
            description={SLOT_HINT[slot]}
            action={
              <label className={`inline-flex cursor-pointer items-center gap-1.5 rounded-xl bg-brand-forest px-3.5 py-2 text-xs font-bold text-white ${uploading ? 'opacity-50' : ''}`}>
                <Upload size={12} /> {uploading === slot ? '上传中…' : '上传图片或短片'}
                <input
                  id={`home-media-upload-${slot}`}
                  type="file"
                  accept="image/jpeg,image/png,video/mp4"
                  className="sr-only"
                  disabled={uploading !== null}
                  onChange={e => {
                    const file = e.target.files?.[0];
                    e.target.value = '';
                    if (file) void upload(slot, file);
                  }}
                />
              </label>
            }
          >
            {inSlot.length === 0 ? (
              <EmptyState title={`还没有${SLOT_TITLE[slot]}素材`} hint="图片 jpg／png 2 MB 以内，短片 mp4 30 MB 以内。" />
            ) : (
              <ul className="space-y-2.5">
                {inSlot.map((item, i) => (
                  <MediaRow
                    key={item.id}
                    item={item}
                    slot={slot}
                    first={i === 0}
                    last={i === inSlot.length - 1}
                    onChanged={replace}
                    onMove={dir => void move(slot, i, dir)}
                  />
                ))}
              </ul>
            )}
          </Panel>
        );
      })}
    </div>
  );
}
