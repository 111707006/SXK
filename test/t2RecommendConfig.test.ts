import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';
import { RECOMMEND_CONFIG_MODULE, RECOMMEND_DOCX, renderRecommendConfigModule } from '../scripts/t2/recommendConfig';
import { sameToolkitContent } from '../scripts/t2/extract';
import { RECOMMEND_CONFIG } from '../src/t2/recommend/config';
import { DIMENSION_CODES } from '../src/t2/types';

/**
 * 量表推薦設定（客規附錄 A）：`src/t2/recommend/config.ts` 是腳本從客規 docx 抽的，不手改（同題庫的護欄）。
 */

const ROOT = path.resolve(__dirname, '..');

describe('客規附錄 A → config.ts', () => {
  it('來源 docx 在 git 裡', () => {
    expect(fs.existsSync(path.join(ROOT, RECOMMEND_DOCX))).toBe(true);
  });

  it('config.ts 與腳本重跑的結果逐位元一致（只容忍 CRLF）', () => {
    const onDisk = fs.readFileSync(path.join(ROOT, RECOMMEND_CONFIG_MODULE), 'utf8');
    expect(sameToolkitContent(onDisk, renderRecommendConfigModule(ROOT)), '重跑 npx tsx scripts/t2-extract-recommend-config.ts').toBe(true);
  });

  it('31 份量表（24 份 T2＋7 份 T3）；每份的主次維度都是九維代碼、月齡區間合理', () => {
    const tools = Object.entries(RECOMMEND_CONFIG.tools);
    expect(tools).toHaveLength(31);
    expect(tools.filter(([, t]) => t.layer === 'T2')).toHaveLength(24);
    for (const [code, t] of tools) {
      for (const d of [...t.primary, ...t.secondary]) expect(DIMENSION_CODES, code).toContain(d);
      expect(t.minM, code).toBeLessThanOrEqual(t.maxM);
      expect(t.minutes, code).toBeGreaterThan(0);
    }
  });

  it('六種診斷＋NONE；必選量表都在量表庫裡；22 條關鍵題', () => {
    expect(Object.keys(RECOMMEND_CONFIG.dx).sort()).toEqual(['ASD', 'CP', 'EMO', 'GDD', 'LANG', 'LDADHD', 'NONE']);
    for (const p of Object.values(RECOMMEND_CONFIG.dx)) for (const c of p.must) expect(RECOMMEND_CONFIG.tools).toHaveProperty([c]);
    expect(RECOMMEND_CONFIG.keyItems).toHaveLength(22);
  });
});
