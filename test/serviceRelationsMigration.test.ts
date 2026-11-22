import { describe, it, expect } from 'vitest';
import { spawnSync } from 'child_process';
import fs from 'fs';
import os from 'os';
import path from 'path';
import {
  planReferrerUnits,
  planServiceRelations,
  runServiceRelationsMigration,
} from '../deploy/serviceRelationsMigration.mjs';

/**
 * 舊資料 → 服務關係（#123，ADR-0020「後果 → 遷移」）：
 * - 綁了推薦人的家長＝那位推薦人與他的單位（就算帳號歸屬另一家公司）
 * - 沒綁推薦人、帳號歸屬某家單位＝那個單位、推薦人空
 * - 未歸屬＝沒有服務關係
 * - 沒隸屬單位的推薦人每人建一個個人治療師單位並掛上；指名的合作公司改類型為個人治療師
 * 預演只送 SELECT；已有服務關係的家長不覆蓋；每筆寫一列紀錄（system／migration）。
 */

const COMPANIES = [
  { id: 5, name: '甲机构', slug: 'jia', kind: 'institution', active: 1 },
  { id: 6, name: '杨智翔', slug: 'yzx', kind: 'institution', active: 1 },
  { id: 8, name: '旧', slug: 'therapist-r12', kind: 'institution', active: 1 },
  { id: 9, name: '停用的', slug: 'off', kind: 'institution', active: 0 },
];
const REFERRERS = [
  { id: 10, name: '张老师', company_id: 5, active: 1 },
  { id: 11, name: '李渠道', company_id: null, active: 1 },
  { id: 12, name: '王老师', company_id: null, active: 0 },
];
const USERS = [
  { id: 101, phone: '13800000101', company_id: 5 }, // 歸屬甲、沒綁 → 甲／還沒標注
  { id: 102, phone: '13800000102', company_id: 6 }, // 歸屬杨、綁张 → 甲／张（歸屬與推薦人單位不同）
  { id: 103, phone: '13800000103', company_id: null }, // 未歸屬、綁李（李沒單位）→ 李的新單位／李
  { id: 104, phone: '13800000104', company_id: null }, // 未歸屬、沒綁 → 沒有服務關係
  { id: 105, phone: '13800000105', company_id: 5 }, // 已經有服務關係 → 不動
  { id: 106, phone: '13800000106', company_id: null }, // 綁停用的王（沒單位）→ 王的新單位、推薦人空
  { id: 107, phone: '13800000107', company_id: 9 }, // 歸屬停用的單位 → 沒有服務關係
];
const BINDINGS = [
  { user_id: 102, referrer_id: 10 },
  { user_id: 103, referrer_id: 11 },
  { user_id: 106, referrer_id: 12 },
];

const camelReferrers = REFERRERS.map(r => ({ id: r.id, name: r.name, companyId: r.company_id, active: r.active === 1 }));
const camelUsers = USERS.map(u => ({ id: u.id, phone: u.phone, companyId: u.company_id }));
const camelBindings = BINDINGS.map(b => ({ userId: b.user_id, referrerId: b.referrer_id }));
const camelCompanies = COMPANIES.map(c => ({ ...c, active: c.active === 1 }));

describe('planReferrerUnits', () => {
  it('沒有單位的推薦人（停用的也算）每人一個個人治療師單位；代號避開已有的', () => {
    expect(planReferrerUnits(camelReferrers, COMPANIES)).toEqual([
      { referrerId: 11, name: '李渠道', slug: 'therapist-r11' },
      { referrerId: 12, name: '王老师', slug: 'therapist-r12-2' },
    ]);
  });

  it('都有單位：不建', () => {
    expect(planReferrerUnits(camelReferrers.filter(r => r.companyId !== null), COMPANIES)).toEqual([]);
  });
});

