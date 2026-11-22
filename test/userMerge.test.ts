import { describe, it, expect } from 'vitest';
import { planMerges, formatPlan, runMergeDuplicatePhones } from '../deploy/userMerge.mjs';

/**
 * 合併專案 A 重複的手機號帳號（#116，ADR-0020「後果 → 遷移」）。
 * 規則：保留有報告／訂單／T2 作答的那一個，把另一個的使用權、推薦人綁定搬過去、停用；
 * 兩個以上都有資料不自動合併，留給人決定。
 */

type Acc = Parameters<typeof planMerges>[0][number];

function acc(id: number, over: Partial<Acc> = {}): Acc {
  return {
    id,
    phone: '13800001234',
    companyId: null,
    createdAt: '2026-10-01 10:00:00',
    reports: 0,
    paidOrders: 0,
    t2Results: 0,
    t2Findings: 0,
    trainingPassIds: [],
    unlocks: [],
    bindingReferrerId: null,
    ...over,
  };
}

describe('planMerges', () => {
  // 正式站那一組：#9 公網註冊、資料都在這裡；#13 從治療師的連結進來，只有使用權與綁定。
  it('保留有資料的那一個，另一個的使用權與綁定搬過去', () => {
    const [group] = planMerges([
      acc(9, { reports: 2, paidOrders: 1, t2Results: 3 }),
      acc(13, { companyId: 5, trainingPassIds: [40, 41], bindingReferrerId: 7 }),
    ]);
    expect(group).toEqual({
      phone: '13800001234',
      status: 'merge',
      keep: 9,
      drops: [{ id: 13, trainingPassIds: [40, 41], unlockIds: [], unlocksLeft: [], moveBinding: true }],
    });
  });

  it('有資料的那一個 id 比較大也照樣保留它', () => {
    const [group] = planMerges([acc(3), acc(8, { t2Findings: 1 })]);
    expect(group).toMatchObject({ status: 'merge', keep: 8, drops: [{ id: 3 }] });
  });

  it('兩個都有報告或訂單：不自動合併，留給人決定', () => {
    const [group] = planMerges([acc(9, { reports: 1 }), acc(13, { paidOrders: 1 })]);
    expect(group).toMatchObject({ status: 'manual', accounts: [9, 13] });
    expect(group.status === 'manual' && group.reason).toContain('都有');
  });

  it('都沒有資料：保留最早的那一個', () => {
    const [group] = planMerges([acc(21), acc(20)]);
    expect(group).toMatchObject({ status: 'merge', keep: 20, drops: [{ id: 21 }] });
  });

  it('只有一個帳號的手機號不出現', () => {
    expect(planMerges([acc(1), acc(2, { phone: '13900000000' })])).toEqual([]);
  });

  it('保留者已經有同一種解鎖：那一列不搬（唯一鍵會撞），留在停用帳號上', () => {
    const [group] = planMerges([
      acc(9, { reports: 1, unlocks: [{ id: 1, key: 't2:*' }] }),
      acc(13, { unlocks: [{ id: 2, key: 't2:*' }, { id: 3, key: 't3:motor' }] }),
    ]);
    expect(group).toMatchObject({ status: 'merge', drops: [{ unlockIds: [3], unlocksLeft: [2] }] });
  });

  it('保留者已經綁了推薦人、而且是同一位：綁定不搬', () => {
    const [group] = planMerges([acc(9, { reports: 1, bindingReferrerId: 7 }), acc(13, { bindingReferrerId: 7 })]);
    expect(group).toMatchObject({ status: 'merge', drops: [{ moveBinding: false }] });
  });

  it('兩個帳號綁了不同的推薦人：不自動合併', () => {
    const [group] = planMerges([acc(9, { reports: 1, bindingReferrerId: 7 }), acc(13, { bindingReferrerId: 8 })]);
    expect(group).toMatchObject({ status: 'manual' });
    expect(group.status === 'manual' && group.reason).toContain('推荐人');
  });

  it('三個帳號：兩個沒資料的都併進有資料的那一個，綁定只搬一次', () => {
    const [group] = planMerges([
      acc(2, { bindingReferrerId: 7 }),
      acc(5, { reports: 1 }),
      acc(9, { bindingReferrerId: 7, unlocks: [{ id: 4, key: 't2:*' }] }),
    ]);
    expect(group).toMatchObject({
      status: 'merge',
      keep: 5,
      drops: [
        { id: 2, moveBinding: true },
        { id: 9, moveBinding: false, unlockIds: [4] },
      ],
    });
  });
});

