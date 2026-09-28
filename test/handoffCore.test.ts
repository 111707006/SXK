import { describe, it, expect } from 'vitest';
import {
  buildHandoffPayload,
  generateHandoffCode,
  handoffUrl,
  hashHandoffCode,
  isHandoffCodeShape,
  maskPhone,
  readHandoffPayload,
  resolveHandoffSourceConfig,
  resolveHandoffTargetConfig,
  secretMatches,
} from '../src/handoff/core';
import { latestT1ReportFor } from '../src/utils/reportResume';
import type { AssessmentRecord, DimensionScore } from '../src/types';

/**
 * B→A 交接的純函式（ADR-0009、docs/specs/b-to-a-handoff.md §1、§6、§7）。
 */

const SECRET = 'x'.repeat(40);

const score = (dimensionId: string, s: number, completedAt = '2026-09-28T01:00:00.000Z', tierId: 'T1' | 'T3' = 'T1'): DimensionScore => ({
  dimensionId,
  dimensionName: dimensionId,
  tierId,
  score: s,
  maxScore: 8,
  status: s <= 5 ? 'delay' : 'normal',
  completedAt,
});

const report = (id: string, scores: DimensionScore[], createdAt: string, withAi = true): AssessmentRecord => ({
  id,
  type: 'T1_SCREENING',
  child: { name: '小安', ageMonth: 30, gender: 'girl' },
  scores,
  ...(withAi ? { aiReport: { summary: id } as any } : {}),
  createdAt,
});

describe('交接碼', () => {
  it('32 位元組亂數、base64url 43 字；雜湊是 SHA-256 hex；兩次不一樣', () => {
    const a = generateHandoffCode();
    const b = generateHandoffCode();
    expect(isHandoffCodeShape(a.code)).toBe(true);
    expect(a.hash).toMatch(/^[0-9a-f]{64}$/);
    expect(a.hash).toBe(hashHandoffCode(a.code));
    expect(a.code).not.toBe(b.code);
  });

  it('形狀不對的一律不收（不拿去查資料庫）', () => {
    for (const v of ['', 'short', 'a'.repeat(44), 'a'.repeat(42) + '!', null, 123]) {
      expect(isHandoffCodeShape(v)).toBe(false);
    }
  });

  it('連結把碼放在網址片段，不放查詢字串', () => {
    expect(handoffUrl('https://sxkscreen.com', 'abc')).toBe('https://sxkscreen.com/handoff#code=abc');
  });

  it('密鑰比對：對的才過，長度不同也不丟錯', () => {
    expect(secretMatches(SECRET, SECRET)).toBe(true);
    expect(secretMatches('y'.repeat(40), SECRET)).toBe(false);
    expect(secretMatches('short', SECRET)).toBe(false);
    expect(secretMatches(null, SECRET)).toBe(false);
  });

  it('遮罩手機只留前三後四', () => {
    expect(maskPhone('13800138000')).toBe('138****8000');
    expect(maskPhone('abc')).toBe('****');
  });
});

describe('設定', () => {
  it('沒設密鑰＝功能關閉', () => {
    expect(resolveHandoffSourceConfig({})).toBeNull();
    expect(resolveHandoffTargetConfig({ HANDOFF_SOURCE_ORIGIN: 'http://127.0.0.1:5001' })).toBeNull();
  });

  it('發出端：密鑰＋A 的網址；同意版本有預設', () => {
    expect(resolveHandoffSourceConfig({ HANDOFF_SECRET: SECRET, HANDOFF_TARGET_ORIGIN: 'https://sxkscreen.com/' })).toEqual({
      secret: SECRET,
      targetOrigin: 'https://sxkscreen.com',
      consentVersion: 'handoff-consent-v1',
    });
  });

  it('接收端：密鑰＋B 的內部網址（本機可以是 http）', () => {
    expect(resolveHandoffTargetConfig({ HANDOFF_SECRET: SECRET, HANDOFF_SOURCE_ORIGIN: 'http://127.0.0.1:5001' })).toEqual({
      secret: SECRET,
      sourceOrigin: 'http://127.0.0.1:5001',
    });
  });

  // 設錯寧可起不來：交接缺一半等於沒開，而畫面上會有一顆按不動的按鈕。
  it.each([
    ['密鑰太短', { HANDOFF_SECRET: 'short', HANDOFF_TARGET_ORIGIN: 'https://sxkscreen.com' }],
    ['有密鑰沒網址', { HANDOFF_SECRET: SECRET }],
    ['對外網址是 http', { HANDOFF_SECRET: SECRET, HANDOFF_TARGET_ORIGIN: 'http://sxkscreen.com' }],
    ['網址帶路徑', { HANDOFF_SECRET: SECRET, HANDOFF_TARGET_ORIGIN: 'https://sxkscreen.com/app' }],
  ])('%s：丟錯', (_label, env) => {
    expect(() => resolveHandoffSourceConfig(env)).toThrow();
  });
});

describe('帶過去的那一包', () => {
  const t1 = [score('gross_motor', 4), score('language', 8)];

  it('成績只帶 T1；報告只帶對得上這組成績的最新一份', () => {
    const payload = buildHandoffPayload({
      phone: '13800138000',
      sourceUserId: 7,
      source: { companyId: 2, slug: 'fudan', name: '复旦' },
      child: { name: '小安' },
      completedScores: [...t1, score('language', 3, '2026-01-01T00:00:00.000Z', 'T3')],
      reportHistory: [
        report('old', [score('gross_motor', 6, '2026-08-01T00:00:00.000Z')], '2026-08-01T00:00:00.000Z'),
        report('match-early', t1, '2026-09-28T02:00:00.000Z'),
        report('match-late', t1, '2026-09-28T03:00:00.000Z'),
        report('no-ai', t1, '2026-09-28T04:00:00.000Z', false),
      ],
      kind: 'button',
      consentVersion: '2026-09-28',
    });
    expect(payload.completedScores).toEqual(t1);
    expect(payload.t1Report?.id).toBe('match-late');
  });

  it('與 App 接續即時報告是同一個規則（重做過 T1 就對不上）', () => {
    expect(latestT1ReportFor([report('r', t1, '2026-09-28T02:00:00.000Z')], t1)?.id).toBe('r');
    expect(latestT1ReportFor([report('r', t1, '2026-09-28T02:00:00.000Z')], [score('gross_motor', 4), score('language', 7)])).toBeNull();
  });

  it('接收端讀回來：形狀對才收', () => {
    const good = {
      phone: '13800138000', sourceUserId: 7, source: null, child: { name: '小安' },
      completedScores: t1, t1Report: null, kind: 'button', consentVersion: '2026-09-28',
    };
    expect(readHandoffPayload(good)).toEqual(good);
    for (const bad of [
      { ...good, phone: '123' },
      { ...good, sourceUserId: 0 },
      { ...good, source: { companyId: 'x' } },
      { ...good, child: null },
      { ...good, completedScores: [] },
      { ...good, kind: 'email' },
      null,
    ]) {
      expect(readHandoffPayload(bad)).toBeNull();
    }
  });
});