describe('planServiceRelations', () => {
  const plan = planServiceRelations({ users: camelUsers, bindings: camelBindings, referrers: camelReferrers, companies: camelCompanies, existing: new Set([105]) });
  const of = (id: number) => plan.find(p => p.userId === id);

  it('歸屬某單位、沒綁推薦人：那個單位、推薦人空', () => {
    expect(of(101)).toMatchObject({ fromCompanyId: 5, boundReferrerId: null, to: { companyId: 5, referrerId: null } });
  });

  it('綁了推薦人：那位推薦人與他的單位，就算帳號歸屬另一家', () => {
    expect(of(102)).toMatchObject({ fromCompanyId: 6, boundReferrerId: 10, to: { companyId: 5, referrerId: 10 } });
  });

  it('綁的推薦人還沒有單位：掛到要替他建的那個單位（預演時還沒有編號）', () => {
    expect(of(103)).toMatchObject({ boundReferrerId: 11, to: { companyId: null, referrerId: 11 }, pendingUnitFor: 11 });
  });

  it('未歸屬、沒綁：沒有服務關係', () => {
    expect(of(104)).toMatchObject({ to: null });
  });

  it('綁的推薦人停用：掛到他的單位、推薦人空（review）', () => {
    expect(of(106)).toMatchObject({ boundReferrerId: 12, to: { companyId: null, referrerId: null }, pendingUnitFor: 12 });
  });

  it('要掛的單位停用：沒有服務關係（review）', () => {
    expect(of(107)).toMatchObject({ fromCompanyId: 9, to: null });
  });

  it('已經有服務關係：不在計畫裡（不覆蓋）', () => {
    expect(of(105)).toBeUndefined();
  });
});

function fakeConn(rows: Record<string, any[]>) {
  const sent: string[] = [];
  let nextId = 900;
  const conn = {
    async query(sql: string, params?: unknown[]): Promise<any[]> {
      sent.push(params?.length ? `${sql} ${JSON.stringify(params)}` : sql);
      const tag = /^\s*\/\*\s*(\w+)\s*\*\//.exec(sql)?.[1];
      if (tag && tag in rows) return [rows[tag]];
      if (/^\s*INSERT INTO companies/i.test(sql)) return [{ insertId: nextId++, affectedRows: 1 }];
      if (/^\s*(INSERT|UPDATE)/i.test(sql)) return [{ affectedRows: 1, insertId: 0 }];
      return [[]];
    },
    async beginTransaction() { sent.push('BEGIN'); },
    async commit() { sent.push('COMMIT'); },
    async rollback() { sent.push('ROLLBACK'); },
  };
  return { conn, sent };
}

const baseRows = () => ({
  companies: COMPANIES,
  referrers: REFERRERS,
  users: USERS,
  bindings: BINDINGS,
  relations: [{ user_id: 105 }],
});
const writes = (sent: string[]) => sent.filter(s => !/^\s*(\/\*\s*\w+\s*\*\/\s*)?SELECT/i.test(s) && !['BEGIN', 'COMMIT', 'ROLLBACK'].includes(s));

