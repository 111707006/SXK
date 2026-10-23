import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { bandScores } from './helpers/t1Scores';

/**
 * 評估面板三欄、個人中心排序與商城開關（issue #85，`VITE_UI_1022`、`VITE_MALL_OPEN`）。
 */

const scores = bandScores(30, dim => (dim === 'language' ? 0 : dim === 'attention' ? 1 : 2));

async function load(env: Record<string, string>) {
  vi.resetModules();
  for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
  return import('../src/components/ledo/LedoDashboard');
}

async function renderDashboard(env: Record<string, string>, completedScores = scores) {
  const { default: LedoDashboard } = await load(env);
  return renderToStaticMarkup(createElement(LedoDashboard, {
    childName: '小树', completedScores, onSelectDimension: () => {}, onViewReport: () => {}, onStartT1Screening: () => {},
  }));
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe('1022 開著：評估面板', () => {
  it('還沒做：新叫法，沒有「会看哪些方面」與「点击亮的…」', async () => {
    const html = await renderDashboard({ VITE_UI_1022: '1' }, []);
    expect(html).toContain('先做一次 T1 儿少综合发展评估');
    expect(html).toContain('T1 儿少综合发展评估');
    expect(html).not.toContain('会看哪些方面');
    expect(html).not.toContain('点击高亮');
    expect(html).not.toContain('T3');
  });

  it('做完：九格三欄，需要支持的有「深度评估」，沒有「T2 自评量表 + T3 专项上传」', async () => {
    const html = await renderDashboard({ VITE_UI_1022: '1' });
    expect(html).toContain('id="ledo-dim-grid" class="grid grid-cols-3');
    expect(html.match(/id="ledo-dim-/g)).toHaveLength(10); // grid 本身＋九格
    expect(html.match(/>深度评估</g)).toHaveLength(2);
    expect(html).not.toContain('T2 自评量表');
    expect(html).not.toContain('先看这几项');
    expect(html).not.toContain('truncate');
  });
});

describe('關著照舊', () => {
  it('兩段清單、「会看哪些方面」', async () => {
    expect(await renderDashboard({ VITE_UI_1022: '0' })).toContain('先看这几项');
    expect(await renderDashboard({ VITE_UI_1022: '0' }, [])).toContain('会看哪些方面');
  });
});

describe('商城開關', () => {
  async function mall(env: Record<string, string>) {
    vi.resetModules();
    for (const [k, v] of Object.entries(env)) vi.stubEnv(k, v);
    return (await import('../src/productConfig')).PRODUCT.features.mall;
  }

  it('1022 開著：預設藏，VITE_MALL_OPEN=1 才出現', async () => {
    expect(await mall({ VITE_UI_1022: '1' })).toBe(false);
    expect(await mall({ VITE_UI_1022: '1', VITE_MALL_OPEN: '0' })).toBe(false);
    expect(await mall({ VITE_UI_1022: '1', VITE_MALL_OPEN: '1' })).toBe(true);
  });

  it('1022 關著：照舊開', async () => {
    expect(await mall({ VITE_UI_1022: '0' })).toBe(true);
  });

  it('導覽列、個人中心的訂單、商城頁都看同一個開關（直接到商城頁也到不了）', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain("...(PRODUCT.features.mall");
    expect(app).toContain('const mallOrdersSection = PRODUCT.features.mall ? (');
    expect(app).toContain("currentView === 'mall' && PRODUCT.features.mall ? (");
  });

  it('建置前擋認不得的值', () => {
    expect(readFileSync('vite.config.ts', 'utf8')).toMatch(/assertValidUi1022\(\);\s*assertValidMallOpen\(\);/);
  });
});

describe('個人中心', () => {
  it('1022：「已完成的评估成绩」排在商城訂單前面', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    const before = app.indexOf('{!PRODUCT.features.ui1022 && mallOrdersSection}');
    const scoresAt = app.indexOf('已完成的评估成绩', before);
    const after = app.indexOf('{PRODUCT.features.ui1022 && mallOrdersSection}');
    expect(before).toBeGreaterThan(-1);
    expect(scoresAt).toBeGreaterThan(before);
    expect(after).toBeGreaterThan(scoresAt);
  });
});
