/**
 * 合併專案 A 重複的手機號帳號，最後讓 A 的手機號唯一（#116，ADR-0020「後果 → 遷移」）。
 *
 * 執行入口是 `deploy/merge-duplicate-phones.mjs`（在主機上用 node 直接跑，與 `migrate.mjs` 一樣
 * 不需要 tsx）；這一份放規則與讀寫，連線由呼叫端給，測試給假的。
 *
 * 【規則】同一支手機號在 A 有兩個以上**啟用中**的帳號（`disabled_at IS NULL`）：
 *   - 恰好一個有報告／訂單（付款成功或已退款）／T2 作答或報告 → 保留它；
 *     都沒有 → 保留最早的（id 最小）。
 *   - 兩個以上都有 → 不自動合併，印出來留給人決定（資料要怎麼併沒有對的答案）。
 *   - 綁了不同的推薦人 → 也不自動合併（綁定以家長為主鍵，只能留一位）。
 *   - 被併掉的帳號：使用權（training_passes）、解鎖（unlocks，保留者已有同一種的那一列不搬 ——
 *     唯一鍵會撞）、推薦人綁定（保留者還沒有才搬）改掛到保留者；本身寫 `disabled_at`、`merged_into`。
 *     其他資料（筛查档案、兑换码与优惠券的使用纪录…）一列不動、不刪，留在停用的帳號上。
 *
 * 【可重跑】停用過的帳號不再算重複；唯一鍵已經在就不再加。
 * 【唯一鍵】只在 A：生成欄位 `active_phone`（停用的帳號是 NULL）上的 `uk_a_active_phone`。
 * 還有要人決定的組時不加 —— 加了也會因重複而失敗。B 照舊是（歸屬，手機號）唯一，這支不在 B 跑。
 */

/**
 * @typedef {{
 *   id: number, phone: string, companyId: number | null, createdAt: string,
 *   reports: number, paidOrders: number, t2Results: number, t2Findings: number,
 *   trainingPassIds: number[], unlocks: { id: number, key: string }[], bindingReferrerId: number | null,
 * }} MergeAccount
 * @typedef {{ id: number, trainingPassIds: number[], unlockIds: number[], unlocksLeft: number[], moveBinding: boolean }} MergeDrop
 * @typedef {{ phone: string, status: 'merge', keep: number, drops: MergeDrop[] }} MergeGroup
 * @typedef {{ phone: string, status: 'manual', reason: string, accounts: number[] }} ManualGroup
 * @typedef {MergeGroup | ManualGroup} PlanGroup
 */

/** 有沒有「人看得到的資料」：報告、訂單、T2 作答或報告。只有使用權與綁定不算。 */
/** @param {MergeAccount} a */
function hasData(a) {
  return a.reports > 0 || a.paidOrders > 0 || a.t2Results > 0 || a.t2Findings > 0;
}

/**
 * 每一支重複的手機號一組。只有一個帳號的手機號不出現。
 * @param {MergeAccount[]} accounts 啟用中的帳號
 * @returns {PlanGroup[]}
 */
