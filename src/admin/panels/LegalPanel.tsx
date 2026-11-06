/**
 * 後台「条款」（客戶 11/03 第 14 頁，開關 `LEGAL_DOCS`，只在專案 A、只有全域管理員）：
 * 服務及免責條款、隱私保護條款各一份 Markdown。左邊編輯（四顆工具鈕：標題、條列、粗體、換行），右邊即時預覽
 * ＝家長看到的樣子（同一支 `LegalMarkdownView`）。還沒存過的那一份從內建條款起頭（`src/legal/defaultMarkdown.ts`）。
 * 「最后更新日期」存檔時伺服器自動填；改了不要求家長重新勾同意。
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Bold, CornerDownLeft, Heading, List } from 'lucide-react';
import { adminApi, AdminApiError } from '../adminApi';
import type { AdminErrorView } from '../adminView';
import { PRODUCT } from '../../productConfig';
import LegalMarkdownView from '../../legal/LegalMarkdownView';
import { defaultLegalMarkdown } from '../../legal/defaultMarkdown';
import { insertLineBreak, toggleBullets, toggleHeading, wrapBold, type EditorState } from '../../legal/editorActions';
import { MAX_LEGAL_MARKDOWN_LENGTH, readLegalMarkdown } from '../../legal/markdown';
import { legalDateLabel, LEGAL_DOC_KEYS, type LegalDoc, type LegalDocKey, type LegalDocs } from '../../legal/shape';
import { Button, EmptyState, ErrorNote, Panel, Spinner, useAsyncData } from '../ui';

const DOC_TITLE: Record<LegalDocKey, string> = { service: '服务及免责条款', privacy: '隐私保护条款' };

function Editor({ docKey, saved, onSaved }: { docKey: LegalDocKey; saved: LegalDoc | null; onSaved: (doc: LegalDoc) => void }) {
  const initial = saved?.markdown ?? defaultLegalMarkdown(docKey, PRODUCT.brand);
  const [text, setText] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const ref = useRef<HTMLTextAreaElement>(null);
  const pendingSelection = useRef<{ start: number; end: number } | null>(null);

  useEffect(() => {
    const sel = pendingSelection.current;
    if (sel && ref.current) {
      ref.current.focus();
      ref.current.setSelectionRange(sel.start, sel.end);
      pendingSelection.current = null;
    }
  });

  const apply = (fn: (s: EditorState) => EditorState) => {
    const el = ref.current;
    const next = fn({ text, start: el?.selectionStart ?? text.length, end: el?.selectionEnd ?? text.length });
    pendingSelection.current = { start: next.start, end: next.end };
    setText(next.text);
    setNotice(null);
  };

  const check = readLegalMarkdown(text);
  const dirty = saved ? text !== saved.markdown : true;

  const save = async () => {
    if (!check.ok) return;
    setBusy(true);
    setError(null);
    try {
      const { doc } = await adminApi.saveLegalDoc(docKey, check.markdown);
      setText(doc.markdown);
      onSaved(doc);
      setNotice(`已存档。家长端从现在起看到这一版，最后更新日期：${legalDateLabel(doc.updatedAt)}。`);
    } catch (err) {
      setError(err instanceof Error ? err.message : '存档失败。');
    } finally {
      setBusy(false);
    }
  };

  const tools: Array<{ label: string; hint: string; icon: React.ReactNode; fn: (s: EditorState) => EditorState }> = [
    { label: '标题', hint: '把游标所在的那一行变成小标题（再按一次取消）', icon: <Heading size={12} />, fn: toggleHeading },
    { label: '条列', hint: '把选到的几行变成条列（每行前面一个圆点）', icon: <List size={12} />, fn: toggleBullets },
    { label: '粗体', hint: '把选到的字加粗', icon: <Bold size={12} />, fn: wrapBold },
    { label: '换行', hint: '在游标处换一行；要分成新的一段，空一行', icon: <CornerDownLeft size={12} />, fn: insertLineBreak },
  ];

  return (
    <Panel
      title={DOC_TITLE[docKey]}
      description={
        saved
          ? `家长端现在看到的是这里存的版本（最后更新日期：${legalDateLabel(saved.updatedAt)}）。存档时自动更新日期；改了不会要求家长重新勾选同意。`
          : '还没存过：家长端现在看到的是内建条款，下面已经帮你填好那一份。改完按「存档」后，家长端改用这里的版本，最后更新日期自动填存档那一天。'
      }
      action={
        <Button id={`legal-save-${docKey}`} busy={busy} disabled={!check.ok || !dirty} onClick={() => void save()}>
          存档
        </Button>
      }
    >
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5" role="toolbar" aria-label="排版工具">
            {tools.map(t => (
              <Button key={t.label} variant="ghost" title={t.hint} onMouseDown={e => e.preventDefault()} onClick={() => apply(t.fn)}>
                {t.icon} {t.label}
              </Button>
            ))}
          </div>
          <textarea
            id={`legal-editor-${docKey}`}
            ref={ref}
            value={text}
            onChange={e => {
              setText(e.target.value);
              setNotice(null);
            }}
            spellCheck={false}
            className="h-[60vh] min-h-[320px] w-full resize-y rounded-xl border border-brand-stone bg-brand-cream/40 px-3 py-2 font-mono text-xs leading-relaxed text-brand-charcoal outline-none focus:border-brand-moss"
          />
          <p className="text-[10px] leading-relaxed text-brand-charcoal/45">
            小技巧：一行开头打「## 」是标题、「- 」是条列、「1. 」是编号；字的前后各加「**」是粗体；空一行是新的一段。
            {' '}已用 {text.length} / {MAX_LEGAL_MARKDOWN_LENGTH} 字。
          </p>
          {!check.ok && <p className="text-[11px] font-bold text-red-700">{check.error}</p>}
          {error && <p className="text-[11px] font-bold text-red-700">{error}</p>}
          {notice && <p className="text-[11px] font-bold text-brand-forest">{notice}</p>}
        </div>
        <div className="space-y-2">
          <p className="text-[11px] font-bold text-brand-charcoal/70">预览（家长看到的样子）</p>
          <div id={`legal-preview-${docKey}`} className="h-[60vh] min-h-[320px] overflow-y-auto rounded-xl border border-brand-stone bg-white p-4 text-xs leading-relaxed text-brand-charcoal">
            <LegalMarkdownView markdown={text} />
            <div className="mt-4 border-t border-brand-stone/30 pt-3 text-center text-xs text-brand-charcoal/80">
              最后更新日期：{dirty ? '（存档后自动填）' : saved ? legalDateLabel(saved.updatedAt) : ''}
            </div>
          </div>
        </div>
      </div>
    </Panel>
  );
}

export default function LegalPanel({ onError }: { onError: (view: AdminErrorView) => void }) {
  const load = useCallback(async () => {
    try {
      return { docs: await adminApi.legalDocs(), off: false };
    } catch (err) {
      // 伺服器開關 LEGAL_DOCS 關著：那兩支不註冊（404）。
      if (err instanceof AdminApiError && err.status === 404) return { docs: null, off: true };
      throw err;
    }
  }, []);
  const { data, loading, failure, reload } = useAsyncData(load, [], onError);
  const [docs, setDocs] = useState<LegalDocs | null>(null);
  const [tab, setTab] = useState<LegalDocKey>('service');
  const current = docs ?? data?.docs ?? null;

  if (loading) return <Spinner />;
  if (failure) return <ErrorNote message={failure} onRetry={reload} />;
  if (data?.off || !current) {
    return (
      <Panel title="条款">
        <EmptyState title="条款编辑还没开启" hint="伺服器开关 LEGAL_DOCS 打开后，这里可以编辑服务及免责条款、隐私保护条款。" />
      </Panel>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex gap-2" role="tablist">
        {LEGAL_DOC_KEYS.map(k => (
          <Button key={k} id={`legal-tab-${k}`} role="tab" aria-selected={tab === k} variant={tab === k ? 'primary' : 'ghost'} onClick={() => setTab(k)}>
            {DOC_TITLE[k]}
          </Button>
        ))}
      </div>
      {/* key＝換一份就重新起頭（各自的草稿不互相帶過去；沒存的草稿切走會丟，存檔鈕在上面） */}
      <Editor key={tab} docKey={tab} saved={current[tab]} onSaved={doc => setDocs({ ...current, [tab]: doc })} />
    </div>
  );
}
