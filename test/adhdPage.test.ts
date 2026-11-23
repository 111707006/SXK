import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { ADHD_PAGE_FILE, PAGE_PROBES, bridgeTag, patchAdhdPage } from '../src/adhd/page';
import { buildAssessFiles } from '../src/adhd/pageFiles';

const ROOT = join(__dirname, '..');
const original = readFileSync(join(ROOT, ADHD_PAGE_FILE), 'utf8');

describe('成人 ADHD 頁面：客戶原檔＋一行 bridge', () => {
  it('站上那一份＝原檔在 </body> 前多一段 bridgeTag，其他位元組不動', () => {
    const { html, bridgeVersion } = buildAssessFiles(ROOT);
    const at = original.indexOf('</body>');
    expect(html).toBe(original.slice(0, at) + bridgeTag(bridgeVersion) + original.slice(at));
    expect(html.length - original.length).toBe(bridgeTag(bridgeVersion).length);
  });

  it('bridge 依賴的全域變數都在客戶原檔裡', () => {
    for (const p of PAGE_PROBES) expect(original.includes(p.text), p.name).toBe(true);
  });

  it('少一個探針就丟錯（客戶換版不會靜靜壞掉）', () => {
    const broken = original.replace('casePayload=function(){', 'casePayloadX=function(){');
    expect(() => patchAdhdPage(broken, 'abcdef012345')).toThrow(/casePayload/);
  });

  it('</body> 不是恰好一個就丟錯', () => {
    expect(() => patchAdhdPage(original.replace('</body>', ''), 'abcdef012345')).toThrow(/body/);
    expect(() => patchAdhdPage(original + '</body>', 'abcdef012345')).toThrow(/body/);
  });

  it('bridge 版本只收十六進位', () => {
    expect(() => bridgeTag('"><script>')).toThrow();
  });
});