export function planMerges(accounts) {
  /** @type {Map<string, MergeAccount[]>} */
  const byPhone = new Map();
  for (const a of accounts) {
    const list = byPhone.get(a.phone) ?? [];
    list.push(a);
    byPhone.set(a.phone, list);
  }

  /** @type {PlanGroup[]} */
  const groups = [];
  for (const [phone, list] of [...byPhone].sort(([a], [b]) => a.localeCompare(b))) {
    if (list.length < 2) continue;
    const sorted = [...list].sort((a, b) => a.id - b.id);
    const ids = sorted.map(a => a.id);

    const withData = sorted.filter(hasData);
    if (withData.length > 1) {
      groups.push({ phone, status: 'manual', reason: `${withData.map(a => `#${a.id}`).join('、')} 都有报告、订单或 T2 作答`, accounts: ids });
      continue;
    }
    const referrers = new Set(sorted.map(a => a.bindingReferrerId).filter(r => r !== null));
    if (referrers.size > 1) {
      groups.push({ phone, status: 'manual', reason: `绑了不同的推荐人（${[...referrers].join('、')}）`, accounts: ids });
      continue;
    }

    const keep = withData[0] ?? sorted[0];
    const keys = new Set(keep.unlocks.map(u => u.key));
    let hasBinding = keep.bindingReferrerId !== null;
    const drops = sorted.filter(a => a !== keep).map(a => {
      /** @type {number[]} */ const unlockIds = [];
      /** @type {number[]} */ const unlocksLeft = [];
      for (const u of a.unlocks) {
        if (keys.has(u.key)) unlocksLeft.push(u.id);
        else { keys.add(u.key); unlockIds.push(u.id); }
      }
      const moveBinding = !hasBinding && a.bindingReferrerId !== null;
      if (moveBinding) hasBinding = true;
      return { id: a.id, trainingPassIds: [...a.trainingPassIds], unlockIds, unlocksLeft, moveBinding };
    });
    groups.push({ phone, status: 'merge', keep: keep.id, drops });
  }
  return groups;
}

/** 印出來的手機號打碼：日誌會被貼來貼去。 */
/** @param {string} phone */
export function maskPhone(phone) {
  return phone.length >= 7 ? `${phone.slice(0, 3)}****${phone.slice(-4)}` : '****';
}

/** @param {number[]} ids */
const list = ids => ids.join(', ');

/**
 * 逐組印出保留哪個、搬哪些列。
 * @param {PlanGroup[]} groups
 * @param {Map<number, MergeAccount>} [byId] 有給就每個帳號多印一行概況
 * @returns {string[]}
 */
export function formatPlan(groups, byId) {
  /** @type {string[]} */
  const out = [];
  /** @param {number} id */
  const describe = id => {
    const a = byId?.get(id);
    if (!a) return `#${id}`;
    const from = a.companyId === null ? '未归属' : `归属公司 ${a.companyId}`;
    return `#${id}（${from}，建立 ${a.createdAt}；报告 ${a.reports}、订单 ${a.paidOrders}、T2 作答 ${a.t2Results}、T2 报告 ${a.t2Findings}、使用权 ${a.trainingPassIds.length}、解锁 ${a.unlocks.length}、推荐人 ${a.bindingReferrerId ?? '无'}）`;
  };
  for (const g of groups) {
    out.push(`手机号 ${maskPhone(g.phone)}`);
    if (g.status === 'manual') {
      out.push(`  ✗ 不自动合并：${g.reason}。请人工决定。`);
      for (const id of g.accounts) out.push(`    ${describe(id)}`);
      continue;
    }
    out.push(`  保留 ${describe(g.keep)}`);
    for (const d of g.drops) {
      out.push(`  停用 ${describe(d.id)}，并入 #${g.keep}`);
      if (d.trainingPassIds.length) out.push(`    搬 training_passes ${list(d.trainingPassIds)}`);
      if (d.unlockIds.length) out.push(`    搬 unlocks ${list(d.unlockIds)}`);
      if (d.unlocksLeft.length) out.push(`    不搬 unlocks ${list(d.unlocksLeft)}（#${g.keep} 已有同一种）`);
      if (d.moveBinding) out.push(`    搬 referrer_bindings（推荐人绑定）`);
      if (!d.trainingPassIds.length && !d.unlockIds.length && !d.moveBinding) out.push('    没有要搬的列');
    }
  }
  return out;
}

// ── 讀寫 ────────────────────────────────────────────────────────────
//
// 每句查詢開頭的 `/* tag */` 只是標記「這句在讀什麼」（測試的假連線靠它回資料），對 MySQL 是註解。

export const PHONE_UNIQUE_STATEMENTS = [
  'ALTER TABLE `users` ADD COLUMN `active_phone` VARCHAR(20) AS (IF(`disabled_at` IS NULL, `phone`, NULL)) VIRTUAL',
  'ALTER TABLE `users` ADD UNIQUE KEY `uk_a_active_phone` (`active_phone`)',
];

/** @param {any} conn @param {string} sql @param {any[]} [params] */
async function rows(conn, sql, params) {
  const [r] = await conn.query(sql, params);
  return Array.isArray(r) ? r : [];
}

/**
 * 讀出重複手機號的啟用帳號與各自的資料。給了 `phone` 就只讀那一支、並鎖住那幾列（交易裡用）。
 * @param {any} conn
 * @param {string} [phone]
 * @returns {Promise<MergeAccount[]>}
 */
export async function loadAccounts(conn, phone) {
  const users = phone === undefined
    ? await rows(conn, `/* dup_users */ SELECT id, phone, company_id, created_at FROM users
        WHERE disabled_at IS NULL AND phone IN (
          SELECT phone FROM (SELECT phone FROM users WHERE disabled_at IS NULL AND phone IS NOT NULL GROUP BY phone HAVING COUNT(*) > 1) d
        ) ORDER BY phone, id`)
    : (await rows(conn, '/* dup_users */ SELECT id, phone, company_id, created_at FROM users WHERE disabled_at IS NULL AND phone = ? ORDER BY id FOR UPDATE', [phone]))
      .filter(u => u.phone === phone);
  if (users.length === 0) return [];
  const ids = users.map(u => Number(u.id));

  /** @param {string} tag @param {string} sql */
  const count = async (tag, sql) => {
    const m = new Map();
    for (const r of await rows(conn, `/* ${tag} */ ${sql}`, [ids])) m.set(Number(r.user_id), Number(r.n) || 0);
    return m;
  };
  const reports = await count('reports', 'SELECT user_id, COALESCE(JSON_LENGTH(report_history), 0) AS n FROM user_data WHERE user_id IN (?)');
  const paid = await count('paid_orders', "SELECT user_id, COUNT(*) AS n FROM payments WHERE status IN ('success','refunded') AND user_id IN (?) GROUP BY user_id");
  const t2Results = await count('t2_results', 'SELECT user_id, COUNT(*) AS n FROM t2_tool_results WHERE user_id IN (?) GROUP BY user_id');
  const t2Findings = await count('t2_findings', 'SELECT user_id, COUNT(*) AS n FROM t2_findings WHERE user_id IN (?) GROUP BY user_id');
  const passes = await rows(conn, '/* training_passes */ SELECT id, user_id FROM training_passes WHERE user_id IN (?) ORDER BY id', [ids]);
  const unlocks = await rows(conn, '/* unlocks */ SELECT id, user_id, scope, entitlement_key FROM unlocks WHERE user_id IN (?) ORDER BY id', [ids]);
  const bindings = await rows(conn, '/* bindings */ SELECT user_id, referrer_id FROM referrer_bindings WHERE user_id IN (?)', [ids]);

  return users.map(u => {
    const id = Number(u.id);
    const binding = bindings.find(b => Number(b.user_id) === id);
    return {
      id,
      phone: String(u.phone),
      companyId: u.company_id === null || u.company_id === undefined ? null : Number(u.company_id),
      createdAt: String(u.created_at),
      reports: reports.get(id) ?? 0,
      paidOrders: paid.get(id) ?? 0,
      t2Results: t2Results.get(id) ?? 0,
      t2Findings: t2Findings.get(id) ?? 0,
      trainingPassIds: passes.filter(p => Number(p.user_id) === id).map(p => Number(p.id)),
      unlocks: unlocks.filter(x => Number(x.user_id) === id).map(x => ({ id: Number(x.id), key: `${x.scope}:${x.entitlement_key}` })),
      bindingReferrerId: binding ? Number(binding.referrer_id) : null,
    };
  });
}

/** 拼進 SQL 的只有資料庫讀回來的整數 id；不是整數就停。 @param {number[]} ids */
function intList(ids) {
  for (const id of ids) if (!Number.isSafeInteger(id) || id <= 0) throw new Error(`不是合法的 id：${id}`);
  return ids.join(', ');
}

/**
 * 一組一個交易。交易裡重讀、鎖住那幾列、重算一次：跟預演時不一樣（中間有人登入、做了報告）就整組不做。
 * @param {any} conn @param {MergeGroup} planned
 * @returns {Promise<boolean>} 做了沒有
 */
async function executeGroup(conn, planned) {
  await conn.beginTransaction();
  try {
    const [fresh] = planMerges(await loadAccounts(conn, planned.phone));
    if (!fresh || JSON.stringify(fresh) !== JSON.stringify(planned)) {
      await conn.rollback();
      return false;
    }
    const keep = intList([planned.keep]);
    for (const d of planned.drops) {
      const drop = intList([d.id]);
      if (d.trainingPassIds.length) await conn.query(`UPDATE training_passes SET user_id = ${keep} WHERE id IN (${intList(d.trainingPassIds)})`);
      if (d.unlockIds.length) await conn.query(`UPDATE unlocks SET user_id = ${keep} WHERE id IN (${intList(d.unlockIds)})`);
      if (d.moveBinding) await conn.query(`UPDATE referrer_bindings SET user_id = ${keep} WHERE user_id = ${drop}`);
      await conn.query(`UPDATE users SET disabled_at = NOW(), merged_into = ${keep} WHERE id = ${drop} AND disabled_at IS NULL`);
    }
    await conn.commit();
    return true;
  } catch (err) {
    await conn.rollback();
    throw err;
  }
}

/** @param {any} conn */
async function phoneUniqueExists(conn) {
  const [r] = await rows(conn, `/* phone_index */ SELECT COUNT(*) AS n FROM information_schema.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND INDEX_NAME = 'uk_a_active_phone'`);
  return Number(r?.n) > 0;
}

/**
 * 整支流程。`execute: false`（預演）只送 SELECT。
 * @param {any} conn
 * @param {{ execute: boolean, log: (line: string) => void }} opts
 * @returns {Promise<{ merged: number, manual: number, skipped: number, uniqueAdded: boolean }>}
 */
export async function runMergeDuplicatePhones(conn, { execute, log }) {
  const accounts = await loadAccounts(conn);
  const byId = new Map(accounts.map(a => [a.id, a]));
  const groups = planMerges(accounts);
  const manual = groups.filter(g => g.status === 'manual').length;

  if (groups.length === 0) log('没有重复的手机号。');
  else for (const line of formatPlan(groups, byId)) log(line);
  log('');

  let merged = 0;
  let skipped = 0;
  if (execute) {
    for (const g of groups) {
      if (g.status !== 'merge') continue;
      if (await executeGroup(conn, g)) { merged++; log(`✓ ${maskPhone(g.phone)} 已合并到 #${g.keep}`); }
      else { skipped++; log(`· ${maskPhone(g.phone)} 资料在预演之后变了，这一组没做；再跑一次看新的结果。`); }
    }
  }

  let uniqueAdded = false;
  if (await phoneUniqueExists(conn)) {
    log('A 的手机号唯一键（uk_a_active_phone）已经在了。');
  } else if (manual > 0 || skipped > 0) {
    log(`还有 ${manual + skipped} 组没合并，先不加手机号唯一键；处理完再跑一次。`);
  } else if (!execute) {
    log('预演：执行时会在合并之后加上 A 的手机号唯一键（uk_a_active_phone）。这次没有写入任何东西。');
  } else {
    for (const sql of PHONE_UNIQUE_STATEMENTS) {
      try {
        await conn.query(sql);
      } catch (err) {
        // 上一次跑到一半：欄位已經在，接著加索引。
        if (/** @type {any} */ (err)?.code !== 'ER_DUP_FIELDNAME') throw err;
      }
    }
    uniqueAdded = true;
    log('✓ 已加上 A 的手机号唯一键（uk_a_active_phone）。');
  }
  return { merged, manual, skipped, uniqueAdded };
}
