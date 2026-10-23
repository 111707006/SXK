import { readFileSync } from 'node:fs';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, it, expect } from 'vitest';
import { proxyFindings, readProxyInput } from '../src/t2/proxySnapshot';
import { dimensionColors, planPeriod } from '../src/t2/trainingPush';
import { ACTIVITY_SEED } from '../src/t2/activitySeed';
import { DIMENSION_CODES } from '../src/t2/types';
import { T2ReportSnapshot } from '../src/components/T2Report';

/**
 * 推薦人代填（#112）：輸入檢查、代填快照（紅黃綠＝T2 分級、標籤歸到它的維度）、推送規則排得出一期、
 * 報告頁標「由治疗师填写」；資料層那個交易的關鍵句（同一個鍵找家長、擋別人名下的、只第一次扣碼）。
 */

const NOW = new Date('2026-10-24T02:00:00Z');
const colors = Object.fromEntries(DIMENSION_CODES.map(d => [d, d === 'LANG' ? 'red' : d === 'ATT' ? 'yellow' : 'green']));
const body = { phone: '13900000001', child: { name: '小树', birthDate: '2022-10-01', gender: 'girl' }, colors, tags: ['lang.comprehension'], months: 3 };

describe('輸入', () => {
  it('讀得懂', () => {
    const input = readProxyInput(body, NOW);
    expect(input).toMatchObject({ phone: '13900000001', months: 3, tags: ['lang.comprehension'], child: { name: '小树', gender: 'girl' } });
  });

  it.each([
    [{ ...body, phone: '123' }, '手机号'],
    [{ ...body, child: { ...body.child, name: '' } }, '姓名'],
    [{ ...body, child: { ...body.child, birthDate: '2000-01-01' } }, '出生日期'],
    [{ ...body, child: { ...body.child, gender: 'x' } }, '性别'],
    [{ ...body, colors: { ...colors, LANG: 'blue' } }, '红、黄或绿'],
    [{ ...body, colors: { COG: 'red' } }, '红、黄或绿'],
    [{ ...body, tags: ['lang.not_a_tag'] }, '标签'],
    [{ ...body, months: 2 }, '1、3、6'],
  ])('不對就說哪裡不對（%#）', (b, word) => {
    const out = readProxyInput(b, NOW);
    expect('error' in out && out.error).toContain(word);
  });
});

describe('代填快照', () => {
  const input = readProxyInput(body, NOW) as Exclude<ReturnType<typeof readProxyInput>, { error: string }>;
  const findings = proxyFindings({ colors: input.colors, tags: input.tags, ageMonth: 48, sex: 'girl', now: NOW });

  it('紅黃綠＝refer／watch／clear；標籤歸到它的維度', () => {
    const lang = findings.dimensions.find(d => d.dimensionId === 'LANG')!;
    expect(lang).toMatchObject({ band: 'refer', tags: ['lang.comprehension'], t1Flag: 2 });
    expect(findings.dimensions.find(d => d.dimensionId === 'ATT')!.band).toBe('watch');
    expect(findings.dimensions.find(d => d.dimensionId === 'COG')).toMatchObject({ band: 'clear', tags: [] });
    expect(findings.toolkitVersion).toBe('proxy-20261023');
  });

  it('推送規則當作 T2 分級、排得出一期', () => {
    expect(dimensionColors(findings.dimensions).every(c => c.source === 't2')).toBe(true);
    const plan = planPeriod({ dimensions: findings.dimensions, ageMonth: 48, library: ACTIVITY_SEED });
    expect(plan.weeks.flat().filter(s => s.activityId)).toHaveLength(36);
  });

  it('報告頁：九宮格與「由治疗师填写」，顏色是治療師給的', () => {
    const html = renderToStaticMarkup(createElement(T2ReportSnapshot, {
      entry: { id: 1, createdAt: NOW.toISOString(), findings, prose: null, isAiGenerated: false, aiEngine: 'proxy' } as never,
    }));
    expect(html).toContain('由治疗师填写');
    expect(html).toContain('data-band="refer"');
    expect(html).toContain('data-band="watch"');
  });
});

describe('資料層的交易', () => {
  const src = readFileSync('src/admin/adminStore.ts', 'utf8');
  const fill = src.slice(src.indexOf('export async function proxyFill'));

  it('與登入同一個鍵找家長；找不到才建', () => {
    expect(fill).toContain('WHERE u.phone = ? AND u.company_id <=> ? LIMIT 1 FOR UPDATE');
    expect(fill).toContain("INSERT INTO users (phone, company_id) VALUES (?, ?)");
  });

  it('別人名下的：退回、一個字都不寫', () => {
    expect(fill).toMatch(/Number\(boundTo\) !== referrer\.id\) \{\s*await conn\.rollback\(\);\s*return \{ ok: false, reason: 'other' \};/);
  });

  it('只有第一次代填才扣碼、發使用權、綁定；沒有碼先產一組再用', () => {
    expect(fill).toContain("SELECT 1 FROM training_passes WHERE user_id = ? AND source = 'proxy' LIMIT 1");
    expect(fill).toContain('INSERT INTO redeem_batches (referrer_id, months, quantity, created_by) VALUES (?, ?, 1, ?)');
    expect(fill).toContain("INSERT IGNORE INTO referrer_bindings (user_id, referrer_id, source, ref_id) VALUES (?, ?, 'proxy', ?)");
  });

  it('中途失敗整個退回', () => {
    expect(fill).toMatch(/catch \(err\) \{\s*await conn\.rollback\(\);\s*throw err;/);
  });
});

describe('家長端', () => {
  it('代填過、沒做 T1：登入後直接到居家訓練（只帶一次）', () => {
    const app = readFileSync('src/App.tsx', 'utf8');
    expect(app).toContain("setCurrentView(v => (v === 'home' || v === 'dashboard' ? 'training' : v));");
  });
});
