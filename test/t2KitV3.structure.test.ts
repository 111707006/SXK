import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { KITV3_DIR, KITV3_ZIP, loadKitV3Zip, loadV3Source, renderKitV3Files } from '../scripts/t2/kitv3';
import { V3_RECIPES } from '../scripts/t2/kitv3-recipes';
import { isPureData } from '../scripts/t2/literals';
import { sameToolkitContent } from '../scripts/t2/extract';
import { RECOMMEND_CONFIG } from '../src/t2/recommend/config';

/**
 * 完整版題庫的地基（T2 v3 題庫規格 §3）：`src/t2/kitv3/<slug>.ts` 是腳本從客戶 zip 重跑的結果，逐位元一致。
 * 客戶的完整版 zip（2.7 MB，只有 HTML 與 docx，沒有影片）在 git 裡，CI 也跑得到。
 */

const ROOT = path.resolve(__dirname, '..');

describe('完整版題庫：抽取地基', () => {
  it('來源 zip 在 git 裡、讀得出 31 支網頁版（中文檔名沒設 UTF-8 旗標）', () => {
    expect(fs.existsSync(path.join(ROOT, KITV3_ZIP))).toBe(true);
    const html = [...loadKitV3Zip(ROOT).keys()].filter(k => k.includes('网页版/') && k.endsWith('.html'));
    expect(html.length).toBe(32); // 31 支＋HUB
  });

  it('每一支都收得到資料宣告（跨行字串相加也收得到）', () => {
    const zip = loadKitV3Zip(ROOT);
    for (const name of zip.keys()) {
      if (!name.includes('网页版/') || !name.endsWith('.html')) continue;
      const src = loadV3Source(zip, name.split('网页版/')[1]);
      expect(src.consts.size, name).toBeGreaterThan(0);
    }
  });

  it('純資料檢查：字串相加放行，識別字照樣擋', () => {
    expect(isPureData('"a"+\n"b"')).toBe(true);
    expect(isPureData('"a"+x')).toBe(false);
  });

  it('配方只認客規 T2 的代碼、slug 不重複', () => {
    const t2 = Object.entries(RECOMMEND_CONFIG.tools).filter(([, t]) => t.layer === 'T2').map(([c]) => c);
    for (const r of V3_RECIPES) expect(t2, r.code).toContain(r.code);
    expect(new Set(V3_RECIPES.map(r => r.slug)).size).toBe(V3_RECIPES.length);
  });

  it('客規 T2 的每一支都有配方（24 支）', () => {
    const t2 = Object.entries(RECOMMEND_CONFIG.tools).filter(([, t]) => t.layer === 'T2').map(([c]) => c);
    expect(t2).toHaveLength(24);
    expect(t2.filter(c => !V3_RECIPES.some(r => r.code === c))).toEqual([]);
  });

  it('每一份 src/t2/kitv3/<slug>.ts 與腳本重跑的結果一致（只容忍 CRLF）', () => {
    for (const [rel, text] of renderKitV3Files(ROOT, V3_RECIPES)) {
      const abs = path.join(ROOT, rel);
      expect(fs.existsSync(abs), rel).toBe(true);
      expect(sameToolkitContent(fs.readFileSync(abs, 'utf8'), text), `${rel}：重跑 npx tsx scripts/t2-extract-kitv3.ts`).toBe(true);
    }
    // 目錄裡沒有配方以外的產出檔（手寫的只有 types、index、lazy、score、submit）
    const handwritten = new Set(['types.ts', 'index.ts', 'lazy.ts', 'score.ts', 'submit.ts']);
    const produced = new Set(V3_RECIPES.map(r => `${r.slug}.ts`));
    for (const f of fs.readdirSync(path.join(ROOT, KITV3_DIR))) {
      if (!handwritten.has(f)) expect(produced.has(f), f).toBe(true);
    }
  });
});
