/**
 * 條款 Markdown 的畫法（`src/legal/markdown.ts`）：家長端條款彈窗與後台即時預覽共用，長相比照內建條款。
 * 一律組 React 元素，不用 innerHTML。
 */
import { parseLegalMarkdown, type LegalInline } from './markdown';

function Inline({ segs }: { segs: LegalInline[] }) {
  return (
    <>
      {segs.map((s, i) => (s.bold ? <strong key={i} className="text-brand-forest">{s.text}</strong> : <span key={i}>{s.text}</span>))}
    </>
  );
}

export default function LegalMarkdownView({ markdown }: { markdown: string }) {
  const blocks = parseLegalMarkdown(markdown);
  return (
    <div className="legal-markdown">
      {blocks.map((b, i) => {
        if (b.type === 'heading') {
          const cls =
            b.level === 1
              ? 'font-black text-brand-forest text-base mb-2 mt-4 first:mt-0'
              : b.level === 2
                ? 'font-black text-brand-forest text-sm mb-2 mt-4 first:mt-0'
                : 'font-bold text-brand-forest text-sm mb-1 mt-3 first:mt-0';
          return <h4 key={i} className={cls}><Inline segs={b.content} /></h4>;
        }
        if (b.type === 'list') {
          const items = b.items.map((it, j) => <li key={j}><Inline segs={it} /></li>);
          return b.ordered
            ? <ol key={i} className="list-decimal pl-5 mt-1 space-y-1.5">{items}</ol>
            : <ul key={i} className="list-disc pl-5 mt-1 space-y-1">{items}</ul>;
        }
        return (
          <p key={i} className="mt-2 first:mt-0">
            {b.lines.map((line, j) => (
              <span key={j}>
                {j > 0 && <br />}
                <Inline segs={line} />
              </span>
            ))}
          </p>
        );
      })}
    </div>
  );
}