describe('runServiceRelationsMigration', () => {
  it('預演：只送 SELECT，逐位家長印原歸屬、原推薦人、新單位、新推薦人', async () => {
    const { conn, sent } = fakeConn(baseRows());
    const lines: string[] = [];
    const result = await runServiceRelationsMigration(conn, { execute: false, log: l => lines.push(l), therapistUnitIds: [6] });
    expect(writes(sent)).toEqual([]);
    const text = lines.join('\n');
    expect(text).toMatch(/#101 .*归属 甲机构\s.*推荐人 —\s.*→ 甲机构 · 还没标注/);
    expect(text).toMatch(/#102 .*归属 杨智翔\s.*推荐人 张老师\s.*→ 甲机构 · 张老师/);
    expect(text).toMatch(/#103 .*归属 未归属\s.*推荐人 李渠道\s.*→ （新建）李渠道 · 李渠道/);
    expect(text).toMatch(/#104 .*→ 没有服务关系（森心康直属）/);
    expect(text).not.toMatch(/#105 /);
    expect(text).toMatch(/杨智翔.*改为个人治疗师/);
    expect(result).toEqual({ unitsCreated: 0, therapistUnits: 0, attached: 0, direct: 2, skippedExisting: 1, planned: 4 });
  });

  it('執行：先改類型、建單位並掛上推薦人，再重讀推薦人、逐位寫服務關係與紀錄', async () => {
    const rows = baseRows();
    const { conn, sent } = fakeConn(rows);
    // 建好單位之後重讀推薦人：李、王有了單位
    let referrerReads = 0;
    const query = conn.query.bind(conn);
    conn.query = async (sql: string, params?: unknown[]) => {
      if (/\/\*\s*referrers\s*\*\//.test(sql) && referrerReads++ > 0) {
        sent.push(sql);
        return [REFERRERS.map(r => ({ ...r, company_id: r.company_id ?? (r.id === 11 ? 900 : 901) }))];
      }
      return query(sql, params);
    };
    const result = await runServiceRelationsMigration(conn, { execute: true, log: () => {}, therapistUnitIds: [6] });
    const w = writes(sent);
    expect(w[0]).toBe("UPDATE companies SET kind = 'therapist' WHERE id = ? AND kind <> 'therapist' [6]");
    expect(w).toContain(`INSERT INTO companies (name, slug, kind) VALUES (?, ?, 'therapist') ["李渠道","therapist-r11"]`);
    expect(w).toContain('UPDATE referrers SET company_id = ? WHERE id = ? AND company_id IS NULL [900,11]');
    expect(w).toContain('INSERT IGNORE INTO service_relations (user_id, company_id, referrer_id) VALUES (?, ?, ?) [102,5,10]');
    expect(w).toContain('INSERT IGNORE INTO service_relations (user_id, company_id, referrer_id) VALUES (?, ?, ?) [103,900,11]');
    expect(w).toContain(
      "INSERT INTO service_relation_changes (user_id, to_company_id, to_referrer_id, actor, reason) VALUES (?, ?, ?, 'system', 'migration') [102,5,10]"
    );
    expect(w.some(s => s.includes('[104'))).toBe(false);
    expect(w.some(s => s.includes('[105'))).toBe(false);
    expect(w).toContain('INSERT IGNORE INTO service_relations (user_id, company_id, referrer_id) VALUES (?, ?, ?) [106,901,null]');
    expect(result).toMatchObject({ unitsCreated: 2, therapistUnits: 1, attached: 4, direct: 2, skippedExisting: 1 });
  });

  it('執行時那位家長已經被別人掛上（INSERT IGNORE 沒寫進去）：不寫紀錄', async () => {
    const rows = baseRows();
    rows.referrers = REFERRERS.map(r => ({ ...r, company_id: r.company_id ?? 5 }));
    const { conn, sent } = fakeConn(rows);
    const query = conn.query.bind(conn);
    conn.query = async (sql: string, params?: unknown[]) =>
      /INSERT IGNORE INTO service_relations/.test(sql) ? (sent.push(sql), [{ affectedRows: 0 }]) : query(sql, params);
    const result = await runServiceRelationsMigration(conn, { execute: true, log: () => {}, therapistUnitIds: [] });
    expect(writes(sent).some(s => s.includes('service_relation_changes'))).toBe(false);
    expect(result.attached).toBe(0);
  });

  it('指名改類型的單位不存在：停下來，不寫任何東西', async () => {
    const { conn, sent } = fakeConn(baseRows());
    await expect(runServiceRelationsMigration(conn, { execute: true, log: () => {}, therapistUnitIds: [77] })).rejects.toThrow(/#77/);
    expect(writes(sent)).toEqual([]);
  });
});

describe('指令', () => {
  const ROOT = path.resolve(__dirname, '..');
  const run = (env: Record<string, string>, args: string[] = []) => {
    const cwd = fs.mkdtempSync(path.join(os.tmpdir(), 'svc-rel-'));
    return spawnSync(process.execPath, [path.join(ROOT, 'deploy/migrate-service-relations.mjs'), ...args], {
      cwd,
      env: { ...process.env, MYSQL_HOST: '', MYSQL_USER: '', MYSQL_PASSWORD: '', MYSQL_DATABASE: '', ...env },
      encoding: 'utf8',
    });
  };

  it('專案 B（APP_MODE 不是 full）：不跑', () => {
    const r = run({ APP_MODE: 't1only' });
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('APP_MODE');
  });

  it('--therapist-unit 後面不是編號：不跑', () => {
    const r = run({ APP_MODE: 'full' }, ['--therapist-unit', 'abc']);
    expect(r.status).not.toBe(0);
    expect(r.stderr).toContain('--therapist-unit');
  });
});