describe('formatPlan', () => {
  it('逐組印出保留哪個、搬哪些列；手機號打碼', () => {
    const text = formatPlan(planMerges([
      acc(9, { reports: 2 }),
      acc(13, { companyId: 5, trainingPassIds: [40], bindingReferrerId: 7 }),
    ])).join('\n');
    expect(text).toContain('138****1234');
    expect(text).not.toContain('13800001234');
    expect(text).toMatch(/保留 #9/);
    expect(text).toMatch(/#13/);
    expect(text).toContain('training_passes 40');
    expect(text).toContain('referrer_bindings');
  });

  it('要人決定的那一組寫明原因', () => {
    const text = formatPlan(planMerges([acc(9, { reports: 1 }), acc(13, { paidOrders: 1 })])).join('\n');
    expect(text).toContain('不自动合并');
  });
});

/**
 * 跑整支：連線是假的，只認「這一句在讀什麼」（每句查詢開頭的 `/* tag *\/`）。
 * 要證明的是預演一句寫入都不送、執行才送，以及唯一鍵只在沒有待決的組時才加。
 */
function fakeConn(rows: Record<string, any[]>) {
  const sent: string[] = [];
  const conn = {
    async query(sql: string) {
      sent.push(sql);
      const tag = /^\s*\/\*\s*(\w+)\s*\*\//.exec(sql)?.[1];
      if (tag && tag in rows) return [rows[tag]];
      return [[]];
    },
    async beginTransaction() { sent.push('BEGIN'); },
    async commit() { sent.push('COMMIT'); },
    async rollback() { sent.push('ROLLBACK'); },
  };
  return { conn, sent };
}

const writes = (sent: string[]) => sent.filter(s => !/^\s*(\/\*\s*\w+\s*\*\/\s*)?SELECT/i.test(s));

function dupRows() {
  return {
    dup_users: [
      { id: 9, phone: '13800001234', company_id: null, created_at: '2026-10-01' },
      { id: 13, phone: '13800001234', company_id: 5, created_at: '2026-11-01' },
    ],
    reports: [{ user_id: 9, n: 2 }],
    paid_orders: [],
    t2_results: [],
    t2_findings: [],
    training_passes: [{ id: 40, user_id: 13 }],
    unlocks: [],
    bindings: [{ user_id: 13, referrer_id: 7 }],
    phone_index: [],
  };
}

describe('runMergeDuplicatePhones', () => {
  it('預演：不送任何寫入', async () => {
    const { conn, sent } = fakeConn(dupRows());
    const lines: string[] = [];
    await runMergeDuplicatePhones(conn, { execute: false, log: l => lines.push(l) });
    expect(writes(sent)).toEqual([]);
    expect(lines.join('\n')).toMatch(/保留 #9/);
  });

  it('執行：一組一個交易，搬使用權與綁定、停用另一個，最後加 A 的手機號唯一鍵', async () => {
    const { conn, sent } = fakeConn(dupRows());
    await runMergeDuplicatePhones(conn, { execute: true, log: () => {} });
    const w = writes(sent).join('\n');
    expect(w).toMatch(/BEGIN[\s\S]*UPDATE training_passes SET user_id = 9 WHERE id IN \(40\)[\s\S]*UPDATE referrer_bindings SET user_id = 9 WHERE user_id = 13[\s\S]*UPDATE users SET disabled_at = NOW\(\), merged_into = 9 WHERE id = 13 AND disabled_at IS NULL[\s\S]*COMMIT/);
    expect(w).toContain('ADD UNIQUE KEY `uk_a_active_phone` (`active_phone`)');
  });

  it('還有要人決定的組：照樣合併其他組，但不加唯一鍵', async () => {
    const rows = dupRows();
    rows.paid_orders = [{ user_id: 13, n: 1 }] as any;
    const { conn, sent } = fakeConn(rows);
    const lines: string[] = [];
    await runMergeDuplicatePhones(conn, { execute: true, log: l => lines.push(l) });
    expect(writes(sent).join('\n')).not.toContain('uk_a_active_phone');
    expect(writes(sent).join('\n')).not.toContain('UPDATE users');
    expect(lines.join('\n')).toContain('唯一');
  });

  it('唯一鍵已經在：不再加（可重跑）', async () => {
    const rows = { ...dupRows(), dup_users: [], phone_index: [{ n: 1 }] };
    const { conn, sent } = fakeConn(rows);
    await runMergeDuplicatePhones(conn, { execute: true, log: () => {} });
    expect(writes(sent)).toEqual([]);
  });
});
